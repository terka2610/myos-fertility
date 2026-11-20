#!/usr/bin/env python3
"""Exit check: GET /api/samples/SMP-0001 returns the courier sample."""

from __future__ import annotations

import json
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path

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


def main() -> None:
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
            must(len(sample["route"]) == 3, "GPS route missing")
            must(sample["route"][0]["lat"] == 24.4539, "route should start at Clinic A")

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


if __name__ == "__main__":
    main()
