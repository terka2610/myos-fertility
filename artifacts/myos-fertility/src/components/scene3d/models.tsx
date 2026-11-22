// Simple low-poly models built from primitives: no textures and no GLB files to load.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "./SceneBox";
import * as THREE from "three";
import { sceneTokens as T } from "./tokens";

export const glossy = (color: string, emissive = "#000000", emissiveIntensity = 0) => (
  <meshStandardMaterial
    color={color}
    roughness={0.32}
    metalness={0.05}
    emissive={emissive}
    emissiveIntensity={emissiveIntensity}
  />
);

/** A flat, unlit colour: shows the exact palette colour on the light background. `intensity` is kept for compatibility. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const glow = (color: string, _intensity = 1) => <meshBasicMaterial color={color} toneMapped={false} />;

/* ------------------------------ fertility centre ------------------------------ */

export function FertilityCentreModel() {
  const egg = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!egg.current) return;
    const t = clock.getElapsedTime();
    egg.current.position.y = 3.05 + Math.sin(t * 1.4) * 0.08;
    egg.current.rotation.y = t * 0.6;
  });

  const windowsFront: [number, number][] = [];
  for (const y of [0.62, 1.12]) for (const x of [-0.72, -0.24, 0.24, 0.72]) windowsFront.push([x, y]);

  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.75, 1.85, 0.18, 48]} />
        {glossy(T.ice)}
      </mesh>
      <RoundedBox args={[2.3, 1.25, 1.6]} radius={0.12} position={[0, 0.8, 0]} castShadow>
        {glossy(T.white)}
      </RoundedBox>
      <RoundedBox args={[1.5, 0.75, 1.25]} radius={0.12} position={[0.25, 1.8, -0.1]} castShadow>
        {glossy(T.white)}
      </RoundedBox>
      <RoundedBox args={[1.75, 0.08, 1.45]} radius={0.03} position={[0.25, 2.21, -0.1]}>
        {glossy(T.ice)}
      </RoundedBox>
      {windowsFront.map(([x, y], i) => (
        <mesh key={i} position={[x, y + 0.08, 0.805]}>
          <planeGeometry args={[0.32, 0.26]} />
          {glow(T.window, 0.9)}
        </mesh>
      ))}
      {[-0.2, 0.25, 0.7].map((x, i) => (
        <mesh key={`u${i}`} position={[x, 1.8, 0.53]}>
          <planeGeometry args={[0.3, 0.3]} />
          {glow(T.window, 0.9)}
        </mesh>
      ))}
      <mesh position={[0, 0.42, 0.81]}>
        <planeGeometry args={[0.46, 0.5]} />
        {glow(T.accent, 0.7)}
      </mesh>
      <RoundedBox args={[0.9, 0.06, 0.4]} radius={0.02} position={[0, 0.74, 0.98]}>
        {glossy(T.ice)}
      </RoundedBox>
      <group ref={egg} position={[0.25, 3.05, -0.1]}>
        <mesh scale={[0.3, 0.38, 0.3]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshPhysicalMaterial color={T.sample} emissive={T.accentStrong} emissiveIntensity={0.25} roughness={0.15} clearcoat={1} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.52, 0.018, 12, 64]} />
          {glow(T.ice, 1.2)}
        </mesh>
      </group>
      <pointLight position={[0.25, 3.05, -0.1]} color={T.accent} intensity={1.5} distance={4} />
    </group>
  );
}

/* ------------------------------ cryo transport ------------------------------ */

/** The van on its own. Faces +x. */
export function VanModel() {
  const wheel = (x: number, z: number, key: string) => (
    <mesh key={key} position={[x, 0.24, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.22, 0.22, 0.16, 24]} />
      <meshStandardMaterial color={T.tyre} roughness={0.7} />
    </mesh>
  );
  return (
    <group>
      <RoundedBox args={[1.5, 0.85, 0.9]} radius={0.1} position={[-0.2, 0.78, 0]} castShadow>
        {glossy(T.white)}
      </RoundedBox>
      <mesh position={[-0.2, 0.7, 0.452]}>
        <planeGeometry args={[1.35, 0.1]} />
        {glow(T.iceDeep, 0.8)}
      </mesh>
      <mesh position={[-0.2, 0.7, -0.452]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.35, 0.1]} />
        {glow(T.iceDeep, 0.8)}
      </mesh>
      <RoundedBox args={[0.62, 0.62, 0.86]} radius={0.1} position={[0.86, 0.66, 0]} castShadow>
        {glossy(T.white)}
      </RoundedBox>
      <mesh position={[1.172, 0.78, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.66, 0.26]} />
        <meshStandardMaterial color={T.dark} roughness={0.2} metalness={0.3} />
      </mesh>
      {[-0.28, 0.28].map((z, i) => (
        <mesh key={i} position={[1.175, 0.5, z]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.06, 16]} />
          {glow(T.gold, 2)}
        </mesh>
      ))}
      {wheel(-0.6, 0.46, "w1")}
      {wheel(-0.6, -0.46, "w2")}
      {wheel(0.82, 0.46, "w3")}
      {wheel(0.82, -0.46, "w4")}
    </group>
  );
}

/** A cryo shipping container on a trolley. */
export function ShippingContainerModel() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.4]} />
        <meshStandardMaterial color={T.dark} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.2, 0.6, 32]} />
        {glossy(T.white)}
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.202, 0.202, 0.08, 32]} />
        {glow(T.iceDeep, 1)}
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 0.1, 24]} />
        {glossy(T.ice)}
      </mesh>
    </group>
  );
}

export function CryoTransportModel() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.45, 1.5, 0.12, 48]} />
        {glossy(T.platformEdge)}
      </mesh>
      <group position={[-0.25, 0, 0]}>
        <VanModel />
      </group>
      <group position={[-0.1, 0, 0.95]}>
        <ShippingContainerModel />
      </group>
    </group>
  );
}

/* ------------------------------ cryogenic storage ------------------------------ */

/** One frosted tank. `highlight` adds a pink band. */
export function TankModel({ highlight = false }: { highlight?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 1.1, 40]} />
        {glossy(T.white)}
      </mesh>
      <mesh position={[0, 1.27, 0]} castShadow>
        <sphereGeometry args={[0.42, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {glossy(T.white)}
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.425, 0.425, 0.07, 40]} />
        {glow(highlight ? T.accentStrong : T.iceDeep, highlight ? 1.8 : 1.1)}
      </mesh>
      <mesh position={[0, 1.76, 0]}>
        <cylinderGeometry args={[0.1, 0.13, 0.16, 24]} />
        {glossy(T.ice)}
      </mesh>
      <mesh position={[0, 1.86, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.05, 24]} />
        {glossy(T.iceDeep)}
      </mesh>
    </group>
  );
}

export function CryoStorageModel() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.45, 1.5, 0.12, 48]} />
        {glossy(T.platformEdge)}
      </mesh>
      <group position={[-0.5, 0, 0.25]}>
        <TankModel />
      </group>
      <group position={[0.5, 0, 0.25]}>
        <TankModel />
      </group>
      <group position={[0, 0, -0.55]} scale={1.12}>
        <TankModel />
      </group>
    </group>
  );
}

/* ------------------------------ patient ------------------------------ */

/** A phone standing on a small podium. `scale` lets the patient environment reuse it large. */
export function PhoneModel({ screenGlow = 0.9 }: { screenGlow?: number }) {
  return (
    <group>
      <RoundedBox args={[0.56, 1.06, 0.07]} radius={0.06} position={[0, 0.53, 0]} castShadow>
        {glossy(T.dark)}
      </RoundedBox>
      <mesh position={[0, 0.54, 0.037]}>
        <planeGeometry args={[0.48, 0.92]} />
        <meshStandardMaterial color={T.plum} emissive="#4A1D33" emissiveIntensity={screenGlow * 0.6} />
      </mesh>
      {/* chat bubbles on the screen */}
      {[
        { y: 0.82, x: -0.06, w: 0.32, c: T.white },
        { y: 0.64, x: 0.06, w: 0.28, c: T.chat },
        { y: 0.46, x: -0.04, w: 0.34, c: T.white },
        { y: 0.28, x: 0.07, w: 0.24, c: T.chat },
      ].map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0.04]}>
          <planeGeometry args={[b.w, 0.1]} />
          {glow(b.c, b.c === T.chat ? 0.9 : 0.5)}
        </mesh>
      ))}
    </group>
  );
}

export function PatientModel() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.95, 1.0, 0.12, 48]} />
        {glossy(T.platformEdge)}
      </mesh>
      <group position={[0, 0.12, 0]} rotation={[-0.12, 0, 0]}>
        <PhoneModel />
      </group>
    </group>
  );
}

/* ------------------------------ MYOS assistant ------------------------------ */

/** The assistant hub that floats above the network: one WhatsApp number, one chat per party. */
export function AssistantHubModel() {
  const core = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (core.current) {
      core.current.rotation.y = t * 0.5;
      core.current.rotation.x = t * 0.3;
      core.current.position.y = Math.sin(t * 1.2) * 0.08;
    }
    if (ringA.current) ringA.current.rotation.z = t * 0.7;
    if (ringB.current) ringB.current.rotation.x = Math.PI / 2 + t * 0.5;
  });
  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshPhysicalMaterial color={T.chat} emissive={T.chatDeep} emissiveIntensity={0.35} roughness={0.25} clearcoat={1} flatShading />
      </mesh>
      <mesh ref={ringA} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[0.72, 0.02, 12, 72]} />
        {glow(T.chat, 1.4)}
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[0.86, 0.01, 12, 72]} />
        {glow(T.chatDeep, 1.2)}
      </mesh>
      <pointLight color={T.chat} intensity={1.5} distance={4} />
    </group>
  );
}
