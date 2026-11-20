#!/usr/bin/env python3
"""Self-hosted GPS ingest for the MyOS specimen-logistics demo.

The phone apps to install are the public ones the meeting asked for:

* OwnTracks (owntracks/android, well over 1,000 stars) posts JSON to /pub
* Traccar Client (traccar/traccar, well over 1,000 stars) posts OsmAnd
  query or form fields onto the server URL, and newer builds post JSON

This process stores an opaque asset id and the fix. The schema has no
patient, clinic, or sample-owner columns, and unknown payload fields are
dropped on purpose.
"""

from __future__ import annotations

import argparse
import base64
import json
import sqlite3
import sys
import traceback
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "assets.json"
INDEX_PATH = ROOT / "static" / "index.html"
TRACK_PATH = ROOT / "static" / "track.html"
ASSET_ID_MAX = 64
MAX_BODY = 64 * 1024
KNOTS_TO_KMH = 1.852
MPS_TO_KMH = 3.6


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def infer_kind(asset_id: str) -> str:
    lowered = asset_id.lower()
    if "phone" in lowered:
        return "phone"
    if "bag" in lowered or lowered.startswith("ship"):
        return "bag"
    if any(word in lowered for word in ("vehicle", "van", "truck", "courier")):
        return "vehicle"
    return "asset"


def sanitize_asset_id(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in {".", ".."} or len(text) > ASSET_ID_MAX:
        return None
    allowed = set(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-"
    )
    if any(char not in allowed for char in text):
        return None
    return text


def device_from_topic(topic: object) -> str | None:
    if not isinstance(topic, str) or not topic.strip():
        return None
    parts = [part for part in topic.split("/") if part]
    if len(parts) < 2:
        return None
    return sanitize_asset_id(parts[-1])


def as_float(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def valid_lat_lon(lat: float | None, lon: float | None) -> bool:
    if lat is None or lon is None:
        return False
    return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0


def parse_time(value: object) -> str:
    now = utcnow()
    if value is None or value == "":
        return iso(now)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        raw: float | None = float(value)
        parsed: datetime | None = None
    else:
        text = str(value).strip()
        try:
            raw = float(text)
            parsed = None
        except ValueError:
            raw = None
            try:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except ValueError:
                return iso(now)
    if parsed is None:
        assert raw is not None
        if raw > 10_000_000_000:
            raw = raw / 1000.0
        try:
            parsed = datetime.fromtimestamp(raw, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return iso(now)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if parsed.year < 2020 or parsed.year > 2100:
        return iso(now)
    return iso(parsed)


def battery_percent(value: object) -> float | None:
    number = as_float(value)
    if number is None or number < 0 or number > 100:
        return None
    return number


def battery_fraction(value: object) -> float | None:
    """Traccar Client JSON reports battery.level as a 0–1 fraction."""
    number = as_float(value)
    if number is None:
        return None
    if 0 <= number <= 1:
        return round(number * 100.0, 1)
    return battery_percent(number)


def course_deg(value: object) -> float | None:
    number = as_float(value)
    if number is None:
        return None
    if number < 0 or number > 360:
        return None
    return number


def first(params: dict, key: str) -> str | None:
    value = params.get(key)
    if value is None or value == "":
        return None
    return str(value)


def load_catalog() -> dict:
    if not CATALOG_PATH.exists():
        return {}
    raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    catalog = {}
    for asset_id, meta in raw.items():
        clean = sanitize_asset_id(asset_id)
        if clean is None or not isinstance(meta, dict):
            continue
        catalog[clean] = {
            "kind": str(meta.get("kind") or infer_kind(clean)),
            "label": str(meta.get("label") or "Unassigned asset"),
        }
    return catalog


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path, catalog: dict) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(str(db_path))
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS assets (
                asset_id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                label TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                accuracy_m REAL,
                altitude_m REAL,
                speed_kmh REAL,
                course_deg REAL,
                battery_pct REAL,
                recorded_at TEXT NOT NULL,
                received_at TEXT NOT NULL,
                source TEXT NOT NULL,
                FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
            );
            CREATE INDEX IF NOT EXISTS idx_positions_asset_time
                ON positions (asset_id, recorded_at, id);
            """
        )
        now = iso(utcnow())
        for asset_id, meta in catalog.items():
            conn.execute(
                """
                INSERT INTO assets (asset_id, kind, label, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(asset_id) DO UPDATE SET
                    kind = excluded.kind,
                    label = excluded.label
                """,
                (asset_id, meta["kind"], meta["label"], now),
            )
        conn.commit()
    finally:
        conn.close()


def ensure_asset(conn: sqlite3.Connection, catalog: dict, asset_id: str) -> None:
    found = conn.execute(
        "SELECT 1 FROM assets WHERE asset_id = ?", (asset_id,)
    ).fetchone()
    if found:
        return
    meta = catalog.get(asset_id, {})
    conn.execute(
        """
        INSERT INTO assets (asset_id, kind, label, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            asset_id,
            meta.get("kind") or infer_kind(asset_id),
            meta.get("label") or "Unassigned asset",
            iso(utcnow()),
        ),
    )


def insert_fix(
    db_path: str,
    catalog: dict,
    asset_id: str,
    lat: float,
    lon: float,
    accuracy: float | None,
    altitude: float | None,
    speed_kmh: float | None,
    course: float | None,
    battery: float | None,
    recorded_at: str,
    source: str,
) -> None:
    conn = connect(db_path)
    try:
        ensure_asset(conn, catalog, asset_id)
        conn.execute(
            """
            INSERT INTO positions (
                asset_id, lat, lon, accuracy_m, altitude_m, speed_kmh,
                course_deg, battery_pct, recorded_at, received_at, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                asset_id,
                lat,
                lon,
                accuracy,
                altitude,
                speed_kmh,
                course,
                battery,
                recorded_at,
                iso(utcnow()),
                source,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    print(f"stored {asset_id} {lat:.5f},{lon:.5f} via {source}", flush=True)


def snapshot(db_path: str) -> dict:
    conn = connect(db_path)
    try:
        assets = conn.execute(
            "SELECT asset_id, kind, label FROM assets ORDER BY asset_id"
        ).fetchall()
        position_count = conn.execute("SELECT COUNT(*) AS n FROM positions").fetchone()["n"]
        payload = []
        for asset in assets:
            last = conn.execute(
                """
                SELECT lat, lon, accuracy_m, altitude_m, speed_kmh, course_deg,
                       battery_pct, recorded_at, source
                FROM positions
                WHERE asset_id = ?
                ORDER BY recorded_at DESC, id DESC
                LIMIT 1
                """,
                (asset["asset_id"],),
            ).fetchone()
            trail_rows = conn.execute(
                """
                SELECT lat, lon, recorded_at FROM (
                    SELECT lat, lon, recorded_at, id
                    FROM positions
                    WHERE asset_id = ?
                    ORDER BY recorded_at DESC, id DESC
                    LIMIT 500
                )
                ORDER BY recorded_at ASC, id ASC
                """,
                (asset["asset_id"],),
            ).fetchall()
            payload.append(
                {
                    "asset_id": asset["asset_id"],
                    "kind": asset["kind"],
                    "label": asset["label"],
                    "unassigned": asset["label"] == "Unassigned asset",
                    "last": None if last is None else dict(last),
                    "trail": [
                        [row["lat"], row["lon"], row["recorded_at"]] for row in trail_rows
                    ],
                }
            )
        return {
            "server_time": iso(utcnow()),
            "position_count": position_count,
            "assets": payload,
        }
    finally:
        conn.close()


def clear_positions(db_path: str) -> None:
    conn = connect(db_path)
    try:
        conn.execute("DELETE FROM positions")
        conn.commit()
    finally:
        conn.close()


def lan_ip() -> str:
    import socket
    import subprocess

    for iface in ("en0", "en1"):
        try:
            ip = subprocess.check_output(
                ["ipconfig", "getifaddr", iface],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
        except (OSError, subprocess.CalledProcessError):
            continue
        if ip and not ip.startswith("127."):
            return ip
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        if ip and not ip.startswith("127."):
            return ip
    except OSError:
        pass
    finally:
        sock.close()
    return "127.0.0.1"


def form_params(body: bytes) -> dict:
    if not body:
        return {}
    text = body.decode("utf-8", errors="replace").strip()
    if not text or text[0] in "{[":
        return {}
    parsed = parse_qs(text, keep_blank_values=False)
    return {key: values[-1] for key, values in parsed.items() if values}


def query_params(qs: dict) -> dict:
    return {key: values[-1] for key, values in qs.items() if values}


class Handler(BaseHTTPRequestHandler):
    db_path = ""
    catalog: dict = {}
    token = ""

    def log_message(self, fmt: str, *args) -> None:
        # The request line can carry a name someone typed into the URL.
        # Keep the terminal log to the path. The stored asset id is printed separately.
        path = urlparse(self.path).path or "/"
        sys.stderr.write("%s - %s %s\n" % (self.log_date_time_string(), self.command, path))

    def do_GET(self) -> None:
        self.dispatch("GET")

    def do_POST(self) -> None:
        self.dispatch("POST")

    def dispatch(self, method: str) -> None:
        self._sent = False
        try:
            self.route(method)
        except ValueError as exc:
            if not self._sent:
                self.send_error_json(400, str(exc))
        except Exception:
            traceback.print_exc()
            if not self._sent:
                self.send_error_json(500, "internal error")

    def route(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query, keep_blank_values=False)
        params = query_params(qs)

        if method == "GET" and path == "/health":
            state = snapshot(self.db_path)
            self.send_json(
                200,
                {
                    "status": "ok",
                    "protocols": ["browser", "owntracks", "osmand", "traccar-client"],
                    "position_count": state["position_count"],
                },
            )
            return

        if method == "GET" and path == "/api/latest":
            self.send_json(200, snapshot(self.db_path))
            return

        if method == "POST" and path == "/api/demo/reset":
            if not self.loopback():
                self.send_error_json(403, "reset is only available from this machine")
                return
            clear_positions(self.db_path)
            self.send_json(200, {"cleared": True})
            return

        if method == "GET" and path == "/track":
            self.serve_file(TRACK_PATH)
            return

        if method == "GET" and path == "/" and not self.looks_like_fix(params):
            self.serve_index()
            return

        body = b""
        if method == "POST":
            body = self.read_body()

        if method == "POST" and path == "/api/fix":
            self.handle_browser_fix(params, body)
            return

        if path == "/pub" or self.looks_like_owntracks(body):
            if method != "POST":
                self.send_error_json(405, "OwnTracks publishes with POST")
                return
            self.handle_owntracks(params, body)
            return

        if path in {"/", "/osmand"} or self.looks_like_fix(params):
            self.handle_osmand(params, body)
            return

        self.send_error_json(404, "not found")

    def looks_like_fix(self, params: dict) -> bool:
        ident = params.get("id") or params.get("deviceid") or params.get("device_id")
        return ident is not None and ("lat" in params or "location" in params)

    def looks_like_owntracks(self, body: bytes) -> bool:
        if not body or body.lstrip()[:1] not in (b"{",):
            return False
        try:
            data = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return False
        return isinstance(data, dict) and "_type" in data

    def handle_browser_fix(self, params: dict, body: bytes) -> None:
        if not self.authorized(params):
            self.send_error_json(401, "unauthorized")
            return
        try:
            data = json.loads(body.decode("utf-8")) if body else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error_json(400, "invalid json")
            return
        if not isinstance(data, dict):
            self.send_error_json(400, "invalid json")
            return
        asset_id = sanitize_asset_id(data.get("asset_id") or params.get("d"))
        if asset_id is None:
            self.send_error_json(400, "device id missing or not an asset code")
            return
        lat = as_float(data.get("lat"))
        lon = as_float(data.get("lon"))
        if not valid_lat_lon(lat, lon):
            self.send_error_json(400, "latitude or longitude out of range")
            return
        assert lat is not None and lon is not None
        speed = as_float(data.get("speed"))
        insert_fix(
            self.db_path,
            self.catalog,
            asset_id,
            lat,
            lon,
            as_float(data.get("accuracy")),
            as_float(data.get("altitude")),
            None if speed is None or speed < 0 else speed * MPS_TO_KMH,
            course_deg(data.get("heading")),
            battery_percent(data.get("batt")),
            parse_time(data.get("recorded_at")),
            "browser",
        )
        self.send_json(200, {"stored": True, "asset_id": asset_id})

    def handle_owntracks(self, params: dict, body: bytes) -> None:
        if not self.authorized(params):
            self.send_error_json(401, "unauthorized")
            return
        if not body.strip():
            self.send_json(200, [])
            return
        try:
            data = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error_json(400, "invalid json")
            return
        if not isinstance(data, dict) or data.get("_type") != "location":
            self.send_json(200, [])
            return
        asset_id = (
            sanitize_asset_id(params.get("d"))
            or sanitize_asset_id(self.headers.get("X-Limit-D"))
            or device_from_topic(data.get("topic"))
            or sanitize_asset_id(data.get("tid"))
        )
        if asset_id is None:
            self.send_error_json(400, "device id missing or not an asset code")
            return
        lat = as_float(data.get("lat"))
        lon = as_float(data.get("lon"))
        if not valid_lat_lon(lat, lon):
            self.send_error_json(400, "latitude or longitude out of range")
            return
        assert lat is not None and lon is not None
        insert_fix(
            self.db_path,
            self.catalog,
            asset_id,
            lat,
            lon,
            as_float(data.get("acc")),
            as_float(data.get("alt")),
            as_float(data.get("vel")),
            course_deg(data.get("cog")),
            battery_percent(data.get("batt")),
            parse_time(data.get("tst")),
            "owntracks",
        )
        self.send_json(200, [])

    def handle_osmand(self, params: dict, body: bytes) -> None:
        if not self.authorized(params):
            self.send_error_json(401, "unauthorized")
            return
        content_type = self.headers.get("Content-Type", "")
        if body.lstrip()[:1] == b"{" or "application/json" in content_type:
            try:
                data = json.loads(body.decode("utf-8")) if body else {}
            except (UnicodeDecodeError, json.JSONDecodeError):
                self.send_error_json(400, "invalid json")
                return
            if isinstance(data, dict) and (
                "device_id" in data or isinstance(data.get("location"), dict)
            ):
                self.store_traccar_json(data)
                return
        merged = dict(params)
        merged.update(form_params(body))
        asset_id = sanitize_asset_id(
            merged.get("id") or merged.get("deviceid") or merged.get("device_id")
        )
        if asset_id is None:
            self.send_error_json(400, "device id missing or not an asset code")
            return
        lat = as_float(merged.get("lat"))
        lon = as_float(merged.get("lon"))
        if lat is None and merged.get("location"):
            pieces = str(merged["location"]).split(",")
            if len(pieces) == 2:
                lat = as_float(pieces[0])
                lon = as_float(pieces[1])
        if not valid_lat_lon(lat, lon):
            self.send_error_json(400, "latitude or longitude out of range")
            return
        assert lat is not None and lon is not None
        speed = as_float(merged.get("speed"))
        insert_fix(
            self.db_path,
            self.catalog,
            asset_id,
            lat,
            lon,
            as_float(merged.get("accuracy")),
            as_float(merged.get("altitude")),
            None if speed is None else speed * KNOTS_TO_KMH,
            course_deg(merged.get("bearing") or merged.get("heading")),
            battery_percent(merged.get("batt")),
            parse_time(merged.get("timestamp")),
            "osmand",
        )
        self.send_empty(200)

    def store_traccar_json(self, data: dict) -> None:
        location = data.get("location") if isinstance(data.get("location"), dict) else {}
        coords = location.get("coords") if isinstance(location.get("coords"), dict) else {}
        asset_id = sanitize_asset_id(data.get("device_id") or data.get("deviceId") or data.get("id"))
        if asset_id is None:
            self.send_error_json(400, "device id missing or not an asset code")
            return
        lat = as_float(coords.get("latitude", data.get("lat")))
        lon = as_float(coords.get("longitude", data.get("lon")))
        if not valid_lat_lon(lat, lon):
            self.send_error_json(400, "latitude or longitude out of range")
            return
        assert lat is not None and lon is not None
        speed = as_float(coords.get("speed"))
        battery = location.get("battery") if isinstance(location.get("battery"), dict) else {}
        insert_fix(
            self.db_path,
            self.catalog,
            asset_id,
            lat,
            lon,
            as_float(coords.get("accuracy")),
            as_float(coords.get("altitude")),
            None if speed is None else speed * MPS_TO_KMH,
            course_deg(coords.get("heading")),
            battery_fraction(battery.get("level")),
            parse_time(location.get("timestamp") or data.get("timestamp")),
            "traccar-client",
        )
        self.send_empty(200)

    def authorized(self, params: dict) -> bool:
        if not self.token:
            return True
        supplied = params.get("token")
        header = self.headers.get("Authorization", "")
        if header.lower().startswith("basic "):
            try:
                decoded = base64.b64decode(header.split(" ", 1)[1].strip()).decode("utf-8")
            except (ValueError, UnicodeDecodeError):
                return False
            _, _, password = decoded.partition(":")
            supplied = password or supplied
        elif header.lower().startswith("bearer "):
            supplied = header.split(" ", 1)[1].strip()
        return supplied == self.token

    def loopback(self) -> bool:
        host = self.client_address[0]
        return host == "::1" or host.endswith("127.0.0.1")

    def read_body(self) -> bytes:
        length_header = self.headers.get("Content-Length", "0") or "0"
        try:
            length = int(length_header)
        except ValueError as exc:
            raise ValueError("invalid content length") from exc
        if length < 0 or length > MAX_BODY:
            raise ValueError("body too large")
        if length == 0:
            return b""
        return self.rfile.read(length)

    def serve_index(self) -> None:
        self.serve_file(INDEX_PATH)

    def serve_file(self, path: Path) -> None:
        if not path.exists():
            self.send_error_json(500, "page missing")
            return
        self.send_bytes(200, path.read_bytes(), "text/html; charset=utf-8")

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_bytes(status, body, "application/json; charset=utf-8")

    def send_error_json(self, status: int, message: str) -> None:
        self.send_json(status, {"error": message})

    def send_empty(self, status: int) -> None:
        self.send_bytes(status, b"", "text/plain; charset=utf-8")

    def send_bytes(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
        self._sent = True


def serve(host: str, port: int, db_path: Path, token: str) -> ThreadingHTTPServer:
    catalog = load_catalog()
    init_db(db_path, catalog)
    Handler.db_path = str(db_path)
    Handler.catalog = catalog
    Handler.token = token
    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    parser = argparse.ArgumentParser(description="MyOS specimen GPS monitor")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--db", default=str(ROOT / "data" / "positions.sqlite"))
    parser.add_argument(
        "--token",
        default="",
        help="Optional shared secret. OwnTracks can send it as the HTTP basic password.",
    )
    args = parser.parse_args()
    httpd = serve(args.host, args.port, Path(args.db), args.token)
    bound_host, bound_port = httpd.server_address[:2]
    phone_host = lan_ip() if args.host in {"0.0.0.0", "::"} else bound_host
    print("MyOS GPS monitor", flush=True)
    print(f"  map:       http://127.0.0.1:{bound_port}", flush=True)
    print(f"  phone:     http://{phone_host}:{bound_port}", flush=True)
    print(f"  database:  {args.db}", flush=True)
    print("OwnTracks HTTP URL:", flush=True)
    print(f"  http://{phone_host}:{bound_port}/pub?d=phone-demo", flush=True)
    print("Traccar Client server URL:", flush=True)
    print(f"  http://{phone_host}:{bound_port}", flush=True)
    print("  device identifier: phone-demo", flush=True)
    print("Use an asset code such as phone-demo, bag-ship-01, or vehicle-cryo-01.", flush=True)
    print("Do not put a person's name in the device id.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped", flush=True)
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
