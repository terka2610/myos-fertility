# MyOS GPS monitor

Thursday’s task is a working location feed: a phone or a bag reports GPS into a database we control. This folder is that feed. It is separate from ProfSidekick.

Two public apps already do the “find my phone” part, and both are well past the 1,000-star bar from the meeting:

| App | Repo | What we speak |
|---|---|---|
| OwnTracks | [owntracks/android](https://github.com/owntracks/android) (about 1,800 stars) | `POST /pub` JSON, `_type: location` |
| Traccar | [traccar/traccar](https://github.com/traccar/traccar) (about 8,100 stars) | OsmAnd query/form on the server URL, plus the newer Traccar Client JSON body |

Docker and Java are not installed on this machine, so the full Traccar server is not running here. The monitor accepts the same HTTP those apps already send, and writes each fix to SQLite.

The table stores an asset code, coordinates, speed, course, accuracy, altitude, battery, and time. It has no patient, clinic, or sample-owner columns. Extra fields on the publish (name, Wi-Fi, cell tower) are dropped.

## Run

```bash
cd myos-gps-monitor
python3 server.py
```

In a second terminal:

```bash
cd myos-gps-monitor
python3 simulate.py
python3 test_monitor.py
```

Open http://127.0.0.1:8787

`simulate.py` loads a synthetic NYU Abu Dhabi to MBZUAI courier leg: a van, a specimen shipper offset beside it so both lines stay visible, and a short walk for the operator phone. `simulate.py --live` plays that route one step per second.

`test_monitor.py` checks OwnTracks, OsmAnd, a form post, and Traccar Client JSON. It also checks that old OwnTracks and Traccar credentials plus browser sessions work only during a configured rotation overlap, and that current credentials continue afterward. Other checks cover asset scoping, person-style device id rejection, and keeping sample identity strings out of the database and API.

## Point a phone at it

The phone and the laptop need the same Wi-Fi. Use the `phone:` URL printed when the server starts, not `127.0.0.1`. macOS may ask to allow incoming connections.

Device id is an asset code: `phone-demo`, `bag-ship-01`, `vehicle-cryo-01`, or a new code such as `bag-02`. Do not type a person’s name. Names with spaces are rejected. Unknown codes still record, and the map marks them as unlisted.

To register a tracker before its first upload, open **Asset settings**, unlock
with the administrator authorization, and use **Add tracker**. Supply a unique
asset code (up to 64 letters, numbers, dots, underscores or hyphens), a display
name (up to 80 characters), and its type. Registration enables the tracker and
stores it in the monitor database; no catalog file edits are needed. Use that
same code when setting up location uploads with a device credential or browser
sharing session. Duplicate codes are rejected without changing existing
settings or location history. Use asset descriptions, not patient information.

To undo an accidental edit, unlock **Asset settings** and expand **Setting
history** for that asset. The latest 50 saved states show when each change was
saved, its display name, type, and map visibility. **Restore this state** asks
for confirmation and restores those three settings together. The asset code
and all location fixes stay unchanged. Restores are saved as new history
entries, so they can also be undone. If someone else changed the settings,
reload the history before restoring again.

History begins with the settings present when this feature is first started
(or when a new asset is created); earlier edits cannot be reconstructed.
History and restore require an unlocked administrator session, not a device
credential or phone-sharing session.

**OwnTracks** (iOS or Android): Connection mode HTTP, URL:

```text
http://<laptop-ip>:8787/pub?d=phone-demo
```

Set the device id to `phone-demo` as well, then publish once from the app. The fix shows up on the map within two seconds, and the server terminal prints `stored phone-demo ... via owntracks`.

**Traccar Client**: server URL `http://<laptop-ip>:8787`, device identifier `phone-demo` (or `bag-ship-01` for a bag). The app appends `id`, `lat`, `lon`, and `timestamp` itself. Start tracking. The terminal prints `stored ... via osmand` or `via traccar-client`.

Set `GPS_UPLOAD_TOKEN` in the service environment before starting the monitor.
It is the administrator authorization used to issue device credentials and
temporary browser sessions; it cannot upload a location directly. When it is
missing, the map and health endpoints remain readable but all uploads and
credential/session requests are rejected. Hosted MYOS runs read this value
from the Replit environment; do not put it in frontend code or the artifact
configuration.

```bash
export GPS_UPLOAD_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
python3 server.py
```

### Rotate the administrator secret

The monitor supports a bounded overlap while moving from an old administrator
secret to a new one. Set all three environment variables before restarting:

```bash
export GPS_UPLOAD_TOKEN="<new secret>"
export GPS_UPLOAD_TOKEN_RETIRING="<old GPS_UPLOAD_TOKEN value>"
export GPS_UPLOAD_TOKEN_RETIRING_UNTIL="YYYY-MM-DDTHH:MM:SSZ"
python3 server.py
```

`GPS_UPLOAD_TOKEN_RETIRING_UNTIL` must be a timezone-aware ISO 8601 date-time.
During the overlap, administrator requests, browser sessions, and tracker
credentials signed from either secret are accepted. New device credentials and
browser sessions are always issued using the current `GPS_UPLOAD_TOKEN`. At the
deadline, the retiring secret and browser sessions signed with it stop working
automatically, even if the monitor has not restarted.

To avoid interrupted device uploads:

1. Set the new `GPS_UPLOAD_TOKEN`, the old value as
   `GPS_UPLOAD_TOKEN_RETIRING`, and a deadline long enough to update every
   tracker. Restart the monitor.
2. Use the new administrator secret to request a fresh per-asset device
   credential for each tracker, then update its saved credential before the
   deadline. Existing OwnTracks and Traccar credentials keep working during
   the overlap.
3. After all trackers use their new credentials, remove both retiring-secret
   environment variables and restart the monitor. Do not leave the old secret
   configured beyond the intended transition window.

Each restart must receive the same rotation values until the transition is
complete. If either retiring-secret variable is set without the other, or the
deadline is not timezone-aware, the monitor exits with a configuration error.

Issue one credential per asset code using the administrator authorization.
For example, this creates (or registers) `phone-demo` and returns its scoped
credential:

```bash
curl -X POST http://127.0.0.1:8787/api/device-credential \
  -H "Authorization: Bearer $GPS_UPLOAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset_id":"phone-demo"}'
```

Give a tracker only the returned credential for its assigned asset. The
monitor accepts it as an OwnTracks HTTP Basic password, a Traccar Bearer
authorization header, or a `token` query parameter for clients that cannot
set headers. Prefer authorization headers over query parameters because URLs
may be retained by client or proxy logs. A credential for one asset is
rejected if the upload names a different asset code.

The browser sharing page at `/track` asks for the administrator authorization
and a selected asset code. It exchanges them for a server-signed credential
that can update only that asset and expires after one hour. The dashboard
uses a separate administrator session for asset settings. Neither session
places the long-lived authorization in location updates. The read-only map
and `/api/latest` endpoint do not require authorization.

## Where this sits in the hackathon

The fertility-clinic work is a funnel of digital twins plus, this week, logistics for frozen specimens moving between clinics. Cryoport-style transport is the reference. This monitor is only the location leg.

A later onboarding step, the agentic workflow called out as the senior piece, would create a shipment id. This service then follows that id. It does not collect the collection date, the freeze duration, or the patient record. Those stay in a separate store.

On AWS later, run this same ingest in the clinic account and swap SQLite for Postgres. The tracker’s credentials should not be able to read the patient store. Map tiles on this dashboard come from the public OpenStreetMap service, so the viewport can reveal the route to that tile host. For a real shipment, serve tiles from inside the same network. The system of record is still the local database.

Reset the synthetic route from this machine with `python3 simulate.py`, or delete `data/positions.sqlite` and start the server again.
