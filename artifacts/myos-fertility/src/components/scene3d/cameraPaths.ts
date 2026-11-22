// Fixed camera poses: the network overview, a close-up per station (before entering), and one per environment.
import * as THREE from "three";
import { NODES, type Party } from "./nodes";

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const pose = (p: [number, number, number], t: [number, number, number]): CameraPose => ({
  position: new THREE.Vector3(...p),
  target: new THREE.Vector3(...t),
});

export const OVERVIEW: CameraPose = pose([-0.7, 9.6, 14.8], [-0.7, 1.9, -0.2]);

/** Close-up of a station on the network, used for the fly-in before its environment opens. */
export function poseFor(id: Party): CameraPose {
  const node = NODES.find((n) => n.id === id)!;
  const p = new THREE.Vector3(...node.position);
  const outward = p.lengthSq() > 0.01 ? p.clone().setY(0).normalize() : new THREE.Vector3(0, 0, 1);
  const camDir = outward.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 0, 1)).normalize();
  const distance = id === "centre" ? 5.2 : 4.2;
  const position = p.clone().add(camDir.multiplyScalar(distance)).add(new THREE.Vector3(0, 2.2, 0));
  const target = p.clone().add(new THREE.Vector3(0, id === "centre" ? 1.4 : 0.8, 0));
  return { position, target };
}

/** Camera inside each party's environment. */
const back = (p: CameraPose, k: number): CameraPose => ({
  position: p.target.clone().add(p.position.clone().sub(p.target).multiplyScalar(k)),
  target: p.target.clone(),
});

export const ENV_POSES: Record<Party, CameraPose> = {
  centre: back(pose([0, 5.4, 9.4], [0.4, 1.1, 0]), 1.15),
  transport: back(pose([0, 6.6, 9.8], [0.4, 0.7, -0.3]), 1.15),
  storage: back(pose([0, 6.0, 9.6], [0.4, 1.1, -0.7]), 1.15),
  patient: back(pose([0, 4.8, 8.8], [0.3, 1.6, 0]), 1.15),
};

/** Quadratic Bezier between two points with the midpoint lifted by `lift`. */
export function arcPoint(from: THREE.Vector3, to: THREE.Vector3, t: number, lift = 2.2, out = new THREE.Vector3()) {
  const mid = from.clone().lerp(to, 0.5);
  mid.y += lift;
  const a = from.clone().lerp(mid, t);
  const b = mid.clone().lerp(to, t);
  return out.copy(a.lerp(b, t));
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
