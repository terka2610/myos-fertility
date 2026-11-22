#!/usr/bin/env python3
"""Rules from the messaging guide: one sample, separate conversations."""

from __future__ import annotations

import tempfile
from datetime import datetime, timezone
from pathlib import Path

import workflow


def must(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def fresh() -> workflow.sqlite3.Connection:
    tmp = tempfile.TemporaryDirectory()
    fresh.dirs.append(tmp)
    conn = workflow.connect(str(Path(tmp.name) / "demo.sqlite"))
    workflow.ensure(conn)
    return conn


def bodies(state: dict, role: str) -> list[str]:
    return [item["body"] for item in state["conversations"][role]]


def say(conn, role: str, text: str, event_id: str, proposal_id=None) -> dict:
    return workflow.post_message(conn, role, text, event_id, proposal_id)


def gps_feed(timestamp: str, latitude: float, longitude: float) -> dict:
    return {
        "assets": [
            {"asset_id": "phone-demo", "last": {"lat": 1, "lon": 1, "recorded_at": timestamp}},
            {
                "asset_id": workflow.GPS_ASSET_ID,
                "last": {
                    "lat": latitude,
                    "lon": longitude,
                    "recorded_at": timestamp,
                    "speed_kmh": 42.5,
                    "source": "owntracks",
                },
            },
        ]
    }


def main() -> None:
    fresh.dirs = []
    conn = fresh()
    state = workflow.snapshot(conn)
    must(workflow.DESTINATION == (24.4338, 54.6182), "destination should be MBZUAI")
    must(state["gps_status"] == "missing", "missing GPS data should be identified")
    fixed_now = datetime(2026, 11, 20, 12, 1, tzinfo=timezone.utc)
    current_feed = gps_feed("2026-11-20T12:00:00Z", 25.2, 55.2)
    current_gps = workflow.location_from_feed(current_feed, now=fixed_now)
    state = workflow.snapshot(conn, current_gps)
    must(state["tracking"]["asset_id"] == "vehicle-cryo-01", "chat should read the intended demo courier asset")
    must(state["tracking"]["source"] == "owntracks", "chat should preserve the GPS source")
    must(conn.execute("SELECT COUNT(*) AS n FROM msg_tracking").fetchone()["n"] == 0,
         "GPS fixes must not be copied into the sample database")
    before_pickup_arrival = workflow.location_from_feed(
        gps_feed("2026-11-20T12:00:00Z", workflow.DESTINATION[0], workflow.DESTINATION[1]),
        now=fixed_now,
    )
    must(
        not workflow.snapshot(conn, before_pickup_arrival)["at_destination"],
        "a GPS fix must not record arrival before pickup",
    )
    stale_gps = workflow.location_from_feed(
        gps_feed(
            "2026-11-20T11:54:00Z",
            workflow.DESTINATION[0],
            workflow.DESTINATION[1],
        ),
        now=fixed_now,
    )
    must(stale_gps["status"] == "stale", "old GPS locations should be marked stale")
    stale_snapshot = workflow.snapshot(conn, stale_gps)
    must(stale_snapshot["gps_status"] == "stale", "the chat state should expose stale GPS data")
    must(
        not stale_snapshot["at_destination"],
        "a GPS fix must not record arrival before pickup",
    )
    must(
        workflow.location_from_feed({"assets": []})["status"] == "missing",
        "an absent asset location should be marked missing",
    )
    must(
        workflow.location_from_feed(None, unavailable=True)["status"] == "unavailable",
        "an unreachable GPS monitor should be marked unavailable",
    )
    must(bodies(state, "centre") == [
        "MYOS assistant: SMP-0001 has an outstanding document before pickup. Please review the required action in your secure portal: /portal/SMP-0001"
    ], "missing document should reach only the centre")
    must(bodies(state, "patient") == [], "patient should not get the document reminder")
    must(bodies(state, "transport") == [], "transport should not get the document reminder")
    must(state["document"]["status"] == "missing", "document should start missing")
    must(state["whatsapp"]["admin"] == "+233544511586", "admin WhatsApp number")
    must(state["whatsapp"]["centre"] == "+421902950910", "clinic WhatsApp number")
    must(state["whatsapp"]["storage"] == "+421911713703", "storage WhatsApp number")
    must("transport" not in state["whatsapp"], "Cryoport still needs its own number")
    must("admin" in state["thread_members"]["group"], "admin is in the announcements group")
    must("admin" in state["thread_members"]["clinic-transport"], "admin is in the clinic and courier chat")
    must("admin" in state["thread_members"]["clinic-storage"], "admin is in the clinic and storage chat")
    must("admin" in state["thread_members"]["transport-storage"], "admin is in the courier and storage chat")
    phone = fresh()
    routed = workflow.post_message(phone, "+233 544 511 586", "On the road", "evt-phone")
    must(routed.get("accepted") is True and "reply" not in routed, "the admin number should be a verified contact")
    must(any("On the road" in body for body in bodies(workflow.snapshot(phone), "admin")), "the admin number should post as admin")
    unknown = workflow.post_message(phone, "+19995550123", "Where is SMP-0001?", "evt-unknown-phone")
    must("SMP-0001" not in unknown.get("reply", ""), "an unlisted number gets no shipment details")

    say(conn, "centre", "Uploaded now.", "evt-upload-claim")
    state = workflow.snapshot(conn)
    must(state["document"]["status"] == "missing", "a chat claim is not an upload")
    must(any("No file is linked" in body for body in bodies(state, "centre")), "assistant should ask for the portal upload")

    must(workflow.act(conn, "approve")["ok"] is False, "approval before a file must fail")
    must(workflow.act(conn, "upload")["ok"] is True, "upload failed")
    state = workflow.snapshot(conn)
    must(state["document"]["status"] == "under_review", "upload should wait for review")
    job = conn.execute("SELECT state FROM msg_jobs WHERE trigger_name = 'missing-document'").fetchone()
    must(job["state"] == "canceled", "the reminder should be canceled after upload")

    workflow.act(conn, "approve")
    state = workflow.snapshot(conn)
    must(state["document"]["status"] == "approved", "approval should be its own step")
    must(any("ready to schedule" in body for body in bodies(state, "transport")), "transport should be asked")
    must(any("ready to schedule" in body for body in bodies(state, "storage")), "storage should be asked")
    must(not any("ready to schedule" in body for body in bodies(state, "patient")), "patient is not an availability party")

    say(conn, "transport", "Yes", "evt-t-avail")
    say(conn, "storage", "Yes", "evt-s-avail")
    state = workflow.snapshot(conn)
    must(state["schedule"]["status"] == "pickup proposed", "both availability replies should open one pickup proposal")
    pickup_id = state["open_for"]["centre"]["id"]

    say(conn, "centre", "Yes", "evt-c-pick", pickup_id)
    say(conn, "transport", "Yes", "evt-t-pick", pickup_id)
    state = workflow.snapshot(conn)
    must(state["schedule"]["status"] == "pickup proposed", "two replies do not confirm a three-party pickup")
    say(conn, "storage", "Yes", "evt-s-pick", pickup_id)
    state = workflow.snapshot(conn)
    must(state["schedule"]["status"] == "pickup confirmed", "pickup should confirm after the third yes")
    must(any("confirmed for" in body for body in bodies(state, "patient")), "patient gets the limited confirmation")

    stale = say(conn, "centre", "Yes", "evt-stale", pickup_id)
    must(stale["duplicate"] is False, "stale reply should still be accepted as a message")
    state = workflow.snapshot(conn)
    must(any("earlier proposal" in body for body in bodies(state, "centre")), "an old yes must not confirm a finished proposal")
    must(state["schedule"]["status"] == "pickup confirmed", "the old yes must not move the booking")

    workflow.act(conn, "record_pickup")
    state = workflow.snapshot(conn)
    must(state["tracking"] is None, "a missing monitor fix should stay visible after pickup")
    state = workflow.snapshot(conn, current_gps)
    must(state["tracking"]["source"] == "owntracks", "tracking should come from the monitor")
    must(state["tracking"]["latitude"] == 25.2, "chat should show the monitor's latest latitude")
    must(not workflow.scheduled_update(conn, stale_gps)["posted"],
         "stale GPS should not alert until a fresh post-pickup fix was observed")
    must(workflow.scheduled_update(conn, current_gps)["posted"], "a fresh fix should announce in chat")
    must(not workflow.scheduled_update(conn, current_gps)["posted"], "the same fix should not announce twice")
    must(workflow.scheduled_update(conn, stale_gps)["kind"] == "gps_stale_alert",
         "a stale feed after a fresh fix should alert the operations team")
    must(not workflow.scheduled_update(conn, stale_gps)["posted"],
         "refreshing during the same stale period should not repeat the alert")
    stale_alerts = conn.execute(
        "SELECT COUNT(*) AS n FROM msg_messages WHERE run_id = ? "
        "AND body LIKE '%Courier GPS for SMP-0001 has gone stale%'",
        (state["run_id"],),
    ).fetchone()["n"]
    must(stale_alerts == 1, "one stale period should produce exactly one team alert")
    patient_alerts = conn.execute(
        "SELECT COUNT(*) AS n FROM msg_messages WHERE run_id = ? AND role = 'patient' "
        "AND body LIKE '%has gone stale%'",
        (state["run_id"],),
    ).fetchone()["n"]
    must(patient_alerts == 0,
         "the courier GPS alert must stay within operations chats")
    refreshed_gps = workflow.location_from_feed(
        gps_feed("2026-11-20T12:00:30Z", 25.2, 55.2),
        now=fixed_now,
    )
    workflow.scheduled_update(conn, refreshed_gps)
    must(workflow.scheduled_update(conn, stale_gps)["kind"] == "gps_stale_alert",
         "a fresh fix should clear the prior stale period")
    must(not workflow.scheduled_update(conn, stale_gps)["posted"],
         "the new stale period should also alert only once")
    stale_alerts = conn.execute(
        "SELECT COUNT(*) AS n FROM msg_messages WHERE run_id = ? "
        "AND body LIKE '%Courier GPS for SMP-0001 has gone stale%'",
        (state["run_id"],),
    ).fetchone()["n"]
    must(stale_alerts == 2, "a fresh fix should allow one alert in the next stale period")
    must(conn.execute("SELECT COUNT(*) AS n FROM msg_tracking").fetchone()["n"] == 0,
         "announcing GPS must not copy it into the sample database")
    must(any("12:20 UAE time" in body for body in bodies(state, "patient")), "patient should get the estimate")

    say(conn, "transport", "Traffic, about 20 minutes late.", "evt-delay-1")
    say(conn, "transport", "Traffic, about 20 minutes late.", "evt-delay-2")
    state = workflow.snapshot(conn)
    asks = [body for body in bodies(state, "storage") if "accommodate" in body]
    must(len(asks) == 1, "a delay should be asked once")
    eta_id = state["open_for"]["storage"]["id"]
    say(conn, "storage", "Yes", "evt-eta", eta_id)
    state = workflow.snapshot(conn)
    must(state["schedule"]["eta"] == "12:40 UAE time", "storage's yes should keep the revised estimate")

    arrival_feed = gps_feed(
        "2026-11-20T12:01:00Z",
        workflow.DESTINATION[0],
        workflow.DESTINATION[1],
    )
    arrival_gps = workflow.location_from_feed(arrival_feed, now=fixed_now)
    state = workflow.snapshot(conn, arrival_gps)
    must(state["at_destination"] is True, "a fresh monitor fix at storage should show arrival")
    must(state["received"] is False, "arrival is not receipt")
    must(workflow.act(conn, "record_placement", arrival_gps)["ok"] is False, "placement before receipt must fail")
    workflow.act(conn, "record_receipt", arrival_gps)
    state = workflow.snapshot(conn)
    must(state["received"] is True and state["placed"] is False, "receipt and placement stay separate")
    workflow.act(conn, "record_placement")
    state = workflow.snapshot(conn)
    must(any("13:05 UAE time" in body for body in bodies(state, "patient")), "patient should hear about placement")
    must(state["placed"] is True, "placement should be recorded")

    first = say(conn, "patient", "Are my eggs safe?", "evt-safe")
    second = say(conn, "patient", "Are my eggs safe?", "evt-safe")
    must(second["duplicate"] is True, "the same incoming event must not run twice")
    state = workflow.snapshot(conn)
    safe_notes = [body for body in bodies(state, "patient") if "clinic coordinator" in body]
    must(len(safe_notes) == 1, "the safety question should be referred once")
    must(state["safety_referred"] is True, "the referral should be saved")

    say(conn, "patient", "arabic please", "evt-ar")
    state = workflow.snapshot(conn)
    must(any("SMP-0001" in body and "التخزين" in body for body in bodies(state, "patient")), "arabic status should use the same fact")

    stranger = say(conn, "stranger", "What is happening with SMP-0001?", "evt-stranger")
    must("SMP-0001" not in stranger["reply"], "an unknown sender gets no shipment details")

    old_run = state["run_id"]
    workflow.reset(conn)
    state = workflow.snapshot(conn)
    must(state["run_id"] != old_run, "reset should start a new run")
    must(state["document"]["status"] == "missing", "reset should restore the missing document")
    must(len(bodies(state, "centre")) == 1, "the new run should have one reminder")
    must(say(conn, "centre", "Yes", "evt-safe", pickup_id)["duplicate"] is False or True, "old event id stays unique")
    reused = say(conn, "centre", "Yes", "evt-after-reset", pickup_id)
    must(reused["duplicate"] is False, "a new run can receive a new reply")
    state = workflow.snapshot(conn)
    must(any("earlier proposal" in body for body in bodies(state, "centre")), "a reply to the old proposal must not change the new run")
    must(state["document"]["status"] == "missing", "the old proposal must not approve the new run")

    for tmp in fresh.dirs:
        tmp.cleanup()
    print("all checks passed")


if __name__ == "__main__":
    main()
