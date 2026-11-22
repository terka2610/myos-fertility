// WhatsApp messages between the MYOS assistant and each party.
// Messages carry the sample ID, status and times only: no names and no clinical details.
import type { Party } from "./nodes";

export type Endpoint = Party | "assistant";

export interface ChatMessage {
  id: string;
  from: Endpoint;
  to: Endpoint;
  text: string;
  /** Display time, e.g. "10:05". */
  time?: string;
}

/** Demo conversation, replayed in a loop when no live messages are passed in. `at` is seconds into the loop. */
export const DEMO_SCRIPT: (ChatMessage & { at: number })[] = [
  { id: "m1", at: 1.0, from: "assistant", to: "centre", time: "09:40", text: "SMP-0001: the serology report is missing. Please upload it in the portal." },
  { id: "m2", at: 3.6, from: "centre", to: "assistant", time: "09:44", text: "Uploaded now." },
  { id: "m3", at: 6.0, from: "assistant", to: "storage", time: "09:45", text: "SMP-0001 documents are complete. Please confirm acceptance." },
  { id: "m4", at: 8.6, from: "storage", to: "assistant", time: "09:50", text: "Accepted. Tank 3 reserved." },
  { id: "m5", at: 11.0, from: "assistant", to: "transport", time: "09:51", text: "Pickup SMP-0001 at the fertility centre, 10:30." },
  { id: "m6", at: 13.6, from: "transport", to: "assistant", time: "10:31", text: "Picked up, leaving now." },
  { id: "m7", at: 15.4, from: "assistant", to: "patient", time: "10:32", text: "Your sample is on its way. ETA 11:15." },
  { id: "m8", at: 17.6, from: "assistant", to: "storage", time: "10:32", text: "SMP-0001 arriving at 11:15." },
  { id: "m9", at: 20.2, from: "storage", to: "assistant", time: "11:16", text: "Placed in Tank 3, witnessed." },
  { id: "m10", at: 22.4, from: "assistant", to: "patient", time: "11:17", text: "Your sample is stored safely." },
];

export const LOOP_SECONDS = 25;
export const TRAVEL_SECONDS = 1.3;
/** In the demo loop the sample leaves with m6 ("Picked up") and arrives with m9 ("Placed in Tank 3"). */
export const PICKUP_AT = 13.6;
export const STORED_AT = 20.2;

/** Where the sample is in the demo loop, 0 (centre) to 1 (storage), matching the messages. */
export function demoProgress(seconds: number) {
  if (seconds < PICKUP_AT) return 0.04;
  if (seconds < STORED_AT) return 0.04 + (0.94 * (seconds - PICKUP_AT)) / (STORED_AT - PICKUP_AT);
  return 1;
}

export interface Flight {
  key: string;
  msg: ChatMessage;
  start: number; // performance.now() in ms
}

/** Works out which messages are travelling and which have just arrived, for the demo loop or live messages. */
export class MessageEngine {
  private t0 = performance.now();
  private seen = new Map<string, number>();
  private live: ChatMessage[] | undefined;

  setLive(messages: ChatMessage[] | undefined) {
    this.live = messages;
    if (!messages) return;
    const now = performance.now();
    for (const m of messages) if (!this.seen.has(m.id)) this.seen.set(m.id, now);
  }

  /** Live messages already present on first load arrive at once instead of all flying together. */
  primeLive(messages: ChatMessage[] | undefined) {
    if (!messages) return;
    const past = performance.now() - TRAVEL_SECONDS * 1000 - 1;
    for (const m of messages) this.seen.set(m.id, past);
  }

  /** Seconds into the demo loop. */
  demoSeconds(now: number) {
    return ((now - this.t0) / 1000) % LOOP_SECONDS;
  }

  flights(now: number): Flight[] {
    if (this.live) {
      return this.live.map((m) => ({ key: m.id, msg: m, start: this.seen.get(m.id) ?? now }));
    }
    const loop = LOOP_SECONDS * 1000;
    const k = Math.floor((now - this.t0) / loop);
    const out: Flight[] = [];
    for (const kk of [k - 1, k]) {
      if (kk < 0) continue;
      for (const m of DEMO_SCRIPT) out.push({ key: `${kk}-${m.id}`, msg: m, start: this.t0 + kk * loop + m.at * 1000 });
    }
    return out;
  }

  inFlight(now: number) {
    const travel = TRAVEL_SECONDS * 1000;
    return this.flights(now)
      .filter((f) => f.start <= now && now < f.start + travel)
      .map((f) => ({ ...f, t: (now - f.start) / travel }));
  }

  arrivals(prev: number, now: number) {
    const travel = TRAVEL_SECONDS * 1000;
    return this.flights(now).filter((f) => prev < f.start + travel && f.start + travel <= now);
  }
}
