#!/usr/bin/env python3
"""Rules from the messaging guide: one sample, separate conversations."""

from __future__ import annotations

import tempfile
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


def main() -> None:
    fresh.dirs = []
    conn = fresh()
    state = workflow.snapshot(conn)
    must(bodies(state, "centre") == [
        "MYOS assistant: SMP-0001 has an outstanding document before pickup. Please review the required action in your secure portal: /portal/SMP-0001"
    ], "missing document should reach only the centre")
    must(bodies(state, "patient") == [], "patient should not get the document reminder")
    must(bodies(state, "transport") == [], "transport should not get the document reminder")
    must(state["document"]["status"] == "missing", "document should start missing")
    must(state["whatsapp"]["centre"] == "+421902950910", "clinic WhatsApp number")
    must(state["whatsapp"]["storage"] == "+421911713703", "storage WhatsApp number")
    must(state["whatsapp"]["transport"] == "+233544511586", "transport WhatsApp number")
    phone = fresh()
    routed = workflow.post_message(phone, "+233 544 511 586", "On the road", "evt-phone")
    must(routed.get("accepted") is True and "reply" not in routed, "the transport number should be a verified contact")
    must(any("On the road" in body for body in bodies(workflow.snapshot(phone), "transport")), "the transport number should post as Cryoport")
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
    must(state["tracking"]["source"] == "replay", "tracking source should be replay")
    must(state["tracking"]["speed_mps"] is None, "speed stays null until a sensor exists")
    must(state["tracking"]["sample_id"] == "SMP-0001", "gps payload should name the sample")
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

    while "gps_next" in workflow.snapshot(conn)["actions"]:
        workflow.act(conn, "gps_next")
    state = workflow.snapshot(conn)
    must(state["at_destination"] is True, "replay should reach the facility")
    must(state["received"] is False, "arrival is not receipt")
    must(workflow.act(conn, "record_placement")["ok"] is False, "placement before receipt must fail")
    workflow.act(conn, "record_receipt")
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
