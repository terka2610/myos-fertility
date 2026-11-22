// The parties on the network. Edit labels, routes and positions here.
// The MYOS assistant sits above them and has one WhatsApp chat with each party (no group chats).
export type Party = "centre" | "transport" | "storage" | "patient";
/** Kept for compatibility with version 1. */
export type NodeId = Party;

export interface SceneNode {
  id: Party;
  label: string;
  subtitle: string;
  /** Position on the network platform (x, y, z). The fertility centre is the middle. */
  position: [number, number, number];
  /** Rotation around the vertical axis, in radians. */
  rotationY: number;
  /** Height of the label above the station. */
  labelHeight: number;
  /** Where message bubbles appear for this party, relative to its position. */
  bubbleOffset: [number, number, number];
  /** One plain sentence shown when you look inside. */
  intro: string;
  /** Page in your app for this party, used by onOpen. */
  route: string;
}

const R = 4.4; // radius of the ring road
const at = (deg: number): [number, number, number] => [
  +(R * Math.cos((deg * Math.PI) / 180)).toFixed(3),
  0,
  +(R * Math.sin((deg * Math.PI) / 180)).toFixed(3),
];

export const RING_RADIUS = R;

export const NODES: SceneNode[] = [
  {
    id: "centre",
    label: "Fertility clinic",
    subtitle: "Documents and consent",
    position: [0, 0, 0],
    rotationY: 0,
    labelHeight: 3.75,
    bubbleOffset: [-2.1, 3.3, 0],
    intro: "Where the sample is prepared. MYOS checks the paperwork before anything moves.",
    route: "/workflow/fertility-centre",
  },
  {
    id: "transport",
    label: "Cryo transport",
    subtitle: "Pickup and live GPS",
    position: at(150),
    rotationY: (-60 * Math.PI) / 180,
    labelHeight: 2.6,
    bubbleOffset: [0, 3.45, 0],
    intro: "The courier collects the sample. Everyone can see where it is and how long it has been out of the freezer.",
    route: "/workflow/cryo-transport",
  },
  {
    id: "storage",
    label: "Cryogenic storage",
    subtitle: "Acceptance and tanks",
    position: at(30),
    rotationY: (60 * Math.PI) / 180,
    labelHeight: 2.6,
    bubbleOffset: [0, 3.45, 0],
    intro: "The sample is checked in, stored in a tank in front of a witness, and its tank is monitored.",
    route: "/workflow/cryogenic-storage",
  },
  {
    id: "patient",
    label: "Patient",
    subtitle: "Updates on WhatsApp",
    position: at(235),
    rotationY: 0.45,
    labelHeight: 2.2,
    bubbleOffset: [0, 3.05, 0],
    intro: "The patient follows every step on WhatsApp. There is no app to install.",
    route: "/workflow/patient",
  },
];

/** The MYOS assistant: one WhatsApp number, one chat per party. */
export const ASSISTANT = {
  label: "MYOS on WhatsApp",
  subtitle: "One chat with each party",
  position: [0, 4.7, -1.3] as [number, number, number],
  bubbleOffset: [2.9, -0.3, 0] as [number, number, number],
};

export const nodeById = (id: Party) => NODES.find((n) => n.id === id)!;
export const partyLabel = (id: Party | "assistant") => (id === "assistant" ? ASSISTANT.label : nodeById(id).label);
