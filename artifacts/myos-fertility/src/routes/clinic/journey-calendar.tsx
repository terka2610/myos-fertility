import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, MapPin, RefreshCw, Truck } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/myos/PublicHeader";
import { JourneyMetricsPanel } from "@/components/clinic/JourneyMetricsPanel";
import { JourneyRouteReplay } from "@/components/clinic/JourneyRouteReplay";
import { LiveVehicleCard } from "@/components/clinic/LiveVehicleCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deriveJourneyMetrics,
  formatJourneyDuration,
  formatJourneyTimestamp,
  parseJourneySnapshot,
  type JourneyMetrics,
  type JourneySnapshot,
} from "@/lib/samples/cryo-journey";

export const Route = createFileRoute("/clinic/journey-calendar")({
  head: () => ({
    meta: [
      { title: "Journey Calendar — MYOS" },
      {
        name: "description",
        content: "Synthetic sample journey milestones and courier GPS updates.",
      },
    ],
  }),
  component: JourneyCalendar,
});

function JourneyCalendar() {
  const [snapshot, setSnapshot] = useState<JourneySnapshot | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}api/chat`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Journey feed returned ${response.status}.`);
        const next = parseJourneySnapshot(await response.json());
        if (!next) throw new Error("The journey feed returned an unexpected response.");
        if (!active) return;
        setSnapshot(next);
        setNow(new Date());
        setError(null);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load the journey feed.");
        setNow(new Date());
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [retry]);

  const metrics = useMemo(
    () => (snapshot && now ? deriveJourneyMetrics(snapshot, now) : null),
    [now, snapshot],
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-14">
        <Link
          to="/clinic/samples"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to sample workflow
        </Link>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              Synthetic demo
            </Badge>
            <h1 className="mt-4 text-4xl md:text-5xl">
              Journey <span className="serif-accent">calendar</span>
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Pickup, handover, storage milestones, and courier location for SMP-0001.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setRetry((count) => count + 1)}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh journey
          </Button>
        </header>

        <div
          role="note"
          className="mb-6 rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground"
        >
          Synthetic sample and courier data only. GPS is a separate demo feed and is not linked to
          real patient or sample records. No WhatsApp message is sent from this page.
        </div>

        {error && (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-950"
          >
            <span>{snapshot ? `Latest refresh failed: ${error}` : error}</span>
            {!snapshot && (
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setRetry((count) => count + 1)}>
                Try again
              </Button>
            )}
          </div>
        )}

        {loading && !snapshot ? (
          <Card className="rounded-3xl border-0 bg-card shadow-soft">
            <CardContent className="p-8 text-sm text-muted-foreground" role="status">
              Loading the synthetic journey…
            </CardContent>
          </Card>
        ) : snapshot && metrics ? (
          <div className="space-y-6">
            <section aria-label="Journey summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={<CalendarDays aria-hidden="true" className="size-4" />}
                title="Pickup"
                value={metrics.pickupAt ? formatJourneyTimestamp(metrics.pickupAt) : snapshot.schedule.pickup || "Not scheduled"}
                detail={metrics.pickupAt ? "Pickup recorded" : "Planned time · not yet recorded"}
              />
              <SummaryCard
                icon={<MapPin aria-hidden="true" className="size-4" />}
                title="Estimated arrival"
                value={arrivalValue(snapshot, metrics)}
                detail={arrivalDetail(snapshot, metrics)}
              />
              <SummaryCard
                icon={<Clock3 aria-hidden="true" className="size-4" />}
                title="Time in transit"
                value={formatJourneyDuration(metrics.transitMinutes)}
                detail={
                  metrics.receivedAt
                    ? "Stopped at recorded storage receipt"
                    : metrics.pickupAt
                      ? "Since recorded pickup"
                      : "Starts when pickup is recorded"
                }
              />
              <GpsSummary snapshot={snapshot} metrics={metrics} />
            </section>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
              <MilestoneTimeline snapshot={snapshot} metrics={metrics} />
              {snapshot.feed.trail.length > 0 ? (
                <JourneyRouteReplay points={snapshot.feed.trail} sampleId={snapshot.sampleId} />
              ) : (
                <RouteMap snapshot={snapshot} />
              )}
            </div>
            <details className="rounded-2xl border border-border bg-card px-5 py-4">
              <summary className="cursor-pointer text-sm font-medium">
                Courier details and additional metrics
              </summary>
              <div className="mt-4 space-y-4">
                <LiveVehicleCard snapshot={snapshot} metrics={metrics} />
                <JourneyMetricsPanel snapshot={snapshot} metrics={metrics} />
              </div>
            </details>
            <p className="text-xs text-muted-foreground">
              Workflow status: {snapshot.schedule.status} · Updates automatically every 15 seconds.
            </p>
          </div>
        ) : null}

        <div className="mt-12 border-t border-border pt-6">
          <Link
            to="/clinic/samples"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Return to the clinic workflow
          </Link>
        </div>
      </main>
      <div className="bg-card">
        <PublicFooter />
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-2xl border-0 bg-card shadow-soft">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-1">
        <p className="font-medium">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function arrivalValue(snapshot: JourneySnapshot, metrics: JourneyMetrics) {
  if (metrics.receivedAt) return "Received at storage";
  if (snapshot.atDestination && metrics.pickupAt) return "At destination";
  if (metrics.liveEtaAt) return formatJourneyTimestamp(metrics.liveEtaAt);
  return snapshot.schedule.eta || "Unavailable";
}

function arrivalDetail(snapshot: JourneySnapshot, metrics: JourneyMetrics) {
  if (metrics.receivedAt) return formatJourneyTimestamp(metrics.receivedAt);
  if (snapshot.atDestination && metrics.pickupAt) return "Receipt still needs to be recorded";
  if (metrics.liveEtaAt) return "Approximate estimate from fresh GPS and reported speed";
  if (snapshot.schedule.etaStale) return "Previous schedule estimate · GPS update is stale";
  return "Schedule estimate · not a live GPS forecast";
}

function GpsSummary({ snapshot, metrics }: { snapshot: JourneySnapshot; metrics: JourneyMetrics }) {
  const fix = metrics.lastFix;
  const status = !snapshot.feed.connected || !fix
    ? "Unavailable"
    : metrics.locationStale
      ? "Stale · last known point"
      : "Current";
  const detail = fix
    ? `${fix.latitude.toFixed(4)}, ${fix.longitude.toFixed(4)} · ${formatJourneyTimestamp(fix.recordedAt)}`
    : snapshot.feed.message;
  return (
    <SummaryCard
      icon={<Truck aria-hidden="true" className="size-4" />}
      title="Courier GPS"
      value={status}
      detail={detail}
    />
  );
}

function MilestoneTimeline({ snapshot, metrics }: { snapshot: JourneySnapshot; metrics: JourneyMetrics }) {
  const milestones = [
    {
      title: "Pickup",
      detail: metrics.pickupAt
        ? `Recorded by ${snapshot.custody.find((event) => event.eventType === "pickup")?.actor ?? "transport"}`
        : "Waiting for pickup confirmation",
      time: metrics.pickupAt ?? null,
      status: metrics.pickupAt ? "Recorded" : "Planned",
      complete: Boolean(metrics.pickupAt),
    },
    {
      title: "Storage receipt",
      detail: metrics.receivedAt
        ? "Receipt recorded by storage"
        : snapshot.atDestination && metrics.pickupAt
          ? "Courier GPS is near destination; receipt is not confirmed"
          : metrics.pickupAt
            ? "In transit · waiting for storage receipt"
            : "Waiting for pickup",
      time: metrics.receivedAt,
      status: metrics.receivedAt ? "Recorded" : snapshot.atDestination && metrics.pickupAt ? "Action needed" : "Pending",
      complete: Boolean(metrics.receivedAt),
    },
    {
      title: "Storage placement",
      detail: metrics.placedAt ? "Placement recorded by storage" : "Recorded separately after receipt",
      time: metrics.placedAt,
      status: metrics.placedAt ? "Recorded" : metrics.receivedAt ? "Pending" : "Not reached",
      complete: Boolean(metrics.placedAt),
    },
  ];

  return (
    <Card className="rounded-3xl border-0 bg-card shadow-soft">
      <CardHeader className="p-6 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">Journey milestones</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Fertility clinic → Cryoport → Cryogenic storage
            </p>
          </div>
          <Badge variant="secondary">SMP-0001</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <ol aria-label="Sample journey milestones" className="space-y-0">
          {milestones.map((milestone, index) => (
            <li key={milestone.title} className="relative flex gap-4 pb-6 last:pb-0">
              <span className="relative flex w-4 shrink-0 justify-center">
                {index < milestones.length - 1 && (
                  <span aria-hidden="true" className="absolute bottom-0 top-3 w-px bg-border" />
                )}
                <span
                  aria-hidden="true"
                  className={`relative mt-1.5 size-3 rounded-full ring-4 ring-card ${
                    milestone.complete ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              </span>
              <div className="min-w-0 flex-1 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{milestone.title}</p>
                  <Badge variant={milestone.complete ? "default" : "outline"}>{milestone.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{milestone.detail}</p>
                <time className="mt-2 block text-xs text-muted-foreground" dateTime={milestone.time ?? undefined}>
                  {milestone.time
                    ? formatJourneyTimestamp(milestone.time)
                    : milestone.title === "Pickup"
                      ? snapshot.schedule.pickup || "No planned time"
                      : "Not recorded"}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function RouteMap({ snapshot }: { snapshot: JourneySnapshot }) {
  const points = snapshot.feed.trail;
  const projection = useMemo(() => {
    if (points.length === 0) return [];
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.001);
    const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.001);
    return points.map((point) => ({
      x: 18 + ((point.longitude - minLongitude) / longitudeSpan) * 284,
      y: 132 - ((point.latitude - minLatitude) / latitudeSpan) * 108,
    }));
  }, [points]);

  const line = projection.map((point) => `${point.x},${point.y}`).join(" ");
  const lastPoint = points.at(-1);
  const stale = snapshot.gpsStatus === "stale";

  return (
    <Card className="rounded-3xl border-0 bg-card shadow-soft">
      <CardHeader className="p-6 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">Courier route</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.feed.label} · {snapshot.feed.assetId}
            </p>
          </div>
          <Badge variant={stale ? "outline" : "secondary"}>
            {stale ? "Stale route" : snapshot.feed.connected ? "GPS connected" : "Unavailable"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-2">
        {projection.length > 0 ? (
          <svg
            viewBox="0 0 320 160"
            className="w-full rounded-2xl bg-secondary/50"
            role="img"
            aria-label={`Synthetic courier route with ${points.length} GPS points`}
          >
            <polyline
              points={line}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {projection.map((point, index) => (
              <circle
                key={`${points[index]?.recordedAt ?? "point"}-${index}`}
                cx={point.x}
                cy={point.y}
                r={index === projection.length - 1 ? 6 : 3}
                fill={index === projection.length - 1 ? "var(--pink)" : "var(--card)"}
                stroke="var(--primary)"
                strokeWidth="2"
              />
            ))}
            <text x="14" y="18" fill="var(--muted-foreground)" fontSize="10">START</text>
            <text x="266" y="18" fill="var(--muted-foreground)" fontSize="10">LATEST</text>
          </svg>
        ) : (
          <div role="status" className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground">
            {snapshot.feed.message}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{points.length} route point{points.length === 1 ? "" : "s"}</span>
          {lastPoint?.recordedAt && (
            <time dateTime={lastPoint.recordedAt} className="text-muted-foreground">
              Latest point {formatJourneyTimestamp(lastPoint.recordedAt)}
            </time>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          GPS records courier coordinates only. It does not confirm sample custody, receipt, or
          placement.
        </p>
      </CardContent>
    </Card>
  );
}
