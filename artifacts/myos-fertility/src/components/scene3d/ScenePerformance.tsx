import { useEffect, useRef } from "react";
import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";

export interface ScenePerformanceSnapshot {
  readyAt: number | null;
  frames: number;
  view: string;
  paused: boolean;
  samples: { cpuMs: number; intervalMs: number; calls: number; triangles: number; geometries: number; textures: number }[];
}

declare global {
  interface Window {
    __MYOS_SCENE_PERF__?: ScenePerformanceSnapshot;
  }
}

/** Opt-in diagnostic probe. No per-frame timings or samples for ordinary visitors.
 * CPU cost covers frame subscribers + WebGL submission, NOT GPU completion.
 */
export function ScenePerformance({ view, paused }: { view: string; paused: boolean }) {
  const gl = useThree((state) => state.gl);
  const start = useRef(0);
  const previous = useRef(0);
  const enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("scenePerf") === "1";
  useFrame(() => {
    if (enabled) start.current = performance.now();
  }, -1000);

  useEffect(() => {
    if (!enabled) return;
    const metrics: ScenePerformanceSnapshot = { readyAt: null, frames: 0, view, paused, samples: [] };
    window.__MYOS_SCENE_PERF__ = metrics;
    let lastFrame = gl.info.render.frame;
    let readyFrame = 0;
    const remove = addAfterEffect(() => {
      if (gl.info.render.frame === lastFrame) return;
      lastFrame = gl.info.render.frame;
      const now = performance.now();
      metrics.frames++;
      metrics.samples.push({
        cpuMs: now - start.current,
        intervalMs: previous.current ? now - previous.current : 0,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      });
      if (metrics.samples.length > 600) metrics.samples.shift();
      previous.current = now;
      // The renderer has submitted actual geometry and the projector has positioned
      // controls. Wait another animation frame so this isn't just Canvas creation.
      if (!readyFrame && metrics.readyAt === null && gl.info.render.calls > 0) {
        readyFrame = requestAnimationFrame(() => {
          metrics.readyAt = performance.now();
          performance.mark("myos-scene-rendered");
        });
      }
    });
    return () => {
      remove();
      cancelAnimationFrame(readyFrame);
      if (window.__MYOS_SCENE_PERF__ === metrics) delete window.__MYOS_SCENE_PERF__;
    };
    // Keep one counter across view and pause changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gl]);

  useEffect(() => {
    const metrics = window.__MYOS_SCENE_PERF__;
    if (!enabled || !metrics) return;
    metrics.view = view;
    metrics.paused = paused;
    previous.current = 0;
  }, [enabled, view, paused]);
  return null;
}
