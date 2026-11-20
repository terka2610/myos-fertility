#!/usr/bin/env python3
"""Sample API for the cryo custody demo.

GET /api/samples/SMP-0001 is the shared exit check.
The rows match superbase/cryo/seed.sql.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import workflow

API_ROOT = Path(__file__).resolve().parent
ROOT = API_ROOT.parent
DEFAULT_DB = ROOT / "data" / "cryo.sqlite"

FACILITIES = [
    ("CLINIC-A", "fertility_clinic", "Harbour IVF Clinic", "Abu Dhabi", "UAE", 24.4539, 54.3773),
    ("CRYOPORT", "courier", "Cryoport courier", "Abu Dhabi", "UAE", 24.7600, 54.7000),
    ("CRYONEXT", "storage", "CryoNext storage", "Dubai", "UAE", 25.2048, 55.2708),
]

SAMPLES = [
    ("SMP-0001", "CRYO-1700", "PT-0142", "oocyte", 8, "good", "in_transit", "in_transit", "CRYOPORT", "CLINIC-A", "CRYONEXT", "2026-11-19T06:00:00Z"),
    ("SMP-0002", "CRYO-1612", "PT-0090", "oocyte", 12, "good", "in_storage", "stored", "CRYONEXT", "CLINIC-A", "CRYONEXT", "2021-06-01T08:00:00Z"),
    ("SMP-0003", "CRYO-1544", "PT-0077", "oocyte", 6, "good", "returning", "in_transit_return", "CRYOPORT", "CRYONEXT", "CLINIC-A", "2019-03-12T08:00:00Z"),
]

EVENTS = [
    ("SMP-0001", "CLINIC-A", "collected", "Eight oocytes frozen at Clinic A.", "2026-11-19T06:00:00Z"),
    ("SMP-0001", "CLINIC-A", "consent_recorded", "Transfer consent is on file.", "2026-11-19T06:40:00Z"),
    ("SMP-0001", "CLINIC-A", "released", "Handed to the courier.", "2026-11-19T07:10:00Z"),
    ("SMP-0001", "CRYOPORT", "in_transit", "En route to CryoNext storage.", "2026-11-19T08:00:00Z"),
    ("SMP-0002", "CLINIC-A", "collected", "Twelve oocytes frozen at Clinic A.", "2021-06-01T08:00:00Z"),
    ("SMP-0002", "CRYONEXT", "arrived_storage", "Received at CryoNext.", "2021-06-01T15:00:00Z"),
    ("SMP-0002", "CRYONEXT", "stored", "In monitored storage.", "2021-06-01T16:00:00Z"),
    ("SMP-0003", "CRYONEXT", "stored", "Held in storage since 2019.", "2019-03-14T10:00:00Z"),
    ("SMP-0003", "CRYONEXT", "release_requested", "Patient asked to use the eggs.", "2026-11-18T09:00:00Z"),
    ("SMP-0003", "CRYOPORT", "in_transit_return", "Returning to Clinic A.", "2026-11-19T09:30:00Z"),
]

ROUTE = [
    ("SMP-0001", 24.4539, 54.3773, "2026-11-19T07:10:00Z"),
    ("SMP-0001", 24.6200, 54.5200, "2026-11-19T07:40:00Z"),
    ("SMP-0001", 24.7600, 54.7000, "2026-11-19T08:10:00Z"),
    ("SMP-0003", 25.2048, 55.2708, "2026-11-19T09:30:00Z"),
    ("SMP-0003", 25.0200, 55.0500, "2026-11-19T10:10:00Z"),
    ("SMP-0003", 24.8200, 54.7800, "2026-11-19T10:40:00Z"),
]


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(str(db_path))
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS facilities (
              code TEXT PRIMARY KEY,
              kind TEXT NOT NULL,
              name TEXT NOT NULL,
              city TEXT NOT NULL,
              country TEXT NOT NULL,
              lat REAL NOT NULL,
              lon REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS samples (
              public_id TEXT PRIMARY KEY,
              cryo_id TEXT NOT NULL UNIQUE,
              patient_code TEXT NOT NULL,
              specimen_type TEXT NOT NULL,
              specimen_count INTEGER NOT NULL,
              condition TEXT NOT NULL,
              status TEXT NOT NULL,
              current_step TEXT NOT NULL,
              current_facility TEXT NOT NULL,
              origin_facility TEXT NOT NULL,
              destination_facility TEXT NOT NULL,
              collected_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS custody_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              sample_id TEXT NOT NULL,
              facility_code TEXT NOT NULL,
              step TEXT NOT NULL,
              note TEXT NOT NULL,
              recorded_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS route_points (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              sample_id TEXT NOT NULL,
              lat REAL NOT NULL,
              lon REAL NOT NULL,
              recorded_at TEXT NOT NULL
            );
            """
        )
        conn.commit()
    finally:
        conn.close()
    if snapshot_count(db_path) == 0:
        reset_db(db_path)


def snapshot_count(db_path: Path) -> int:
    conn = connect(str(db_path))
    try:
        return conn.execute("SELECT COUNT(*) AS n FROM samples").fetchone()["n"]
    finally:
        conn.close()


def reset_db(db_path: Path) -> None:
    conn = connect(str(db_path))
    try:
        conn.execute("DELETE FROM route_points")
        conn.execute("DELETE FROM custody_events")
        conn.execute("DELETE FROM samples")
        conn.execute("DELETE FROM facilities")
        conn.executemany(
            "INSERT INTO facilities VALUES (?, ?, ?, ?, ?, ?, ?)", FACILITIES
        )
        conn.executemany(
            "INSERT INTO samples VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", SAMPLES
        )
        conn.executemany(
            "INSERT INTO custody_events (sample_id, facility_code, step, note, recorded_at) VALUES (?, ?, ?, ?, ?)",
            EVENTS,
        )
        conn.executemany(
            "INSERT INTO route_points (sample_id, lat, lon, recorded_at) VALUES (?, ?, ?, ?)",
            ROUTE,
        )
        conn.commit()
    finally:
        conn.close()


def facility_row(row: sqlite3.Row) -> dict:
    return {
        "code": row["code"],
        "kind": row["kind"],
        "name": row["name"],
        "city": row["city"],
        "country": row["country"],
        "lat": row["lat"],
        "lon": row["lon"],
    }


def sample_payload(conn: sqlite3.Connection, public_id: str) -> dict | None:
    sample = conn.execute(
        "SELECT * FROM samples WHERE public_id = ?", (public_id,)
    ).fetchone()
    if sample is None:
        return None
    facilities = {
        row["code"]: row
        for row in conn.execute("SELECT * FROM facilities")
    }
    events = conn.execute(
        """
        SELECT facility_code, step, note, recorded_at
        FROM custody_events WHERE sample_id = ?
        ORDER BY recorded_at, id
        """,
        (public_id,),
    ).fetchall()
    points = conn.execute(
        """
        SELECT lat, lon, recorded_at FROM route_points
        WHERE sample_id = ? ORDER BY recorded_at, id
        """,
        (public_id,),
    ).fetchall()
    current = facilities[sample["current_facility"]]
    origin = facilities[sample["origin_facility"]]
    destination = facilities[sample["destination_facility"]]
    return {
        "public_id": sample["public_id"],
        "cryo_id": sample["cryo_id"],
        "patient_code": sample["patient_code"],
        "specimen_type": sample["specimen_type"],
        "count": sample["specimen_count"],
        "condition": sample["condition"],
        "status": sample["status"],
        "current_step": sample["current_step"],
        "collected_at": sample["collected_at"],
        "facility": facility_row(current),
        "origin": {
            "code": origin["code"],
            "name": origin["name"],
            "lat": origin["lat"],
            "lon": origin["lon"],
        },
        "destination": {
            "code": destination["code"],
            "name": destination["name"],
            "lat": destination["lat"],
            "lon": destination["lon"],
        },
        "custody": [
            {
                "step": event["step"],
                "facility_code": event["facility_code"],
                "note": event["note"],
                "recorded_at": event["recorded_at"],
            }
            for event in events
        ],
        "route": [
            {"lat": point["lat"], "lon": point["lon"], "recorded_at": point["recorded_at"]}
            for point in points
        ],
    }


def list_samples(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT public_id, cryo_id, status, current_step, current_facility FROM samples ORDER BY public_id"
    ).fetchall()
    return [dict(row) for row in rows]


def home_html(conn: sqlite3.Connection) -> str:
    items = []
    for sample in list_samples(conn):
        public_id = sample["public_id"]
        items.append(
            "<li><a href=\"/api/samples/{id}\">{id}</a> "
            "{cryo} · {status} · {facility}</li>".format(
                id=public_id,
                cryo=sample["cryo_id"],
                status=sample["status"].replace("_", " "),
                facility=sample["current_facility"],
            )
        )
    page = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Samples</title>
<style>
  body { margin: 0; font: 16px/1.45 system-ui, sans-serif; background: #f4f7f5; color: #17211c; }
  main { max-width: 36rem; margin: 0 auto; padding: 2.5rem 1.25rem; }
  h1 { font-size: 1.6rem; margin: 0 0 0.4rem; }
  p { margin: 0 0 1.25rem; }
  a { color: #0b6b4f; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { background: #fff; border: 1px solid #d7e2dc; border-radius: 10px; padding: 0.85rem 1rem; margin: 0 0 0.6rem; }
</style>
</head>
<body>
<main>
  <h1>Samples</h1>
  <p>Exit check: <a href="/api/samples/SMP-0001">/api/samples/SMP-0001</a></p>
  <p><a href="/chat">Simulated chat for SMP-0001</a></p>
  <ul>
    __ITEMS__
  </ul>
</main>
</body>
</html>"""
    return page.replace("__ITEMS__", "\n    ".join(items))


class Handler(BaseHTTPRequestHandler):
    db_path = ""

    def do_GET(self) -> None:
        self.route("GET")

    def do_POST(self) -> None:
        self.route("POST")

    def route(self, method: str) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"
        if method == "GET" and path == "/":
            conn = connect(self.db_path)
            try:
                page = home_html(conn)
            finally:
                conn.close()
            self.send_html(200, page)
            return
        if method == "GET" and path == "/chat":
            page = (API_ROOT / "static" / "chat.html").read_text(encoding="utf-8")
            self.send_html(200, page)
            return
        if method == "GET" and path == "/api/chat":
            conn = workflow.connect(self.db_path)
            try:
                self.send_json(200, workflow.snapshot(conn))
            finally:
                conn.close()
            return
        if method == "POST" and path == "/api/chat/tick":
            conn = workflow.connect(self.db_path)
            try:
                self.send_json(200, workflow.scheduled_update(conn))
            finally:
                conn.close()
            return
        if method == "POST" and path == "/api/chat/reset":
            conn = workflow.connect(self.db_path)
            try:
                self.send_json(200, workflow.reset(conn))
            finally:
                conn.close()
            return
        if method == "POST" and path == "/api/chat/action":
            payload = self.read_json()
            conn = workflow.connect(self.db_path)
            try:
                result = workflow.act(conn, str(payload.get("action", "")))
            finally:
                conn.close()
            self.send_json(200 if result.get("ok") else 409, result)
            return
        if method == "POST" and path == "/api/chat/message":
            payload = self.read_json()
            proposal = payload.get("proposal_id")
            conn = workflow.connect(self.db_path)
            try:
                result = workflow.post_message(
                    conn,
                    str(payload.get("role", "")),
                    str(payload.get("text", "")),
                    str(payload.get("event_id") or uuid.uuid4()),
                    None if proposal is None else int(proposal),
                    payload.get("thread") or None,
                )
            finally:
                conn.close()
            self.send_json(200, result)
            return
        if method == "GET" and path == "/health":
            self.send_json(200, {"status": "ok"})
            return
        if method == "GET" and path == "/api/samples":
            conn = connect(self.db_path)
            try:
                self.send_json(200, {"samples": list_samples(conn)})
            finally:
                conn.close()
            return
        if method == "POST" and path == "/api/reset":
            reset_db(Path(self.db_path))
            self.send_json(200, {"reset": True})
            return
        prefix = "/api/samples/"
        if method == "GET" and path.startswith(prefix):
            public_id = unquote(path[len(prefix):])
            conn = connect(self.db_path)
            try:
                payload = sample_payload(conn, public_id)
            finally:
                conn.close()
            if payload is None:
                self.send_json(404, {"error": "sample not found"})
                return
            self.send_json(200, payload)
            return
        self.send_json(404, {"error": "not found"})

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, status: int, page: str) -> None:
        body = page.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args) -> None:
        return


def serve(host: str, port: int, db_path: Path) -> ThreadingHTTPServer:
    init_db(db_path)
    conn = workflow.connect(str(db_path))
    try:
        workflow.ensure(conn)
    finally:
        conn.close()
    Handler.db_path = str(db_path)
    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    parser = argparse.ArgumentParser(description="MyOS sample API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8790)
    parser.add_argument("--db", default=str(DEFAULT_DB))
    args = parser.parse_args()
    httpd = serve(args.host, args.port, Path(args.db))
    print(f"Sample API  http://127.0.0.1:{args.port}/api/samples/SMP-0001", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped", flush=True)
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
