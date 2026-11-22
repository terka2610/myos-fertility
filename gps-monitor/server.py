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
import hashlib
import hmac
import json
import os
import secrets
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
BROWSER_SESSION_SECONDS = 60 * 60
DEFAULT_RETIRING_TOKEN_ENV = "GPS_UPLOAD_TOKEN_RETIRING"
DEFAULT_RETIRING_UNTIL_ENV = "GPS_UPLOAD_TOKEN_RETIRING_UNTIL"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_rotation_deadline(value: str) -> datetime:
    """Parse a required, timezone-aware ISO 8601 retiring-secret deadline."""
    try:
        deadline = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("retiring secret deadline must be an ISO 8601 date-time") from exc
    if deadline.tzinfo is None:
        raise ValueError("retiring secret deadline must include a timezone")
    return deadline.astimezone(timezone.utc)


def sign_browser_session(secret: str, scope: str) -> str:
    expires_at = int(utcnow().timestamp()) + BROWSER_SESSION_SECONDS
    payload = f"{expires_at}:{secrets.token_urlsafe(12)}:{scope}"
    encoded_payload = base64.urlsafe_b64encode(payload.encode("utf-8")).rstrip(b"=").decode("ascii")
    signature = hmac.new(
        secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256
    ).digest()
    return (
        encoded_payload
        + "."
        + base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    )


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
            "enabled": meta.get("enabled", True) is not False,
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
                enabled INTEGER NOT NULL DEFAULT 1,
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
            CREATE TABLE IF NOT EXISTS asset_settings_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id TEXT NOT NULL,
                label TEXT NOT NULL,
                kind TEXT NOT NULL,
                enabled INTEGER NOT NULL,
                changed_at TEXT NOT NULL,
                action TEXT NOT NULL,
                restored_from INTEGER,
                FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
            );
            CREATE INDEX IF NOT EXISTS idx_asset_settings_history
                ON asset_settings_history (asset_id, id);
            """
        )
        asset_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(assets)").fetchall()
        }
        if "enabled" not in asset_columns:
            conn.execute(
                "ALTER TABLE assets ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1"
            )
        now = iso(utcnow())
        for asset_id, meta in catalog.items():
            conn.execute(
                """
                INSERT INTO assets (asset_id, kind, label, enabled, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(asset_id) DO NOTHING
                """,
                (asset_id, meta["kind"], meta["label"], int(meta["enabled"]), now),
            )
        for asset in conn.execute("SELECT * FROM assets").fetchall():
            if not conn.execute(
                "SELECT 1 FROM asset_settings_history WHERE asset_id = ?",
                (asset["asset_id"],),
            ).fetchone():
                record_asset_settings(conn, asset["asset_id"], "initial")
        conn.commit()
    finally:
        conn.close()


def record_asset_settings(
    conn: sqlite3.Connection, asset_id: str, action: str,
    restored_from: int | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO asset_settings_history
            (asset_id, label, kind, enabled, changed_at, action, restored_from)
        SELECT asset_id, label, kind, enabled, ?, ?, ?
        FROM assets WHERE asset_id = ?
        """,
        (iso(utcnow()), action, restored_from, asset_id),
    )


def ensure_asset(conn: sqlite3.Connection, catalog: dict, asset_id: str) -> None:
    found = conn.execute(
        "SELECT 1 FROM assets WHERE asset_id = ?", (asset_id,)
    ).fetchone()
    if found:
        return
    meta = catalog.get(asset_id, {})
    conn.execute(
        """
        INSERT INTO assets (asset_id, kind, label, enabled, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            asset_id,
            meta.get("kind") or infer_kind(asset_id),
            meta.get("label") or "Unassigned asset",
            int(meta.get("enabled", True)),
            iso(utcnow()),
        ),
    )
    record_asset_settings(conn, asset_id, "initial")


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
            "SELECT asset_id, kind, label, enabled FROM assets ORDER BY asset_id"
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
                    "enabled": bool(asset["enabled"]),
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


def device_credential(master_token: str, asset_id: str) -> str:
    message = f"gps-device-v1:{asset_id}".encode("utf-8")
    digest = hmac.new(master_token.encode("utf-8"), message, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


class Handler(BaseHTTPRequestHandler):
    db_path = ""
    catalog: dict = {}
    token = ""
    retiring_token = ""
    retiring_until: datetime | None = None
    base_path = ""
    reset_enabled = True

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
        if self.base_path:
            if path == self.base_path:
                path = "/"
            elif path.startswith(self.base_path + "/"):
                path = path[len(self.base_path) :]
            else:
                self.send_error_json(404, "not found")
                return
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
            if not self.reset_enabled:
                self.send_error_json(404, "not found")
                return
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

        if method == "POST" and path == "/api/assets":
            self.handle_update_asset(None, body)
            return

        if path.startswith("/api/assets/"):
            parts = path[len("/api/assets/") :].split("/")
            if len(parts) == 2 and parts[1] == "history" and method == "GET":
                self.handle_asset_history(parts[0])
                return
            if len(parts) == 2 and parts[1] == "restore" and method == "POST":
                self.handle_restore_asset(parts[0], body)
                return
            if len(parts) == 1 and method == "POST":
                self.handle_update_asset(parts[0], body)
                return
            self.send_error_json(404, "not found")
            return

        if method == "POST" and path == "/api/device-credential":
            self.handle_device_credential(params, body)
            return

        if method == "POST" and path == "/api/operator/session":
            self.handle_operator_session(params)
            return

        if method == "POST" and path == "/api/share/session":
            self.handle_share_session(params, body)
            return

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

    def handle_update_asset(self, raw_asset_id: str | None, body: bytes) -> None:
        if not self.require_browser_session(None):
            return
        creating = raw_asset_id is None
        try:
            data = json.loads(body.decode("utf-8")) if body else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error_json(400, "invalid json")
            return
        if not isinstance(data, dict):
            self.send_error_json(400, "invalid json")
            return
        if creating:
            raw_asset_id = data.get("asset_id")
        asset_id = sanitize_asset_id(raw_asset_id)
        if not isinstance(raw_asset_id, str) or asset_id is None:
            self.send_error_json(400, "invalid asset id")
            return
        label = data.get("label")
        kind = data.get("kind")
        enabled = True if creating else data.get("enabled")
        if (
            not isinstance(label, str)
            or not label.strip()
            or len(label.strip()) > 80
            or any(ord(char) < 32 for char in label)
        ):
            self.send_error_json(400, "label must contain 1 to 80 printable characters")
            return
        if not isinstance(kind, str) or kind not in {"phone", "bag", "vehicle", "asset"}:
            self.send_error_json(400, "unsupported asset kind")
            return
        if not isinstance(enabled, bool):
            self.send_error_json(400, "enabled must be true or false")
            return

        conn = connect(self.db_path)
        try:
            conn.execute("BEGIN IMMEDIATE")
            if creating:
                try:
                    conn.execute(
                        """
                        INSERT INTO assets (asset_id, label, kind, enabled, created_at)
                        VALUES (?, ?, ?, 1, ?)
                        """,
                        (asset_id, label.strip(), kind, iso(utcnow())),
                    )
                except sqlite3.IntegrityError:
                    conn.rollback()
                    self.send_error_json(409, "asset code already exists")
                    return
                record_asset_settings(conn, asset_id, "initial")
            else:
                previous = conn.execute(
                    "SELECT label, kind, enabled FROM assets WHERE asset_id = ?",
                    (asset_id,),
                ).fetchone()
                cursor = conn.execute(
                    """
                    UPDATE assets
                    SET label = ?, kind = ?, enabled = ?
                    WHERE asset_id = ?
                    """,
                    (label.strip(), kind, int(enabled), asset_id),
                )
                if cursor.rowcount == 0:
                    conn.rollback()
                    self.send_error_json(404, "asset not found")
                    return
                if tuple(previous) != (label.strip(), kind, int(enabled)):
                    record_asset_settings(conn, asset_id, "edit")
            conn.commit()
            asset = conn.execute(
                """
                SELECT asset_id, label, kind, enabled
                FROM assets WHERE asset_id = ?
                """,
                (asset_id,),
            ).fetchone()
            self.send_json(
                201 if creating else 200,
                {
                    "asset": {
                        "asset_id": asset["asset_id"],
                        "label": asset["label"],
                        "kind": asset["kind"],
                        "enabled": bool(asset["enabled"]),
                    }
                },
            )
        finally:
            conn.close()

    def handle_asset_history(self, asset_id: str) -> None:
        if not self.require_browser_session(None):
            return
        conn = connect(self.db_path)
        try:
            if not conn.execute(
                "SELECT 1 FROM assets WHERE asset_id = ?", (asset_id,)
            ).fetchone():
                self.send_error_json(404, "asset not found")
                return
            rows = conn.execute(
                """
                SELECT * FROM asset_settings_history
                WHERE asset_id = ? ORDER BY id DESC LIMIT 50
                """,
                (asset_id,),
            ).fetchall()
            history = [
                {**dict(row), "enabled": bool(row["enabled"])} for row in rows
            ]
            self.send_json(200, {"history": history})
        finally:
            conn.close()

    def handle_restore_asset(self, asset_id: str, body: bytes) -> None:
        if not self.require_browser_session(None):
            return
        try:
            data = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error_json(400, "invalid json")
            return
        if not isinstance(data, dict) or any(
            type(data.get(key)) is not int or data[key] < 1
            for key in ("revision_id", "expected_revision_id")
        ):
            self.send_error_json(400, "positive revision ids are required")
            return
        conn = connect(self.db_path)
        try:
            conn.execute("BEGIN IMMEDIATE")
            latest = conn.execute(
                "SELECT id FROM asset_settings_history WHERE asset_id = ? ORDER BY id DESC LIMIT 1",
                (asset_id,),
            ).fetchone()
            target = conn.execute(
                "SELECT * FROM asset_settings_history WHERE asset_id = ? AND id = ?",
                (asset_id, data["revision_id"]),
            ).fetchone()
            if latest is None or target is None:
                self.send_error_json(404, "asset or revision not found")
                return
            if latest["id"] != data["expected_revision_id"]:
                self.send_error_json(409, "Settings changed. Reload the history before restoring.")
                return
            current = conn.execute(
                "SELECT label, kind, enabled FROM assets WHERE asset_id = ?", (asset_id,)
            ).fetchone()
            settings = (target["label"], target["kind"], target["enabled"])
            if tuple(current) != settings:
                conn.execute(
                    "UPDATE assets SET label = ?, kind = ?, enabled = ? WHERE asset_id = ?",
                    (*settings, asset_id),
                )
                record_asset_settings(conn, asset_id, "restore", target["id"])
            conn.commit()
            self.send_json(200, {"asset": {
                "asset_id": asset_id, "label": target["label"],
                "kind": target["kind"], "enabled": bool(target["enabled"]),
            }})
        finally:
            conn.close()

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
        if not self.require_browser_session(asset_id):
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
        if not self.require_device_authorized(params, asset_id):
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
                self.store_traccar_json(params, data)
                return
        merged = dict(params)
        merged.update(form_params(body))
        asset_id = sanitize_asset_id(
            merged.get("id") or merged.get("deviceid") or merged.get("device_id")
        )
        if asset_id is None:
            self.send_error_json(400, "device id missing or not an asset code")
            return
        if not self.require_device_authorized(params, asset_id):
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

    def store_traccar_json(self, params: dict, data: dict) -> None:
        location = data.get("location") if isinstance(data.get("location"), dict) else {}
        coords = location.get("coords") if isinstance(location.get("coords"), dict) else {}
        asset_id = sanitize_asset_id(data.get("device_id") or data.get("deviceId") or data.get("id"))
        if asset_id is None:
            self.send_error_json(400, "device id missing or not an asset code")
            return
        if not self.require_device_authorized(params, asset_id):
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

    def handle_device_credential(self, params: dict, body: bytes) -> None:
        if not self.token:
            self.send_error_json(503, "upload authorization is not configured")
            return
        if not self.authorized(params, allow_query=False):
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
        asset_id = sanitize_asset_id(data.get("asset_id"))
        if asset_id is None:
            self.send_error_json(400, "device id missing or not an asset code")
            return
        conn = connect(self.db_path)
        try:
            ensure_asset(conn, self.catalog, asset_id)
            conn.commit()
        finally:
            conn.close()
        self.send_json(
            200,
            {
                "asset_id": asset_id,
                "token": device_credential(self.token, asset_id),
            },
        )

    def handle_operator_session(self, params: dict) -> None:
        if not self.token:
            self.send_error_json(503, "upload authorization is not configured")
            return
        if not self.authorized(params, allow_query=False):
            self.send_error_json(401, "unauthorized")
            return
        self.send_json(
            200,
            {
                "token": self.new_browser_session("operator"),
                "expires_in": BROWSER_SESSION_SECONDS,
            },
        )

    def handle_share_session(self, params: dict, body: bytes) -> None:
        if not self.token:
            self.send_error_json(503, "upload authorization is not configured")
            return
        if not self.authorized(params, allow_query=False):
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
        asset_id = sanitize_asset_id(data.get("asset_id"))
        if asset_id is None:
            self.send_error_json(400, "device id missing or not an asset code")
            return
        self.send_json(
            200,
            {
                "token": self.new_browser_session("asset:" + asset_id),
                "asset_id": asset_id,
                "expires_in": BROWSER_SESSION_SECONDS,
            },
        )

    def new_browser_session(self, scope: str) -> str:
        return sign_browser_session(self.token, scope)

    def active_master_tokens(self) -> tuple[str, ...]:
        if not self.token:
            return ()
        if (
            self.retiring_token
            and self.retiring_until is not None
            and utcnow() < self.retiring_until
            and self.retiring_token != self.token
        ):
            return (self.token, self.retiring_token)
        return (self.token,)

    def require_device_authorized(self, params: dict, asset_id: str) -> bool:
        if not self.token:
            self.send_error_json(503, "upload authorization is not configured")
            return False
        supplied = self.authorization_candidate(params)
        if supplied and any(
            hmac.compare_digest(supplied, device_credential(secret, asset_id))
            for secret in self.active_master_tokens()
        ):
            return True
        self.send_error_json(401, "unauthorized")
        return False

    def require_browser_session(self, expected_scope: str | None) -> bool:
        if not self.token:
            self.send_error_json(503, "upload authorization is not configured")
            return False
        header = self.headers.get("Authorization", "")
        scope = None
        if header.lower().startswith("bearer "):
            scope = self.browser_session_scope(header.split(" ", 1)[1].strip())
        required_scope = (
            "operator"
            if expected_scope is None
            else "asset:" + expected_scope
        )
        if scope == required_scope:
            return True
        if scope is not None:
            self.send_error_json(403, "browser session is limited to another asset")
            return False
        self.send_error_json(401, "unauthorized")
        return False

    def browser_session_scope(self, supplied: str) -> str | None:
        if not self.token:
            return None
        try:
            encoded_payload, encoded_signature = supplied.split(".", 1)
            provided_signature = base64.urlsafe_b64decode(
                encoded_signature + "=" * (-len(encoded_signature) % 4)
            )
            if not any(
                hmac.compare_digest(
                    provided_signature,
                    hmac.new(
                        secret.encode("utf-8"),
                        encoded_payload.encode("ascii"),
                        hashlib.sha256,
                    ).digest(),
                )
                for secret in self.active_master_tokens()
            ):
                return None
            payload = base64.urlsafe_b64decode(
                encoded_payload + "=" * (-len(encoded_payload) % 4)
            ).decode("utf-8")
            expires_text, nonce, scope = payload.split(":", 2)
            expires_at = int(expires_text)
            if not nonce or int(utcnow().timestamp()) >= expires_at:
                return None
            if scope != "operator" and (
                not scope.startswith("asset:")
                or sanitize_asset_id(scope.removeprefix("asset:"))
                != scope.removeprefix("asset:")
            ):
                return None
            return scope
        except (ValueError, UnicodeDecodeError):
            return None

    def authorized(
        self,
        params: dict,
        *,
        allow_query: bool = True,
    ) -> bool:
        if not self.token:
            return False
        supplied = params.get("token") if allow_query else None
        header = self.headers.get("Authorization", "")
        if header.lower().startswith("basic "):
            try:
                decoded = base64.b64decode(header.split(" ", 1)[1].strip()).decode("utf-8")
            except (ValueError, UnicodeDecodeError):
                return False
            _, _, password = decoded.partition(":")
            supplied = password or supplied
        elif header.lower().startswith("bearer "):
            bearer = header.split(" ", 1)[1].strip()
            if any(hmac.compare_digest(bearer, secret) for secret in self.active_master_tokens()):
                return True
            supplied = bearer
        return bool(supplied) and any(
            hmac.compare_digest(supplied, secret)
            for secret in self.active_master_tokens()
        )

    def authorization_candidate(self, params: dict) -> str | None:
        supplied = params.get("token")
        header = self.headers.get("Authorization", "")
        if header.lower().startswith("basic "):
            try:
                decoded = base64.b64decode(header.split(" ", 1)[1].strip()).decode("utf-8")
            except (ValueError, UnicodeDecodeError):
                return None
            _, _, password = decoded.partition(":")
            return password or supplied
        if header.lower().startswith("bearer "):
            return header.split(" ", 1)[1].strip()
        return supplied

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
        page = path.read_text(encoding="utf-8")
        page = page.replace("__BASE_PATH__", self.base_path)
        self.send_bytes(200, page.encode("utf-8"), "text/html; charset=utf-8")

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


def serve(
    host: str,
    port: int,
    db_path: Path,
    token: str,
    base_path: str = "",
    disable_reset: bool = False,
    retiring_token: str = "",
    retiring_until: datetime | None = None,
) -> ThreadingHTTPServer:
    base_path = base_path.rstrip("/")
    if base_path and (not base_path.startswith("/") or "//" in base_path):
        raise ValueError("base path must be a single absolute URL prefix")
    if bool(retiring_token) != (retiring_until is not None):
        raise ValueError("retiring secret and its deadline must be configured together")
    if retiring_until is not None and retiring_until.tzinfo is None:
        raise ValueError("retiring secret deadline must include a timezone")
    if retiring_token and not token:
        raise ValueError("a current upload secret is required during rotation")
    if retiring_token and retiring_token == token:
        raise ValueError("retiring secret must differ from the current secret")
    catalog = load_catalog()
    init_db(db_path, catalog)
    Handler.db_path = str(db_path)
    Handler.catalog = catalog
    Handler.token = token
    Handler.retiring_token = retiring_token
    Handler.retiring_until = retiring_until
    Handler.base_path = base_path
    Handler.reset_enabled = not disable_reset
    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    parser = argparse.ArgumentParser(description="MyOS specimen GPS monitor")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--db", default=str(ROOT / "data" / "positions.sqlite"))
    parser.add_argument(
        "--token",
        default=None,
        help="Upload secret (prefer --token-env so the secret is not in process arguments).",
    )
    parser.add_argument(
        "--token-env",
        default="GPS_UPLOAD_TOKEN",
        help="Environment variable containing the upload secret (default: GPS_UPLOAD_TOKEN).",
    )
    parser.add_argument(
        "--retiring-token-env",
        default=DEFAULT_RETIRING_TOKEN_ENV,
        help=(
            "Environment variable containing the previous upload secret during rotation "
            f"(default: {DEFAULT_RETIRING_TOKEN_ENV})."
        ),
    )
    parser.add_argument(
        "--retiring-until-env",
        default=DEFAULT_RETIRING_UNTIL_ENV,
        help=(
            "Environment variable containing the retiring secret's ISO 8601 UTC deadline "
            f"(default: {DEFAULT_RETIRING_UNTIL_ENV})."
        ),
    )
    parser.add_argument(
        "--base-path",
        default="",
        help="Optional URL prefix for hosting this monitor behind a path router.",
    )
    parser.add_argument(
        "--disable-reset-endpoints",
        action="store_true",
        help="Disable the destructive demo reset endpoint.",
    )
    args = parser.parse_args()
    token = args.token if args.token is not None else os.environ.get(args.token_env, "")
    retiring_token = os.environ.get(args.retiring_token_env, "")
    retiring_until_value = os.environ.get(args.retiring_until_env, "")
    if bool(retiring_token) != bool(retiring_until_value):
        parser.error(
            f"{args.retiring_token_env} and {args.retiring_until_env} must be set together"
        )
    try:
        retiring_until = (
            parse_rotation_deadline(retiring_until_value)
            if retiring_until_value
            else None
        )
    except ValueError as exc:
        parser.error(str(exc))
    if retiring_token and not token:
        parser.error(f"{args.token_env} must be set while rotating upload secrets")
    if retiring_token and retiring_token == token:
        parser.error(f"{args.retiring_token_env} must differ from {args.token_env}")
    httpd = serve(
        args.host,
        args.port,
        Path(args.db),
        token,
        base_path=args.base_path,
        disable_reset=args.disable_reset_endpoints,
        retiring_token=retiring_token,
        retiring_until=retiring_until,
    )
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
