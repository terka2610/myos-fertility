// Rule-based safety classification run BEFORE answer generation (ported from the original app).
export const GENERAL = "general_education";
export const CLINIC = "clinic_specific_instruction";
export const PATIENT_DECISION = "patient_specific_decision";
export const MEDICATION = "time_sensitive_medication";
export const EMERGENCY = "emergency";
export const CRISIS = "crisis";
export const PARTNER_AUTH = "partner_authorization";

const DETERMINISTIC = new Set([EMERGENCY, CRISIS, MEDICATION, PARTNER_AUTH]);
export const SIMULATED_LABEL = "Simulated for this demo — no message was sent to a real clinic or nurse.";

export type RiskLevel = "education" | "routine" | "urgent" | "emergency";
export interface SafetyResult {
  category: string;
  subtype: string | null;
  risk_level: RiskLevel;
  matched: string[];
  escalation_offered: boolean;
  escalation_label: string | null;
  deterministic: boolean;
  fixed_response?: string | undefined;
}

function result(category: string, subtype: string | null, risk: RiskLevel, matched: string[], esc = false, label: string | null = null, fixed?: string): SafetyResult {
  return { category, subtype, risk_level: risk, matched, escalation_offered: esc, escalation_label: label, deterministic: DETERMINISTIC.has(category), fixed_response: fixed };
}
const has = (t: string, pats: string[]) => pats.filter((p) => new RegExp(p).test(t));

const CRISIS_P = ["kill myself", "suicid", "self[- ]harm", "hurt myself", "end my life", "don'?t want to (live|be alive)", "no reason to live"];
const EMERGENCY_P = [
  "can'?t breathe", "short(ness)? of breath", "(trouble|difficulty) breathing", "struggling to breathe",
  "faint", "passed out", "pass out", "chest pain", "heavy bleeding", "bleeding heavily", "soak(ing|ed) (a|through)",
  "severe (abdominal|pelvic|stomach|belly)? ?pain", "(abdominal|pelvic|stomach) pain.*(severe|unbearable|worse)", "worsening pain",
  "one[- ]sided (severe )?(pelvic )?pain", "shoulder[- ]tip", "torsion", "unbearable pain", "throat (is )?swell", "anaphyla",
];
const SWELLING = ["swollen", "swelling", "huge", "very bloated", "distended", "tight"];
const URINE = ["urinat", "\\bpee", "urine"];
const MED_OBJ = "(inject|injection|shot|dose|trigger|medication|medicine|pen|progesterone|syringe|needle|vial)";
const MED_PROBLEMS = [
  "\\bmissed\\b", "\\bforgot", "\\blate\\b", "half (the|of)", "\\bpartial", "leak", "not sure how much",
  "stopped halfway", "pen (stopped|jammed|broke|malfunction)", "malfunction", "wrong (dose|needle|medication|drug|time|location|site)",
  "\\bdouble\\b", "\\brepeat\\b", "inject more", "give (the )?rest", "top (it )?up", "pulled out early", "unrefrigerated",
  "(left )?out of the fridge", "dropped the vial", "can'?t remember whether", "conflict", "different directions",
  "dose changed", "\\bstop (taking|the|my)?\\s*(progesterone|medication|medicine|support)", "stop progesterone", "extra dose",
  "combine injections", "reuse a needle",
];
const PARTNER_PRIVATE = [
  "\\bher (results?|hormone|labs?|lab results|estradiol|hcg|amh|chart|record|scan|test)", "nora'?s", "tell me (her|my partner'?s|my wife'?s)",
  "(my partner'?s|my wife'?s|my girlfriend'?s) (results?|hormone|labs?|chart|record|estradiol|hcg|amh)",
];
const PATIENT_DECISION_P = [
  "\\bmy (chance|chances|odds)", "success rate", "will (it|this|ivf) work", "should i (do|have|choose|get|start|freeze|transfer|continue|pause)",
  "my (results?|estradiol|hcg|amh|afc|fsh|embryo grade|scan)", "is my .* (normal|good|bad)", "how many eggs should i",
  "should we (transfer|test|freeze)", "diagnos",
];
const CLINIC_P = ["my clinic", "before anesthesia", "refundable", "\\bfees?\\b", "storage cost", "my (plan|protocol|schedule|dose|appointment)", "clinic agreement", "clinic'?s"];

const OHSS_REPLY = "I'm glad you told me. Marked swelling with much less urine during or after stimulation can be a warning sign and needs urgent medical assessment. Please contact your clinic's urgent team now, or use local emergency services if you feel seriously unwell. I can't safely assume this is just bloating. I can help summarise your symptoms.";
const EMERGENCY_REPLY = "This could need urgent medical attention. Please contact your fertility clinic's urgent line now, and if you feel seriously unwell — trouble breathing, fainting, chest pain, heavy bleeding or severe pain — call your local emergency number or go to the nearest emergency department. I can help summarise your symptoms for the team.";
const CRISIS_REPLY = "I'm really sorry you're feeling this way, and I'm glad you said it. You deserve support from a person right now. If you might act on these thoughts, please call your local emergency number or a crisis line immediately. If you can, reach out to someone you trust and to your clinic's counselling team. I'm an AI and can't provide crisis care.";
const PARTNER_REPLY = "I can explain what these tests and results are used for in general. To share her personal results, I'd need her authorization, and she hasn't granted that in this app. Would you like a general explanation instead?";

function medicationReply(t: string): [string, string] {
  if (t.includes("trigger")) return ["late_or_uncertain_trigger", "Trigger timing matters, and I can't determine whether a delay is safe. Please contact your fertility clinic's urgent number now. I can prepare a message with the exact time and medication for you — in this demo, sending is only simulated."];
  if (/conflict|different directions|dose changed/.test(t)) return ["conflicting_instructions", "Thanks for flagging this. I can see the instructions don't agree, and I won't choose between them. Please don't rely on the older schedule — let's verify the latest signed order with your fertility team before you take the medication."];
  if (/stop/.test(t) && /progesterone|medication|support/.test(t)) return ["stopping_medication", "Please don't stop prescribed medication based on this chat. An early home test may not be definitive. Follow your clinic's testing plan and contact your team for medication instructions. I can help you draft that message."];
  if (/unrefrigerated|out of the fridge|dropped the vial/.test(t)) return ["storage_failure", "I can't tell whether that medication is still usable. Please don't use it until your clinic or pharmacist confirms — contact them now so your schedule isn't affected. I can help you prepare the details."];
  return ["dose_uncertainty", "Thanks for checking before giving more. Please don't repeat, double or top up the dose until your fertility team confirms what to do — I can't tell how much was delivered from a description. Contact your clinic's urgent line now. I can help prepare a message with the medication, prescribed dose, time, device and what happened (in this demo, sending is only simulated)."];
}

export function classify(text: string, role: string = "patient"): SafetyResult {
  const t = (text || "").toLowerCase();
  let m = has(t, CRISIS_P);
  if (m.length) return result(CRISIS, "psychological_crisis", "emergency", m, true, SIMULATED_LABEL, CRISIS_REPLY);
  m = has(t, EMERGENCY_P);
  const swell = has(t, SWELLING), urine = has(t, URINE);
  if (swell.length && urine.length) return result(EMERGENCY, "ohss_warning", "emergency", [...swell, ...urine], true, SIMULATED_LABEL, OHSS_REPLY);
  if (m.length) return result(EMERGENCY, /(positive|pregnan|transfer)/.test(t) ? "post_transfer_or_pregnancy" : "acute_symptom", "emergency", m, true, SIMULATED_LABEL, EMERGENCY_REPLY);
  if (role === "partner") {
    m = has(t, PARTNER_PRIVATE);
    if (m.length) return result(PARTNER_AUTH, "private_results", "routine", m, false, null, PARTNER_REPLY);
  }
  if (new RegExp(MED_OBJ).test(t) || /\b(stop|stopping)\b.*(progesterone|medication)/.test(t)) {
    m = has(t, MED_PROBLEMS);
    if (m.length) {
      const [sub, reply] = medicationReply(t);
      return result(MEDICATION, sub, "urgent", m, true, SIMULATED_LABEL, reply);
    }
  }
  m = has(t, PATIENT_DECISION_P);
  if (m.length) return result(PATIENT_DECISION, null, "routine", m);
  m = has(t, CLINIC_P);
  if (m.length) return result(CLINIC, null, "routine", m);
  return result(GENERAL, null, "education", []);
}
