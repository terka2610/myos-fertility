export const MAYA_FACTS: [string, string][] = [
  ["Age, pronouns", "33, she/her"],
  ["Partner", "Jess, 35, her wife of 3 years"],
  ["Location", "Oakland, CA"],
  ["Work", "UX researcher"],
  ["Insurance", "Employer PPO, unsure what it covers"],
  ["Path", "Maya carries; IUI with bank donor sperm; open to reciprocal IVF later"],
  ["Timeline", "Treatment within 6 months, pregnant within 18"],
];

export const MAYA_HEALTH = [
  "Suspected PCOS, never formally diagnosed. Cycles run 35–60 days.",
  "IBS that flares under stress and with some foods.",
  "Medical anxiety: racing heart during pelvic exams, late-night symptom spirals.",
];

export const MAYA_TOP5 = [
  "How will your forms, portal and staff refer to Jess?",
  "How does PCOS change your approach to ovulation meds or IVF, and how do you lower my risk of overstimulation?",
  "Will someone explain each step before it happens, and can I pause or stop at any point?",
  "Will results show in the portal before anyone explains them?",
  "Do you help queer couples get insurance coverage without a history of trying through intercourse?",
];

export type DemoTopic = { title: string; ask: string; good: string; red: string; shows: string };

export const MAYA_TOPICS: DemoTopic[] = [
  {
    title: "Being queer",
    ask: "We're a queer couple. How much experience do you have with families like ours, and will Jess be treated as a co-parent, not a visitor?",
    good: "A lot. About a third of our donor-sperm patients last year were same-sex couples, and we do reciprocal IVF most months. Our forms ask for your partner's name and role, so Jess goes in your chart as co-parent from day one, and our staff are trained not to assume anything. We'll walk you through choosing a bank or known donor, and we can refer you to LGBTQ+ family-law attorneys so Jess's parentage is secure before the baby arrives.",
    red: "Oh, absolutely, we welcome everyone here! We don't really treat anyone differently. Just put your partner down as your emergency contact on the form, and we can sort out the donor part once we see how your first cycle goes.",
    shows: "Real experience, a co-parent role and a plan for legal parentage, versus vague warmth and Jess filed as an emergency contact.",
  },
  {
    title: "PCOS, IBS and anxiety",
    ask: "I have suspected PCOS, IBS and a lot of anxiety around doctors. How will you take all of that into account, and what happens if I panic during an exam?",
    good: "Thank you for telling me. It changes how we plan. First I'd confirm the PCOS with an AMH level, hormone labs and an ultrasound. If it is PCOS, we'd start ovulation meds at a low dose and monitor closely, because PCOS makes overstimulation more likely. Some fertility meds upset the gut, so we'll plan around your IBS and keep your GI doctor in the loop. For exams, we explain each step before we do it, you pick a stop word, and you can insert the ultrasound probe yourself if that helps. We also have a counselor who works with fertility patients.",
    red: "Everyone's nervous at first, you'll be fine. PCOS is really common, and a lot of it gets better with weight loss. The IBS is a separate thing, so just keep seeing your GI doctor for that. Let's get you started on a cycle and see how you respond.",
    shows: "A plan that connects her conditions and her anxiety, versus brushing off her fear, weight-first framing and her IBS handed off.",
  },
  {
    title: "How it will work",
    ask: "How will this actually work week to week? Can I keep chatting with you between appointments, and can my wife come to every visit?",
    good: "After this consult, you'll do about two weeks of testing, then we'll meet again to pick a plan. Your nurse coordinator, Dana, is your main contact. Message her in the app anytime, and she replies within one business day, same day for anything urgent. There's also a 24-hour on-call line. Results come with a note from Dana explaining them, so you won't see an unexplained number at midnight. Jess gets her own login and can come to every visit; the only exception is the operating room if you ever do an egg retrieval.",
    red: "You can send questions through the portal, and someone will get back to you. Your partner can come to the consult; for procedures it just depends on the day. The portal is only for the patient, but you can always share your login with her.",
    shows: "A named contact, set reply times and a clear place for Jess, versus \"someone will get back to you\" and a shared password.",
  },
];

export const FLAGS: [string, string][] = [
  ["Asks both partners' names and pronouns, talks to Jess directly", "Assumes a husband or asks who \"the dad\" is"],
  ["Explains before touching and offers a stop signal", "Starts an exam mid-sentence"],
  ["Treats PCOS and IBS as part of the plan", "Calls IBS unrelated or makes PCOS only about weight"],
  ["Gives numbers with context: odds, costs, timelines", "Vague reassurance like \"you're young, don't worry\""],
  ["Welcomes her written list and leaves time for it", "Glances at the clock or cuts questions short"],
  ["Hands over a written cost estimate", "Gets vague on cost until after she signs"],
];
