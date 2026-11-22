"""Send and receive the SMP-0001 WhatsApp thread through Twilio.

The account SID and auth token stay in the environment. The chat still
runs when those values are absent.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sqlite3
from datetime import datetime, timezone
from urllib import error, parse, request

import workflow


def configured() -> bool:
    return bool(os.environ.get("TWILIO_ACCOUNT_SID") and os.environ.get("TWILIO_AUTH_TOKEN"))


def digits(value: str) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def whatsapp_address(number: str) -> str:
    return "whatsapp:+" + digits(number)


def sender_for(number: str) -> str:
    target = digits(number)
    for saved, sender in workflow.WHATSAPP_FROM.items():
        if digits(saved) == target:
            return "+" + digits(sender)
    fallback = os.environ.get("TWILIO_WHATSAPP_FROM", "+17372508034")
    return "+" + digits(fallback)


def targets(message: dict) -> list[str]:
    role = message.get("role") or ""
    if role in workflow.WHATSAPP:
        return [workflow.WHATSAPP[role]]
    if role == "agent":
        admin = workflow.WHATSAPP.get("admin")
        return [admin] if admin else []
    return []


def signature(url: str, params: dict, token: str) -> str:
    payload = url
    for key in sorted(params):
        payload += key + str(params[key])
    digest = hmac.new(token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(digest).decode("ascii")


def signature_ok(url: str, params: dict, header: str) -> bool:
    token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    if not token:
        return True
    if not header:
        return False
    expected = signature(url, params, token)
    try:
        return hmac.compare_digest(expected, header)
    except ValueError:
        return False


def send_whatsapp(number: str, body: str, opener=None) -> dict:
    phone = "+" + digits(number)
    if not configured():
        return {"sent": False, "phone": phone, "detail": "Twilio is not configured"}
    sid = os.environ["TWILIO_ACCOUNT_SID"]
    token = os.environ["TWILIO_AUTH_TOKEN"]
    data = parse.urlencode({
        "To": whatsapp_address(number),
        "From": whatsapp_address(sender_for(number)),
        "Body": body,
    }).encode("utf-8")
    url = "https://api.twilio.com/2010-04-01/Accounts/" + parse.quote(sid, safe="") + "/Messages.json"
    req = request.Request(url, data=data, method="POST")
    basic = base64.b64encode((sid + ":" + token).encode("utf-8")).decode("ascii")
    req.add_header("Authorization", "Basic " + basic)
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    open_url = opener or request.urlopen
    try:
        with open_url(req, timeout=12) as response:
            raw = response.read().decode("utf-8")
            status = getattr(response, "status", 200)
    except error.HTTPError as exc:
        detail = ""
        if exc.fp is not None:
            detail = exc.read().decode("utf-8", errors="replace")[:300]
        return {"sent": False, "phone": phone, "detail": detail or str(exc.code)}
    except Exception as exc:
        return {"sent": False, "phone": phone, "detail": str(exc)[:300]}
    message_sid = ""
    try:
        message_sid = str(json.loads(raw).get("sid", ""))
    except json.JSONDecodeError:
        message_sid = ""
    return {"sent": status < 300, "phone": phone, "detail": message_sid or "accepted"}


def _remember(conn: sqlite3.Connection, message_id: int | None, outcome: dict) -> None:
    conn.execute(
        """
        INSERT INTO msg_deliveries (message_id, phone, status, detail, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            message_id,
            outcome["phone"],
            "sent" if outcome["sent"] else "failed",
            outcome["detail"],
            datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        ),
    )


def deliver(conn: sqlite3.Connection, after_id: int, opener=None) -> list[dict]:
    if not configured():
        return []
    results = []
    seen = set()
    for message in workflow.outbound_since(conn, after_id):
        for phone in targets(message):
            key = (digits(phone), message["body"])
            if key in seen:
                continue
            seen.add(key)
            outcome = send_whatsapp(phone, message["body"], opener)
            outcome["message_id"] = message["id"]
            results.append(outcome)
            _remember(conn, message["id"], outcome)
    if results:
        conn.commit()
    return results


def accept_inbound(conn: sqlite3.Connection, fields: dict, opener=None) -> dict:
    sender = fields.get("From") or fields.get("from") or ""
    if sender.lower().startswith("whatsapp:"):
        sender = sender.split(":", 1)[1]
    body = (fields.get("Body") or fields.get("body") or "").strip()
    sid = fields.get("MessageSid") or fields.get("SmsMessageSid") or ""
    before = workflow.latest_message_id(conn)
    event_id = "twilio:" + sid if sid else "twilio:" + digits(sender) + ":" + body
    result = workflow.post_message(conn, sender, body, event_id)
    if result.get("reply"):
        if not configured():
            result["whatsapp"] = []
            return result
        outcome = send_whatsapp(sender, result["reply"], opener)
        _remember(conn, None, outcome)
        conn.commit()
        result["whatsapp"] = [outcome]
        return result
    result["whatsapp"] = deliver(conn, before, opener)
    return result
