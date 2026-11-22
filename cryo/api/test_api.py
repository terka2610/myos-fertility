#!/usr/bin/env python3
"""Exit check: GET /api/samples/SMP-0001 returns the courier sample."""

from __future__ import annotations

import json
import io
import tempfile
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import server


def request(url: str, method: str = "GET") -> tuple[int, dict]:
    req = urllib.request.Request(url, method=method, data=b"" if method == "POST" else None)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read())


def must(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def gps_feed_checks() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    feed = {
        "assets": [
            {"asset_id": "phone-demo", "last": {"lat": 1, "lon": 1, "recorded_at": now}},
            {
                "asset_id": "vehicle-cryo-01",
                "kind": "vehicle",
                "unassigned": False,
                "last": {
                    "lat": 25.2,
                    "lon": 55.2,
                    "recorded_at": now,
                    "source": "owntracks",
                },
            },
        ]
    }
    gps_url = "http://gps-monitor.test/api/latest"
    with patch.object(server, "urlopen", return_value=io.BytesIO(json.dumps(feed).encode())):
        state = server.read_gps_state(gps_url)
    must(state["status"] == "current", "Cryo did not read the GPS monitor feed")
    must(
        state["tracking"]["asset_id"] == "vehicle-cryo-01",
        "Cryo selected an asset other than the configured demo courier",
    )
    with patch.object(server, "urlopen", side_effect=OSError("feed offline")):
        unavailable = server.read_gps_state(gps_url)
    must(unavailable["status"] == "unavailable", "feed errors should be reported clearly")


def main() -> None:
    gps_feed_checks()
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "cryo.sqlite"
        httpd = server.serve("127.0.0.1", 0, db_path)
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{port}"
        try:
            status, health = request(f"{base}/health")
            must(status == 200 and health["status"] == "ok", "health failed")

            with urllib.request.urlopen(f"{base}/", timeout=5) as home:
                page = home.read().decode("utf-8")
                must(home.status == 200 and "SMP-0001" in page, "home page missing the exit check")

            status, sample = request(f"{base}/api/samples/SMP-0001")
            must(status == 200, "SMP-0001 was not found")
            must(sample["cryo_id"] == "CRYO-1700", "cryo id mismatch")
            must(sample["status"] == "in_transit", "SMP-0001 should be in transit")
            must(sample["current_step"] == "in_transit", "current step mismatch")
            must(sample["facility"]["code"] == "CRYOPORT", "courier facility missing")
            must(sample["origin"]["code"] == "CLINIC-A", "origin missing")
            must(sample["destination"]["code"] == "CRYONEXT", "storage destination missing")
            must(sample["count"] == 8, "oocyte count mismatch")
            must([event["step"] for event in sample["custody"]][:4] == [
                "collected", "consent_recorded", "released", "in_transit"
            ], "custody chain mismatch")
            must(len(sample["route"]) == 4, "GPS route missing")
            must(sample["route"][0]["lat"] == 24.5240, "route should start at NYU Abu Dhabi")
            must(sample["route"][-1]["lat"] == 24.4338, "route should end at MBZUAI")
            must(sample["route"][-1]["lon"] == 54.6182, "route should end at MBZUAI")

            status, listed = request(f"{base}/api/samples")
            ids = [item["public_id"] for item in listed["samples"]]
            must(ids == ["SMP-0001", "SMP-0002", "SMP-0003"], f"sample list mismatch: {ids}")

            status, missing = request(f"{base}/api/samples/SMP-9999")
            must(status == 404, "unknown sample should be 404")

            status, stored = request(f"{base}/api/samples/SMP-0002")
            must(stored["status"] == "in_storage" and stored["current_step"] == "stored", "stored sample mismatch")

            status, reset = request(f"{base}/api/reset", method="POST")
            must(status == 200 and reset["reset"] is True, "reset failed")
            status, again = request(f"{base}/api/samples/SMP-0001")
            must(again["cryo_id"] == "CRYO-1700", "reset dropped SMP-0001")
        finally:
            httpd.shutdown()
            httpd.server_close()
    print("all checks passed")


def public_preview_reset_checks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "cryo-preview.sqlite"
        httpd = server.serve("127.0.0.1", 0, db_path, allow_reset=False)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{httpd.server_address[1]}"
        try:
            for path in ("/api/reset", "/api/chat/reset"):
                status, _ = request(f"{base}{path}", method="POST")
                must(status == 404, f"{path} must be unavailable in public preview")
        finally:
            httpd.shutdown()
            httpd.server_close()


def gps_feed_separation_checks() -> None:
    payload = {
        "assets": [
            {
                "asset_id": "phone-demo",
                "kind": "phone",
                "unassigned": False,
                "last": {"lat": 10, "lon": 20},
            },
            {
                "asset_id": "vehicle-cryo-01",
                "kind": "vehicle",
                "label": "untrusted label",
                "unassigned": False,
                "patient_code": "REAL-PATIENT-998",
                "last": {
                    "lat": 25.2048,
                    "lon": 55.2708,
                    "recorded_at": "2026-11-20T10:00:00Z",
                    "speed_kmh": 48,
                    "accuracy_m": 12,
                    "patient_name": "Real Patient",
                },
                "trail": [
                    [24.4539, 54.3773, "2026-11-20T09:00:00Z", "patient data ignored"],
                    [24.8, 54.8, "2026-11-20T09:30:00Z"],
                    [25.2048, 55.2708, "2026-11-20T10:00:00Z"],
                    [95, 55, "invalid point"],
                ],
            },
        ]
    }
    encoded = json.dumps(payload).encode("utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "cryo.sqlite"
        httpd = server.serve(
            "127.0.0.1",
            0,
            db_path,
            allow_reset=False,
            gps_monitor_url="http://gps-monitor.test/api/latest",
        )
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{httpd.server_address[1]}"
        try:
            with patch("server.urlopen", side_effect=lambda *args, **kwargs: io.BytesIO(encoded)):
                status, chat = request(f"{base}/api/chat")
            must(status == 200, "chat snapshot failed")
            feed = chat["gps_demo_feed"]
            must(feed["asset_id"] == "vehicle-cryo-01", "wrong GPS demo asset was selected")
            must(feed["synthetic"] is True and feed["patient_linked"] is False, "GPS feed boundary missing")
            must(feed["last_fix"]["latitude"] == 25.2048, "synthetic GPS point missing")
            must(len(feed["trail"]) == 3, "validated courier route trail missing")
            must(feed["trail"][0]["latitude"] == 24.4539, "route order was not preserved")
            must("patient" not in json.dumps(feed["trail"]).lower(), "patient data leaked into GPS route")
            must("Real Patient" not in json.dumps(feed), "patient data leaked into GPS feed")
            must("sample_id" not in feed and "patient_code" not in feed, "GPS feed was joined to sample data")
            conn = server.workflow.connect(str(db_path))
            try:
                count = conn.execute("SELECT COUNT(*) FROM msg_tracking").fetchone()[0]
                must(count == 0, "GPS monitor points were copied into Cryo sample tracking")
            finally:
                conn.close()
        finally:
            httpd.shutdown()
            httpd.server_close()


if __name__ == "__main__":
    main()
    public_preview_reset_checks()
    gps_feed_separation_checks()
