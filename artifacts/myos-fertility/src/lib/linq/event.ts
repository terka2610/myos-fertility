import { z } from "zod";

const handle = z.object({ handle: z.string().min(1).max(100) });
const parts = z.array(z.object({ type: z.string(), value: z.string().optional() })).max(50);
const current = z.object({
  direction: z.string(),
  chat: z.object({ id: z.string().min(1).max(200), is_group: z.boolean().optional() }),
  sender_handle: handle,
  parts,
});
const legacy = z.object({
  chat_id: z.string().min(1).max(200),
  from_handle: handle.optional(),
  from: z.string().min(1).max(100).optional(),
  is_from_me: z.boolean(),
  is_group: z.boolean().optional(),
  message: z.object({ parts }),
}).refine((data) => Boolean(data.from_handle || data.from));
const event = z.object({ event_id: z.string().min(1).max(200), event_type: z.string(), data: z.union([current, legacy]) });

/** Normalize both documented Linq webhook versions without accepting outbound/group messages. */
export function parseLinqEvent(raw: string) {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const parsed = event.safeParse(json);
  if (!parsed.success) return null;
  const { data, ...envelope } = parsed.data;
  if ("chat" in data) return { ...envelope, data };
  return { ...envelope, data: {
    direction: data.is_from_me ? "outbound" : "inbound",
    chat: { id: data.chat_id, is_group: data.is_group },
    sender_handle: { handle: data.from_handle?.handle ?? data.from ?? "" },
    parts: data.message.parts,
  } };
}