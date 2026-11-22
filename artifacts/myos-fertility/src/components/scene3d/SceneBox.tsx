import { useEffect, useMemo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

type Props = Omit<ThreeElements["mesh"], "args"> & {
  args?: [number, number, number];
  radius?: number;
};

/** Low-segment rounded primitives avoid extruding and rebuilding creased normals at startup. */
export function RoundedBox({ args = [1, 1, 1], radius = 0.05, children, ...props }: Props) {
  const [width, height, depth] = args;
  const geometry = useMemo(
    () => new RoundedBoxGeometry(width, height, depth, 1, Math.min(radius, width / 2, height / 2, depth / 2)),
    [width, height, depth, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh {...props} geometry={geometry}>{children}</mesh>;
}
