import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSampleTimestamp } from "@/components/clinic/SampleRegistryTable";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { JourneyRoutePoint } from "@/lib/samples/types";

export function JourneyRouteReplay({
  points,
  completedMilestones,
  sampleId,
  connected,
}: {
  points: readonly JourneyRoutePoint[];
  completedMilestones: number;
  sampleId: string;
  connected: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(points.length > 0 ? points.length - 1 : 0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => setActiveIndex(points.length > 0 ? points.length - 1 : 0), [points]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActiveIndex((previous) => {
        if (previous >= points.length - 1) {
          setPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, points.length]);

  const projection = useMemo(() => {
    if (points.length === 0) {
      return { route: "", completed: "", points: [] as { x: number; y: number }[] };
    }
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const spanLat = Math.max(maxLat - minLat, 0.001);
    const spanLng = Math.max(maxLng - minLng, 0.001);
    const projected = points.map((point, index) => ({
      x: 18 + ((point.longitude - minLng) / spanLng) * 264 + (index % 2) * 4,
      y: 210 - ((point.latitude - minLat) / spanLat) * 150 - (index % 2) * 8,
    }));
    const route = projected
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    const completedCount = Math.max(1, Math.min(activeIndex + 1, projected.length));
    const completed = projected
      .slice(0, completedCount)
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    return { route, completed, points: projected };
  }, [activeIndex, points]);

  const activePoint = points[activeIndex];
  const timestamp = formatSampleTimestamp(activePoint?.recordedAt);
  const replayCount = activeIndex + 1;

  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-0 bg-card shadow-soft">
      <CardHeader className="p-6 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl">Route tracking</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {connected && points.length > 0 ? "Recorded Route" : "Route Replay"} for {sampleId}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-2">
        {points.length === 0 ? (
          <div
            role="status"
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/30 text-center"
          >
            <MapPin aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No replay points available</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Recorded route information will appear when available.
            </p>
          </div>
        ) : (
          <>
            <div
              className="relative overflow-hidden rounded-2xl border border-border bg-[#f4f1ed]"
              role="img"
              aria-label={`${connected && points.length > 0 ? "Recorded route map" : "Simulated route map"} for ${sampleId}`}
            >
              <svg viewBox="0 0 300 230" className="h-auto w-full" aria-hidden="true">
                <rect width="300" height="230" fill="#f6f3ee" />
                <path
                  d="M-20 185 C60 155, 105 165, 145 135 S230 92, 320 70"
                  fill="none"
                  stroke="#ddd5c8"
                  strokeWidth="12"
                />
                <path
                  d="M40 -10 C70 55, 65 105, 120 150 S190 190, 240 240"
                  fill="none"
                  stroke="#ddd5c8"
                  strokeWidth="8"
                />
                <path
                  d="M-20 185 C60 155, 105 165, 145 135 S230 92, 320 70"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="5"
                  strokeDasharray="8 7"
                />
                <path
                  d={projection.route}
                  fill="none"
                  stroke="#bdb4a8"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="5 7"
                />
                <path
                  d={projection.completed}
                  fill="none"
                  stroke="#e879a7"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {projection.points.map((point, index) => (
                  <circle
                    key={points[index]?.id ?? index}
                    cx={point.x}
                    cy={point.y}
                    r={index === activeIndex ? 7 : 4}
                    fill={index <= activeIndex ? "#e879a7" : "#ffffff"}
                    stroke="#7c4d64"
                    strokeWidth="2"
                  />
                ))}
              </svg>
              <div className="absolute left-3 top-3 rounded-lg bg-card/95 px-3 py-2 shadow-soft">
                <p className="text-xs font-medium">
                  {connected && points.length > 0
                    ? "Latest recorded position"
                    : "Latest simulated position"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activePoint?.label ?? "Origin"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{activePoint?.facility ?? "Fertility Centre"}</p>
                <time
                  dateTime={timestamp.dateTime}
                  className="mt-1 block text-xs text-muted-foreground"
                >
                  {timestamp.text}
                </time>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setPlaying((value) => !value)}
                  disabled={points.length < 2}
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
                >
                  <RotateCcw aria-hidden="true" />
                  Reset
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Replay point {replayCount} of {points.length} · {completedMilestones} completed
              milestone{completedMilestones === 1 ? "" : "s"} · Completed segments are pink;
              remaining segments are dashed.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
