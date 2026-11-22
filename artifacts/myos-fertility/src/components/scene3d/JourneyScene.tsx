// MYOS 3D scene, version 3: the health.myos.sk look, the main features only, and a simpler flow.
// Network view: the fertility centre in the middle, cryo transport, cryogenic storage and the patient around it,
// and MYOS above with one WhatsApp chat per party. The sample's journey and the messages run on one shared clock.
// Click a place: the camera flies in and that place opens, with its main features as numbered cards and pins.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ENV_POSES, OVERVIEW, arcPoint, easeInOut, poseFor, type CameraPose } from "./cameraPaths";
import { ENVIRONMENTS } from "./environments";
import { FEATURES, featuresFor, type Feature } from "./features";
import { MessageEngine, demoProgress, type ChatMessage } from "./messages";
import { JourneyPath, Platform, Station, WhatsAppLinks } from "./network";
import { NODES, nodeById, type Party, type SceneNode } from "./nodes";
import { FeatureDetail, LabelPill, OverlayStyles, PlaceBar, PlacesNav, Projector, createRegistry, track, type Step, type View } from "./overlays";
import { sceneTokens as T } from "./tokens";
import { ScenePerformance } from "./ScenePerformance";

export type { View };

export interface JourneySceneProps {
  /** View to open first: "network" (default) or a place. */
  initialView?: View;
  /** Optional controlled view. The scene still animates the change and calls onViewChange. */
  view?: View;
  /** Called when the scene starts moving to another view. */
  onViewChange?: (view: View) => void;
  /** "Open the … page" at the bottom of a place's panel. Hidden if not set. */
  onOpen?: (party: Party, node: SceneNode) => void;
  /** "Open in the portal" on a feature. Hidden if not set. */
  onFeatureOpen?: (feature: Feature) => void;
  /** Feature to open on first load, e.g. "gps". */
  initialFeature?: string;
  /** One short live line under each place's label, e.g. { transport: "ETA 11:15" }. */
  status?: Partial<Record<Party, string>>;
  /** Live status per feature id, e.g. { documents: "3 of 3 complete" }. Falls back to features.ts. */
  featureStatus?: Record<string, string>;
  /** Live WhatsApp messages (oldest first). Leave undefined to play the demo conversation in a loop. */
  messages?: ChatMessage[];
  /** Where the sample is, 0 (centre) to 1 (storage). Leave undefined to follow the demo conversation. */
  progress?: number;
  /** @deprecated No longer shown; the overview has no intro text. */
  /** Heading on the network view. Wrap the words to put in italic berry in *asterisks*. */
  title?: string;
  /** Line under the heading. */
  hint?: string;
  /** The three "How it works" steps. */
  steps?: Step[];
  /** Places menu (default true). Also gives keyboard access. */
  showNav?: boolean;
  /** Small label above the heading, e.g. "Synthetic data · demo". */
  badge?: ReactNode;
  /** Hide every HTML overlay (labels, panels, nav), e.g. while a form dialog is open. */
  overlaysHidden?: boolean;
  /** Stop rendering frames without unmounting the scene. */
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const DEFAULT_STEPS: Step[] = [
  { party: "centre", title: "Documents checked", sub: "MYOS asks for anything missing" },
  { party: "transport", title: "On the road", sub: "Live GPS for everyone" },
  { party: "storage", title: "Stored safely", sub: "Witnessed, and the patient is told" },
];

/* ------------------------------ camera ------------------------------ */

interface CamMove {
  from: CameraPose;
  to: CameraPose;
  t: number;
  duration: number;
  lift: number;
  done?: () => void;
  /** Where the camera is now, before parallax. */
  current: CameraPose;
}

const clonePose = (p: CameraPose): CameraPose => ({ position: p.position.clone(), target: p.target.clone() });

function CameraRig({ move, inPlace }: { move: MutableRefObject<CamMove>; inPlace: MutableRefObject<boolean> }) {
  const { camera, pointer, size, scene } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const shift = useRef({ x: 0, y: 0 });
  useFrame((_, delta) => {
    // step back on tall, narrow screens so the whole scene stays in view
    const fit = Math.min(2.3, Math.max(1, 1.1 / (size.width / Math.max(1, size.height))));
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = 16 * fit;
      scene.fog.far = 34 * fit;
    }
    const m = move.current;
    if (m.t < 1) {
      m.t = Math.min(1, m.t + Math.min(delta, 0.1) / m.duration);
      if (m.t >= 1 && m.done) {
        const done = m.done;
        m.done = undefined;
        done();
      }
    }
    const k = easeInOut(m.t);
    arcPoint(m.from.position, m.to.position, k, m.lift, m.current.position);
    m.current.target.copy(m.from.target).lerp(m.to.target, k);
    tmp.copy(m.current.position).sub(m.current.target).multiplyScalar(fit).add(m.current.target);
    tmp.x += pointer.x * 0.25;
    tmp.y += pointer.y * 0.15;
    camera.position.copy(tmp);
    camera.lookAt(m.current.target);

    // inside a place, move the picture away from the side panel (desktop) or the bottom sheet (phone)
    const wide = size.width > 760;
    const want = wide ? { x: inPlace.current ? 185 : 0, y: 0 } : inPlace.current ? { x: 0, y: size.height * 0.27 } : { x: 0, y: 0 };
    const s = Math.min(1, delta * 6);
    shift.current.x += (want.x - shift.current.x) * s;
    shift.current.y += (want.y - shift.current.y) * s;
    (camera as THREE.PerspectiveCamera).setViewOffset(size.width, size.height, -shift.current.x, shift.current.y, size.width, size.height);
  });
  return null;
}

/* ------------------------------ scene ------------------------------ */

const FADE_MS = 260;

export default function JourneyScene({
  initialView = "network",
  view: viewProp,
  onViewChange,
  onOpen,
  onFeatureOpen,
  initialFeature,
  status,
  featureStatus,
  messages,
  progress,
  showNav = true,
  overlaysHidden = false,
  paused = false,
  className,
  style,
}: JourneySceneProps) {
  const start = viewProp ?? initialView;
  const [view, setView] = useState<View>(start);
  const [focus, setFocus] = useState<Party | null>(null);
  const [hovered, setHovered] = useState<Party | null>(null);
  const [feature, setFeature] = useState<string | null>(initialFeature ?? null);
  const [fading, setFading] = useState(false);
  const reg = useMemo(createRegistry, []);
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const narrow = useMemo(() => typeof window !== "undefined" && window.innerWidth <= 760, []);
  const engine = useMemo(() => new MessageEngine(), []);
  const viewRef = useRef<View>(start);
  const targetRef = useRef<View>(start);
  const inPlace = useRef(start !== "network");
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const startPose = start === "network" ? OVERVIEW : ENV_POSES[start];
  const move = useRef<CamMove>({ from: clonePose(startPose), to: clonePose(startPose), t: 1, duration: 1, lift: 0, current: clonePose(startPose) });

  // one clock for the sample and the messages
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const getProgress = useCallback(() => progressRef.current ?? demoProgress(engine.demoSeconds(performance.now())), [engine]);

  // fixed anchors for the network labels
  useMemo(() => {
    for (const n of NODES) reg.anchors.set(`party:${n.id}`, new THREE.Vector3(n.position[0], n.position[1] + n.labelHeight, n.position[2]));
  }, [reg]);

  // live messages (if any) feed the in-scene message particles; the demo script plays only as 3D motion, no text
  const primed = useRef(false);
  useEffect(() => {
    if (messages && !primed.current) engine.primeLive(messages);
    primed.current = true;
    engine.setLive(messages);
  }, [messages, engine]);

  /* ---------- moving between views ---------- */
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      document.body.style.cursor = "";
    },
    [],
  );

  const flyTo = (to: CameraPose, duration: number, lift: number, done?: () => void) => {
    const m = move.current;
    m.from = clonePose(m.current);
    m.to = clonePose(to);
    m.t = 0;
    m.duration = reducedMotion ? Math.min(duration, 0.2) : duration;
    m.lift = lift;
    m.done = done;
  };

  const enterPlace = (id: Party) => {
    viewRef.current = id;
    inPlace.current = true;
    setView(id);
    const p = ENV_POSES[id];
    const back = p.position.clone().sub(p.target).normalize().multiplyScalar(3.2);
    move.current.current = { position: p.position.clone().add(back), target: p.target.clone() };
    flyTo(p, 1.1, 0);
  };

  const go = useCallback(
    (target: View) => {
      if (target === targetRef.current) return;
      if (busy.current) {
        later(() => goRef.current(target), 160);
        return;
      }
      busy.current = true;
      targetRef.current = target;
      setFeature(null);
      setHovered(null);
      document.body.style.cursor = "";
      onViewChange?.(target);
      const from = viewRef.current;
      const finish = () => later(() => (busy.current = false), FADE_MS + 40);

      if (from === "network" && target !== "network") {
        // fly to the place, fade, then open it
        setFocus(target);
        flyTo(poseFor(target), 0.8, 0.9, () => {
          setFading(true);
          later(() => {
            enterPlace(target);
            setFocus(null);
            setFading(false);
            finish();
          }, FADE_MS);
        });
        return;
      }
      setFading(true);
      later(() => {
        if (target === "network") {
          viewRef.current = "network";
          inPlace.current = false;
          setView("network");
          move.current.current = clonePose(poseFor(from as Party));
          flyTo(OVERVIEW, 1.1, 0.9);
        } else {
          enterPlace(target);
        }
        setFading(false);
        finish();
      }, FADE_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onViewChange],
  );

  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (viewProp && viewProp !== targetRef.current) go(viewProp);
  }, [viewProp, go]);

  // inside a place, choosing a feature moves the camera a little towards its pin
  useEffect(() => {
    if (view === "network" || busy.current) return;
    if ((wrap.current?.offsetWidth ?? 1000) <= 760) return; // on phones the camera stays put
    const base = ENV_POSES[view];
    if (!feature) {
      flyTo(base, 0.9, 0);
      return;
    }
    const f = FEATURES.find((x) => x.id === feature);
    const a = reg.anchors.get(`feat:${feature}`);
    const pin = a ? a.clone().setY(a.y - 0.3) : new THREE.Vector3(...(f?.position ?? [0, 1, 0]));
    const target = base.target.clone().lerp(pin, 0.55);
    const position = base.position.clone().add(pin.clone().sub(base.target).multiplyScalar(0.35));
    position.lerp(target, 0.2);
    flyTo({ position, target }, 0.9, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // leave keys alone while a form or dialog is in use
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || document.querySelector('[role="dialog"]') || overlaysHidden || el?.closest?.("input,textarea,select,[contenteditable=true]")) return;
      if (e.key === "Escape") {
        if (feature) setFeature(null);
        else if (viewRef.current !== "network") go("network");
        return;
      }
      // 1, 2, 3 open the features of the current place
      const n = Number(e.key);
      const here = viewRef.current;
      if (here !== "network" && n >= 1 && n <= 9) {
        const list = featuresFor(here);
        if (list[n - 1]) setFeature((cur) => (cur === list[n - 1].id ? null : list[n - 1].id));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feature, go, overlaysHidden]);

  /* ---------- render ---------- */
  const party = view !== "network" ? (view as Party) : null;
  const placeFeatures = party ? featuresFor(party) : [];
  const statusOf = (f: Feature) => featureStatus?.[f.id] ?? f.status;
  const activeFeature = placeFeatures.find((f) => f.id === feature) ?? null;
  return (
    <div
      ref={wrap}
      className={["myos-scene", className].filter(Boolean).join(" ")}
      style={{ position: "relative", width: "100%", height: "100%", minHeight: 420, overflow: "hidden", borderRadius: 24, background: T.background, ...style }}
    >
      <OverlayStyles />
      <Canvas
        flat
        frameloop={paused ? "never" : "always"}
        dpr={1}
        gl={{ antialias: !narrow, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: startPose.position.toArray() as [number, number, number], fov: 42, near: 0.1, far: 80 }}
        onPointerMissed={() => setFeature(null)}
      >
        <ScenePerformance view={view} paused={Boolean(paused)} />
        <fog attach="fog" args={[T.fog, 16, 34]} />
        <ambientLight intensity={1.6} color="#fff4f0" />
        <hemisphereLight args={["#ffffff", "#f6dfe8", 1.0]} />
        <directionalLight
          position={[4, 10, 6]}
          intensity={1.6}
        />
        <pointLight position={[0, 4, 3]} intensity={3} distance={14} color="#ffd6e6" />

        <Suspense fallback={null}>
          <CameraRig move={move} inPlace={inPlace} />
          <Projector reg={reg} />
          {party ? (
            ENVIRONMENTS[party]({ reg, engine, activeFeature: feature, onFeature: setFeature, getProgress })
          ) : (
            <group>
              <Platform />
              <JourneyPath getProgress={getProgress} />
              <WhatsAppLinks engine={engine} highlight={hovered ?? focus} />
              {NODES.map((n) => (
                <Station key={n.id} node={n} hovered={hovered === n.id} focused={focus === n.id} onHover={setHovered} onClick={go} />
              ))}
            </group>
          )}
        </Suspense>
      </Canvas>

      {!overlaysHidden ? (
        <>
          {/* place labels and feature pins, moved every frame by the Projector */}
          <div className={`myos-labels${party ? " in-env" : ""}`} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}>
            {!party
              ? NODES.map((n) => (
                  <LabelPill
                    key={n.id}
                    refCallback={track(reg, `party:${n.id}`)}
                    title={n.label}
                    active={focus === n.id}
                    hovered={hovered === n.id}
                    onClick={() => go(n.id)}
                    onHover={(on) => setHovered(on ? n.id : null)}
                  />
                ))
              : placeFeatures.map((f, i) => (
                  <LabelPill
                    key={f.id}
                    refCallback={track(reg, `feat:${f.id}`)}
                    title={f.label}
                    num={i + 1}
                    tone="feature"
                    active={feature === f.id}
                    onClick={() => setFeature((cur) => (cur === f.id ? null : f.id))}
                  />
                ))}
          </div>

          {party ? (
            <>
              <PlaceBar node={nodeById(party)} onBack={() => go("network")} onOpenPage={onOpen ? () => onOpen(party, nodeById(party)) : undefined} />
              {activeFeature ? (
                <FeatureDetail
                  key={activeFeature.id}
                  feature={activeFeature}
                  num={placeFeatures.indexOf(activeFeature) + 1}
                  status={statusOf(activeFeature)}
                  onClose={() => setFeature(null)}
                  onFeatureOpen={onFeatureOpen}
                />
              ) : null}
            </>
          ) : null}
          {showNav ? <PlacesNav view={view} onGo={go} /> : null}
        </>
      ) : null}

      {/* fade between the network and a place */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          background: T.cream,
          opacity: fading ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
          pointerEvents: fading ? "auto" : "none",
        }}
      />
    </div>
  );
}
