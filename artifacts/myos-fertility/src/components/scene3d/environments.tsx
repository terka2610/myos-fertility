// One 3D environment per party. Clicking a station on the network opens its environment.
// Each main feature is a numbered pin here (the same numbers as the side panel), and the party's
// WhatsApp chat with MYOS is drawn as a teal line with its messages travelling along it.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line } from "./SceneLine";
import { RoundedBox } from "./SceneBox";
import * as THREE from "three";
import { easeInOut } from "./cameraPaths";
import { FEATURES, type Feature } from "./features";
import type { MessageEngine } from "./messages";
import { AssistantHubModel, PhoneModel, TankModel, VanModel, glossy, glow } from "./models";
import { useGlowTexture } from "./network";
import type { Party } from "./nodes";
import type { AnchorRegistry } from "./overlays";
import { sceneTokens as T } from "./tokens";

export interface EnvProps {
  reg: AnchorRegistry;
  engine: MessageEngine;
  activeFeature: string | null;
  onFeature: (id: string) => void;
  /** 0..1 progress of the sample's journey, read every frame. */
  getProgress: () => number;
}

const feature = (id: string) => FEATURES.find((f) => f.id === id)!;
const setAnchor = (reg: AnchorRegistry, key: string, p: THREE.Vector3) => {
  const a = reg.anchors.get(key);
  if (a) a.copy(p);
  else reg.anchors.set(key, p.clone());
};
const LINE = "#D9C3CE"; // text lines on paper, cards and screens

/* ------------------------------ shared pieces ------------------------------ */

/** Floor, back wall and soft glow shared by every environment. */
export function EnvFloor({ radius = 6.6 }: { radius?: number }) {
  const glowTex = useGlowTexture();
  return (
    <group>
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius - 0.4, 0.4, 96]} />
        <meshStandardMaterial color={T.platform} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.2, radius, 96]} />
        {glow(T.pink)}
      </mesh>
      {[2.2, 4.2].map((r) => (
        <mesh key={r} position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r, r + 0.025, 96]} />
          <meshBasicMaterial color={T.berry} transparent opacity={0.12} />
        </mesh>
      ))}
      <mesh position={[0, 0.01, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[13, 13]} />
        <meshBasicMaterial map={glowTex} transparent depthWrite={false} opacity={0.6} />
      </mesh>
      {/* curved back wall */}
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[radius - 0.15, radius - 0.15, 2.6, 96, 1, true, Math.PI - 1.25, 2.5]} />
        <meshBasicMaterial color={T.pinkSoft} transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.62, 0]}>
        <cylinderGeometry args={[radius - 0.14, radius - 0.14, 0.04, 96, 1, true, Math.PI - 1.25, 2.5]} />
        <meshBasicMaterial color={T.pink} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A clickable pin for one feature. Registers its screen anchor as `feat:<id>` so the label follows it. */
export function Hotspot({
  feature: f,
  reg,
  active,
  onSelect,
  position,
}: {
  feature: Feature;
  reg: AnchorRegistry;
  active: boolean;
  onSelect: (id: string) => void;
  /** Overrides `feature.position`, e.g. when the pin sits inside a moving group. */
  position?: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const v = useMemo(() => new THREE.Vector3(), []);
  const phase = useMemo(() => (f.id.charCodeAt(0) % 7) / 7, [f.id]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (gem.current) {
      gem.current.rotation.y = t * 1.3;
      gem.current.position.y = Math.sin(t * 2 + phase * 6) * 0.06;
      gem.current.scale.setScalar(active ? 1.4 : hover ? 1.2 : 1);
    }
    if (halo.current) {
      const k = (t * 0.7 + phase) % 1;
      halo.current.scale.setScalar(1 + k * 1.5);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    }
    if (group.current) {
      group.current.getWorldPosition(v);
      v.y += 0.3;
      setAnchor(reg, `feat:${f.id}`, v);
    }
  });

  return (
    <group ref={group} position={position ?? f.position}>
      <mesh ref={gem}>
        <octahedronGeometry args={[0.16, 0]} />
        {glow(active ? T.berryDeep : hover ? T.berryDeep : T.berry)}
      </mesh>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.26, 40]} />
        <meshBasicMaterial color={active ? T.gold : T.pink} transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(f.id);
        }}
      >
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Where MYOS floats inside every environment. */
export const ENV_HUB: [number, number, number] = [2.9, 3.0, -4.2];

/** Where each party's WhatsApp chat ends inside its environment (its phone). */
export const ENV_CHAT_END: Record<Party, [number, number, number]> = {
  centre: [1.45, 1.5, 0.5],
  transport: [-2.6, 1.35, -2.6],
  storage: [0.45, 1.4, 1.75],
  patient: [-0.4, 2.85, 0.1],
};

const MAX_PARTICLES = 4;

/** The party's WhatsApp line to MYOS, with its messages travelling along it. */
export function EnvChatLink({ party, engine, reg }: { party: Party; engine: MessageEngine; reg: AnchorRegistry }) {
  const curve = useMemo(() => {
    const hub = new THREE.Vector3(...ENV_HUB);
    const end = new THREE.Vector3(...ENV_CHAT_END[party]);
    const mid = hub.clone().lerp(end, 0.5);
    mid.y += 1.4;
    return new THREE.QuadraticBezierCurve3(hub, mid, end);
  }, [party]);
  const points = useMemo(() => curve.getPoints(48), [curve]);
  const line = useRef<any>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  useMemo(() => {
    const end = new THREE.Vector3(...ENV_CHAT_END[party]);
    setAnchor(reg, "bubble:env", end.clone().add(new THREE.Vector3(0, 0.5, 0)));
    setAnchor(reg, "hub:env", new THREE.Vector3(...ENV_HUB).add(new THREE.Vector3(1.45, 0.12, 0)));
  }, [party, reg]);

  useFrame(({ clock }) => {
    if (line.current?.material) line.current.material.dashOffset = -clock.getElapsedTime() * 0.4;
    const flying = engine
      .inFlight(performance.now())
      .filter((f) => f.msg.from === party || f.msg.to === party)
      .slice(0, MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const f = flying[i];
      if (!f) {
        mesh.visible = false;
        continue;
      }
      const outbound = f.msg.from === "assistant";
      curve.getPoint(easeInOut(outbound ? f.t : 1 - f.t), mesh.position);
      mesh.visible = true;
      (mesh.material as THREE.MeshBasicMaterial).color.set(outbound ? T.chat : T.reply);
    }
  });

  return (
    <group>
      <group position={ENV_HUB} scale={0.85}>
        <AssistantHubModel />
      </group>
      <Line ref={line} points={points} color={T.chat} lineWidth={2.2} dashed dashSize={0.2} gapSize={0.13} transparent opacity={0.85} />
      {Array.from({ length: MAX_PARTICLES }, (_, i) => (
        <mesh key={i} ref={(m) => (meshes.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshBasicMaterial color={T.chat} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** A small phone, optionally on a stand: the party's end of the WhatsApp chat. */
function ChatPhone({ position, scale = 0.62, stand = 0 }: { position: [number, number, number]; scale?: number; stand?: number }) {
  return (
    <group position={position}>
      {stand > 0 ? (
        <mesh position={[0, stand / 2, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.26, stand, 24]} />
          {glossy(T.white)}
        </mesh>
      ) : null}
      <group position={[0, stand, 0]} scale={scale} rotation={[-0.15, -0.25, 0]}>
        <PhoneModel />
      </group>
    </group>
  );
}

function Pedestal({ r = 0.45, h = 0.5, color = T.white }: { r?: number; h?: number; color?: string }) {
  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[r, r + 0.06, h, 40]} />
      {glossy(color)}
    </mesh>
  );
}

function Pins({ ids, reg, activeFeature, onFeature }: { ids: string[]; reg: AnchorRegistry; activeFeature: string | null; onFeature: (id: string) => void }) {
  return (
    <>
      {ids.map((id) => (
        <Hotspot key={id} feature={feature(id)} reg={reg} active={activeFeature === id} onSelect={onFeature} />
      ))}
    </>
  );
}

function Person({ x, z = 0, facing }: { x: number; z?: number; facing: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, facing, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.5, 8, 20]} />
        {glossy(T.secondary)}
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <sphereGeometry args={[0.15, 24, 24]} />
        {glossy(T.white)}
      </mesh>
    </group>
  );
}

/* ------------------------------ fertility centre ------------------------------ */

function DocumentCard({ x, rotZ, status }: { x: number; rotZ: number; status: "ok" | "missing" }) {
  const ref = useRef<THREE.Group>(null);
  const dot = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) ref.current.position.y = 1.42 + Math.sin(t * 1.3 + x * 3) * 0.05;
    if (dot.current && status === "missing") dot.current.scale.setScalar(1 + Math.sin(t * 5) * 0.25);
  });
  return (
    <group ref={ref} position={[x, 1.42, 0.3]} rotation={[-0.12, 0, rotZ]}>
      <RoundedBox args={[0.5, 0.66, 0.025]} radius={0.02} castShadow>
        {glossy(status === "ok" ? T.white : T.goldSoft)}
      </RoundedBox>
      {[0.2, 0.1, 0, -0.1].map((y, i) => (
        <mesh key={i} position={[-0.03, y, 0.014]}>
          <planeGeometry args={[i === 0 ? 0.3 : 0.36, 0.035]} />
          <meshBasicMaterial color={i === 0 ? T.plum : LINE} />
        </mesh>
      ))}
      <mesh ref={dot} position={[0.15, -0.22, 0.016]}>
        <circleGeometry args={[0.06, 24]} />
        {glow(status === "ok" ? T.ok : T.warn)}
      </mesh>
    </group>
  );
}

function Microphone() {
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    rings.current.forEach((m, i) => {
      if (!m) return;
      const k = (t * 0.6 + i / 3) % 1;
      m.scale.setScalar(0.6 + k * 1.6);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
    });
  });
  return (
    <group>
      <Pedestal r={0.42} h={0.12} />
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.1, 16]} />
        {glossy(T.secondary)}
      </mesh>
      <mesh position={[0, 1.38, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.24, 8, 24]} />
        {glossy(T.plum)}
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <cylinderGeometry args={[0.155, 0.155, 0.05, 24]} />
        {glow(T.pink)}
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => (rings.current[i] = m)} position={[0, 1.38, 0]}>
          <torusGeometry args={[0.32, 0.014, 8, 64]} />
          <meshBasicMaterial color={T.berry} transparent opacity={0.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function CalendarBoard() {
  const tiles: { x: number; y: number; hot: boolean; done: boolean }[] = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 7; c++) tiles.push({ x: -0.57 + c * 0.19, y: 0.2 - r * 0.17, hot: r === 2 && c === 3, done: r < 2 || (r === 2 && c < 3) });
  return (
    <group>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.55, -0.04]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 1.1, 12]} />
          {glossy(T.secondary)}
        </mesh>
      ))}
      <group position={[0, 1.2, 0]}>
        <RoundedBox args={[1.55, 1.05, 0.06]} radius={0.04} castShadow>
          {glossy(T.white)}
        </RoundedBox>
        <mesh position={[0, 0.42, 0.032]}>
          <planeGeometry args={[1.4, 0.13]} />
          {glow(T.plum)}
        </mesh>
        {tiles.map((t, i) => (
          <mesh key={i} position={[t.x, t.y, 0.032]}>
            <planeGeometry args={[0.15, 0.13]} />
            {t.hot ? glow(T.berry) : <meshBasicMaterial color={t.done ? T.input : T.secondary} />}
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function CentreEnvironment(p: EnvProps) {
  return (
    <group>
      <EnvFloor />
      {/* desk with the document check */}
      <group position={[0, 0, 0.3]}>
        <RoundedBox args={[1.5, 0.74, 0.62]} radius={0.06} position={[0, 0.37, 0]} castShadow receiveShadow>
          {glossy(T.secondary)}
        </RoundedBox>
        <RoundedBox args={[2.1, 0.08, 0.9]} radius={0.03} position={[0, 0.78, 0]} castShadow>
          {glossy(T.white)}
        </RoundedBox>
      </group>
      <DocumentCard x={-0.58} rotZ={0.1} status="ok" />
      <DocumentCard x={0} rotZ={0} status="ok" />
      <DocumentCard x={0.58} rotZ={-0.1} status="missing" />
      <ChatPhone position={[ENV_CHAT_END.centre[0], 0.82, ENV_CHAT_END.centre[2]]} scale={0.5} />
      <group position={[-2.5, 0, 0.9]}>
        <Microphone />
      </group>
      <group position={[2.6, 0, -1.3]} rotation={[0, -0.5, 0]}>
        <CalendarBoard />
      </group>
      <EnvChatLink party="centre" engine={p.engine} reg={p.reg} />
      <Pins ids={["documents", "consent", "calendar"]} reg={p.reg} activeFeature={p.activeFeature} onFeature={p.onFeature} />
    </group>
  );
}

/* ------------------------------ cryo transport ------------------------------ */

const ROAD_A = 3.9;
const ROAD_B = 2.42;
const ROAD_W = 0.38;

function useEllipseRoad() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, ROAD_A + ROAD_W, ROAD_B + ROAD_W, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, ROAD_A - ROAD_W, ROAD_B - ROAD_W, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape, 96);
  }, []);
}

/** Point on the road. s = 0 at the fertility centre (left), 0.5 at storage (right), via the front. */
const roadPoint = (s: number, out = new THREE.Vector3()) => {
  const th = Math.PI - s * Math.PI * 2;
  return out.set(ROAD_A * Math.cos(th), 0, ROAD_B * Math.sin(th));
};

function MapPin({ color = T.berry }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        {glow(color)}
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.11, 0.26, 24]} />
        {glow(color)}
      </mesh>
      <mesh position={[0, 0.2, 0.12]}>
        <circleGeometry args={[0.06, 20]} />
        <meshBasicMaterial color={T.white} />
      </mesh>
    </group>
  );
}

function MovingVan({ getProgress, reg, activeFeature, onFeature }: Pick<EnvProps, "getProgress" | "reg" | "activeFeature" | "onFeature">) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = Math.min(0.495, getProgress() * 0.5); // the front half of the loop: centre → storage
    roadPoint(s, a);
    roadPoint(s + 0.004, b);
    if (group.current) {
      group.current.position.copy(a);
      group.current.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    }
    if (pulse.current) {
      const k = (t * 0.9) % 1;
      pulse.current.scale.setScalar(0.6 + k * 1.4);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
    }
  });
  return (
    <group ref={group}>
      <group scale={0.62} position={[0, 0.02, 0]}>
        <VanModel />
      </group>
      <mesh ref={pulse} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.78, 48]} />
        <meshBasicMaterial color={T.berry} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <group position={[0, 1.15, 0]}>
        <MapPin />
      </group>
      <Hotspot feature={feature("gps")} reg={reg} active={activeFeature === "gps"} onSelect={onFeature} />
    </group>
  );
}

function FreezerGauge({ getProgress }: { getProgress: () => number }) {
  const fill = useRef<THREE.Mesh>(null);
  const c = useMemo(() => new THREE.Color(), []);
  const cold = useMemo(() => new THREE.Color(T.teal), []);
  const warm = useMemo(() => new THREE.Color(T.warn), []);
  useFrame(() => {
    const k = getProgress();
    const level = 0.08 + 0.3 * k; // stays well under the limit line, like the demo status
    if (fill.current) {
      fill.current.scale.y = level;
      fill.current.position.y = 0.3 + (1.2 * level) / 2;
      c.copy(cold).lerp(warm, k * 0.35);
      (fill.current.material as THREE.MeshBasicMaterial).color.copy(c);
    }
  });
  return (
    <group>
      <Pedestal r={0.42} h={0.3} />
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 1.22, 32, 1, true]} />
        <meshPhysicalMaterial color={T.secondary} transparent opacity={0.35} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={fill} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 1.2, 32]} />
        <meshBasicMaterial color={T.teal} toneMapped={false} />
      </mesh>
      {/* the limit line */}
      <mesh position={[0, 1.38, 0]}>
        <torusGeometry args={[0.27, 0.02, 8, 40]} />
        {glow(T.warn)}
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.08, 32]} />
        {glossy(T.white)}
      </mesh>
    </group>
  );
}

function Clipboard() {
  return (
    <group>
      <Pedestal r={0.42} h={0.55} />
      <group position={[0, 0.82, 0]} rotation={[-0.95, 0, 0]}>
        <RoundedBox args={[0.62, 0.8, 0.04]} radius={0.03} castShadow>
          {glossy(T.white)}
        </RoundedBox>
        <mesh position={[0, 0.38, 0.03]}>
          <boxGeometry args={[0.24, 0.07, 0.04]} />
          {glossy(T.berry)}
        </mesh>
        {[0.18, 0.02, -0.14, -0.3].map((y, i) => (
          <group key={i} position={[0, y, 0.022]}>
            <mesh position={[-0.2, 0, 0]}>
              <circleGeometry args={[0.045, 16]} />
              {i < 3 ? glow(T.ok) : <meshBasicMaterial color={T.input} />}
            </mesh>
            <mesh position={[0.05, 0, 0]}>
              <planeGeometry args={[0.36, 0.035]} />
              <meshBasicMaterial color={LINE} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function TransportEnvironment(p: EnvProps) {
  const road = useEllipseRoad();
  const front = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const v = roadPoint((i / 64) * 0.5);
      pts.push([v.x, 0.05, v.z]);
    }
    return pts;
  }, []);
  const routeLine = useRef<any>(null);
  useFrame(({ clock }) => {
    if (routeLine.current?.material) routeLine.current.material.dashOffset = -clock.getElapsedTime() * 0.6;
  });
  return (
    <group>
      <EnvFloor />
      <mesh geometry={road} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color={T.road} roughness={0.9} />
      </mesh>
      <Line ref={routeLine} points={front} color={T.berry} lineWidth={2.6} dashed dashSize={0.3} gapSize={0.18} />
      {/* start: the fertility centre */}
      <group position={[-4.55, 0, 0]}>
        <Pedestal r={0.36} h={0.12} color={T.pink} />
        <RoundedBox args={[0.5, 0.42, 0.4]} radius={0.05} position={[0, 0.33, 0]} castShadow>
          {glossy(T.white)}
        </RoundedBox>
      </group>
      {/* destination: cryogenic storage */}
      <group position={[4.62, 0, 0]}>
        <Pedestal r={0.4} h={0.12} color={T.pink} />
        <group scale={0.55} position={[0, 0.1, 0]}>
          <TankModel highlight />
        </group>
      </group>
      <MovingVan getProgress={p.getProgress} reg={p.reg} activeFeature={p.activeFeature} onFeature={p.onFeature} />
      <group position={[2.3, 0, -2.6]}>
        <FreezerGauge getProgress={p.getProgress} />
      </group>
      <group position={[0, 0, -0.1]}>
        <Clipboard />
      </group>
      <ChatPhone position={[ENV_CHAT_END.transport[0], 0, ENV_CHAT_END.transport[2]]} stand={0.62} scale={0.5} />
      <EnvChatLink party="transport" engine={p.engine} reg={p.reg} />
      <Pins ids={["freezer", "handover"]} reg={p.reg} activeFeature={p.activeFeature} onFeature={p.onFeature} />
    </group>
  );
}

/* ------------------------------ cryogenic storage ------------------------------ */

function AcceptanceGate() {
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!beam.current) return;
    const t = clock.getElapsedTime();
    beam.current.position.y = 0.3 + ((Math.sin(t * 1.6) + 1) / 2) * 1.1;
  });
  return (
    <group>
      {[-0.6, 0.6].map((x) => (
        <RoundedBox key={x} args={[0.16, 1.7, 0.16]} radius={0.04} position={[x, 0.85, 0]} castShadow>
          {glossy(T.white)}
        </RoundedBox>
      ))}
      <RoundedBox args={[1.38, 0.16, 0.18]} radius={0.04} position={[0, 1.72, 0]} castShadow>
        {glossy(T.white)}
      </RoundedBox>
      <mesh ref={beam} position={[0, 0.8, 0]}>
        <boxGeometry args={[1.05, 0.035, 0.035]} />
        {glow(T.teal)}
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.12, 20, 20]} />
        {glow(T.ok)}
      </mesh>
    </group>
  );
}

function ReadingsConsole() {
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    bars.current.forEach((m, i) => {
      if (!m) return;
      const h = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 0.9));
      m.scale.y = h;
      m.position.y = -0.2 + (0.4 * h) / 2;
    });
  });
  return (
    <group>
      <RoundedBox args={[1.5, 0.72, 0.55]} radius={0.06} position={[0, 0.36, 0]} castShadow receiveShadow>
        {glossy(T.secondary)}
      </RoundedBox>
      <group position={[0, 1.08, -0.05]} rotation={[-0.35, 0, 0]}>
        <RoundedBox args={[1.4, 0.62, 0.05]} radius={0.03} castShadow>
          {glossy(T.plum)}
        </RoundedBox>
        <mesh position={[0, 0, 0.027]}>
          <planeGeometry args={[1.3, 0.52]} />
          <meshBasicMaterial color="#3F1B2A" />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} ref={(m) => (bars.current[i] = m)} position={[-0.48 + i * 0.16, 0, 0.032]}>
            <planeGeometry args={[0.09, 0.4]} />
            {glow(i === 3 ? T.pink : T.teal)}
          </mesh>
        ))}
        <mesh position={[0, 0.19, 0.033]}>
          <planeGeometry args={[1.18, 0.012]} />
          {glow(T.gold)}
        </mesh>
      </group>
    </group>
  );
}

const TANK_ANGLES = [210, 240, 270, 300, 330];

export function StorageEnvironment(p: EnvProps) {
  return (
    <group>
      <EnvFloor />
      {TANK_ANGLES.map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const hot = i === 2;
        return (
          <group key={deg} position={[2.8 * Math.cos(a), 0, 2.8 * Math.sin(a)]} scale={hot ? 1.18 : 1}>
            <TankModel highlight={hot} />
          </group>
        );
      })}
      {/* the technician and the witness at Tank 3 */}
      <Person x={-0.75} z={-1.55} facing={0.6} />
      <Person x={0.75} z={-1.55} facing={-0.6} />
      <group position={[-2.9, 0, 1.2]} rotation={[0, 0.55, 0]}>
        <AcceptanceGate />
      </group>
      <group position={[2.8, 0, 1.2]} rotation={[0, -0.45, 0]}>
        <ReadingsConsole />
      </group>
      <ChatPhone position={[ENV_CHAT_END.storage[0], 0, ENV_CHAT_END.storage[2]]} stand={0.72} scale={0.48} />
      <EnvChatLink party="storage" engine={p.engine} reg={p.reg} />
      <Pins ids={["acceptance", "placement", "readings"]} reg={p.reg} activeFeature={p.activeFeature} onFeature={p.onFeature} />
    </group>
  );
}

/* ------------------------------ patient ------------------------------ */

function FloatingBubbles() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const items: { p: [number, number, number]; w: number; mine: boolean }[] = [
    { p: [-1.75, 2.3, 0.2], w: 1.0, mine: false },
    { p: [0.95, 1.95, 0.3], w: 0.8, mine: true },
    { p: [-1.6, 1.3, 0.45], w: 0.85, mine: false },
  ];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((g, i) => {
      if (g) g.position.y = items[i].p[1] + Math.sin(t * 1.2 + i * 1.7) * 0.07;
    });
  });
  return (
    <>
      {items.map((b, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} position={b.p}>
          <RoundedBox args={[b.w, 0.3, 0.05]} radius={0.1} castShadow>
            {glossy(b.mine ? T.pinkSoft : T.white)}
          </RoundedBox>
          <mesh position={[0, 0.02, 0.03]}>
            <planeGeometry args={[b.w * 0.7, 0.04]} />
            <meshBasicMaterial color={b.mine ? T.pink : LINE} />
          </mesh>
          <mesh position={[-b.w * 0.1, -0.06, 0.03]}>
            <planeGeometry args={[b.w * 0.5, 0.04]} />
            <meshBasicMaterial color={b.mine ? T.pink : LINE} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function WhereIsMySample() {
  const pin = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const route = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 32; i++) {
      const s = i / 32;
      pts.push([-0.55 + 1.1 * s, 0.17, 0.25 * Math.sin(s * Math.PI * 2)]);
    }
    return pts;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (pin.current) pin.current.position.y = 0.2 + Math.abs(Math.sin(t * 2)) * 0.12;
    if (pulse.current) {
      const k = (t * 0.8) % 1;
      pulse.current.scale.setScalar(0.5 + k * 1.3);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
    }
  });
  return (
    <group>
      <Pedestal r={0.82} h={0.14} />
      <Line points={route} color={T.berry} lineWidth={2} dashed dashSize={0.08} gapSize={0.05} />
      <mesh ref={pulse} position={[0.15, 0.16, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.23, 40]} />
        <meshBasicMaterial color={T.berry} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <group ref={pin} position={[0.15, 0.2, 0.1]}>
        <MapPin />
      </group>
    </group>
  );
}

export function PatientEnvironment(p: EnvProps) {
  return (
    <group>
      <EnvFloor />
      <group position={[-0.4, 0, 0]}>
        <Pedestal r={0.85} h={0.14} />
        <group position={[0, 0.14, 0]} scale={2.4} rotation={[-0.08, 0, 0]}>
          <PhoneModel screenGlow={1.2} />
        </group>
      </group>
      <FloatingBubbles />
      <group position={[2.5, 0, 0.4]}>
        <WhereIsMySample />
      </group>
      <EnvChatLink party="patient" engine={p.engine} reg={p.reg} />
      <Pins ids={["updates", "whereis"]} reg={p.reg} activeFeature={p.activeFeature} onFeature={p.onFeature} />
    </group>
  );
}

export const ENVIRONMENTS: Record<Party, (p: EnvProps) => ReactNode> = {
  centre: (p) => <CentreEnvironment {...p} />,
  transport: (p) => <TransportEnvironment {...p} />,
  storage: (p) => <StorageEnvironment {...p} />,
  patient: (p) => <PatientEnvironment {...p} />,
};
