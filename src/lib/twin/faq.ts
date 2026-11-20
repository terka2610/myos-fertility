// Deterministic answers for common IVF, egg-freezing and surrogacy questions, plus scope and
// medication-advice guardrails. Pure functions: no model call, same question -> same answer.
// Content is educational (from the bundled demo protocol) and is not clinician-reviewed.

export interface FaqEntry { id: string; topic: "IVF" | "Egg freezing" | "Surrogacy" | "General"; keys: string[][]; answer: string; source: string }

// Each entry matches when ANY group in `keys` has ALL its words present in the question.
export const FAQ: FaqEntry[] = [
  { id: "ivf-what", topic: "IVF", keys: [["what", "ivf"], ["how", "ivf", "work"], ["explain", "ivf"]],
    answer: "IVF (in vitro fertilisation) has a few steps. Medicines help several eggs grow, and the clinic checks progress with scans and sometimes blood tests. A trigger injection finishes egg maturation, then eggs are collected in a short procedure, usually with sedation. In the lab, eggs are fertilised and embryos grow for a few days. An embryo may be transferred fresh or frozen for later. Your own clinic's plan decides the details.",
    source: "Protocol §4 — IVF journey" },
  { id: "ivf-steps-time", topic: "IVF", keys: [["how", "long", "ivf"], ["ivf", "cycle", "take"], ["ivf", "timeline"]],
    answer: "Stimulation usually lasts around 8 to 14 days, with monitoring visits along the way. Egg collection happens about a day and a half after the trigger. Embryos grow in the lab for 3 to 6 days. A pregnancy test is usually about two weeks after transfer. Your clinic's calendar for your cycle is the one to follow.",
    source: "Protocol §4 — Ovarian stimulation; Monitoring and trigger" },
  { id: "stimulation", topic: "IVF", keys: [["stimulation"], ["stim", "injections"], ["why", "injections"]],
    answer: "During stimulation, prescribed medicines help several follicles grow at once instead of one. The clinic watches your response with ultrasound and sometimes blood tests and may adjust the plan. How and when to inject is always set by your own treatment plan, and your nurse will train you.",
    source: "Protocol §4 — Ovarian stimulation" },
  { id: "retrieval", topic: "IVF", keys: [["egg", "retrieval"], ["egg", "collection"], ["retrieval", "day"]],
    answer: "Egg retrieval is a short clinic procedure, commonly under sedation, where a fine needle guided by ultrasound collects eggs from the follicles. Most people go home the same day and need someone to take them home. Some cramping and bloating afterwards is common. Follow your clinic's recovery sheet, and contact them for strong pain, fever or heavy bleeding.",
    source: "Protocol §4 — Egg retrieval and recovery" },
  { id: "follicles-eggs", topic: "IVF", keys: [["follicles", "eggs"], ["fewer", "eggs"]],
    answer: "Follicle count and egg count are different measures. Not every follicle contains an egg, and not every egg is mature. Your team can explain what your numbers mean for your next step.",
    source: "Protocol §7 — Follicles versus eggs" },
  { id: "icsi", topic: "IVF", keys: [["icsi"], ["fertilisation"], ["fertilization"]],
    answer: "In the lab, eggs are fertilised either by placing them with sperm (conventional IVF) or by injecting one sperm into each egg (ICSI). Your clinic chooses the method for your situation. Not every egg fertilises and not every embryo keeps developing, which is normal.",
    source: "Protocol §4 — Fertilization and embryo development" },
  { id: "transfer", topic: "IVF", keys: [["embryo", "transfer"], ["transfer", "day"], ["frozen", "transfer"]],
    answer: "Embryo transfer is usually a quick, gentle procedure, a bit like a smear test, and sedation isn't normally needed. It can be a fresh transfer in the same cycle or a frozen transfer later. Some people take prescribed support like progesterone afterwards, exactly as their plan says.",
    source: "Protocol §4 — Embryo transfer and luteal support" },
  { id: "two-week-wait", topic: "IVF", keys: [["two", "week", "wait"], ["after", "transfer"], ["home", "test"]],
    answer: "After transfer, an early home test may not be reliable. Please keep following your clinic's medication plan and testing date, and don't stop prescribed support based on a home test. If you have heavy bleeding or severe pain, contact your clinic or urgent care.",
    source: "Protocol §7 — Negative home test" },
  { id: "ohss", topic: "IVF", keys: [["ohss"], ["hyperstimulation"]],
    answer: "OHSS (ovarian hyperstimulation syndrome) is when the ovaries over-respond to stimulation. Clinics lower the risk with careful monitoring and by adjusting the plan. Marked swelling, much less urine, trouble breathing or severe pain after stimulation or retrieval need urgent medical assessment.",
    source: "Protocol §10 — Safety and escalation" },
  { id: "success", topic: "IVF", keys: [["success", "rate"], ["chance", "pregnant"], ["will", "work"]],
    answer: "Success depends on many things, especially age and egg and embryo factors, so I can't give you a personal prediction. Your clinic can share its published rates for people like you and explain what they count as success.",
    source: "Protocol §10 — Avoid overclaiming" },
  { id: "freeze-what", topic: "Egg freezing", keys: [["egg", "freezing"], ["freeze", "eggs"], ["social", "freezing"], ["oocyte", "cryopreservation"]],
    answer: "Egg freezing follows the first half of IVF: stimulation, monitoring, trigger and egg collection. Mature eggs are then frozen (vitrified) for possible future use. Freezing does not guarantee a future baby. Storage terms, time limits, costs and consent are set by your clinic's agreement.",
    source: "Protocol §4 — Egg freezing and storage" },
  { id: "freeze-age", topic: "Egg freezing", keys: [["age", "freeze"], ["too", "old"], ["when", "freeze"], ["30s", "freeze"]],
    answer: "Egg quality and number tend to fall with age, so eggs frozen younger generally have better odds later. There is no single right age for everyone. A fertility specialist can look at your tests, like AMH and an ultrasound count, and talk through your goals before you decide.",
    source: "Protocol §4 — Initial evaluation and planning" },
  { id: "freeze-how-many", topic: "Egg freezing", keys: [["how", "many", "eggs"], ["enough", "eggs"]],
    answer: "There isn't one number that fits everyone. The number of eggs to aim for depends mostly on your age and goals, and some people need more than one cycle. Your specialist can give you an estimate based on your own tests.",
    source: "Protocol §4 — Egg freezing and storage" },
  { id: "freeze-storage", topic: "Egg freezing", keys: [["how", "long", "stored"], ["storage"], ["store", "eggs"]],
    answer: "Frozen eggs are kept in liquid nitrogen and can stay stable for many years. How long you may store them, the yearly cost and what happens at the end of the term are set by your clinic's storage agreement and local law.",
    source: "Protocol §4 — Egg freezing and storage" },
  { id: "freeze-cost", topic: "Egg freezing", keys: [["cost"], ["price"], ["insurance"]],
    answer: "Costs vary a lot by clinic and country. Ask for a written, itemised estimate that covers medicines, monitoring, the procedure, anaesthesia and yearly storage, plus what happens financially if a cycle is cancelled.",
    source: "Persona checklist — Cost, insurance and logistics" },
  { id: "surrogacy-what", topic: "Surrogacy", keys: [["surrogacy"], ["surrogate"], ["gestational", "carrier"]],
    answer: "In gestational surrogacy, an embryo made through IVF, using the intended parents' or donor eggs and sperm, is transferred to a gestational carrier who carries the pregnancy. The carrier is not genetically related to the baby. It involves medical screening for everyone, a legal agreement and parentage steps, and counselling. Rules differ a lot between countries and states, so legal advice early on is important.",
    source: "General education — not clinic-reviewed" },
  { id: "surrogacy-steps", topic: "Surrogacy", keys: [["surrogacy", "steps"], ["surrogacy", "work"], ["surrogacy", "process"]],
    answer: "Surrogacy usually goes: choose a clinic and agency or carrier, medical and psychological screening, a legal contract, IVF to create embryos, preparing the carrier's uterus, embryo transfer, pregnancy care, then legal parentage after birth. Your clinic and lawyer will set the exact order where you live.",
    source: "General education — not clinic-reviewed" },
  { id: "queer-paths", topic: "General", keys: [["donor", "sperm"], ["reciprocal", "ivf"], ["same", "sex"], ["queer"], ["lgbtq"]],
    answer: "Many couples and single people build families with donor sperm, IUI, IVF or reciprocal IVF, where one partner's eggs are used and the other partner carries. A good clinic records both partners as co-parents and can refer you to a family-law attorney for parentage. Ask how many cycles like yours they do each year.",
    source: "Persona checklist — Inclusive care" },
  { id: "emotional", topic: "General", keys: [["scared"], ["anxious"], ["overwhelmed"], ["failed"]],
    answer: "This is a lot to carry, and your feelings make sense. It can help to write your questions down before visits and ask your clinic about counselling support. I can help you prepare a list for your care team.",
    source: "Protocol §7 — Fear of failure" },
];

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).map((w) => w.replace(/s$/, "")));

/** Returns the best deterministic FAQ answer, or null. */
export function matchFaq(q: string): FaqEntry | null {
  const w = words(q);
  let best: { e: FaqEntry; n: number } | null = null;
  for (const e of FAQ) for (const g of e.keys) {
    if (g.every((k) => w.has(k.replace(/s$/, "")))) { if (!best || g.length > best.n) best = { e, n: g.length }; }
  }
  return best?.e ?? null;
}

const IN_SCOPE = /\b(women|woman|lesbian|queer|same-sex|two moms|ivf|icsi|iui|egg|eggs|oocyte|freez|embryo|sperm|donor|fertil|infertil|pregnan|ovar|ovul|follic|uter|womb|period|cycle|menstru|pcos|endometrio|amh|fsh|hcg|progesterone|estrogen|oestrogen|hormone|surroga|carrier|retrieval|transfer|implant|miscarri|reproduct|contracept|menopaus|clinic|doctor|nurse|treatment|injection|trigger|stim|ohss|bloat|cramp|spotting|semen|partner|wife|husband|baby|conceiv|ttc|ivf)/i;

export const OUT_OF_SCOPE_TEXT = "I can only help with fertility and reproductive health, like IVF, egg freezing and surrogacy. For anything else, please ask someone who can help with that topic.";

/** True when the question is clearly outside reproductive health. */
export const outOfScope = (q: string) => !IN_SCOPE.test(q);

const MED_ADVICE = /\b(should i (take|use|start|stop|try)|can i take|what (medication|medicine|drug|pill|supplement)s? should|which (medication|medicine|drug|pill|supplement)|recommend (a |an |any )?(medication|medicine|drug|pill|supplement)|prescribe)\b/i;

export const TREATMENT_PLAN_TEXT = "I can't recommend or change any medication. Please follow the treatment plan your clinic gave you, and ask your care team about anything you're unsure of. I can explain in general what a medicine is for if that helps.";

/** True when the question asks for a medication recommendation. */
export const asksMedicationAdvice = (q: string) => MED_ADVICE.test(q);

/** Questions about the twin itself ("who are you?") — answered kindly, never escalated. */
const IDENTITY = /\b(who|what) are you\b|\byour name\b|\bare you (a |an )?(real|human|robot|ai|bot|doctor)\b|\bwhat can you (do|help)\b|^\s*(hi|hello|hey)\b/i;
export const asksIdentity = (q: string) => IDENTITY.test(q);
export const identityText = (doctorName: string, clinic?: string | null) =>
  `I'm the AI twin of Dr ${doctorName}${clinic ? ` at ${clinic}` : ""}. I'm not a live consultation, but I can explain how IVF, egg freezing and fertility treatment work, any time and in your language. If you'd like a person from the clinic to answer, I can send your question to them.`;
/** Kind reply when the doctor's documents don't cover a question. Not a safety escalation. */
export const NOT_COVERED_TEXT = "That's a good question, but it isn't covered in the clinic's documents I learn from, so I don't want to guess. If you like, I can send it to the clinic and someone from the team will get back to you.";
