import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { JourneySceneProps } from "@/components/scene3d/JourneyScene";

const JourneyScene = lazy(() => import("@/components/scene3d/JourneyScene"));

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("3D journey scene failed", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full w-full animate-pulse items-end rounded-[24px] bg-pink-soft/60 p-6"
    >
      <span className="text-sm text-muted-foreground">Loading the journey scene…</span>
    </div>
  );
}

function SceneFallback({ reason }: { reason: string }) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 rounded-[24px] bg-hero p-8">
      <p className="font-display text-3xl">
        The 3D view is <span className="serif-accent">unavailable</span>
      </p>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        {reason} Use the place selector below. Every form and record works the same without it.
      </p>
    </div>
  );
}

/** Client-only, lazily loaded 3D scene with WebGL detection and an error fallback. */
export function SceneStage(props: JourneySceneProps) {
  const [mode, setMode] = useState<"pending" | "ok" | "nogl">("pending");
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => setMode(hasWebGL() ? "ok" : "nogl"), []);
  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 })
      : null;
    if (container.current) observer?.observe(container.current);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div ref={container} className="h-full w-full">
      {mode === "pending" ? <SceneSkeleton /> : mode === "nogl"
        ? <SceneFallback reason="This browser does not support WebGL." />
        : (
          <SceneBoundary fallback={<SceneFallback reason="The scene could not start on this device." />}>
            <Suspense fallback={<SceneSkeleton />}>
              <JourneyScene {...props} paused={props.paused || props.overlaysHidden || !visible || !tabVisible} />
            </Suspense>
          </SceneBoundary>
        )}
    </div>
  );
}
