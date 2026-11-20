import { AlertTriangle, ShieldAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";

export interface Msg { id?: string; sender: string; content: string; mode?: string; safety?: any; sources?: any[]; created_at?: string }

export function MessageBubble({ m, onEscalate }: { m: Msg; onEscalate?: (m: Msg) => void }) {
  const mine = m.sender === "user";
  const risk = m.safety?.risk_level;
  const alert = !mine && (risk === "emergency" || risk === "urgent");
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "bg-primary text-primary-foreground" : alert ? (risk === "emergency" ? "border border-destructive/40 bg-destructive/10" : "bg-warning text-warning-foreground") : "bg-card shadow-soft"}`}>
        {alert && (
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            {risk === "emergency" ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <AlertTriangle className="h-4 w-4" />}
            {risk === "emergency" ? "Urgent — contact your clinic" : "Check with your clinic"}
          </div>
        )}
        <div className="prose prose-sm max-w-none leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5"><ReactMarkdown>{m.content}</ReactMarkdown></div>
        {!mine && !!m.sources?.length && (
          <div className="mt-3 space-y-1 border-t border-border pt-2">
            {m.sources.map((s: any) => (
              <details key={s.n} className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">[{s.n}] {s.label} <span className="ml-1 rounded bg-muted px-1.5 py-0.5">demo, not clinician-reviewed</span></summary>
                <p className="mt-1 whitespace-pre-line">{s.excerpt}…</p>
              </details>
            ))}
          </div>
        )}
        {!mine && m.safety?.escalation_offered && onEscalate && (
          <div className="mt-3">
            <button onClick={() => onEscalate(m)} className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-soft">Prepare a message for my care team</button>
            <p className="mt-1 text-[11px] opacity-80">{m.safety.escalation_label}</p>
          </div>
        )}
      </div>
    </div>
  );
}
