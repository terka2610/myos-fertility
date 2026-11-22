#!/usr/bin/env python3
"""Exercise setting history and safe restores against an isolated HTTP server."""

import json
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path

import server
from test_monitor import admin_post, request


class SettingsHistoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "positions.sqlite"
        self.secret = "isolated-history-test-secret"
        self.httpd = server.serve("127.0.0.1", 0, self.db, token=self.secret, base_path="/gps")
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}/gps"
        status, body = admin_post(self.base, "/api/operator/session", self.secret)
        self.assertEqual(status, 200)
        self.session = json.loads(body)["token"]
        self.asset_id = "bag-ship-01"
        self.path = "/api/assets/" + self.asset_id

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def history(self, path=None, token=None):
        return request(
            self.base + (path or self.path) + "/history",
            headers={"Authorization": "Bearer " + (token or self.session)},
        )

    def revisions(self):
        status, body = self.history()
        self.assertEqual(status, 200)
        return json.loads(body)["history"]

    def update(self, **changes):
        current = self.revisions()[0]
        payload = {key: current[key] for key in ("label", "kind", "enabled")}
        status, body = admin_post(self.base, self.path, self.session, {**payload, **changes})
        self.assertEqual(status, 200, body)

    def test_restore_retains_identity_positions_and_can_itself_be_undone(self):
        original = self.revisions()[0]
        server.insert_fix(
            str(self.db), {}, self.asset_id, 25.2, 55.2,
            accuracy=None, altitude=None, speed_kmh=None, course=None, battery=None,
            recorded_at=server.iso(server.utcnow()), source="test",
        )
        with sqlite3.connect(self.db) as conn:
            positions = conn.execute("SELECT * FROM positions ORDER BY id").fetchall()
            created_at = conn.execute(
                "SELECT created_at FROM assets WHERE asset_id = ?", (self.asset_id,)
            ).fetchone()
        self.update(label="Accidental name", kind="vehicle", enabled=False)
        edited = self.revisions()[0]
        self.assertEqual(len(self.revisions()), 2)
        payload = {"revision_id": original["id"], "expected_revision_id": edited["id"]}
        status, body = admin_post(self.base, self.path + "/restore", self.session, payload)
        self.assertEqual(status, 200, body)
        restored = json.loads(body)["asset"]
        for key in ("asset_id", "label", "kind", "enabled"):
            self.assertEqual(restored[key], original[key])
        history = self.revisions()
        self.assertEqual(history[0]["action"], "restore")
        self.assertEqual(history[0]["restored_from"], original["id"])
        self.assertEqual(len(history), 3)
        status, _ = admin_post(
            self.base, self.path + "/restore", self.session,
            {"revision_id": edited["id"], "expected_revision_id": history[0]["id"]},
        )
        self.assertEqual(status, 200)
        self.assertFalse(self.revisions()[0]["enabled"])
        with sqlite3.connect(self.db) as conn:
            self.assertEqual(conn.execute("SELECT * FROM positions ORDER BY id").fetchall(), positions)
            self.assertEqual(conn.execute(
                "SELECT created_at FROM assets WHERE asset_id = ?", (self.asset_id,)
            ).fetchone(), created_at)
        server.init_db(self.db, {})
        self.assertEqual(len(self.revisions()), 4, "restart duplicated history")

    def test_authorization_validation_conflicts_and_noop(self):
        original = self.revisions()[0]
        self.update()
        self.assertEqual(len(self.revisions()), 1, "no-op save added a revision")
        status, body = admin_post(
            self.base, "/api/share/session", self.secret, {"asset_id": self.asset_id}
        )
        self.assertEqual(status, 200)
        device_session = json.loads(body)["token"]
        valid = {"revision_id": original["id"], "expected_revision_id": original["id"]}
        for token in ("invalid", self.secret, device_session):
            self.assertIn(self.history(token=token)[0], (401, 403))
            self.assertIn(admin_post(
                self.base, self.path + "/restore", token, valid
            )[0], (401, 403))
        for payload in ({}, [], {"revision_id": True, "expected_revision_id": 1},
                        {**valid, "revision_id": -1}, {**valid, "revision_id": "1"}):
            self.assertEqual(admin_post(
                self.base, self.path + "/restore", self.session, payload
            )[0], 400)
        self.assertEqual(self.history(path="/api/assets/missing")[0], 404)
        self.assertEqual(admin_post(
            self.base, "/api/assets/phone-demo/restore", self.session, valid
        )[0], 404, "accepted a revision from a different asset")
        self.update(label="New setting")
        self.assertEqual(admin_post(
            self.base, self.path + "/restore", self.session, valid
        )[0], 409, "stale restore overwrote newer settings")
        self.assertEqual(self.revisions()[0]["label"], "New setting")

    def test_registration_and_first_upload_capture_initial_settings(self):
        status, _ = admin_post(self.base, "/api/assets", self.session, {
            "asset_id": "new-bag", "label": "New bag", "kind": "bag",
        })
        self.assertEqual(status, 201)
        conn = server.connect(str(self.db))
        try:
            server.ensure_asset(conn, {}, "new-phone")
            conn.commit()
        finally:
            conn.close()
        for asset_id in ("new-bag", "new-phone"):
            status, body = self.history(path="/api/assets/" + asset_id)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)["history"][0]["action"], "initial")

    def test_history_is_recent_first_and_limited(self):
        for index in range(52):
            self.update(label=f"Bag {index}")
        history = self.revisions()
        self.assertEqual(len(history), 50)
        self.assertEqual(history[0]["label"], "Bag 51")
        self.assertEqual(history[-1]["label"], "Bag 2")
        self.assertEqual(
            [row["id"] for row in history],
            sorted((row["id"] for row in history), reverse=True),
        )

    def test_existing_assets_get_one_baseline_on_upgrade(self):
        legacy_db = Path(self.tmp.name) / "legacy.sqlite"
        with sqlite3.connect(legacy_db) as conn:
            conn.execute("""
                CREATE TABLE assets (
                    asset_id TEXT PRIMARY KEY, kind TEXT NOT NULL,
                    label TEXT NOT NULL, created_at TEXT NOT NULL
                )
            """)
            conn.execute("INSERT INTO assets VALUES ('old-bag', 'bag', 'Original', '2020-01-01')")
        server.init_db(legacy_db, {})
        server.init_db(legacy_db, {})
        with sqlite3.connect(legacy_db) as conn:
            rows = conn.execute(
                "SELECT asset_id, label, kind, enabled, action FROM asset_settings_history"
            ).fetchall()
            self.assertEqual(rows, [("old-bag", "Original", "bag", 1, "initial")])


if __name__ == "__main__":
    unittest.main()
