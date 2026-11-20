"""Simulated MYOS conversations for SMP-0001.

Linq is not called. Each role has its own thread. A reply is a proposal
until a backend rule accepts it. Message delivered, reply received, and
task completed stay separate.
"""

from __future__ import annotations

import sqlite3

SAMPLE = "SMP-0001"
ROLES = ("centre", "transport", "storage", "patient")
ACCOUNTS = ("centre", "transport", "storage")
THREADS = {
    "group": ("centre", "transport", "storage"),
    "clinic-transport": ("centre", "transport"),
    "clinic-storage": ("centre", "storage"),
    "transport-storage": ("transport", "storage"),
}
PORTAL = "/portal/SMP-0001"

REPLAY = (
    ("2026-11-22T06:10:00Z", 24.4539, 54.3773),
    ("2026-11-22T07:00:00Z", 24.6200, 54.5200),
    ("2026-11-22T07:40:00Z", 24.7600, 54.7000),
    ("2026-11-22T08:20:00Z", 25.2048, 55.2708),
)

PICKUP_TIME = "10:00 UAE time on 22 November"
ETA_TIME = "12:20 UAE time"
DELAY_TIME = "12:40 UAE time"
PLACEMENT_TIME = "13:05 UAE time"

EXPECTED = {
    "availability": ("transport", "storage"),
    "pickup": ("centre", "transport", "storage"),
    "eta": ("storage",),
}


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS msg_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          active INTEGER NOT NULL DEFAULT 0,
          clock INTEGER NOT NULL DEFAULT 0,
          eta_text TEXT,
          eta_stale INTEGER NOT NULL DEFAULT 0,
          pickup_recorded INTEGER NOT NULL DEFAULT 0,
          at_destination INTEGER NOT NULL DEFAULT 0,
          received INTEGER NOT NULL DEFAULT 0,
          placed INTEGER NOT NULL DEFAULT 0,
          gps_index INTEGER NOT NULL DEFAULT 0,
          gps_stopped INTEGER NOT NULL DEFAULT 0,
          safety_referred INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS msg_documents (
          sample_id TEXT PRIMARY KEY,
          doc_type TEXT NOT NULL,
          owner_role TEXT NOT NULL,
          status TEXT NOT NULL,
          file_ref TEXT,
          version INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS msg_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          role TEXT NOT NULL,
          direction TEXT NOT NULL,
          body TEXT NOT NULL,
          event_id TEXT UNIQUE,
          idempotency_key TEXT UNIQUE,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS msg_proposals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          kind TEXT NOT NULL,
          version INTEGER NOT NULL,
          detail TEXT NOT NULL,
          status TEXT NOT NULL,
          UNIQUE (run_id, kind, version)
        );
        CREATE TABLE IF NOT EXISTS msg_responses (
          proposal_id INTEGER NOT NULL,
          role TEXT NOT NULL,
          response TEXT NOT NULL,
          UNIQUE (proposal_id, role)
        );
        CREATE TABLE IF NOT EXISTS msg_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          sample_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          speed_mps REAL,
          source TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS msg_custody (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          sample_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          actor TEXT NOT NULL,
          recorded_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS msg_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          trigger_name TEXT NOT NULL,
          recipient TEXT NOT NULL,
          state TEXT NOT NULL,
          idempotency_key TEXT UNIQUE
        );
        """
    )
    columns = [row[1] for row in conn.execute("PRAGMA table_info(msg_messages)")]
    if "thread" not in columns:
        conn.execute("ALTER TABLE msg_messages ADD COLUMN thread TEXT NOT NULL DEFAULT 'group'")
    conn.commit()
    if conn.execute("SELECT id FROM msg_runs WHERE active = 1").fetchone() is None:
        reset(conn)


def reset(conn: sqlite3.Connection) -> dict:
    conn.execute("UPDATE msg_runs SET active = 0 WHERE active = 1")
    conn.execute("UPDATE msg_jobs SET state = 'canceled' WHERE state = 'queued'")
    conn.execute(
        """
        INSERT INTO msg_runs (active, eta_text)
        VALUES (1, ?)
        """,
        (ETA_TIME,),
    )
    conn.execute(
        """
        INSERT INTO msg_documents (sample_id, doc_type, owner_role, status, file_ref, version)
        VALUES (?, 'transfer_document', 'centre', 'missing', NULL, 1)
        ON CONFLICT(sample_id) DO UPDATE SET
          status = 'missing', file_ref = NULL, version = 1, owner_role = 'centre'
        """,
        (SAMPLE,),
    )
    conn.commit()
    _say(
        conn,
        "centre",
        "MYOS assistant: SMP-0001 has an outstanding document before pickup. "
        "Please review the required action in your secure portal: " + PORTAL,
        "missing-document:centre",
    )
    _job(conn, "missing-document", "centre", "queued")
    conn.commit()
    return snapshot(conn)


def snapshot(conn: sqlite3.Connection) -> dict:
    run = _run(conn)
    document = conn.execute("SELECT * FROM msg_documents WHERE sample_id = ?", (SAMPLE,)).fetchone()
    tracking = conn.execute(
        """
        SELECT timestamp, latitude, longitude, speed_mps, source
        FROM msg_tracking WHERE run_id = ? ORDER BY id DESC LIMIT 1
        """,
        (run["id"],),
    ).fetchone()
    custody = conn.execute(
        """
        SELECT event_type, actor, recorded_at FROM msg_custody
        WHERE run_id = ? ORDER BY id
        """,
        (run["id"],),
    ).fetchall()
    conversations = {}
    for role in ROLES:
        rows = conn.execute(
            """
            SELECT direction, body, created_at FROM msg_messages
            WHERE run_id = ? AND role = ? ORDER BY id
            """,
            (run["id"], role),
        ).fetchall()
        conversations[role] = [dict(row) for row in rows]
    point = None
    if tracking is not None:
        point = {
            "sample_id": SAMPLE,
            "timestamp": tracking["timestamp"],
            "latitude": tracking["latitude"],
            "longitude": tracking["longitude"],
            "speed_mps": tracking["speed_mps"],
            "source": tracking["source"],
        }
    schedule_status = "not proposed"
    open_pickup = _open_proposal(conn, "pickup")
    if run["placed"]:
        schedule_status = "placed in storage"
    elif run["received"]:
        schedule_status = "received, placement not recorded"
    elif run["at_destination"]:
        schedule_status = "at destination, receipt not recorded"
    elif run["pickup_recorded"]:
        schedule_status = "pickup recorded"
    elif open_pickup is not None:
        schedule_status = "pickup proposed"
    elif _confirmed(conn, "pickup"):
        schedule_status = "pickup confirmed"
    elif document["status"] == "approved":
        schedule_status = "asking availability"
    return {
        "sample_id": SAMPLE,
        "run_id": run["id"],
        "simulated": True,
        "provider": "simulated-chat",
        "document": {
            "status": document["status"],
            "owner_role": document["owner_role"],
            "file_ref": document["file_ref"],
            "version": document["version"],
        },
        "schedule": {
            "status": schedule_status,
            "pickup": PICKUP_TIME,
            "eta": run["eta_text"],
            "eta_stale": bool(run["eta_stale"]),
            "zone": "UAE time (UTC+4)",
        },
        "tracking": point,
        "gps_index": run["gps_index"],
        "gps_total": len(REPLAY),
        "at_destination": bool(run["at_destination"]),
        "received": bool(run["received"]),
        "placed": bool(run["placed"]),
        "safety_referred": bool(run["safety_referred"]),
        "custody": [dict(row) for row in custody],
        "conversations": conversations,
        "actions": _actions(conn, run, document),
        "hint": _hint(conn, run, document),
        "open_for": _open_for(conn),
        "accounts": list(ACCOUNTS),
        "threads": _thread_messages(conn, run["id"]),
        "thread_members": {name: list(members) for name, members in THREADS.items()},
    }


def post_message(conn: sqlite3.Connection, role: str, text: str, event_id: str, proposal_id: int | None = None, thread: str | None = None) -> dict:
    text = (text or "").strip()
    if not text:
        return {"error": "empty message"}
    if role not in ROLES:
        conn.commit()
        return {
            "accepted": True,
            "duplicate": False,
            "reply": "MYOS assistant: This number is not a verified contact.",
        }
    if role == "patient":
        thread = "group"
    else:
        thread = thread or _default_thread(role)
        if thread not in THREADS or role not in THREADS[thread]:
            return {"accepted": False, "error": "this account is not in that chat"}
    try:
        conn.execute(
            "INSERT INTO msg_messages (run_id, role, direction, body, event_id, created_at, thread) VALUES (?, ?, 'in', ?, ?, ?, ?)",
            (_run(conn)["id"], role, text, event_id, _tick(conn), thread),
        )
    except sqlite3.IntegrityError:
        conn.rollback()
        return {"accepted": True, "duplicate": True}
    _interpret(conn, role, text, proposal_id, thread)
    conn.commit()
    return {"accepted": True, "duplicate": False}


def act(conn: sqlite3.Connection, action: str) -> dict:
    run = _run(conn)
    document = conn.execute("SELECT * FROM msg_documents WHERE sample_id = ?", (SAMPLE,)).fetchone()
    if action not in _actions(conn, run, document):
        return {"ok": False, "error": "not allowed yet"}
    if action == "upload":
        conn.execute(
            "UPDATE msg_documents SET status = 'under_review', file_ref = ? WHERE sample_id = ?",
            (PORTAL + "/transfer-document.pdf", SAMPLE),
        )
        conn.execute(
            "UPDATE msg_jobs SET state = 'canceled' WHERE trigger_name = 'missing-document' AND state = 'queued' AND run_id = ?",
            (run["id"],),
        )
        _say(conn, "centre", "MYOS assistant: The upload is received and awaiting review.", "upload-received:centre")
    elif action == "approve":
        conn.execute("UPDATE msg_documents SET status = 'approved' WHERE sample_id = ?", (SAMPLE,))
        _open(conn, "availability", 1, "pickup availability")
        _say(conn, "transport", "MYOS assistant: SMP-0001 is ready to schedule. Can you pick up at " + PICKUP_TIME + "?", "availability:transport")
        _say(conn, "storage", "MYOS assistant: SMP-0001 is ready to schedule. Can you receive it after pickup at " + PICKUP_TIME + "?", "availability:storage")
    elif action == "record_pickup":
        conn.execute("UPDATE msg_runs SET pickup_recorded = 1 WHERE id = ?", (run["id"],))
        _custody(conn, "pickup", "transport")
        _point(conn, 0)
        _say(conn, "centre", "MYOS assistant: Pickup for SMP-0001 has been recorded. Estimated arrival is " + ETA_TIME + ".", "pickup-recorded:centre")
        _say(conn, "storage", "MYOS assistant: Pickup for SMP-0001 has been recorded. Estimated arrival is " + ETA_TIME + ".", "pickup-recorded:storage")
        _say(conn, "patient", "MYOS assistant: Pickup for SMP-0001 has been recorded. Estimated arrival is " + ETA_TIME + ".", "pickup-recorded:patient")
        _announce(conn, ("group", "clinic-transport", "clinic-storage"), _shipped_text(conn), "shipped")
    elif action == "gps_next":
        _point(conn, run["gps_index"])
        latest = _run(conn)
        _announce(conn, ("group", "transport-storage"), _position_text(conn), "gps:" + str(latest["gps_index"]))
        if latest["at_destination"]:
            _say(
                conn,
                "storage",
                "MYOS assistant: The courier for SMP-0001 is at the receiving facility. GPS does not confirm receipt. Please record receipt in the portal.",
                "arrived:storage",
            )
    elif action == "gps_stop":
        conn.execute("UPDATE msg_runs SET gps_stopped = 1, eta_stale = 1 WHERE id = ?", (run["id"],))
    elif action == "record_receipt":
        conn.execute("UPDATE msg_runs SET received = 1 WHERE id = ?", (run["id"],))
        _custody(conn, "receipt", "storage")
        _say(conn, "centre", "MYOS assistant: Receipt of SMP-0001 was recorded by storage. Placement is still a separate step.", "receipt:centre")
        _say(conn, "transport", "MYOS assistant: Receipt of SMP-0001 was recorded by storage. Placement is still a separate step.", "receipt:transport")
    elif action == "record_placement":
        conn.execute("UPDATE msg_runs SET placed = 1 WHERE id = ?", (run["id"],))
        _custody(conn, "placement", "storage")
        _say(conn, "centre", "MYOS assistant: The receiving facility recorded placement of SMP-0001 into storage at " + PLACEMENT_TIME + ".", "placement:centre")
        _say(conn, "patient", "MYOS assistant: The receiving facility recorded placement of SMP-0001 into storage at " + PLACEMENT_TIME + ". You can view the update in your portal.", "placement:patient")
    conn.commit()
    return {"ok": True}


def _interpret(conn: sqlite3.Connection, role: str, text: str, proposal_id: int | None, thread: str) -> None:
    folded = text.lower()
    if _asks_safety(folded, text):
        _refer_safety(conn, role)
        return
    if _is_question(folded):
        _say(conn, role, _answer_from_record(conn), "answer:" + thread + ":" + str(_run(conn)["clock"]), thread)
        return
    if "arabic" in folded or "عربي" in text:
        _say(conn, role, _arabic_status(conn), "arabic:" + role + ":" + str(_run(conn)["clock"]))
        return
    if role == "centre" and "upload" in folded:
        document = conn.execute("SELECT file_ref, status FROM msg_documents WHERE sample_id = ?", (SAMPLE,)).fetchone()
        if document["file_ref"] is None:
            _say(conn, "centre", "MYOS assistant: No file is linked to SMP-0001 yet. Please upload it in the portal.", "no-file:" + str(_run(conn)["clock"]))
        else:
            _say(conn, "centre", "MYOS assistant: The upload is received and awaiting review.", "upload-state:" + str(_run(conn)["clock"]))
        return
    if role == "transport" and ("traffic" in folded or "late" in folded):
        _delay(conn)
        return
    if folded in ("yes", "yes.", "confirmed", "ok", "okay") or folded.startswith("yes "):
        _confirm(conn, role, proposal_id)
        return
    _say(conn, role, "MYOS assistant: Reply yes to confirm the open proposal, or use the portal for the document, pickup, receipt, and placement.", "help:" + role + ":" + str(_run(conn)["clock"]))


def _confirm(conn: sqlite3.Connection, role: str, proposal_id: int | None) -> None:
    if proposal_id is not None:
        target = conn.execute(
            "SELECT * FROM msg_proposals WHERE id = ? AND run_id = ?",
            (proposal_id, _run(conn)["id"]),
        ).fetchone()
        if target is None or target["status"] != "open" or role not in EXPECTED[target["kind"]]:
            _say(conn, role, "MYOS assistant: That confirmation is for an earlier proposal and was not applied.", "stale-yes:" + role + ":" + str(_run(conn)["clock"]))
            return
        proposal = target
    else:
        proposal = _newest_open_for(conn, role)
        if proposal is None:
            _say(conn, role, "MYOS assistant: There is no open proposal to confirm.", "no-proposal:" + role + ":" + str(_run(conn)["clock"]))
            return
    conn.execute(
        "INSERT OR IGNORE INTO msg_responses (proposal_id, role, response) VALUES (?, ?, 'yes')",
        (proposal["id"], role),
    )
    if _all_yes(conn, proposal):
        conn.execute("UPDATE msg_proposals SET status = 'confirmed' WHERE id = ?", (proposal["id"],))
        _advance(conn, proposal)
    else:
        _say(conn, role, "MYOS assistant: Your confirmation is recorded.", "ack:" + role + ":" + str(proposal["id"]))


def _advance(conn: sqlite3.Connection, proposal: sqlite3.Row) -> None:
    if proposal["kind"] == "availability":
        _open(conn, "pickup", 1, PICKUP_TIME)
        text = "MYOS assistant: Pickup for SMP-0001 is proposed for " + PICKUP_TIME + ". Reply yes to confirm this proposal."
        for role in ("centre", "transport", "storage"):
            _say(conn, role, text, "pickup-proposal:" + role)
    elif proposal["kind"] == "pickup":
        text = "MYOS assistant: Pickup for SMP-0001 is confirmed for " + PICKUP_TIME + "."
        for role in ("centre", "transport", "storage"):
            _say(conn, role, text, "pickup-confirmed:" + role)
        _say(conn, "patient", "MYOS assistant: Pickup for SMP-0001 is confirmed for " + PICKUP_TIME + ". Updates will appear in your portal.", "pickup-confirmed:patient")
    elif proposal["kind"] == "eta":
        conn.execute("UPDATE msg_runs SET eta_text = ?, eta_stale = 0 WHERE id = ?", (DELAY_TIME, _run(conn)["id"]))
        _say(conn, "storage", "MYOS assistant: The revised arrival for SMP-0001 is accepted.", "eta-accepted:storage")
        _say(conn, "centre", "MYOS assistant: The current estimated arrival for SMP-0001 is " + DELAY_TIME + ".", "eta-accepted:centre")
        _say(conn, "patient", "MYOS assistant: The current estimated arrival for SMP-0001 is " + DELAY_TIME + ". Your portal shows the latest update.", "eta-accepted:patient")


def _delay(conn: sqlite3.Connection) -> None:
    run = _run(conn)
    if not run["pickup_recorded"]:
        _say(conn, "transport", "MYOS assistant: Pickup is not recorded yet, so there is no arrival time to revise.", "delay-too-early")
        return
    if _open_proposal(conn, "eta") is not None:
        return
    version = 1 + conn.execute("SELECT COUNT(*) AS n FROM msg_proposals WHERE run_id = ? AND kind = 'eta'", (run["id"],)).fetchone()["n"]
    conn.execute("UPDATE msg_proposals SET status = 'superseded' WHERE run_id = ? AND kind = 'eta' AND status = 'open'", (run["id"],))
    _open(conn, "eta", version, DELAY_TIME)
    _say(conn, "storage", "MYOS assistant: SMP-0001 now has a courier-reported ETA of " + DELAY_TIME + ". Can your receiving team accommodate that time?", "eta-ask:" + str(version))
    _say(conn, "centre", "MYOS assistant: The courier reported a later ETA for SMP-0001. The estimate is now " + DELAY_TIME + ".", "eta-note-centre:" + str(version))
    _say(conn, "patient", "MYOS assistant: The current estimated arrival for SMP-0001 is " + DELAY_TIME + ". Your portal shows the latest update.", "eta-note-patient:" + str(version))


def _refer_safety(conn: sqlite3.Connection, role: str) -> None:
    conn.execute("UPDATE msg_runs SET safety_referred = 1 WHERE id = ?", (_run(conn)["id"],))
    status = _fact(conn)
    _say(
        conn,
        role,
        "MYOS assistant: The latest recorded status is " + status + ". I will refer your safety question to your clinic coordinator.",
        "safety:" + role + ":" + str(_run(conn)["clock"]),
    )


def _arabic_status(conn: sqlite3.Connection) -> str:
    phrases = {
        "document outstanding": "المستند ما زال مطلوباً قبل الاستلام",
        "document under review": "المستند وصل وهو بانتظار المراجعة",
        "document approved": "المستند تمت مراجعته",
        "pickup confirmed": "موعد الاستلام مؤكد عند 10:00 بتوقيت الإمارات في 22 نوفمبر",
        "pickup recorded": "تم تسجيل الاستلام، والوصول التقديري 12:20 بتوقيت الإمارات",
        "eta revised": "الوصول التقديري الحالي 12:40 بتوقيت الإمارات",
        "at destination": "الناقل عند جهة الاستلام، ولم يُسجل الاستلام بعد",
        "received": "تم تسجيل الاستلام، ولم يُسجل وضع العينة في التخزين بعد",
        "placed": "تم تسجيل وضع SMP-0001 في التخزين عند 13:05 بتوقيت الإمارات",
    }
    return "MYOS assistant: الحالة المسجلة لـ SMP-0001: " + phrases[_fact_key(conn)] + "."


def _fact(conn: sqlite3.Connection) -> str:
    labels = {
        "document outstanding": "document outstanding",
        "document under review": "document under review",
        "document approved": "document approved",
        "pickup confirmed": "pickup confirmed for " + PICKUP_TIME,
        "pickup recorded": "pickup recorded, estimated arrival " + _run(conn)["eta_text"],
        "eta revised": "estimated arrival " + DELAY_TIME,
        "at destination": "at the receiving facility, receipt not recorded",
        "received": "received, placement not recorded",
        "placed": "placed in storage at " + PLACEMENT_TIME,
    }
    return labels[_fact_key(conn)]


def _fact_key(conn: sqlite3.Connection) -> str:
    run = _run(conn)
    if run["placed"]:
        return "placed"
    if run["received"]:
        return "received"
    if run["at_destination"]:
        return "at destination"
    if run["pickup_recorded"] and run["eta_text"] == DELAY_TIME:
        return "eta revised"
    if run["pickup_recorded"]:
        return "pickup recorded"
    if _confirmed(conn, "pickup"):
        return "pickup confirmed"
    document = conn.execute("SELECT status FROM msg_documents WHERE sample_id = ?", (SAMPLE,)).fetchone()
    if document["status"] == "approved":
        return "document approved"
    if document["status"] == "under_review":
        return "document under review"
    return "document outstanding"


def _asks_safety(folded: str, text: str) -> bool:
    return "safe" in folded or "آمن" in text


def _actions(conn: sqlite3.Connection, run: sqlite3.Row, document: sqlite3.Row) -> list[str]:
    actions = []
    if document["status"] == "missing":
        actions.append("upload")
    if document["status"] == "under_review":
        actions.append("approve")
    if _confirmed(conn, "pickup") and not run["pickup_recorded"]:
        actions.append("record_pickup")
    if run["pickup_recorded"] and not run["gps_stopped"] and not run["at_destination"] and run["gps_index"] < len(REPLAY):
        actions.append("gps_next")
    if run["pickup_recorded"] and not run["gps_stopped"] and not run["at_destination"]:
        actions.append("gps_stop")
    if run["at_destination"] and not run["received"]:
        actions.append("record_receipt")
    if run["received"] and not run["placed"]:
        actions.append("record_placement")
    return actions


def _hint(conn: sqlite3.Connection, run: sqlite3.Row, document: sqlite3.Row) -> str:
    if document["status"] == "missing":
        return "The fertility centre still has to upload the document. A chat reply does not complete it."
    if document["status"] == "under_review":
        return "The file is in. Approval is a separate step."
    if _open_any(conn):
        return "Reply yes in the conversation that received the proposal. An older yes does not confirm a new time."
    if _confirmed(conn, "pickup") and not run["pickup_recorded"]:
        return "Pickup is confirmed. Transport can record the handoff."
    if run["pickup_recorded"] and not run["at_destination"]:
        return "Advance the replay, or mark tracking stopped. Arrival is not receipt."
    if run["at_destination"] and not run["received"]:
        return "Storage records receipt. The map pin does not do that."
    if run["received"] and not run["placed"]:
        return "Storage records placement in the tank."
    if run["placed"]:
        return "Placement is recorded. Reset starts a new demo run."
    return "Confirm the open proposal from each party that was asked."


def _open_for(conn: sqlite3.Connection) -> dict:
    found = {}
    for role in ROLES:
        row = _newest_open_for(conn, role)
        found[role] = None if row is None else {
            "id": row["id"],
            "version": row["version"],
            "kind": row["kind"],
            "detail": row["detail"],
        }
    return found


def _open_any(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT id FROM msg_proposals WHERE run_id = ? AND status = 'open' LIMIT 1",
        (_run(conn)["id"],),
    ).fetchone()
    return row is not None


def _point(conn: sqlite3.Connection, index: int) -> None:
    stamp, lat, lon = REPLAY[index]
    run = _run(conn)
    conn.execute(
        """
        INSERT INTO msg_tracking (run_id, sample_id, timestamp, latitude, longitude, speed_mps, source)
        VALUES (?, ?, ?, ?, ?, NULL, 'replay')
        """,
        (run["id"], SAMPLE, stamp, lat, lon),
    )
    arrived = index + 1 >= len(REPLAY)
    conn.execute(
        "UPDATE msg_runs SET gps_index = ?, at_destination = ? WHERE id = ?",
        (index + 1, 1 if arrived else 0, run["id"]),
    )


def _custody(conn: sqlite3.Connection, event_type: str, actor: str) -> None:
    stamp = _tick(conn)
    conn.execute(
        "INSERT INTO msg_custody (run_id, sample_id, event_type, actor, recorded_at) VALUES (?, ?, ?, ?, ?)",
        (_run(conn)["id"], SAMPLE, event_type, actor, stamp),
    )


def _open(conn: sqlite3.Connection, kind: str, version: int, detail: str) -> None:
    conn.execute(
        """
        INSERT INTO msg_proposals (run_id, kind, version, detail, status)
        VALUES (?, ?, ?, ?, 'open')
        """,
        (_run(conn)["id"], kind, version, detail),
    )


def _open_proposal(conn: sqlite3.Connection, kind: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM msg_proposals WHERE run_id = ? AND kind = ? AND status = 'open' ORDER BY id DESC LIMIT 1",
        (_run(conn)["id"], kind),
    ).fetchone()


def _confirmed(conn: sqlite3.Connection | None, kind: str) -> bool:
    if conn is None:
        return False
    row = conn.execute(
        "SELECT id FROM msg_proposals WHERE run_id = ? AND kind = ? AND status = 'confirmed' ORDER BY id DESC LIMIT 1",
        (_run(conn)["id"], kind),
    ).fetchone()
    return row is not None


def _newest_open_for(conn: sqlite3.Connection, role: str) -> sqlite3.Row | None:
    rows = conn.execute(
        "SELECT * FROM msg_proposals WHERE run_id = ? AND status = 'open' ORDER BY id DESC",
        (_run(conn)["id"],),
    ).fetchall()
    for row in rows:
        if role in EXPECTED[row["kind"]]:
            return row
    return None


def _all_yes(conn: sqlite3.Connection, proposal: sqlite3.Row) -> bool:
    count = conn.execute(
        "SELECT COUNT(*) AS n FROM msg_responses WHERE proposal_id = ? AND response = 'yes'",
        (proposal["id"],),
    ).fetchone()["n"]
    return count == len(EXPECTED[proposal["kind"]])


def scheduled_update(conn: sqlite3.Connection) -> dict:
    run = _run(conn)
    if not run["pickup_recorded"] or run["placed"]:
        return {"posted": False}
    _announce(conn, ("group",), _position_text(conn) if run["gps_index"] else _fact(conn), "schedule:" + str(run["gps_index"]) + ":" + str(run["eta_text"]))
    conn.commit()
    return {"posted": True}


def _say(conn: sqlite3.Connection, role: str, body: str, key: str, thread: str | None = None) -> None:
    run_id = _run(conn)["id"]
    full_key = str(run_id) + ":" + key
    conn.execute(
        """
        INSERT OR IGNORE INTO msg_messages (run_id, role, direction, body, idempotency_key, created_at, thread)
        VALUES (?, ?, 'out', ?, ?, ?, ?)
        """,
        (run_id, role, body, full_key, _tick(conn), thread or _default_thread(role)),
    )


def _announce(conn: sqlite3.Connection, threads: tuple, body: str, key: str) -> None:
    for thread in threads:
        _say(conn, "agent", body, key + ":" + thread, thread)


def _default_thread(role: str) -> str:
    if role == "centre":
        return "clinic-transport"
    if role == "storage":
        return "clinic-storage"
    if role == "transport":
        return "transport-storage"
    return "group"


def _thread_messages(conn: sqlite3.Connection, run_id: int) -> dict:
    found = {name: [] for name in THREADS}
    rows = conn.execute(
        """
        SELECT thread, role, direction, body, created_at FROM msg_messages
        WHERE run_id = ? ORDER BY id
        """,
        (run_id,),
    ).fetchall()
    for row in rows:
        thread = row["thread"] if row["thread"] in found else "group"
        found[thread].append({
            "sender": row["role"],
            "direction": row["direction"],
            "body": row["body"],
            "created_at": row["created_at"],
        })
    return found


def _is_question(folded: str) -> bool:
    markers = ("where", "eta", "arrive", "arrival", "status", "document", "location", "how long", "shipped", "?")
    return any(marker in folded for marker in markers)


def _answer_from_record(conn: sqlite3.Connection) -> str:
    state = _fact(conn)
    run = _run(conn)
    point = conn.execute(
        "SELECT latitude, longitude, timestamp FROM msg_tracking WHERE run_id = ? ORDER BY id DESC LIMIT 1",
        (run["id"],),
    ).fetchone()
    place = "No GPS point is recorded yet."
    if point is not None:
        place = "Latest recorded position is %.5f, %.5f at %s." % (point["latitude"], point["longitude"], point["timestamp"])
    eta = run["eta_text"] or ETA_TIME
    if run["eta_stale"]:
        eta = eta + ", and that estimate is stale"
    return (
        "MYOS assistant: The recorded status of SMP-0001 is " + state
        + ". Estimated arrival is " + eta
        + ". " + place + " This answer uses the saved record only."
    )


def _shipped_text(conn: sqlite3.Connection) -> str:
    return "MYOS assistant: SMP-0001 has been shipped from the fertility clinic. " + _answer_from_record(conn).replace("MYOS assistant: ", "")


def _position_text(conn: sqlite3.Connection) -> str:
    run = _run(conn)
    return "MYOS assistant: GPS update for SMP-0001, point %s of %s. %s" % (
        run["gps_index"], len(REPLAY), _answer_from_record(conn).replace("MYOS assistant: ", "")
    )


def _job(conn: sqlite3.Connection, trigger: str, recipient: str, state: str) -> None:
    run_id = _run(conn)["id"]
    conn.execute(
        """
        INSERT OR IGNORE INTO msg_jobs (run_id, trigger_name, recipient, state, idempotency_key)
        VALUES (?, ?, ?, ?, ?)
        """,
        (run_id, trigger, recipient, state, str(run_id) + ":" + trigger + ":" + recipient),
    )


def _tick(conn: sqlite3.Connection) -> str:
    run = _run(conn)
    conn.execute("UPDATE msg_runs SET clock = clock + 1 WHERE id = ?", (run["id"],))
    clock = run["clock"] + 1
    return "2026-11-22T05:%02d:%02dZ" % (clock // 60, clock % 60)


def _run(conn: sqlite3.Connection) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM msg_runs WHERE active = 1").fetchone()
    if row is None:
        raise RuntimeError("no active demo run")
    return row
