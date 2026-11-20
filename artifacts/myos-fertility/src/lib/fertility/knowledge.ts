import kb from "./kb.json";

export interface KbChunk { section: string; heading: string; content: string }
export interface Source { n: number; label: string; section: string; excerpt: string; risk_level: string; approval_status: string }

const STOP = new Set("a an the and or of to in on for is are am be was were i my me we our you your it this that what when how why do does did can could should would will with from at as about if not no so but have has had any some".split(" "));
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, ""));

const CHUNKS = (kb as KbChunk[]).map((c) => ({ ...c, toks: tokens(`${c.heading} ${c.heading} ${c.content}`) }));
const DF = new Map<string, number>();
for (const c of CHUNKS) for (const t of new Set(c.toks)) DF.set(t, (DF.get(t) ?? 0) + 1);

function riskOf(text: string): string {
  const t = text.toLowerCase();
  if (/emergency|breath|torsion|faint|bleeding|ohss|urinat/.test(t)) return "emergency";
  if (/missed|late|double|unrefrigerated|wrong|malfunction/.test(t)) return "urgent";
  return "education";
}

export function retrieve(query: string, k = 4): (KbChunk & { score: number; risk_level: string })[] {
  const q = tokens(query);
  if (!q.length) return [];
  const N = CHUNKS.length;
  return CHUNKS.map((c) => {
    let score = 0;
    for (const t of new Set(q)) {
      const tf = c.toks.filter((x) => x === t).length;
      if (tf) score += (1 + Math.log(tf)) * Math.log(1 + N / (DF.get(t) ?? 1));
    }
    return { section: c.section, heading: c.heading, content: c.content, score, risk_level: riskOf(c.content) };
  }).filter((c) => c.score > 1.5).sort((a, b) => b.score - a.score).slice(0, k);
}

export function toSource(c: KbChunk & { risk_level: string }, n: number): Source {
  return { n, label: c.heading, section: c.section, excerpt: c.content.slice(0, 280), risk_level: c.risk_level, approval_status: "demo_unreviewed" };
}

export function citedOnly(reply: string, sources: Source[]): Source[] {
  const cited = new Set(Array.from(reply.matchAll(/\[(\d+)\]/g)).map((m) => Number(m[1])));
  return cited.size ? sources.filter((s) => cited.has(s.n)) : [];
}
