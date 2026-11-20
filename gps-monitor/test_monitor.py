#!/usr/bin/env python3
"""Prove location publishes land in the database and identity fields do not."""

from __future__ import annotations

import json
import sqlite3
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import server


def request(url: str, method: str = "GET", body: bytes | None = None, content_type: str | None = None) -> tuple[int, bytes]:
    headers = {}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def must(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def run_checks(base: str, db_path: Path) -> None:
    status, health_body = request(f"{base}/health")
    health = json.loads(health_body)
    must(status == 200 and health["status"] == "ok", "health check failed")
    must(health["position_count"] == 0, "new database should have no fixes")

    status, page = request(base + "/")
    must(status == 200 and b"Route monitor" in page, "dashboard did not load")

    status, latest_body = request(f"{base}/api/latest")
    latest = json.loads(latest_body)
    ids = {asset["asset_id"] for asset in latest["assets"]}
    must(
        {"phone-demo", "bag-ship-01", "vehicle-cryo-01"} <= ids,
        "catalog assets missing before the first fix",
    )

    owntracks = {
        "_type": "location",
        "lat": 25.2048,
        "lon": 55.2708,
        "tst": 1710000000,
        "tid": "PH",
        "batt": 81,
        "acc": 6,
        "vel": 36,
        "cog": 180,
        "topic": "owntracks/PatientZero/phone-lab",
        "patient": "DoNotStore",
        "SSID": "clinic-wifi",
    }
    query = urllib.parse.urlencode({"u": "PatientZero", "d": "phone-lab"})
    status, body = request(
        f"{base}/pub?{query}",
        method="POST",
        body=json.dumps(owntracks).encode("utf-8"),
        content_type="application/json",
    )
    must(status == 200 and body == b"[]", f"OwnTracks publish failed: {status} {body!r}")

    status, ignored = request(
        f"{base}/pub?d=phone-lab",
        method="POST",
        body=json.dumps({"_type": "status", "patient": "DoNotStore"}).encode("utf-8"),
        content_type="application/json",
    )
    must(status == 200 and ignored == b"[]", "non-location OwnTracks payload was not ignored")

    status, bad = request(
        f"{base}/pub?d=phone-lab",
        method="POST",
        body=json.dumps({"_type": "location", "lat": 95, "lon": 0, "tst": 1710000000}).encode("utf-8"),
        content_type="application/json",
    )
    must(status == 400, "out-of-range latitude should be rejected")

    status, named = request(
        f"{base}/pub?d=Jane%20Doe",
        method="POST",
        body=json.dumps({"_type": "location", "lat": 25.2, "lon": 55.2, "tst": 1710000001}).encode("utf-8"),
        content_type="application/json",
    )
    must(status == 400, "a device id with a space should be rejected")

    osmand = urllib.parse.urlencode(
        {
            "id": "vehicle-test",
            "lat": "25.1100",
            "lon": "55.2000",
            "timestamp": "1710000300",
            "speed": "10",
            "bearing": "90",
            "accuracy": "14",
            "batt": "64",
            "patient": "DoNotStore",
            "cell": "208,10,12345,67890,50",
            "wifi": "00:11:22:33:44:55,-70",
        }
    )
    status, empty = request(f"{base}/osmand?{osmand}")
    must(status == 200 and empty == b"", f"OsmAnd publish failed: {status} {empty!r}")

    form = urllib.parse.urlencode(
        {
            "id": "bag-form-01",
            "lat": "25.1200",
            "lon": "55.2100",
            "timestamp": "1710000400",
            "batt": "70",
            "patient": "DoNotStore",
        }
    )
    status, empty = request(
        base + "/",
        method="POST",
        body=form.encode("utf-8"),
        content_type="application/x-www-form-urlencoded",
    )
    must(status == 200 and empty == b"", "Traccar form POST to / failed")

    traccar_json = {
        "device_id": "phone-json-01",
        "patient": "DoNotStore",
        "location": {
            "timestamp": "2026-06-10T13:34:02.733Z",
            "coords": {
                "latitude": 25.1300,
                "longitude": 55.2200,
                "accuracy": 12.18,
                "speed": 0.24,
                "heading": 100.0,
                "altitude": 12.0,
            },
            "battery": {"level": 0.69, "is_charging": False},
        },
    }
    status, empty = request(
        base + "/",
        method="POST",
        body=json.dumps(traccar_json).encode("utf-8"),
        content_type="application/json",
    )
    must(status == 200 and empty == b"", "Traccar JSON publish failed")

    root_fix = urllib.parse.urlencode(
        {"id": "phone-root", "lat": "25.1400", "lon": "55.2250", "timestamp": "1710000500"}
    )
    status, empty = request(f"{base}/?{root_fix}")
    must(status == 200 and empty == b"", "GET /?id=&lat=&lon= should record a fix")

    browser_fix = {
        "asset_id": "phone-browser",
        "lat": 24.5236,
        "lon": 54.4344,
        "accuracy": 12,
        "speed": 1.5,
        "heading": 90,
        "recorded_at": "2026-11-19T16:41:49Z",
        "patient": "DoNotStore",
    }
    status, stored = request(
        f"{base}/api/fix",
        method="POST",
        body=json.dumps(browser_fix).encode("utf-8"),
        content_type="application/json",
    )
    must(status == 200 and json.loads(stored)["stored"] is True, "browser fix was not stored")
    status, track_page = request(f"{base}/track")
    must(status == 200 and b"Share this phone" in track_page, "phone tracking page did not load")

    status, latest_body = request(f"{base}/api/latest")
    latest = json.loads(latest_body)
    by_id = {asset["asset_id"]: asset for asset in latest["assets"]}
    phone = by_id["phone-lab"]["last"]
    must(abs(phone["lat"] - 25.2048) < 1e-6, "OwnTracks latitude was not stored")
    must(phone["speed_kmh"] == 36, "OwnTracks speed should stay in km/h")
    must(phone["battery_pct"] == 81, "OwnTracks battery was not stored")
    must(phone["source"] == "owntracks", "OwnTracks source was not recorded")

    vehicle = by_id["vehicle-test"]["last"]
    must(abs(vehicle["speed_kmh"] - 18.52) < 0.02, f"OsmAnd knots were not converted: {vehicle['speed_kmh']}")
    must(vehicle["course_deg"] == 90, "OsmAnd bearing was not stored")
    must(vehicle["source"] == "osmand", "OsmAnd source was not recorded")

    phone_json = by_id["phone-json-01"]["last"]
    must(abs(phone_json["speed_kmh"] - 0.864) < 0.02, "JSON client speed should be m/s converted to km/h")
    must(phone_json["battery_pct"] == 69, "JSON battery fraction should become percent")
    must(phone_json["source"] == "traccar-client", "JSON client source was not recorded")
    must("bag-form-01" in by_id and "phone-root" in by_id, "form and root publishes were missed")
    browser = by_id["phone-browser"]["last"]
    must(abs(browser["lat"] - 24.5236) < 1e-6, "browser latitude was not stored")
    must(abs(browser["speed_kmh"] - 5.4) < 0.02, "browser speed should be converted from m/s")
    must(browser["source"] == "browser", "browser source was not recorded")

    raw_api = latest_body.decode("utf-8")
    blob = db_path.read_bytes()
    for secret in (b"PatientZero", b"DoNotStore", b"clinic-wifi", b"208,10,12345", b"00:11:22:33:44:55"):
        must(secret not in blob, f"{secret!r} leaked into the database file")
        must(secret.decode() not in raw_api, f"{secret!r} leaked into the API")

    columns = [
        row[1]
        for row in sqlite3.connect(db_path).execute("PRAGMA table_info(positions)")
    ]
    for forbidden in ("patient", "name", "ssid", "cell", "wifi"):
        must(forbidden not in columns, f"positions table has a {forbidden} column")

    status, cleared = request(f"{base}/api/demo/reset", method="POST", body=b"")
    must(status == 200 and json.loads(cleared)["cleared"] is True, "reset failed")
    status, health_body = request(f"{base}/health")
    must(json.loads(health_body)["position_count"] == 0, "reset left fixes behind")
    status, latest_body = request(f"{base}/api/latest")
    must(
        any(asset["asset_id"] == "phone-demo" for asset in json.loads(latest_body)["assets"]),
        "reset removed the asset catalog",
    )


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "positions.sqlite"
        httpd = server.serve("127.0.0.1", 0, db_path, token="")
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            run_checks(f"http://127.0.0.1:{port}", db_path)
        finally:
            httpd.shutdown()
            httpd.server_close()
    print("all checks passed")


if __name__ == "__main__":
    main()
