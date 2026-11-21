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

`test_monitor.py` checks OwnTracks, OsmAnd, a form post, and Traccar Client JSON. It also checks that a person-style device id is rejected and that sample identity strings never land in the database file or the API.

## Point a phone at it

The phone and the laptop need the same Wi-Fi. Use the `phone:` URL printed when the server starts, not `127.0.0.1`. macOS may ask to allow incoming connections.

Device id is an asset code: `phone-demo`, `bag-ship-01`, `vehicle-cryo-01`, or a new code such as `bag-02`. Do not type a person’s name. Names with spaces are rejected. Unknown codes still record, and the map marks them as unlisted.

**OwnTracks** (iOS or Android): Connection mode HTTP, URL:

```text
http://<laptop-ip>:8787/pub?d=phone-demo
```

Set the device id to `phone-demo` as well, then publish once from the app. The fix shows up on the map within two seconds, and the server terminal prints `stored phone-demo ... via owntracks`.

**Traccar Client**: server URL `http://<laptop-ip>:8787`, device identifier `phone-demo` (or `bag-ship-01` for a bag). The app appends `id`, `lat`, `lon`, and `timestamp` itself. Start tracking. The terminal prints `stored ... via osmand` or `via traccar-client`.

Optional ingest secret, once this is not only a local demo:

```bash
python3 server.py --token myos-demo
```

OwnTracks can send that as the HTTP basic password: `http://phone-demo:myos-demo@<laptop-ip>:8787/pub?d=phone-demo`. Traccar Client can keep an existing query on the server URL: `http://<laptop-ip>:8787/?token=myos-demo`.

## Where this sits in the hackathon

The fertility-clinic work is a funnel of digital twins plus, this week, logistics for frozen specimens moving between clinics. Cryoport-style transport is the reference. This monitor is only the location leg.

A later onboarding step, the agentic workflow called out as the senior piece, would create a shipment id. This service then follows that id. It does not collect the collection date, the freeze duration, or the patient record. Those stay in a separate store.

On AWS later, run this same ingest in the clinic account and swap SQLite for Postgres. The tracker’s credentials should not be able to read the patient store. Map tiles on this dashboard come from the public OpenStreetMap service, so the viewport can reveal the route to that tile host. For a real shipment, serve tiles from inside the same network. The system of record is still the local database.

Reset the synthetic route from this machine with `python3 simulate.py`, or delete `data/positions.sqlite` and start the server again.
