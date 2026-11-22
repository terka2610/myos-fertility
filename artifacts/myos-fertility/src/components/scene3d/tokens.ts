// Colours and fonts from health.myos.sk (src/styles.css in the MYOS app), converted from oklch to hex.
// The page tokens match the app's names; the 3D tokens are tints of the same palette.
const page = {
  cream: "#FFF9F4", // --background
  plum: "#2A0E1A", // --primary / --foreground
  berry: "#A13D6B", // --accent
  berryDeep: "#891151", // --chart-1
  pink: "#E8A9C6", // --pink
  pinkSoft: "#F9E3EE", // --pink-soft / --primary-soft
  gold: "#F0D27A", // --gold
  goldSoft: "#FBF0CF", // --gold-soft / --warning
  secondary: "#F3E6EC", // --secondary
  muted: "#F0E2E8", // --muted / --border
  mutedFg: "#5E4752", // --muted-foreground
  input: "#E8D3DD", // --input
  teal: "#3B8F93", // --chart-3, used for WhatsApp messages
  coral: "#CE7162", // --chart-2
};

export const sceneTokens = {
  ...page,

  // page background: cream with the soft pink and peach blobs of --gradient-hero
  background:
    "radial-gradient(1200px 500px at 85% -10%, rgba(255,207,206,0.7), transparent 60%), " +
    "radial-gradient(900px 500px at -10% 20%, rgba(255,216,233,0.8), transparent 60%), #FFF9F4",
  fog: "#FFF6F2",
  shadowSoft: "0 1px 2px rgba(42,14,26,0.04), 0 8px 24px -12px rgba(137,17,81,0.22)",
  radius: 16,

  // platform and road
  platform: "#FBEEF4",
  platformEdge: "#EFD3E0",
  platformGlow: page.pink,
  road: "#F3E1E9",
  roadLine: page.berry,

  // models
  white: "#FFFFFF",
  ice: page.secondary, // secondary surfaces: bases, roofs, caps
  iceDeep: page.pink, // glowing bands on tanks, containers and the van
  window: page.gold, // warm windows
  dark: page.plum,
  tyre: "#3F1B2A",

  // the sample and selection
  accent: page.pink,
  accentStrong: page.berry,
  sample: page.pink,

  // messages and status
  chat: page.teal, // messages on WhatsApp
  chatDeep: "#2C6E72",
  reply: page.berry, // replies travelling back to MYOS
  ok: page.teal,
  warn: "#E3B341", // gold, deep enough to read on white

  // text and panels
  text: page.plum,
  textMuted: page.mutedFg,
  pillBg: "rgba(255,255,255,0.94)",
  pillBorder: page.muted,
  panelBg: "rgba(255,255,255,0.97)", // not fully opaque: avoids a stale-canvas glitch in some browsers
  panelBorder: page.muted,
  fontFamily: 'Poppins, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  displayFont: '"Instrument Serif", ui-serif, Georgia, serif',
} as const;
