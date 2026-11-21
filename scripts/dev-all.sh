#!/bin/sh
# Starts the whole MYOS demo: the web app (port 8080), Seidu's courier GPS monitor (8787)
# and his cryo sample API + simulated chat (8790). Stop everything with Ctrl+C.
cd "$(dirname "$0")/.." || exit 1
PY=$(command -v python3 || command -v python)

"$PY" gps-monitor/server.py --host 0.0.0.0 --port 8787 &
GPS_PID=$!
"$PY" cryo/api/server.py --host 0.0.0.0 --port 8790 &
CRYO_PID=$!
trap 'kill "$GPS_PID" "$CRYO_PID" 2>/dev/null' EXIT INT TERM

# Once the GPS monitor answers, replay the synthetic courier route (one fix per second).
# The feed stops after the replay, so the courier shows as stale after 5 minutes by design.
# Replay it again any time with: npm run demo:gps
(
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    if "$PY" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/api/latest', timeout=1)" 2>/dev/null; then
      "$PY" gps-monitor/simulate.py --live >/dev/null 2>&1
      break
    fi
  done
) &

# Listen on IPv4 too: Replit containers do not support the IPv6 "::" default.
npm run dev -- --host 0.0.0.0
