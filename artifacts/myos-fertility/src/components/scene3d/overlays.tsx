// Everything drawn as normal HTML over the 3D canvas, in the health.myos.sk style:
// cream and white cards, plum text, berry accents, Instrument Serif headings and Poppins text.
// Labels follow 3D points through a small registry that the Projector updates every frame.
import { useMemo, type CSSProperties } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Feature } from "./features";
import { NODES, type Party, type SceneNode } from "./nodes";
import { sceneTokens as T } from "./tokens";

/* ------------------------------ anchors ------------------------------ */

export interface AnchorRegistry {
  anchors: Map<string, THREE.Vector3>;
  els: Map<string, HTMLElement>;
}

export const createRegistry = (): AnchorRegistry => ({ anchors: new Map(), els: new Map() });

/** Ref callback that registers an element so the Projector can move it. */
export const track = (reg: AnchorRegistry, key: string) => (el: HTMLElement | null) => {
  if (el) reg.els.set(key, el);
  else reg.els.delete(key);
};

/** Runs inside the Canvas: moves every tracked element to its 3D anchor on screen. */
export function Projector({ reg }: { reg: AnchorRegistry }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    reg.els.forEach((el, key) => {
      const a = reg.anchors.get(key);
      if (!a) {
        el.style.visibility = "hidden";
        return;
      }
      v.copy(a).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.visibility = v.z > 1 ? "hidden" : "visible";
    });
  });
  return null;
}

const floating: CSSProperties = { position: "absolute", top: 0, left: 0, visibility: "hidden", willChange: "transform" };

/* ------------------------------ labels in the scene ------------------------------ */

export function LabelPill({
  refCallback,
  title,
  sub,
  num,
  active,
  hovered,
  tone = "default",
  onClick,
  onHover,
}: {
  refCallback: (el: HTMLElement | null) => void;
  title: string;
  sub?: string;
  /** Feature number, matching the side panel. */
  num?: number;
  active?: boolean;
  hovered?: boolean;
  tone?: "default" | "chat" | "feature";
  onClick?: () => void;
  onHover?: (on: boolean) => void;
}) {
  const cls = ["myos-pill", `tone-${tone}`, active ? "on" : "", hovered ? "hover" : ""].join(" ");
  return (
    <button
      ref={refCallback}
      type="button"
      className={cls}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      tabIndex={onClick ? 0 : -1}
      aria-hidden={onClick ? undefined : true}
      style={{ ...floating, pointerEvents: onClick ? "auto" : "none", cursor: onClick ? "pointer" : "default" }}
    >
      {num !== undefined ? <span className="myos-num sm">{num}</span> : null}
      <span className="myos-pill-text">
        <span className="t">{title}</span>
        {sub ? <span className="s">{sub}</span> : null}
      </span>
    </button>
  );
}

/* ------------------------------ network view ------------------------------ */

export type View = "network" | Party;

export function PlacesNav({ view, onGo }: { view: View; onGo: (v: View) => void }) {
  const items: { id: View; label: string }[] = [{ id: "network", label: "All places" }, ...NODES.map((n) => ({ id: n.id as View, label: n.label }))];
  return (
    <nav aria-label="Places" className={`myos-nav${view !== "network" ? " in-env" : ""}`}>
      {items.map((b) => (
        <button key={b.label} type="button" onClick={() => onGo(b.id)} aria-pressed={view === b.id} className={view === b.id ? "on" : undefined}>
          {b.label}
        </button>
      ))}
    </nav>
  );
}

export interface Step {
  party: Party;
  title: string;
  sub: string;
}

/* ------------------------------ inside a place ------------------------------ */

const needsAttention = (status: string) => /missing|waiting|alert|overdue/i.test(status);

/** Inside a place: a compact bar with the way back and the place name. Nothing else until a feature is chosen. */
export function PlaceBar({ node, onBack, onOpenPage }: { node: SceneNode; onBack: () => void; onOpenPage?: () => void }) {
  return (
    <div className="myos-placebar" role="group" aria-label={node.label}>
      <button type="button" className="myos-back" onClick={onBack} data-testid="button-scene-back">
        <span aria-hidden>←</span> All places
      </button>
      <span className="myos-placebar-name">{node.label}</span>
      {onOpenPage ? (
        <button type="button" className="myos-back ghost" onClick={onOpenPage} data-testid="button-scene-workarea">
          Work area
        </button>
      ) : null}
    </div>
  );
}

/** The single detail panel for the selected feature. Choosing another feature replaces it. */
export function FeatureDetail({
  feature,
  num,
  status,
  onClose,
  onFeatureOpen,
}: {
  feature: Feature;
  num: number;
  status: string;
  onClose: () => void;
  onFeatureOpen?: (f: Feature) => void;
}) {
  return (
    <aside aria-label={feature.label} className="myos-detail" data-testid="panel-feature-detail">
      <div className="myos-detail-head">
        <span className="myos-num">{num}</span>
        <h3>{feature.label}</h3>
        <button type="button" className="myos-x" onClick={onClose} aria-label={`Close ${feature.label}`} data-testid="button-feature-close">
          <span aria-hidden>×</span>
        </button>
      </div>
      <span className={`myos-chip${needsAttention(status) ? " warn" : ""}`}>{status}</span>
      <p>{feature.description}</p>
      {onFeatureOpen ? (
        <button type="button" className="myos-btn" onClick={() => onFeatureOpen(feature)} data-testid={`button-feature-open-${feature.id}`}>
          {feature.id === "gps" ? "Open GPS monitor" : feature.id === "updates" ? "Open Cryo demo chat" : "Open working form"} <span aria-hidden>→</span>
        </button>
      ) : null}
    </aside>
  );
}

/* ------------------------------ styles ------------------------------ */

export const OVERLAY_CSS = `
.myos-scene{font-family:${T.fontFamily};color:${T.plum};-webkit-font-smoothing:antialiased}
.myos-scene button{font-family:inherit}
.myos-scene :focus-visible{outline:2px solid ${T.berry};outline-offset:2px}
@keyframes myosIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.myos-card{position:absolute;z-index:30;background:${T.panelBg};border:1px solid ${T.panelBorder};border-radius:20px;box-shadow:${T.shadowSoft}}
.myos-num{flex:none;display:inline-grid;place-items:center;width:26px;height:26px;border-radius:99px;background:${T.pinkSoft};color:${T.berry};font-size:12.5px;font-weight:600}
.myos-num.sm{width:20px;height:20px;font-size:11px;background:${T.berry};color:#fff}
.myos-scene .muted{color:${T.mutedFg};font-size:12.5px}

/* labels */
.myos-pill{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:7px;white-space:nowrap;padding:6px 13px 7px;border-radius:999px;
  background:${T.pillBg};border:1px solid ${T.pillBorder};box-shadow:${T.shadowSoft};color:${T.plum};text-align:center;
  font-family:${T.fontFamily};transition:background 160ms ease,color 160ms ease,box-shadow 160ms ease}
.myos-pill .myos-pill-text{display:grid;line-height:1.2}
.myos-pill .t{font-size:13px;font-weight:600}
.myos-pill .s{font-size:11px;color:${T.mutedFg};margin-top:1px}
.myos-pill.tone-feature{padding:5px 12px 5px 6px;text-align:left}
.myos-pill.hover{background:${T.pinkSoft}}
.myos-pill.on{background:${T.plum};border-color:${T.plum};color:${T.cream}}
.myos-pill.on .s{color:${T.pink}}
.myos-pill.on .myos-num.sm{background:${T.pink};color:${T.plum}}
.myos-pill.tone-chat{border-color:rgba(59,143,147,.45)}
.myos-pill.tone-chat .t{color:${T.chatDeep}}

.myos-nav{position:absolute;z-index:30;top:18px;right:18px;display:flex;gap:2px;padding:4px;border-radius:999px;background:rgba(255,255,255,.92);
  border:1px solid ${T.panelBorder};box-shadow:${T.shadowSoft};max-width:calc(100% - 36px);overflow-x:auto}
.myos-nav button{all:unset;cursor:pointer;white-space:nowrap;padding:7px 13px;border-radius:999px;font:500 13px ${T.fontFamily};color:${T.plum};transition:background 160ms ease}
.myos-nav button:hover{background:${T.pinkSoft}}
.myos-nav button.on{background:${T.plum};color:${T.cream}}

.myos-placebar{position:absolute;z-index:30;left:18px;top:18px;display:flex;align-items:center;gap:10px;padding:5px;border-radius:999px;
  background:rgba(255,255,255,.94);border:1px solid ${T.panelBorder};box-shadow:${T.shadowSoft};animation:myosIn 220ms ease-out}
.myos-placebar-name{font-family:${T.displayFont};font-size:22px;line-height:1;padding:0 6px 0 2px;color:${T.plum}}
.myos-back{all:unset;cursor:pointer;display:inline-flex;gap:6px;align-items:center;padding:7px 12px;border-radius:999px;font-size:13px;font-weight:500;background:${T.secondary};color:${T.plum}}
.myos-back:hover{background:${T.pinkSoft}}
.myos-back.ghost{background:transparent;box-shadow:inset 0 0 0 1px ${T.input}}

.myos-detail{position:absolute;z-index:30;background:${T.panelBg};border:1px solid ${T.panelBorder};border-radius:20px;box-shadow:${T.shadowSoft};
  left:18px;top:72px;width:320px;max-height:calc(100% - 90px);overflow:auto;padding:16px 18px 18px;display:grid;gap:10px;animation:myosIn 200ms ease-out}
.myos-detail-head{display:flex;align-items:center;gap:10px}
.myos-detail-head h3{flex:1;margin:0;font-family:${T.displayFont};font-weight:400;font-size:24px;line-height:1.1;color:${T.plum}}
.myos-x{all:unset;cursor:pointer;width:28px;height:28px;display:grid;place-items:center;border-radius:99px;background:${T.secondary};font-size:17px}
.myos-x:hover{background:${T.pinkSoft}}
.myos-chip{justify-self:start;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 9px;border-radius:999px;font-size:11.5px;background:${T.pinkSoft};color:${T.berry}}
.myos-chip.warn{background:${T.goldSoft};color:#7A5A12}
.myos-detail p{margin:0;font-size:13.5px;line-height:1.5;color:${T.mutedFg}}
.myos-btn{all:unset;box-sizing:border-box;cursor:pointer;justify-self:start;display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;
  font-size:13.5px;font-weight:600;background:${T.plum};color:${T.cream};transition:background 160ms ease}
.myos-btn:hover{background:${T.berry}}

@media (max-width:760px){
  .myos-pill.tone-default{display:none}
  /* Projected anchors bunch up on narrow screens. Keep numbered feature
     controls in a separate row below the place bar and above the detail. */
  .myos-labels.in-env{display:flex;justify-content:center;align-items:flex-start;gap:14px;padding-top:104px}
  .myos-labels .myos-pill.tone-feature{position:static!important;transform:none!important;will-change:auto!important;flex:none}
  .myos-pill.tone-feature .myos-pill-text{display:none}
  .myos-pill.tone-feature{padding:5px}
  .myos-placebar{top:10px;left:10px;right:10px;border-radius:16px;flex-wrap:wrap;justify-content:space-between;gap:5px}
  .myos-placebar-name{order:-1;width:100%;padding:4px 0;font-size:18px;text-align:center}
  .myos-detail{top:auto;left:10px;right:10px;bottom:10px;width:auto;max-height:46%}
}`;

export const OverlayStyles = () => <style>{OVERLAY_CSS}</style>;
