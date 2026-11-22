import { forwardRef, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { ColorRepresentation, Vector3 } from "three";

interface Props {
  points: (Vector3 | [number, number, number])[];
  color: ColorRepresentation;
  lineWidth?: number;
  dashed?: boolean;
  dashSize?: number;
  gapSize?: number;
  transparent?: boolean;
  opacity?: number;
}

/** Import only Three's line primitives, not the full helpers/loaders package. */
export const Line = forwardRef<Line2, Props>(function Line(
  { points, color, lineWidth = 1, dashed = false, dashSize = 1, gapSize = 1, transparent = false, opacity = 1 },
  ref,
) {
  const size = useThree((state) => state.size);
  const geometry = useMemo(() => {
    const result = new LineGeometry();
    result.setPositions(points.flatMap((p) => Array.isArray(p) ? p : [p.x, p.y, p.z]));
    return result;
  }, [points]);
  const material = useMemo(() => new LineMaterial({
    color, linewidth: lineWidth, dashed, dashSize, gapSize, transparent, opacity,
  }), [color, lineWidth, dashed, dashSize, gapSize, transparent, opacity]);
  const line = useMemo(() => {
    const result = new Line2(geometry, material);
    result.computeLineDistances();
    return result;
  }, [geometry, material]);

  useEffect(() => {
    material.resolution.set(size.width, size.height);
  }, [material, size.width, size.height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive ref={ref} object={line} />;
});
