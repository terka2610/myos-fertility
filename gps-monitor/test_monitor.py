#!/usr/bin/env python3
"""Prove location publishes land in the database and identity fields do not."""

from __future__ import annotations

import base64
import json
import sqlite3
import tempfile
import threading
from datetime import timedelta
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import server


def request(
    url: str,
    method: str = "GET",
    body: bytes | None = None,
    content_type: str | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    headers = dict(headers or {})
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


def admin_post(base: str, path: str, token: str, payload: dict | None = None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Authorization": "Bearer " + token}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    return request(base + path, method="POST", body=body, headers=headers)


def issue_device_credential(base: str, master_token: str, asset_id: str) -> str:
    status, body = admin_post(
        base, "/api/device-credential", master_token, {"asset_id": asset_id}
    )
    must(status == 200, f"could not issue {asset_id} device credential: {status} {body!r}")
    result = json.loads(body)
    must(result["asset_id"] == asset_id and result["token"], "invalid device credential response")
    return result["token"]


def run_checks(base: str, db_path: Path, token: str) -> None:
    status, health_body = request(f"{base}/health")
    health = json.loads(health_body)
    must(status == 200 and health["status"] == "ok", "health check failed")
    must(health["position_count"] == 0, "new database should have no fixes")

    status, page = request(base + "/")
    must(
        status == 200
        and b"Route monitor" in page
        and b"api/operator/session" in page,
        "dashboard did not load or request its separate operator session",
    )

    status, latest_body = request(f"{base}/api/latest")
    latest = json.loads(latest_body)
    ids = {asset["asset_id"] for asset in latest["assets"]}
    must(
        {"phone-demo", "bag-ship-01", "vehicle-cryo-01"} <= ids,
        "catalog assets missing before the first fix",
    )
    status, public_map = request(f"{base}/api/latest")
    must(status == 200 and token.encode() not in public_map, "public map API exposed authorization")

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
    phone_credential = issue_device_credential(base, token, "phone-lab")
    status, _ = admin_post(
        base, "/api/device-credential", "incorrect-admin-authorization",
        {"asset_id": "phone-other"},
    )
    must(status == 401, "device credential endpoint accepted an invalid administrator authorization")
    status, _ = request(
        f"{base}/api/device-credential?token={urllib.parse.quote(token)}",
        method="POST",
        body=json.dumps({"asset_id": "phone-other"}).encode("utf-8"),
        content_type="application/json",
    )
    must(status == 401, "device credential endpoint accepted authorization from the URL")
    basic = "Basic " + base64.b64encode(f"phone:{phone_credential}".encode()).decode()
    status, body = request(
        f"{base}/pub?{query}",
        method="POST",
        body=json.dumps(owntracks).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": basic},
    )
    must(status == 200 and body == b"[]", f"OwnTracks publish failed: {status} {body!r}")

    status, _ = request(
        f"{base}/pub?d=phone-other",
        method="POST",
        body=json.dumps(owntracks).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": basic},
    )
    must(status == 401, "OwnTracks credential published under another asset code")

    status, ignored = request(
        f"{base}/pub?d=phone-lab",
        method="POST",
        body=json.dumps({"_type": "status", "patient": "DoNotStore"}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": basic},
    )
    must(status == 200 and ignored == b"[]", "non-location OwnTracks payload was not ignored")

    status, bad = request(
        f"{base}/pub?d=phone-lab",
        method="POST",
        body=json.dumps({"_type": "location", "lat": 95, "lon": 0, "tst": 1710000000}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": basic},
    )
    must(status == 400, "out-of-range latitude should be rejected")

    status, named = request(
        f"{base}/pub?d=Jane%20Doe",
        method="POST",
        body=json.dumps({"_type": "location", "lat": 25.2, "lon": 55.2, "tst": 1710000001}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": basic},
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
    vehicle_credential = issue_device_credential(base, token, "vehicle-test")
    status, empty = request(
        f"{base}/osmand?{osmand}",
        headers={"Authorization": "Bearer " + vehicle_credential},
    )
    must(status == 200 and empty == b"", f"OsmAnd publish failed: {empty!r}")
    wrong_osmand = urllib.parse.urlencode(
        {"id": "phone-other", "lat": "25.11", "lon": "55.2"}
    )
    status, _ = request(
        f"{base}/osmand?{wrong_osmand}",
        headers={"Authorization": "Bearer " + vehicle_credential},
    )
    must(status == 401, "OsmAnd credential published under another asset code")

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
        headers={
            "Authorization": "Bearer "
            + issue_device_credential(base, token, "bag-form-01")
        },
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
        headers={
            "Authorization": "Bearer "
            + issue_device_credential(base, token, "phone-json-01")
        },
    )
    must(status == 200 and empty == b"", "Traccar JSON publish failed")
    status, _ = request(
        base + "/",
        method="POST",
        body=json.dumps(dict(traccar_json, device_id="phone-other")).encode("utf-8"),
        content_type="application/json",
        headers={
            "Authorization": "Bearer "
            + issue_device_credential(base, token, "phone-json-01")
        },
    )
    must(status == 401, "Traccar JSON credential published under another asset code")

    root_fix = urllib.parse.urlencode(
        {"id": "phone-root", "lat": "25.1400", "lon": "55.2250", "timestamp": "1710000500"}
    )
    status, _ = request(f"{base}/?{root_fix}&token={urllib.parse.quote(token)}")
    must(status == 401, "administrator authorization uploaded as a device")
    status, empty = request(
        f"{base}/?{root_fix}",
        headers={
            "Authorization": "Bearer "
            + issue_device_credential(base, token, "phone-root")
        },
    )
    must(status == 200 and empty == b"", "GET /?id=&lat=&lon= should record a fix")
    query_credential = issue_device_credential(base, token, "phone-query")
    query_fix = urllib.parse.urlencode(
        {
            "id": "phone-query",
            "lat": "25.1500",
            "lon": "55.2300",
            "token": query_credential,
        }
    )
    status, empty = request(f"{base}/?{query_fix}")
    must(status == 200 and empty == b"", "scoped query-token upload failed")

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
    status, _ = request(
        f"{base}/api/fix",
        method="POST",
        body=json.dumps(browser_fix).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + token},
    )
    must(status == 401, "browser fix accepted the long-lived shared secret directly")
    status, session_body = request(
        f"{base}/api/share/session",
        method="POST",
        body=json.dumps({"asset_id": "phone-browser"}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + token},
    )
    must(status == 200, "browser session exchange failed")
    session = json.loads(session_body)
    must(session["expires_in"] > 0 and token not in session["token"], "browser session was not temporary")
    status, _ = request(
        f"{base}/api/fix",
        method="POST",
        body=json.dumps(browser_fix).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + session["token"] + "tampered"},
    )
    must(status == 401, "browser fix accepted a tampered session credential")
    status, stored = request(
        f"{base}/api/fix",
        method="POST",
        body=json.dumps(browser_fix).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + session["token"]},
    )
    must(status == 200 and json.loads(stored)["stored"] is True, "browser fix was not stored")
    status, _ = request(
        f"{base}/api/fix",
        method="POST",
        body=json.dumps({**browser_fix, "asset_id": "phone-demo"}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + session["token"]},
    )
    must(status == 403, "browser session updated an asset other than its selected device")
    history_fix = {
        "asset_id": "phone-demo",
        "lat": 25.25,
        "lon": 55.3,
        "recorded_at": "2026-11-19T16:41:49Z",
    }
    status, history_session_body = request(
        f"{base}/api/share/session",
        method="POST",
        body=json.dumps({"asset_id": "phone-demo"}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + token},
    )
    must(status == 200, "could not create scoped history session")
    history_session = json.loads(history_session_body)["token"]
    status, _ = request(
        f"{base}/api/fix",
        method="POST",
        body=json.dumps(history_fix).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + history_session},
    )
    must(status == 200, "could not create history for asset settings test")

    settings = {
        "label": "Renamed operator device",
        "kind": "vehicle",
        "enabled": False,
    }
    status, _ = request(
        f"{base}/api/assets/phone-demo",
        method="POST",
        body=json.dumps(settings).encode("utf-8"),
        content_type="application/json",
    )
    must(status == 401, "asset settings changed without an operator session")
    status, operator_session_body = request(
        f"{base}/api/operator/session",
        method="POST",
        headers={"Authorization": "Bearer " + token},
    )
    must(status == 200, "operator session exchange failed")
    operator_session = json.loads(operator_session_body)["token"]
    status, operator_named_device_session_body = request(
        f"{base}/api/share/session",
        method="POST",
        body=json.dumps({"asset_id": "operator"}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + token},
    )
    must(status == 200, "could not create a session for the operator-named asset")
    operator_named_device_session = json.loads(operator_named_device_session_body)["token"]
    status, _ = request(
        f"{base}/api/fix",
        method="POST",
        body=json.dumps({"asset_id": "operator", "lat": 25.2, "lon": 55.2}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + operator_named_device_session},
    )
    must(status == 200, "browser session could not update the asset named operator")
    status, _ = request(
        f"{base}/api/fix",
        method="POST",
        body=json.dumps({"asset_id": "operator", "lat": 25.2, "lon": 55.2}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + operator_session},
    )
    must(status == 403, "operator session was mistaken for a device session")
    status, updated_body = request(
        f"{base}/api/assets/phone-demo",
        method="POST",
        body=json.dumps(settings).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + operator_session},
    )
    updated = json.loads(updated_body)
    must(status == 200 and updated["asset"]["enabled"] is False, "asset could not be hidden")
    server.init_db(db_path, server.load_catalog())
    status, latest_body = request(f"{base}/api/latest")
    hidden_assets = {item["asset_id"]: item for item in json.loads(latest_body)["assets"]}
    hidden = hidden_assets["phone-demo"]
    must(
        hidden["label"] == "Renamed operator device"
        and hidden["kind"] == "vehicle"
        and hidden["enabled"] is False,
        "operator asset settings did not persist after database initialization",
    )
    must(
        hidden["last"] is not None
        and len(hidden["trail"]) == 1
        and hidden["asset_id"] == "phone-demo",
        "renaming or hiding detached the asset from its location history",
    )
    settings["enabled"] = True
    status, enabled_body = request(
        f"{base}/api/assets/phone-demo",
        method="POST",
        body=json.dumps(settings).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + operator_session},
    )
    must(
        status == 200 and json.loads(enabled_body)["asset"]["enabled"] is True,
        "hidden asset could not be re-enabled",
    )
    status, track_page = request(f"{base}/track")
    must(
        status == 200
        and b"Share this phone" in track_page
        and b"JSON.stringify({ asset_id: assetInput.value.trim() })" in track_page
        and b"GPS_UPLOAD_TOKEN" not in track_page
        and token.encode() not in track_page,
        "phone tracking page did not load safely",
    )

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

    run_registration_checks(base, db_path, token)

    status, cleared = request(f"{base}/api/demo/reset", method="POST", body=b"")
    must(status == 200 and json.loads(cleared)["cleared"] is True, "reset failed")
    status, health_body = request(f"{base}/health")
    must(json.loads(health_body)["position_count"] == 0, "reset left fixes behind")
    status, latest_body = request(f"{base}/api/latest")
    must(
        any(asset["asset_id"] == "phone-demo" for asset in json.loads(latest_body)["assets"]),
        "reset removed the asset catalog",
    )


def run_registration_checks(base: str, db_path: Path, token: str) -> None:
    before = server.snapshot(db_path)
    payload = {"asset_id": "bag-registered", "label": "New shipper", "kind": "bag"}
    status, session_body = admin_post(base, "/api/operator/session", token)
    must(status == 200, "registration operator session failed")
    session = json.loads(session_body)["token"]
    status, device_session_body = admin_post(
        base, "/api/share/session", token, {"asset_id": payload["asset_id"]}
    )
    must(status == 200, "registration device session failed")
    device_session = json.loads(device_session_body)["token"]
    for credential, expected in (("", 401), (token, 401), (device_session, 403)):
        status, _ = admin_post(base, "/api/assets", credential, payload)
        must(status == expected, "registration accepted non-operator authorization")
    for invalid in (
        {**payload, "asset_id": value}
        for value in (None, 123, "", ".", "..", "bad/code", "bad code", "x" * 65)
    ):
        status, _ = admin_post(base, "/api/assets", session, invalid)
        must(status == 400, "registration accepted an invalid asset code")
    for key, value in (
        ("label", ""), ("label", "   "), ("label", "x" * 81),
        ("label", "bad\nlabel"), ("label", None),
        ("kind", "unknown"), ("kind", None),
    ):
        status, _ = admin_post(base, "/api/assets", session, {**payload, key: value})
        must(status == 400, "registration accepted invalid metadata")
    for raw in (b"{", b"[]"):
        status, _ = request(
            base + "/api/assets", method="POST", body=raw,
            content_type="application/json",
            headers={"Authorization": "Bearer " + session},
        )
        must(status == 400, "registration accepted invalid JSON")

    status, created_body = admin_post(base, "/api/assets", session, payload)
    must(status == 201, "operator could not register a tracker")
    must(
        json.loads(created_body)["asset"] == {**payload, "enabled": True},
        "registration returned incorrect metadata",
    )
    for duplicate in (payload["asset_id"], " " + payload["asset_id"] + " ", before["assets"][0]["asset_id"]):
        status, _ = admin_post(base, "/api/assets", session, {**payload, "asset_id": duplicate})
        must(status == 409, "registration overwrote an existing asset")

    server.init_db(db_path, server.load_catalog())
    status, latest_body = request(base + "/api/latest")
    must(status == 200, "registered tracker list unavailable")
    latest = json.loads(latest_body)
    registered = next(asset for asset in latest["assets"] if asset["asset_id"] == payload["asset_id"])
    must(
        registered["label"] == payload["label"] and registered["kind"] == payload["kind"]
        and registered["enabled"] and registered["last"] is None and registered["trail"] == [],
        "new tracker missing before first fix or after initialization",
    )
    must(
        [asset for asset in latest["assets"] if asset["asset_id"] != payload["asset_id"]] == before["assets"]
        and latest["position_count"] == before["position_count"],
        "registration changed existing assets or their history",
    )

    credential = issue_device_credential(base, token, payload["asset_id"])
    status, _ = request(
        base + "/osmand?" + urllib.parse.urlencode({
            "id": payload["asset_id"], "lat": 25.2, "lon": 55.2,
        }),
        headers={"Authorization": "Bearer " + credential},
    )
    must(status == 200, "registered tracker could not upload a location")
    uploaded = next(asset for asset in server.snapshot(db_path)["assets"] if asset["asset_id"] == payload["asset_id"])
    must(
        uploaded["label"] == payload["label"] and uploaded["kind"] == payload["kind"]
        and uploaded["last"] is not None and len(uploaded["trail"]) == 1,
        "first upload lost registered tracker metadata",
    )


def run_prefixed_checks(base: str, db_path: Path, token: str) -> None:
    status, page = request(base + "/gps")
    must(status == 200 and b'<base href="/gps/"' in page, "prefixed dashboard did not load")
    must(b'href="track"' in page, "dashboard link escaped the GPS service prefix")

    status, health_body = request(base + "/gps/health")
    must(status == 200 and json.loads(health_body)["status"] == "ok", "prefixed health failed")

    status, latest_body = request(base + "/gps/api/latest")
    must(status == 200 and "assets" in json.loads(latest_body), "prefixed API route failed")

    status, track_page = request(base + "/gps/track")
    must(
        status == 200
        and b'<base href="/gps/"' in track_page
        and b'fetch("api/fix"' in track_page,
        "prefixed phone page routes are incorrect",
    )

    status, session_body = request(
        base + "/gps/api/share/session",
        method="POST",
        body=json.dumps({"asset_id": "phone-prefixed"}).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + token},
    )
    must(status == 200, "prefixed browser session exchange failed")
    session = json.loads(session_body)["token"]
    fix = {"asset_id": "phone-prefixed", "lat": 25.2, "lon": 55.2}
    status, stored = request(
        base + "/gps/api/fix",
        method="POST",
        body=json.dumps(fix).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + session},
    )
    must(status == 200 and json.loads(stored)["stored"], "prefixed browser write failed")

    status, _ = request(base + "/gps/api/demo/reset", method="POST", body=b"")
    must(status == 404, "routed service exposed the destructive reset endpoint")
    status, _ = request(base + "/api/latest")
    must(status == 404, "monitor claimed an unscoped API path")
    status, _ = request(base + "/gps/api/chat")
    must(status == 404, "monitor claimed the Cryo chat API path")
    status, _ = request(base + "/health")
    must(status == 404, "monitor accepted a request outside its configured prefix")

    status, latest_body = request(base + "/gps/api/latest")
    assets = json.loads(latest_body)["assets"]
    must(
        any(asset["asset_id"] == "phone-prefixed" for asset in assets),
        "prefixed location write was not persisted",
    )


def run_rotation_checks(base: str, current_token: str, retiring_token: str) -> None:
    """Verify both tracker protocols and browser sessions across the deadline."""
    old_owntracks_credential = server.device_credential(retiring_token, "phone-rotating")
    old_traccar_credential = server.device_credential(retiring_token, "vehicle-rotating")
    current_owntracks_credential = server.device_credential(current_token, "phone-rotating")
    current_traccar_credential = server.device_credential(current_token, "vehicle-rotating")
    old_browser_session = server.sign_browser_session(retiring_token, "asset:phone-rotating")
    owntracks = {
        "_type": "location",
        "lat": 25.2,
        "lon": 55.2,
        "tst": 1710000000,
    }
    traccar = {
        "device_id": "vehicle-rotating",
        "location": {
            "timestamp": "2026-06-10T13:34:02Z",
            "coords": {"latitude": 25.3, "longitude": 55.3, "speed": 0.5},
        },
    }

    status, _ = request(
        base + "/pub?d=phone-rotating",
        method="POST",
        body=json.dumps(owntracks).encode("utf-8"),
        content_type="application/json",
        headers={
            "Authorization": "Basic "
            + base64.b64encode(f"phone:{old_owntracks_credential}".encode()).decode()
        },
    )
    must(status == 200, "OwnTracks retiring credential failed during rotation overlap")
    status, _ = request(
        base + "/",
        method="POST",
        body=json.dumps(traccar).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + old_traccar_credential},
    )
    must(status == 200, "Traccar retiring credential failed during rotation overlap")

    status, _ = request(
        base + "/api/fix",
        method="POST",
        body=json.dumps(
            {"asset_id": "phone-rotating", "lat": 25.4, "lon": 55.4}
        ).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + old_browser_session},
    )
    must(status == 200, "browser session signed with retiring secret failed during overlap")
    status, credential_body = admin_post(
        base, "/api/device-credential", retiring_token, {"asset_id": "phone-rotating"}
    )
    must(status == 200, "retiring administrator secret failed during overlap")
    must(
        json.loads(credential_body)["token"] == current_owntracks_credential,
        "new device credentials were not issued from the current secret",
    )

    server.Handler.retiring_until = server.utcnow() - timedelta(seconds=1)
    status, _ = request(
        base + "/pub?d=phone-rotating",
        method="POST",
        body=json.dumps(owntracks).encode("utf-8"),
        content_type="application/json",
        headers={
            "Authorization": "Basic "
            + base64.b64encode(f"phone:{old_owntracks_credential}".encode()).decode()
        },
    )
    must(status == 401, "OwnTracks retiring credential remained valid after deadline")
    status, _ = request(
        base + "/",
        method="POST",
        body=json.dumps(traccar).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + old_traccar_credential},
    )
    must(status == 401, "Traccar retiring credential remained valid after deadline")
    status, _ = request(
        base + "/api/fix",
        method="POST",
        body=json.dumps(
            {"asset_id": "phone-rotating", "lat": 25.4, "lon": 55.4}
        ).encode("utf-8"),
        content_type="application/json",
        headers={"Authorization": "Bearer " + old_browser_session},
    )
    must(status == 401, "retiring-secret browser session remained valid after deadline")
    status, _ = admin_post(
        base, "/api/device-credential", retiring_token, {"asset_id": "phone-rotating"}
    )
    must(status == 401, "retiring administrator secret remained valid after deadline")

    for asset_id, url, body, headers in (
        (
            "phone-rotating",
            base + "/pub?d=phone-rotating",
            json.dumps(owntracks).encode("utf-8"),
            {
                "Authorization": "Basic "
                + base64.b64encode(f"phone:{current_owntracks_credential}".encode()).decode()
            },
        ),
        (
            "vehicle-rotating",
            base + "/",
            json.dumps(traccar).encode("utf-8"),
            {"Authorization": "Bearer " + current_traccar_credential},
        ),
    ):
        status, _ = request(
            url,
            method="POST",
            body=body,
            content_type="application/json",
            headers=headers,
        )
        must(status == 200, f"current credential stopped working for {asset_id}")

    status, _ = admin_post(
        base, "/api/device-credential", current_token, {"asset_id": "phone-rotating"}
    )
    must(status == 200, "current administrator secret stopped working after deadline")


def main() -> None:
    token = "test-gps-upload-secret-0123456789"
    with tempfile.TemporaryDirectory() as tmp:
        unconfigured_db_path = Path(tmp) / "unconfigured.sqlite"
        unconfigured = server.serve("127.0.0.1", 0, unconfigured_db_path, token="")
        unconfigured_port = unconfigured.server_address[1]
        unconfigured_thread = threading.Thread(target=unconfigured.serve_forever, daemon=True)
        unconfigured_thread.start()
        try:
            base = f"http://127.0.0.1:{unconfigured_port}"
            status, _ = request(base + "/api/latest")
            must(status == 200, "read-only map should work without upload authorization")
            fix = {"asset_id": "phone-untrusted", "lat": 25.2, "lon": 55.2}
            status, _ = request(
                base + "/api/fix",
                method="POST",
                body=json.dumps(fix).encode("utf-8"),
                content_type="application/json",
            )
            must(status == 503, "unconfigured server accepted a browser upload")
            status, _ = request(
                base + "/pub?d=phone-untrusted",
                method="POST",
                body=json.dumps({"_type": "location", "lat": 25.2, "lon": 55.2}).encode("utf-8"),
                content_type="application/json",
            )
            must(status == 503, "unconfigured server accepted an OwnTracks upload")
            status, _ = request(
                base + "/osmand?id=phone-untrusted&lat=25.2&lon=55.2",
                method="POST",
            )
            must(status == 503, "unconfigured server accepted a Traccar upload")
            status, _ = request(base + "/api/share/session", method="POST")
            must(status == 503, "unconfigured server issued a browser credential")
        finally:
            unconfigured.shutdown()
            unconfigured.server_close()

        db_path = Path(tmp) / "positions.sqlite"
        httpd = server.serve("127.0.0.1", 0, db_path, token=token)
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            run_checks(f"http://127.0.0.1:{port}", db_path, token)
        finally:
            httpd.shutdown()
            httpd.server_close()

        prefixed_db_path = Path(tmp) / "prefixed-positions.sqlite"
        prefixed_httpd = server.serve(
            "127.0.0.1",
            0,
            prefixed_db_path,
            token=token,
            base_path="/gps",
            disable_reset=True,
        )
        prefixed_port = prefixed_httpd.server_address[1]
        prefixed_thread = threading.Thread(target=prefixed_httpd.serve_forever, daemon=True)
        prefixed_thread.start()
        try:
            run_prefixed_checks(f"http://127.0.0.1:{prefixed_port}", prefixed_db_path, token)
            run_registration_checks(f"http://127.0.0.1:{prefixed_port}/gps", prefixed_db_path, token)
        finally:
            prefixed_httpd.shutdown()
            prefixed_httpd.server_close()

        retiring_token = "test-gps-retiring-secret-9876543210"
        rotation_db_path = Path(tmp) / "rotation.sqlite"
        rotation_httpd = server.serve(
            "127.0.0.1",
            0,
            rotation_db_path,
            token=token,
            retiring_token=retiring_token,
            retiring_until=server.utcnow() + timedelta(minutes=5),
        )
        rotation_port = rotation_httpd.server_address[1]
        rotation_thread = threading.Thread(
            target=rotation_httpd.serve_forever, daemon=True
        )
        rotation_thread.start()
        try:
            run_rotation_checks(
                f"http://127.0.0.1:{rotation_port}", token, retiring_token
            )
        finally:
            rotation_httpd.shutdown()
            rotation_httpd.server_close()

        try:
            server.serve(
                "127.0.0.1",
                0,
                Path(tmp) / "invalid-rotation.sqlite",
                token=token,
                retiring_token=retiring_token,
            )
            raise SystemExit("rotation accepted a retiring secret without a deadline")
        except ValueError:
            pass
        try:
            server.serve(
                "127.0.0.1",
                0,
                Path(tmp) / "missing-current.sqlite",
                token="",
                retiring_token=retiring_token,
                retiring_until=server.utcnow() + timedelta(minutes=1),
            )
            raise SystemExit("rotation accepted without a current secret")
        except ValueError:
            pass
        must(
            server.parse_rotation_deadline("2026-12-01T18:00:00Z").tzinfo is not None,
            "ISO 8601 UTC rotation deadline was not parsed",
        )
        try:
            server.parse_rotation_deadline("2026-12-01T18:00:00")
            raise SystemExit("rotation accepted a deadline without timezone")
        except ValueError:
            pass
        try:
            server.serve(
                "127.0.0.1",
                0,
                Path(tmp) / "naive-deadline.sqlite",
                token=token,
                retiring_token=retiring_token,
                retiring_until=server.utcnow().replace(tzinfo=None) + timedelta(minutes=1),
            )
            raise SystemExit("rotation accepted a naive deadline")
        except ValueError:
            pass
    print("all checks passed")


if __name__ == "__main__":
    main()
