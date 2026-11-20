// Languages the twin can answer and speak in. `bcp` drives browser speech in/out.
export const LANGUAGES = [
  { name: "English", bcp: "en-US", native: "English" },
  { name: "Spanish", bcp: "es-ES", native: "Español" },
  { name: "French", bcp: "fr-FR", native: "Français" },
  { name: "German", bcp: "de-DE", native: "Deutsch" },
  { name: "Portuguese", bcp: "pt-BR", native: "Português" },
  { name: "Italian", bcp: "it-IT", native: "Italiano" },
  { name: "Arabic", bcp: "ar-SA", native: "العربية" },
  { name: "Hindi", bcp: "hi-IN", native: "हिन्दी" },
  { name: "Urdu", bcp: "ur-PK", native: "اردو" },
  { name: "Mandarin Chinese", bcp: "zh-CN", native: "中文" },
  { name: "Japanese", bcp: "ja-JP", native: "日本語" },
  { name: "Korean", bcp: "ko-KR", native: "한국어" },
  { name: "Turkish", bcp: "tr-TR", native: "Türkçe" },
  { name: "Russian", bcp: "ru-RU", native: "Русский" },
  { name: "Polish", bcp: "pl-PL", native: "Polski" },
  { name: "Dutch", bcp: "nl-NL", native: "Nederlands" },
  { name: "Croatian", bcp: "hr-HR", native: "Hrvatski" },
  { name: "Hebrew", bcp: "he-IL", native: "עברית" },
] as const;
export type LanguageName = (typeof LANGUAGES)[number]["name"];
export const bcpFor = (name: string) => LANGUAGES.find((l) => l.name === name)?.bcp ?? "en-US";

/** Fixed care-team handoff text; never model-generated. */
export const ESCALATION_BY_LANG: Record<string, string> = {
  English: "I'm sending this to the care team.",
  Spanish: "Estoy enviando esto al equipo médico.",
  French: "J'envoie ceci à l'équipe soignante.",
  German: "Ich leite das an das Behandlungsteam weiter.",
  Portuguese: "Estou a enviar isto à equipa de cuidados.",
  Italian: "Sto inviando questo al team di cura.",
  Arabic: "سأرسل هذا إلى فريق الرعاية.",
  Hindi: "मैं इसे देखभाल टीम को भेज रहा हूँ।",
  Urdu: "میں یہ نگہداشت ٹیم کو بھیج رہا ہوں۔",
  "Mandarin Chinese": "我会把这个问题转给护理团队。",
  Japanese: "この件はケアチームに送ります。",
  Korean: "이 내용을 진료팀에 전달하겠습니다.",
  Turkish: "Bunu bakım ekibine iletiyorum.",
  Russian: "Я передаю это медицинской команде.",
  Polish: "Przekazuję to zespołowi opieki.",
  Dutch: "Ik stuur dit door naar het zorgteam.",
  Croatian: "Šaljem ovo timu za njegu.",
  Hebrew: "אני מעביר/ה את זה לצוות המטפל.",
};
export const escalationText = (lang: string) => ESCALATION_BY_LANG[lang] ?? ESCALATION_BY_LANG["English"]!;
