// The network view: platform, ring road, the sample's journey, the stations, and the WhatsApp
// connections from the MYOS assistant to every party with messages travelling along them.
import { useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line } from "./SceneLine";
import * as THREE from "three";
import { easeInOut } from "./cameraPaths";
import type { MessageEngine } from "./messages";
import { AssistantHubModel, CryoStorageModel, CryoTransportModel, FertilityCentreModel, PatientModel } from "./models";
import { ASSISTANT, NODES, RING_RADIUS, nodeById, type Party, type SceneNode } from "./nodes";
import { sceneTokens as T } from "./tokens";

const MODELS: Record<Party, () => ReactNode> = {
  centre: () => <FertilityCentreModel />,
  transport: () => <CryoTransportModel />,
  storage: () => <CryoStorageModel />,
  patient: () => (
    <group scale={1.4}>
      <PatientModel />
    </group>
  ),
};

/* ------------------------------ ground ------------------------------ */

export function useGlowTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(249,227,238,0.95)");
    g.addColorStop(0.4, "rgba(232,169,198,0.35)");
    g.addColorStop(1, "rgba(232,169,198,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

export function Platform() {
  const glow = useGlowTexture();
  const ring = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push([RING_RADIUS * Math.cos(a), 0.17, RING_RADIUS * Math.sin(a)]);
    }
    return pts;
  }, []);
  return (
    <group>
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[6.4, 6.0, 0.4, 96]} />
        <meshStandardMaterial color={T.platform} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.15, 6.4, 96]} />
        <meshStandardMaterial color={T.pink} emissive={T.pink} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.01, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[RING_RADIUS - 0.42, RING_RADIUS + 0.42, 128]} />
        <meshStandardMaterial color={T.road} roughness={0.9} />
      </mesh>
      <Line points={ring} color={T.roadLine} lineWidth={1.2} dashed dashSize={0.25} gapSize={0.22} transparent opacity={0.3} />
    </group>
  );
}

/* ------------------------------ the sample's journey ------------------------------ */

export function JourneyPath({ getProgress }: { getProgress: () => number }) {
  const curve = useMemo(() => {
    const c = nodeById("centre").position;
    const tr = nodeById("transport").position;
    const st = nodeById("storage").position;
    const pts: THREE.Vector3[] = [new THREE.Vector3(c[0], 0.3, c[2] + 1.0)];
    pts.push(new THREE.Vector3((c[0] + tr[0]) / 2, 0.3, (c[2] + tr[2]) / 2 + 0.6));
    pts.push(new THREE.Vector3(tr[0], 0.3, tr[2]));
    const a0 = Math.atan2(tr[2], tr[0]);
    const a1 = Math.atan2(st[2], st[0]);
    for (let i = 1; i < 8; i++) {
      const a = a0 + ((a1 - a0) * i) / 8;
      pts.push(new THREE.Vector3(RING_RADIUS * Math.cos(a), 0.3, RING_RADIUS * Math.sin(a)));
    }
    pts.push(new THREE.Vector3(st[0], 0.3, st[2]));
    return new THREE.CatmullRomCurve3(pts, false, "centripetal");
  }, []);
  const points = useMemo(() => curve.getPoints(160), [curve]);
  const dot = useRef<THREE.Group>(null);
  const line = useRef<any>(null);
  useFrame(({ clock }) => {
    const t = getProgress();
    const p = curve.getPointAt(Math.min(0.999, Math.max(0, t)));
    if (dot.current) dot.current.position.set(p.x, p.y + 0.22 + Math.sin(clock.getElapsedTime() * 3) * 0.04, p.z);
    if (line.current?.material) line.current.material.dashOffset = -clock.getElapsedTime() * 0.6;
  });
  return (
    <group>
      <Line ref={line} points={points} color={T.accentStrong} lineWidth={2.6} dashed dashSize={0.35} gapSize={0.2} transparent opacity={0.85} />
      <group ref={dot}>
        <mesh>
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshStandardMaterial color={T.sample} emissive={T.accentStrong} emissiveIntensity={2} toneMapped={false} />
        </mesh>
        <pointLight color={T.accent} intensity={1.5} distance={2.5} />
      </group>
    </group>
  );
}

/* ------------------------------ WhatsApp connections ------------------------------ */

/** Where each party's WhatsApp line ends, just above its model. */
const LINK_HEIGHT: Record<Party, number> = { centre: 2.7, transport: 1.55, storage: 2.15, patient: 1.85 };

export function useLinkCurves() {
  return useMemo(() => {
    const hub = new THREE.Vector3(...ASSISTANT.position);
    const out = {} as Record<Party, THREE.QuadraticBezierCurve3>;
    for (const n of NODES) {
      const end = new THREE.Vector3(n.position[0], LINK_HEIGHT[n.id], n.position[2]);
      const mid = hub.clone().lerp(end, 0.5);
      const outward = new THREE.Vector3(end.x, 0, end.z);
      if (outward.lengthSq() > 0.01) mid.add(outward.normalize().multiplyScalar(0.8));
      mid.y += 1.1;
      out[n.id] = new THREE.QuadraticBezierCurve3(hub, mid, end);
    }
    return out;
  }, []);
}

function LinkLine({ curve, active }: { curve: THREE.QuadraticBezierCurve3; active: boolean }) {
  const points = useMemo(() => curve.getPoints(48), [curve]);
  const ref = useRef<any>(null);
  useFrame(({ clock }) => {
    const m = ref.current?.material;
    if (!m) return;
    m.dashOffset = -clock.getElapsedTime() * 0.4;
    const want = active ? 1 : 0.7;
    m.opacity += (want - m.opacity) * 0.1;
  });
  return <Line ref={ref} points={points} color={T.chat} lineWidth={active ? 2.6 : 1.8} dashed dashSize={0.2} gapSize={0.12} transparent opacity={0.7} />;
}

const MAX_PARTICLES = 6;

/** The assistant, its WhatsApp line to every party, and the messages travelling along them. */
export function WhatsAppLinks({ engine, highlight }: { engine: MessageEngine; highlight: Party | null }) {
  const curves = useLinkCurves();
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const flying = engine.inFlight(performance.now()).slice(0, MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const f = flying[i];
      if (!f) {
        mesh.visible = false;
        continue;
      }
      const party = (f.msg.from === "assistant" ? f.msg.to : f.msg.from) as Party;
      const curve = curves[party];
      if (!curve) {
        mesh.visible = false;
        continue;
      }
      const t = easeInOut(f.msg.from === "assistant" ? f.t : 1 - f.t);
      curve.getPoint(t, mesh.position);
      mesh.visible = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(f.msg.from === "assistant" ? T.chat : T.reply);
      mat.emissive.set(f.msg.from === "assistant" ? T.chat : T.reply);
    }
  });
  return (
    <group>
      <group position={ASSISTANT.position}>
        <AssistantHubModel />
      </group>
      {NODES.map((n) => (
        <LinkLine key={n.id} curve={curves[n.id]} active={highlight === n.id} />
      ))}
      {Array.from({ length: MAX_PARTICLES }, (_, i) => (
        <mesh key={i} ref={(m) => (meshes.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={T.chat} emissive={T.chat} emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------ stations ------------------------------ */

export function Station({
  node,
  hovered,
  focused,
  onHover,
  onClick,
}: {
  node: SceneNode;
  hovered: boolean;
  focused: boolean;
  onHover: (id: Party | null) => void;
  onClick: (id: Party) => void;
}) {
  const lift = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const radius = node.id === "centre" ? 2.05 : node.id === "patient" ? 1.45 : 1.7;

  useFrame(({ clock }, delta) => {
    if (lift.current) {
      const target = hovered || focused ? 0.14 : 0;
      lift.current.position.y += (target - lift.current.position.y) * Math.min(1, delta * 8);
    }
    if (ring.current) {
      ring.current.scale.setScalar(focused ? 1 + Math.sin(clock.getElapsedTime() * 3) * 0.035 : 1);
      const mat = ring.current.material as THREE.MeshStandardMaterial;
      const want = focused ? 1.2 : hovered ? 0.8 : 0.15;
      mat.emissiveIntensity += (want - mat.emissiveIntensity) * Math.min(1, delta * 8);
      mat.opacity = focused || hovered ? 1 : 0.7;
    }
  });

  return (
    <group position={node.position}>
      <mesh ref={ring} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius, radius + 0.07, 96]} />
        <meshStandardMaterial
          color={focused || hovered ? T.accentStrong : T.pink}
          emissive={focused || hovered ? T.accentStrong : T.pink}
          emissiveIntensity={0.25}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>
      <group ref={lift}>
        <group rotation={[0, node.rotationY, 0]}>{MODELS[node.id]()}</group>
      </group>
      <mesh
        position={[0, 1.3, 0]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick(node.id);
        }}
      >
        <cylinderGeometry args={[radius, radius, 2.8, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
