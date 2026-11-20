import { createFileRoute } from "@tanstack/react-router";
import { parseLinqEvent } from "@/lib/linq/event";
import { sendLinqText } from "@/lib/linq/send";
import { verifyStandardWebhook, maskHandle } from "@/lib/linq/verify";
import { BOOKING_SMS_FOLLOWUP } from "@/lib/twin/intents";

const WELCOME = "Hi, I'm the AI twin of Dr Tessa Juras. I answer from her clinic's protocols. I'm not a live consultation; for emergencies call 911.";
const LINQ = "https://api.linqapp.com/api/partner/v3/chats";

export const Route = createFileRoute("/api/linq/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LINQ_WEBHOOK_SECRET"];
        const apiKey = process.env["LINQ_API_KEY"];
        const doctorId = process.env["LINQ_DOCTOR_ID"];
        if (!secret || !apiKey || !doctorId) { console.error("Linq webhook: missing LINQ settings"); return new Response("Not configured", { status: 503 }); }
        const raw = await request.text();
        const ok = await verifyStandardWebhook(secret, request.headers.get("webhook-id"), request.headers.get("webhook-timestamp"), request.headers.get("webhook-signature"), raw);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        const ev = parseLinqEvent(raw);
        if (!ev) { console.error("Linq webhook: unsupported or malformed event"); return new Response("Unsupported event", { status: 400 }); }
        if (ev.event_type !== "message.received" || ev.data.direction !== "inbound" || ev.data.chat.is_group) return new Response("ok");
        const question = ev.data.parts.filter((p) => p.type === "text" && p.value).map((p) => p.value).join("\n").trim().slice(0, 1500);
        if (!question) return new Response("ok");
        const chatId = ev.data.chat.id, handle = ev.data.sender_handle.handle;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: dup } = await supabaseAdmin.from("linq_events").insert({ event_id: ev.event_id });
        if (dup?.code === "23505") return new Response("ok"); // already handled
        if (dup) { console.error("Linq event storage failed", dup.code); return new Response("Storage unavailable", { status: 503 }); }

        const linq = (path: string, body?: unknown) => fetch(`${LINQ}/${encodeURIComponent(chatId)}/${path}`, {
          method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
        });
        try {
          linq("typing").catch((e) => console.error("Linq typing failed", e));
          const { data: doc } = await supabaseAdmin.from("twin_doctors").select("owner_id").eq("id", doctorId).single();
          if (!doc) throw new Error("LINQ_DOCTOR_ID not found");
          const { answerTwin, detectLanguage, extractTimes, translateTo } = await import("@/lib/twin/twin.server");
          const language = await detectLanguage(question);
          const masked = maskHandle(handle);
          const { data: contact } = await supabaseAdmin.from("linq_contacts").select("awaiting_booking_at").eq("handle", handle).maybeSingle();
          const { error: newContact } = await supabaseAdmin.from("linq_contacts").insert({ handle });
          const isNew = !newContact;
          let text: string | null = null;
          // After a booking reply, the next text may be the patient's preferred times.
          if (contact?.awaiting_booking_at && Date.now() - new Date(contact.awaiting_booking_at).getTime() < 7 * 86400_000) {
            const times = await extractTimes(question);
            if (times) {
              const { error: be } = await supabaseAdmin.from("twin_booking_requests").insert({ owner_id: doc.owner_id, doctor_id: doctorId, patient_name: masked, contact: masked, preferred_time: times, note: `Via text: ${question}`.slice(0, 800) });
              if (be) throw new Error(be.message);
              await supabaseAdmin.from("linq_contacts").update({ awaiting_booking_at: null }).eq("handle", handle);
              text = await translateTo(language, `Thank you! I've passed "${times}" to the clinic team, and they'll get back to you to confirm.`);
            }
          }
          if (!text) {
            const r = await answerTwin(supabaseAdmin, { doctorId, patientId: null, question, language, ownerId: doc.owner_id, patientName: masked });
            text = r.answer;
            if (r.kind === "booking") {
              const origin = new URL(request.url).origin;
              text += `\n${origin}/book/tessa\n${await translateTo(language, BOOKING_SMS_FOLLOWUP)}`;
              await supabaseAdmin.from("linq_contacts").update({ awaiting_booking_at: new Date().toISOString() }).eq("handle", handle);
            } else if (r.kind === "answer" && r.sources[0]) text += `\nSource: ${r.sources[0].doc_name}, ${r.sources[0].section}`;
          }
          if (isNew) text = `${WELCOME}\n\n${text}`;
          await sendLinqText(linq, text);
        } catch (e) {
          console.error("Linq webhook error", e);
          await sendLinqText(linq, "Sorry, something went wrong on our side. Please try again in a moment.").catch(() => {});
          return new Response("Reply failed", { status: 502 });
        }
        return new Response("ok");
      },
    },
  },
});
