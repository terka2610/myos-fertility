#!/usr/bin/env python3
"""WhatsApp routing for the three joined trial numbers. No live Twilio call."""

from __future__ import annotations

import io
import json
import os
import tempfile
from pathlib import Path
from urllib import error

import twilio_bridge
import workflow


def must(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


class Response:
    status = 201

    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def read(self) -> bytes:
        return self.payload

    def __enter__(self) -> "Response":
        return self

    def __exit__(self, *args) -> bool:
        return False


class Opener:
    def __init__(self, payload: bytes = b'{"sid":"SM123"}') -> None:
        self.payload = payload
        self.calls = []

    def __call__(self, req, timeout=0):
        self.calls.append(req)
        return Response(self.payload)


def fresh():
    tmp = tempfile.TemporaryDirectory()
    fresh.dirs.append(tmp)
    conn = workflow.connect(str(Path(tmp.name) / "demo.sqlite"))
    workflow.ensure(conn)
    return conn


def main() -> None:
    fresh.dirs = []
    saved = {key: os.environ.get(key) for key in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM")}
    try:
        os.environ.pop("TWILIO_ACCOUNT_SID", None)
        os.environ.pop("TWILIO_AUTH_TOKEN", None)
        quiet = Opener()
        missed = twilio_bridge.send_whatsapp("+971554611264", "hello", quiet)
        must(missed["sent"] is False and missed["detail"] == "Twilio is not configured", "missing secrets should not send")
        must(quiet.calls == [], "missing secrets should not call Twilio")

        os.environ["TWILIO_ACCOUNT_SID"] = "AC_test"
        os.environ["TWILIO_AUTH_TOKEN"] = "token-test"
        opener = Opener()
        sent = twilio_bridge.send_whatsapp("+971554611264", "Can you receive it?", opener)
        must(sent["sent"] is True and sent["detail"] == "SM123", "clinic send should be accepted")
        body = opener.calls[0].data.decode("utf-8")
        must("whatsapp%3A%2B971554611264" in body or "whatsapp:+971554611264" in body, "clinic should be the recipient")
        must("17372212163" in body, "clinic should use the sender it joined")
        must("token-test" not in body, "the auth token must stay out of the message body")
        must("Authorization" in opener.calls[0].headers, "the request should authenticate")

        storage = Opener()
        twilio_bridge.send_whatsapp("+971569890171", "Stored", storage)
        must("17372508034" in storage.calls[0].data.decode("utf-8"), "storage should use its joined sender")

        must(twilio_bridge.targets({"role": "centre", "body": "a"}) == ["+971554611264"], "clinic target")
        must(twilio_bridge.targets({"role": "agent", "body": "a"}) == ["+971585022715"], "announcements go to admin")
        must(twilio_bridge.targets({"role": "transport", "body": "a"}) == [], "Cryoport has no WhatsApp number")
        must(twilio_bridge.targets({"role": "patient", "body": "a"}) == [], "patient has no WhatsApp number")

        signed = twilio_bridge.signature("https://demo.example/api/twilio/whatsapp", {"Body": "yes", "From": "whatsapp:+971569890171"}, "token-test")
        must(twilio_bridge.signature_ok("https://demo.example/api/twilio/whatsapp", {"Body": "yes", "From": "whatsapp:+971569890171"}, signed), "valid signature")
        must(twilio_bridge.signature_ok("https://demo.example/api/twilio/whatsapp", {"Body": "yes", "From": "whatsapp:+971569890171"}, "nope") is False, "bad signature")

        conn = fresh()
        inbound = twilio_bridge.accept_inbound(conn, {
            "From": "whatsapp:+971554611264",
            "Body": "Where is SMP-0001?",
            "MessageSid": "SM-clinic-1",
        }, opener)
        must(inbound.get("accepted") is True, "clinic WhatsApp should be accepted")
        state = workflow.snapshot(conn)
        must(any("Where is SMP-0001?" in body for body in [item["body"] for item in state["conversations"]["centre"]]), "clinic WhatsApp should post as the clinic")
        must(any(item["phone"] == "+971554611264" and item["status"] == "sent" for item in state["deliveries"]), "the clinic reply should be delivered")

        again = twilio_bridge.accept_inbound(conn, {
            "From": "whatsapp:+971554611264",
            "Body": "Where is SMP-0001?",
            "MessageSid": "SM-clinic-1",
        }, opener)
        must(again.get("duplicate") is True, "Twilio retries should not post twice")
        must(again.get("whatsapp") == [], "a duplicate should not send another WhatsApp")

        unknown = twilio_bridge.accept_inbound(conn, {
            "From": "whatsapp:+19995550123",
            "Body": "Where is SMP-0001?",
            "MessageSid": "SM-stranger",
        }, opener)
        must("SMP-0001" not in unknown.get("reply", ""), "an unlisted number gets no shipment details")
        must(unknown["whatsapp"][0]["phone"] == "+19995550123", "the refusal goes back to the sender")

        def fail(req, timeout=0):
            raise error.HTTPError("https://api.twilio.com", 400, "bad", None, io.BytesIO(b'{"code":21608,"message":"template required"}'))

        failed = twilio_bridge.send_whatsapp("+971585022715", "hello", fail)
        must(failed["sent"] is False and "21608" in failed["detail"], "a Twilio refusal should stay on the message")
        must("token-test" not in json.dumps(failed), "a failure should not include the auth token")
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
    print("all checks passed")


if __name__ == "__main__":
    main()
