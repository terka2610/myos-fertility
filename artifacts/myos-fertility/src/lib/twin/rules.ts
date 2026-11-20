// Pure rules for the doctor digital twin: chunking, retrieval scoring, escalation, matching.
import { classify, MEDICATION, EMERGENCY, CRISIS, PATIENT_DECISION } from "@/lib/fertility/safety";

export interface Chunk { id?: string; doc_name: string; section: string; content: string }

const STOP = new Set("a an the and or of to in on for with is are was be it i my me you your can do does what how when why should will at as by from this that if not about".split(" "));
export const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) || Array<string>()).filter((w) => w.length > 2 && !STOP.has(w));

/** Split extracted pages into ~900 char passages, keeping page/heading as the section label. */
export function chunkPages(docName: string, pages: string[]): Chunk[] {
  const out: Chunk[] = [];
  pages.forEach((raw, i) => {
    const text = raw.replace(/\s+\n/g, "\n").trim();
    if (!text) return;
    const heading = text.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && l.length < 70) || "";
    const section = `Page ${i + 1}${heading ? ` — ${heading}` : ""}`;
    let buf = "";
    for (const para of text.split(/\n{1,}/)) {
      if ((buf + " " + para).length > 900 && buf) { out.push({ doc_name: docName, section, content: buf.trim() }); buf = ""; }
      buf += " " + para;
    }
    if (buf.trim()) out.push({ doc_name: docName, section, content: buf.trim() });
  });
  return out;
}

/** Keyword overlap retrieval. Patient context terms (diagnosis, medication) boost passages that mention them. */
export function retrieveChunks<T extends Chunk>(query: string, chunks: T[], context = "", k = 4): { chunk: T; score: number }[] {
  const q = new Set(tokens(query));
  const ctx = new Set(tokens(context));
  return chunks
    .map((chunk) => {
      const words = tokens(chunk.content + " " + chunk.section);
      let score = 0;
      const seen = new Set<string>();
      for (const w of words) {
        if (q.has(w) && !seen.has(w)) { score += 1; seen.add(w); }
        else if (ctx.has(w) && !seen.has("ctx:" + w)) { score += 0.3; seen.add("ctx:" + w); }
      }
      return { chunk, score };
    })
    .filter((r) => r.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const DOSE_CHANGE = /\b(increase|decrease|reduce|lower|raise|change|adjust|skip|double|stop|start|quit|halve)\b.*\b(dose|dosage|medication|medicine|injection|pill|tablet|progesterone|estradiol|gonal|menopur|cetrotide|metformin|letrozole|clomid|units?|mg|iu)\b|\bhow (much|many) (mg|units?|iu|tablets?|pills?)\b|\bwhat dose\b|\bmissed\b|\bforgot\b/i;
const RESULTS = /\b(my|these) (results?|levels?|labs?|bloods?|scan|ultrasound|amh|fsh|lh|hcg|estradiol|e2|afc)\b|\bis (my|this) .*(normal|high|low|bad|good)\b|\bwhat does my\b/i;
const DIAGNOSE = /\bdo i have\b|\bdiagnos|\bam i (infertile|pregnant)\b|\bwhat('?s| is) wrong with me\b/i;
const SYMPTOM = /\b(bleeding|severe|pain|fever|faint|dizzy|vomit|swollen|can'?t breathe|chest)\b/i;
const CONFLICT = /\b(conflict|contradict|different (instructions|directions)|told me (something )?different|nurse said|pharmacist said)\b/i;

export const ESCALATION_TEXT = "I'm sending this to the care team.";

/** Returns a reason when the twin must stop and escalate instead of answering. */
export function escalationReason(q: string): string | null {
  const s = classify(q);
  if (s.category === CRISIS || s.category === EMERGENCY) return "Worrying symptoms";
  if (s.category === MEDICATION) return "Medication or missed dose";
  if (CONFLICT.test(q)) return "Conflicting instructions";
  if (DOSE_CHANGE.test(q)) return "Dosing question";
  if (RESULTS.test(q)) return "Test result interpretation";
  if (DIAGNOSE.test(q) || s.category === PATIENT_DECISION && /diagnos/.test(q.toLowerCase())) return "Diagnosis request";
  if (SYMPTOM.test(q)) return "Worrying symptoms";
  return null;
}

export const PREFERENCES = [
  { id: "female", label: "Female doctor" },
  { id: "queer", label: "Experience with queer or trans patients" },
  { id: "pcos", label: "Experience with PCOS" },
  { id: "language", label: "Speaks my language" },
] as const;

export interface DoctorFlags { is_female: boolean; treats_pcos: boolean; treats_endo: boolean; supports_queer_trans: boolean; supports_single_women: boolean; languages: string }
/** A doctor matches when every selected preference is satisfied. */
export function matchesDoctor(d: DoctorFlags, prefs: string[], language = ""): boolean {
  return prefs.every((p) => {
    if (p === "female") return d.is_female;
    if (p === "queer") return d.supports_queer_trans;
    if (p === "pcos") return d.treats_pcos;
    if (p === "language") return !language.trim() || d.languages.toLowerCase().includes(language.trim().toLowerCase());
    return true;
  });
}

export const LEVEL_STYLE: Record<string, string> = {
  new: "The patient is new to fertility treatment. Use plain everyday words, short sentences, explain any medical term in brackets the first time, no abbreviations.",
  some: "The patient has some experience. Use common fertility terms (stimulation, egg retrieval, embryo transfer) with brief clarifications.",
  cycle: "The patient has done a cycle before. Be concise and use standard clinical terminology and abbreviations they will know (FSH, E2, OHSS).",
};
