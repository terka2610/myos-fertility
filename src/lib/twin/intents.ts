// Fixed English texts for non-clinical intents (translated to the patient's language at runtime). Pure.
export type TwinKind = "answer" | "escalation" | "booking" | "greeting" | "not_covered";

export const TWIN_PHONE_DISPLAY = "(415) 799-0277";
export const TWIN_PHONE_TEL = "+14157990277";

export const bookingText = (doctorName: string, hasAgent: boolean) =>
  `I'd love for you to meet Dr ${doctorName} in person! Tap below and the clinic team will help you get it scheduled.` +
  (hasAgent ? ` And you don't have to wait for an appointment: you can have a call with my agent any time, or text me at ${TWIN_PHONE_DISPLAY}.` : "");

export const greetingText = (doctorName: string, clinic: string | null | undefined, isTessa: boolean) => {
  const ex = isTessa
    ? ["How long after the trigger shot is egg retrieval?", "What does my AMH level tell me?"]
    : ["How does IVF work?", "What happens on egg retrieval day?"];
  return `Hi, lovely to meet you! I'm the AI twin of Dr ${doctorName}${clinic ? ` at ${clinic}` : ""}. I'm not a live consultation, but I can explain IVF, egg freezing and fertility testing any time, in your language. You could ask me: "${ex[0]}" or "${ex[1]}"`;
};

export const notCoveredText = (doctorName: string) => `That's not in Dr ${doctorName}'s guides yet. Want me to ask the clinic?`;

export const BOOKING_SMS_FOLLOWUP = "Or reply with a few days and times that work, and I'll pass them to the clinic.";
