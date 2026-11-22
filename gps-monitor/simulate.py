#!/usr/bin/env python3
"""Post a synthetic courier leg so the map is populated before a phone is attached.

The coordinates are a demo drawing from NYU Abu Dhabi to MBZUAI, not a real shipment. The specimen
shipper is offset a short distance from the van so both traces stay visible.
Phone and shipper use the OwnTracks JSON publish. The van uses the same
query string Traccar Client appends to its server URL.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

VEHICLE_WAYPOINTS = [
    (24.5240, 54.4347),
    (24.5000, 54.4800),
    (24.4785, 54.5264),
    (24.4520, 54.5750),
    (24.4338, 54.6182),
]

PHONE_WAYPOINTS = [
    (24.5240, 54.4347),
    (24.5244, 54.4353),
    (24.5248, 54.4359),
    (24.5243, 54.4365),
    (24.5238, 54.4359),
    (24.5236, 54.4351),
    (24.5240, 54.4347),
]


def expand(points: list[tuple[float, float]], steps: int = 4) -> list[tuple[float, float]]:
    if len(points) < 2:
        return list(points)
    expanded: list[tuple[float, float]] = []
    for start, end in zip(points, points[1:]):
        for step in range(steps):
            weight = step / steps
            expanded.append(
                (
                    start[0] + (end[0] - start[0]) * weight,
                    start[1] + (end[1] - start[1]) * weight,
                )
            )
    expanded.append(points[-1])
    return expanded


def offset(points: list[tuple[float, float]], dlon: float) -> list[tuple[float, float]]:
    return [(lat, lon + dlon) for lat, lon in points]


def bearing(start: tuple[float, float], end: tuple[float, float]) -> float:
    if start == end:
        return 0.0
    lat1, lon1 = math.radians(start[0]), math.radians(start[1])
    lat2, lon2 = math.radians(end[0]), math.radians(end[1])
    dlon = lon2 - lon1
    east = math.sin(dlon) * math.cos(lat2)
    north = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(east, north)) + 360.0) % 360.0


def courses(points: list[tuple[float, float]]) -> list[float]:
    values: list[float] = []
    for index, point in enumerate(points):
        nxt = points[index + 1] if index + 1 < len(points) else point
        prev = points[index - 1] if index else point
        target = nxt if nxt != point else prev
        values.append(bearing(point, target))
    return values


def request(url: str, method: str = "GET", body: bytes | None = None, content_type: str | None = None) -> bytes:
    headers = {}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.read()
    except urllib.error.URLError as exc:
        raise SystemExit(
            f"Could not reach {url}. Start the monitor first: python3 server.py\n{exc}"
        ) from exc


def post_owntracks(base: str, asset_id: str, lat: float, lon: float, tst: int, speed: float, course: float, battery: int, accuracy: int) -> None:
    payload = {
        "_type": "location",
        "t": "u",
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "tst": tst,
        "tid": asset_id[:2].upper(),
        "batt": battery,
        "acc": accuracy,
        "vel": speed,
        "cog": round(course, 1),
        "topic": f"owntracks/depot/{asset_id}",
    }
    query = urllib.parse.urlencode({"d": asset_id})
    request(
        f"{base}/pub?{query}",
        method="POST",
        body=json.dumps(payload).encode("utf-8"),
        content_type="application/json",
    )


def get_osmand(base: str, asset_id: str, lat: float, lon: float, tst: int, speed_kmh: float, course: float, battery: int, accuracy: int) -> None:
    knots = speed_kmh / 1.852
    query = urllib.parse.urlencode(
        {
            "id": asset_id,
            "lat": f"{lat:.6f}",
            "lon": f"{lon:.6f}",
            "timestamp": str(tst),
            "speed": f"{knots:.3f}",
            "bearing": f"{course:.1f}",
            "accuracy": str(accuracy),
            "batt": str(battery),
        }
    )
    request(f"{base}/?{query}")


def build_routes() -> list[dict]:
    vehicle = expand(VEHICLE_WAYPOINTS)
    shipper = offset(vehicle, 0.0008)
    phone = expand(PHONE_WAYPOINTS, steps=1)
    return [
        {
            "asset_id": "vehicle-cryo-01",
            "protocol": "osmand",
            "points": vehicle,
            "courses": courses(vehicle),
            "speed": 48,
            "accuracy": 12,
            "battery_start": 84,
        },
        {
            "asset_id": "bag-ship-01",
            "protocol": "owntracks",
            "points": shipper,
            "courses": courses(shipper),
            "speed": 48,
            "accuracy": 15,
            "battery_start": 91,
        },
        {
            "asset_id": "phone-demo",
            "protocol": "owntracks",
            "points": phone,
            "courses": courses(phone),
            "speed": 4,
            "accuracy": 8,
            "battery_start": 77,
        },
    ]


def publish(base: str, route: dict, index: int, tst: int) -> None:
    total = max(len(route["points"]) - 1, 1)
    battery = max(5, route["battery_start"] - int(index / total * 8))
    lat, lon = route["points"][index]
    course = route["courses"][index]
    if route["protocol"] == "osmand":
        get_osmand(
            base,
            route["asset_id"],
            lat,
            lon,
            tst,
            route["speed"],
            course,
            battery,
            route["accuracy"],
        )
        return
    post_owntracks(
        base,
        route["asset_id"],
        lat,
        lon,
        tst,
        route["speed"],
        course,
        battery,
        route["accuracy"],
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Feed a synthetic route into the GPS monitor")
    parser.add_argument("--url", default="http://127.0.0.1:8787")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Publish one step per second instead of loading the whole route at once",
    )
    parser.add_argument(
        "--skip-reset",
        action="store_true",
        help="Keep existing monitor data while adding synthetic route points",
    )
    args = parser.parse_args()
    base = args.url.rstrip("/")
    if not args.skip_reset:
        request(f"{base}/api/demo/reset", method="POST", body=b"")
    routes = build_routes()
    steps = max(len(route["points"]) for route in routes)
    now = int(datetime.now(timezone.utc).timestamp())
    interval = 30
    for index in range(steps):
        tst = now - (steps - 1 - index) * interval
        for route in routes:
            if index < len(route["points"]):
                publish(base, route, index, tst)
        if args.live and index < steps - 1:
            time.sleep(1)
    end = int(datetime.now(timezone.utc).timestamp())
    for route in routes:
        publish(base, route, len(route["points"]) - 1, end)
    state = json.loads(request(f"{base}/api/latest"))
    print(
        f"published {state['position_count']} fixes across {len(state['assets'])} assets",
        flush=True,
    )
    print(f"open {base}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
