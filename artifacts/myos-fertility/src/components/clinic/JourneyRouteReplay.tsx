import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { JourneyRoutePoint } from "@/lib/samples/cryo-journey";
import { formatJourneyTimestamp } from "@/lib/samples/cryo-journey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function JourneyRouteReplay({
  points,
  sampleId,
}: {
  points: readonly JourneyRoutePoint[];
  sampleId: string;
}) {
  const [activeIndex, setActiveIndex] = useState(Math.max(0, points.length - 1));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setActiveIndex(Math.max(0, points.length - 1));
    setPlaying(false);
  }, [points.length]);

  useEffect(() => {
    if (!playing || points.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        return Math.min(current + 1, points.length - 1);
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, points.length]);

  useEffect(() => {
    if (playing && activeIndex >= points.length - 1) setPlaying(false);
  }, [activeIndex, playing, points.length]);

  const projection = useMemo(() => {
    if (!points.length) return [];
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const latSpan = Math.max(maxLat - minLat, 0.001);
    const lonSpan = Math.max(maxLon - minLon, 0.001);
    return points.map((point) => ({
      x: 16 + ((point.longitude - minLon) / lonSpan) * 268,
      y: 188 - ((point.latitude - minLat) / latSpan) * 148,
    }));
  }, [points]);

  const path = projection
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const completedPath = projection
    .slice(0, activeIndex + 1)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const activePoint = points[activeIndex];

  return (
    <Card className="overflow-hidden rounded-3xl border-0 bg-card shadow-soft">
      <CardHeader className="p-6 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">Courier route</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Recorded GPS points for {sampleId}
            </p>
          </div>
          <Badge variant="secondary">Synthetic GPS demo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-2">
        {points.length ? (
          <>
            <svg
              viewBox="0 0 300 220"
              className="w-full rounded-2xl border border-border bg-secondary/40"
              role="img"
              aria-label={`Schematic courier route with ${points.length} synthetic GPS points`}
              data-testid="journey-route-map"
            >
              <path
                d="M-20 180 C40 145 70 165 118 125 S205 85 320 48"
                fill="none"
                stroke="var(--border)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path d={path} fill="none" stroke="var(--muted-foreground)" strokeWidth="4" strokeDasharray="5 7" />
              <path d={completedPath} fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" />
              {projection.map((point, index) => (
                <circle
                  key={points[index]?.id}
                  cx={point.x}
                  cy={point.y}
                  r={index === activeIndex ? 7 : 4}
                  fill={index <= activeIndex ? "var(--primary)" : "var(--card)"}
                  stroke="var(--card)"
                  strokeWidth="2"
                />
              ))}
              <text x="12" y="18" fill="var(--muted-foreground)" fontSize="10">START</text>
              <text x="244" y="18" fill="var(--muted-foreground)" fontSize="10">LATEST</text>
            </svg>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{activePoint?.label ?? "Route point"}</p>
                <time
                  dateTime={activePoint?.recordedAt ?? undefined}
                  className="mt-1 block text-xs text-muted-foreground"
                >
                  {formatJourneyTimestamp(activePoint?.recordedAt ?? null)}
                </time>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    if (activeIndex >= points.length - 1) setActiveIndex(0);
                    setPlaying((value) => !value);
                  }}
                  disabled={points.length < 2}
                  aria-pressed={playing}
                  data-testid="button-route-replay"
                >
                  {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  {playing ? "Pause" : "Replay"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setPlaying(false);
                    setActiveIndex(0);
                  }}
                  disabled={!points.length}
                  data-testid="button-route-reset"
                >
                  <RotateCcw aria-hidden="true" />
                  Reset
                </Button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, points.length - 1)}
              value={activeIndex}
              disabled={points.length < 2}
              aria-label="Choose a route replay point"
              onChange={(event) => {
                setPlaying(false);
                setActiveIndex(Number(event.currentTarget.value));
              }}
              className="w-full accent-primary"
              data-testid="input-route-replay"
            />
            <p className="text-xs text-muted-foreground">
              Point {activeIndex + 1} of {points.length}. This schematic replays courier coordinates;
              it does not confirm sample custody.
            </p>
          </>
        ) : (
          <div
            role="status"
            className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-secondary/30 px-5 text-center text-sm text-muted-foreground"
          >
            No route points are available yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
