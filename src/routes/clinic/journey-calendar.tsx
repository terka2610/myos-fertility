import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CryogenicWorkflowLayout } from "@/components/clinic/CryogenicWorkflowLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSampleTimestamp } from "@/components/clinic/SampleRegistryTable";
import { SYNTHETIC_JOURNEY_CALENDARS, SYNTHETIC_SAMPLE_RECORDS } from "@/lib/samples/fixtures";
import { readSupabaseJourney } from "@/lib/samples/supabase.functions";
import { genericFacilityLabel } from "@/lib/samples/supabase.functions";
import type { SupabaseJourneyResponse } from "@/lib/samples/supabase.functions";
import { JourneyRouteReplay } from "@/components/clinic/JourneyRouteReplay";
import type { JourneyRoutePoint } from "@/lib/samples/types";
import { useAuth } from "@/hooks/useAuth";
import { JourneyMetricsPanel } from "@/components/clinic/JourneyMetricsPanel";
import { LiveVehicleCard } from "@/components/clinic/LiveVehicleCard";
import {
  readVehicleFix,
  readJourneyMetrics,
  refreshJourneyMetrics,
  type JourneyMetricsRefresh,
} from "@/lib/samples/journey-metrics.functions";
import type { VehicleFixResult } from "@/lib/samples/gps-monitor";
import { milestonesFromCustody } from "@/lib/samples/journey-milestones";
import {
  deriveJourneyMetrics,
  journeyInputFromSupabaseRows,
  type JourneyMetrics,
} from "@/lib/samples/journey-metrics";
import type { SyntheticJourney } from "@/lib/samples/types";

// Cryogenic Storage destination from the synthetic Supabase facilities data.
const STORAGE_DESTINATION = { lat: 25.2048, lon: 55.2708 };

// Synthetic milestones mapped to the custody steps used by real custody_events.
const MILESTONE_STEPS: Record<string, string> = {
  pickup: "released",
  "transport-handover": "in_transit",
  "storage-arrival": "arrived_storage",
  "return-request": "release_requested",
  "return-handover": "in_transit_return",
  "return-arrival": "received",
};

function simulatedJourneyMetrics(journey: SyntheticJourney): {
  metrics: JourneyMetrics;
  asOf: string;
} {
  const reached = journey.milestones.filter(
    (milestone) => milestone.status !== "pending" && milestone.at && MILESTONE_STEPS[milestone.id],
  );
  const times = [
    ...journey.routePoints.map((point) => point.recordedAt),
    ...reached.map((milestone) => milestone.at!),
  ].sort((first, second) => Date.parse(first) - Date.parse(second));
  const asOf = times.at(-1) ?? journey.pickupAt;
  return {
    asOf,
    metrics: deriveJourneyMetrics({
      sampleId: journey.sampleId,
      now: new Date(asOf),
      source: "simulation",
      destination: STORAGE_DESTINATION,
      locations: journey.routePoints.map((point) => ({
        lat: point.latitude,
        lon: point.longitude,
        recordedAt: point.recordedAt,
      })),
      custodyEvents: reached.map((milestone) => ({
        step: MILESTONE_STEPS[milestone.id]!,
        recordedAt: milestone.at!,
      })),
    }),
  };
}

export const Route = createFileRoute("/clinic/journey-calendar")({
  validateSearch: (search: Record<string, unknown>): { sampleId: string } => {
    const sampleId = typeof search["sampleId"] === "string" ? search["sampleId"] : "SMP-0001";
    return {
      sampleId: ["SMP-0001", "SMP-0002", "SMP-0003"].includes(sampleId) ? sampleId : "SMP-0001",
    };
  },
  // Reload the journey whenever the selected sample changes.
  loaderDeps: ({ search }) => ({ sampleId: search.sampleId }),
  loader: async ({ deps }): Promise<SupabaseJourneyResponse & { requestedSampleId: string }> => {
    const requestedSampleId = deps.sampleId;
    try {
      const result = (await readSupabaseJourney({
        data: { sampleId: requestedSampleId },
      })) as SupabaseJourneyResponse;
      if (result.connected) return { ...result, requestedSampleId };
      return {
        connected: false as const,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: result.error,
        requestedSampleId,
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Journey data unavailable; using simulation", error);
      }
      return {
        connected: false as const,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: {
          kind: "network" as const,
          message: "Live information is unavailable.",
        },
        requestedSampleId,
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Journey Calendar — MYOS" },
      {
        name: "description",
        content: "A cryogenic sample journey calendar for the MYOS workflow.",
      },
    ],
  }),
  component: JourneyCalendar,
});

function JourneyCalendar() {
  const loaded = Route.useLoaderData();
  const { session } = useAuth();
  const [live, setLive] = useState<SupabaseJourneyResponse>(loaded);
  const navigate = useNavigate();
  const { sampleId } = Route.useSearch();

  useEffect(() => {
    if (!session) {
      setLive(loaded);
      return;
    }
    let cancelled = false;
    void readSupabaseJourney({ data: { sampleId } })
      .then((result) => {
        if (!cancelled) setLive(result);
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn("Authenticated journey read unavailable", error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, sampleId, session]);
  const synthetic =
    SYNTHETIC_JOURNEY_CALENDARS.find((item) => item.sampleId === sampleId) ??
    SYNTHETIC_JOURNEY_CALENDARS[0]!;
  // Real clock only on the client, so server and client renders match.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Courier GPS from the monitor; refreshed with the clock. Vehicle data only.
  const [vehicleFix, setVehicleFix] = useState<VehicleFixResult | null>(null);
  useEffect(() => {
    if (!now) return;
    let cancelled = false;
    void readVehicleFix({ data: { sampleId } })
      .then((result) => {
        if (!cancelled) setVehicleFix(result);
      })
      .catch(() => {
        if (!cancelled) setVehicleFix({ ok: false, reason: "unreachable" });
      });
    return () => {
      cancelled = true;
    };
  }, [now, sampleId]);

  // Live custody data: compute on the server for everyone; only signed-in users also save
  // the numbers for the WhatsApp agent.
  const [refreshed, setRefreshed] = useState<JourneyMetricsRefresh | null>(null);
  const canRefresh = live.connected;
  const signedIn = Boolean(session);
  const refreshTick = now ? Math.floor(now.getTime() / 30000) : 0;
  useEffect(() => {
    if (!canRefresh) {
      setRefreshed(null);
      return;
    }
    let cancelled = false;
    const run = signedIn ? refreshJourneyMetrics : readJourneyMetrics;
    void run({ data: { sampleId } })
      .then((result) => {
        if (!cancelled) setRefreshed(result);
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.warn("Journey metrics refresh unavailable", error);
      });
    return () => {
      cancelled = true;
    };
  }, [canRefresh, refreshTick, sampleId, signedIn]);

  const journeyMetrics = useMemo(() => {
    if (!live.connected) return simulatedJourneyMetrics(synthetic);
    if (refreshed?.connected) {
      return {
        asOf: undefined,
        metrics: refreshed.metrics,
        saveStatus: signedIn ? { saved: refreshed.saved, error: refreshed.saveError } : undefined,
      };
    }
    if (!now) return null;
    return {
      asOf: undefined,
      metrics: deriveJourneyMetrics(
        journeyInputFromSupabaseRows({
          sampleId,
          now,
          routePoints: live.routePoints,
          custodyEvents: live.custodyEvents,
        }),
      ),
    };
  }, [live, now, refreshed, sampleId, signedIn, synthetic]);
  const syntheticSample =
    SYNTHETIC_SAMPLE_RECORDS.find((record) => record.displayId === sampleId) ??
    SYNTHETIC_SAMPLE_RECORDS[0]!;
  const connected = live.connected;
  const sample = connected ? live.sample : syntheticSample;

  // With live data, milestones, pickup and ETA come from real custody events and metrics.
  const liveMetrics = connected ? (journeyMetrics?.metrics ?? null) : null;
  const onReturnTrip = liveMetrics?.leg === "return";
  const milestones = connected
    ? milestonesFromCustody(live.custodyEvents)
    : synthetic.milestones.map((milestone) => ({ ...milestone }));
  // Who holds the sample now: the facility of the latest reached milestone.
  const currentHolder: JourneyRoutePoint["facility"] =
    [...milestones].reverse().find((milestone) => milestone.status !== "pending")?.facility ??
    "Fertility Centre";
  let replayPoints: JourneyRoutePoint[] = synthetic.routePoints.map((point) => ({ ...point }));
  const etaAt = connected
    ? liveMetrics?.etaMethod === "arrived"
      ? liveMetrics.arrivedAt
      : (liveMetrics?.etaAt ?? null)
    : synthetic.etaAt;
  const etaLabel = connected
    ? liveMetrics?.etaMethod === "arrived"
      ? "Arrived"
      : liveMetrics?.etaMethod === "distance_speed_estimate"
        ? "Approximate ETA"
        : "ETA unavailable"
    : synthetic.etaSource === "scheduled"
      ? "Scheduled ETA"
      : synthetic.etaSource === "calculated"
        ? "Calculated ETA"
        : "Simulated ETA";
  let currentStage = synthetic.currentStage;

  if (connected) {
    replayPoints = live.routePoints.flatMap((point, index) => {
      const lat =
        typeof point["lat"] === "number"
          ? point["lat"]
          : typeof point["latitude"] === "number"
            ? point["latitude"]
            : null;
      const lng =
        typeof point["lon"] === "number"
          ? point["lon"]
          : typeof point["lng"] === "number"
            ? point["lng"]
            : typeof point["longitude"] === "number"
              ? point["longitude"]
              : null;
      if (lat === null || lng === null) return [];
      const at =
        typeof point["recorded_at"] === "string"
          ? point["recorded_at"]
          : typeof point["created_at"] === "string"
            ? point["created_at"]
            : "";
      return [
        {
          id: typeof point["id"] === "string" ? point["id"] : `route-${index}`,
          latitude: lat,
          longitude: lng,
          recordedAt: at,
          // Route rows carry no facility; label them with the custody holder at that point.
          facility:
            typeof point["facility"] === "string" || typeof point["location"] === "string"
              ? (genericFacilityLabel(
                  typeof point["facility"] === "string" ? point["facility"] : point["location"],
                ) as JourneyRoutePoint["facility"])
              : currentHolder,
          label: typeof point["label"] === "string" ? point["label"] : "Recorded route point",
        },
      ];
    });
    currentStage =
      typeof live.sample?.currentState === "string"
        ? live.sample.currentState
        : synthetic.currentStage;
  }

  const pickupAt = connected ? (liveMetrics?.pickupAt ?? null) : synthetic.pickupAt;
  const pickup = pickupAt ? formatSampleTimestamp(pickupAt) : { text: "Not picked up yet" };
  const eta = etaAt ? formatSampleTimestamp(etaAt) : { text: "Not available yet" };
  const latestPoint = replayPoints.at(-1);
  const latestLocation = latestPoint ? formatSampleTimestamp(latestPoint.recordedAt) : null;
  const completedCount = milestones.filter((milestone) => milestone.status === "completed").length;
  const remainingMilestones = milestones.filter((milestone) => milestone.status !== "completed");

  return (
    <CryogenicWorkflowLayout title="Journey" accent="Calendar" activePage="journey-calendar">
      <div className="space-y-8">
        <header>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl">Planned sample journey</h2>
                <Badge variant={connected ? "outline" : "secondary"}>
                  {connected ? "Recorded data" : "Simulated data"}
                </Badge>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {connected
                  ? `Custody and route information for ${sample.displayId}.`
                  : `The schedule and route replay for ${sample.displayId} are simulated.`}
              </p>
            </div>
            <label className="block text-sm">
              <span className="mb-2 block font-medium">Sample</span>
              <select
                aria-label="Journey sample"
                className="h-10 min-w-36 rounded-md border border-input bg-background px-3"
                value={sampleId}
                onChange={(event) =>
                  navigate({
                    to: "/clinic/journey-calendar",
                    search: { sampleId: event.target.value },
                  })
                }
              >
                <option value="SMP-0001">SMP-0001</option>
                <option value="SMP-0002">SMP-0002</option>
                <option value="SMP-0003">SMP-0003</option>
              </select>
            </label>
          </div>
        </header>

        <section aria-label="Journey schedule summary" className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-2xl border-0 bg-card shadow-soft">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pickup date and time
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1">
              <p className="font-medium">
                {onReturnTrip ? "Cryogenic Storage" : "Fertility Centre"}
              </p>
              <time dateTime={pickup.dateTime} className="mt-1 block text-sm text-muted-foreground">
                {pickup.text}
              </time>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-card shadow-soft">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Estimated arrival
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1">
              <p className="font-medium">
                {onReturnTrip ? "Fertility Centre" : "Cryogenic Storage"}
              </p>
              <time dateTime={eta.dateTime} className="mt-1 block text-sm text-muted-foreground">
                {eta.text}
              </time>
              <Badge variant="outline" className="mt-3 border-amber-200 bg-amber-50 text-amber-900">
                {etaLabel}
              </Badge>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-card shadow-soft">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current sample status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1">
              <p className="font-medium">{sample.displayId}</p>
              <p className="mt-1 text-sm text-muted-foreground">{currentStage}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-card shadow-soft">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Latest update
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1">
              <p className="font-medium">{latestPoint?.facility ?? "Fertility Centre"}</p>
              <time
                dateTime={latestLocation?.dateTime}
                className="mt-1 block text-sm text-muted-foreground"
              >
                {latestLocation?.text ?? "No recorded update"}
              </time>
            </CardContent>
          </Card>
        </section>

        {journeyMetrics && (
          <JourneyMetricsPanel
            metrics={journeyMetrics.metrics}
            asOf={journeyMetrics.asOf}
            saveStatus={"saveStatus" in journeyMetrics ? journeyMetrics.saveStatus : undefined}
          />
        )}
        {!live.connected && vehicleFix && now && <LiveVehicleCard result={vehicleFix} now={now} />}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
            <CardHeader className="p-6 pb-3 md:p-8 md:pb-4">
              <CardTitle className="text-2xl">Transfer milestones</CardTitle>
              <p className="text-sm text-muted-foreground">
                Fertility Centre → Cryo Transport → Cryogenic Storage
                {synthetic.returnJourney ? " → Fertility Centre return" : ""}
              </p>
            </CardHeader>
            <CardContent className="p-6 pt-2 md:p-8 md:pt-3">
              <ol aria-label="Journey milestones" className="space-y-0">
                {milestones.map((milestone, index) => {
                  const timestamp = milestone.at
                    ? formatSampleTimestamp(milestone.at)
                    : { text: "Not reached yet" };
                  const stateClass =
                    milestone.status === "completed"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                      : milestone.status === "current"
                        ? "border-pink-200 bg-pink-50 text-pink-900 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-200"
                        : "border-border bg-muted text-muted-foreground";
                  const markerClass =
                    milestone.status === "completed"
                      ? "bg-emerald-500"
                      : milestone.status === "current"
                        ? "bg-primary ring-primary/20"
                        : "bg-muted-foreground/30";
                  return (
                    <li key={milestone.id} className="relative flex gap-4 pb-6 last:pb-0">
                      <span className="relative flex w-4 shrink-0 justify-center">
                        {index < milestones.length - 1 && (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 top-3 w-px bg-border"
                          />
                        )}
                        <span
                          aria-hidden="true"
                          className={`relative mt-1.5 size-3 rounded-full ring-4 ring-card ${markerClass}`}
                        />
                      </span>
                      <div className="min-w-0 flex-1 rounded-xl border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{milestone.title}</p>
                            <p className="text-sm text-muted-foreground">{milestone.facility}</p>
                          </div>
                          <Badge variant="outline" className={stateClass}>
                            {milestone.status === "completed"
                              ? "Completed"
                              : milestone.status === "current"
                                ? "Current"
                                : "Pending"}
                          </Badge>
                        </div>
                        <time
                          dateTime={timestamp.dateTime}
                          className="mt-3 block text-sm text-muted-foreground"
                        >
                          {timestamp.text}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <JourneyRouteReplay
              points={replayPoints}
              completedMilestones={completedCount}
              sampleId={sample.displayId}
              connected={connected}
            />
            <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
              <CardHeader className="p-6 pb-3">
                <CardTitle className="text-xl">Remaining milestones</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-1">
                {remainingMilestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No remaining milestones.</p>
                ) : (
                  <ul className="space-y-3">
                    {remainingMilestones.map((milestone) => (
                      <li
                        key={milestone.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{milestone.title}</p>
                          <p className="text-xs text-muted-foreground">{milestone.facility}</p>
                        </div>
                        <Badge variant="outline">
                          {milestone.status === "current" ? "Current" : "Pending"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CryogenicWorkflowLayout>
  );
}
