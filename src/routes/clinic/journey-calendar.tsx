import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/clinic/journey-calendar")({
  validateSearch: (search: Record<string, unknown>): { sampleId: string } => {
    const sampleId = typeof search["sampleId"] === "string" ? search["sampleId"] : "SMP-0001";
    return {
      sampleId: ["SMP-0001", "SMP-0002", "SMP-0003"].includes(sampleId) ? sampleId : "SMP-0001",
    };
  },
  loader: async ({
    location,
  }): Promise<SupabaseJourneyResponse & { requestedSampleId: string }> => {
    const search = (location.search ?? {}) as Record<string, unknown>;
    const requestedSampleId =
      typeof search["sampleId"] === "string" ? search["sampleId"] : "SMP-0001";
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
      console.warn("Supabase journey read failed; using synthetic fallback", error);
      return {
        connected: false as const,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: {
          kind: "network" as const,
          message: error instanceof Error ? error.message : "Supabase read unavailable",
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
  const live = Route.useLoaderData();
  const navigate = useNavigate();
  const { sampleId } = Route.useSearch();
  const synthetic =
    SYNTHETIC_JOURNEY_CALENDARS.find((item) => item.sampleId === sampleId) ??
    SYNTHETIC_JOURNEY_CALENDARS[0]!;
  const syntheticSample =
    SYNTHETIC_SAMPLE_RECORDS.find((record) => record.displayId === sampleId) ??
    SYNTHETIC_SAMPLE_RECORDS[0]!;
  const connected = live.connected;
  const sample = connected ? live.sample : syntheticSample;

  let replayPoints: JourneyRoutePoint[] = synthetic.routePoints.map((point) => ({ ...point }));
  const milestones = synthetic.milestones.map((milestone) => ({ ...milestone }));
  const etaAt = synthetic.etaAt;
  const etaSource = synthetic.etaSource;
  let currentStage = synthetic.currentStage;

  if (connected) {
    replayPoints = live.routePoints.flatMap((point, index) => {
      const lat = typeof point["latitude"] === "number" ? point["latitude"] : null;
      const lng =
        typeof point["longitude"] === "number"
          ? point["longitude"]
          : typeof point["lng"] === "number"
            ? point["lng"]
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
          facility: genericFacilityLabel(
            typeof point["facility"] === "string"
              ? point["facility"]
              : typeof point["location"] === "string"
                ? point["location"]
                : null,
          ) as JourneyRoutePoint["facility"],
          label: typeof point["label"] === "string" ? point["label"] : "Recorded route point",
        },
      ];
    });
    currentStage =
      typeof live.sample?.currentState === "string"
        ? live.sample.currentState
        : synthetic.currentStage;
  }

  const pickup = formatSampleTimestamp(synthetic.pickupAt);
  const eta = formatSampleTimestamp(etaAt);
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
                  ? `Authorized custody and route records for ${sample.displayId}.`
                  : `The schedule and route replay for ${sample.displayId} are simulated. No location is live.`}
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
              <p className="font-medium">Fertility Centre</p>
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
              <p className="font-medium">Cryogenic Storage</p>
              <time dateTime={eta.dateTime} className="mt-1 block text-sm text-muted-foreground">
                {eta.text}
              </time>
              <Badge variant="outline" className="mt-3 border-amber-200 bg-amber-50 text-amber-900">
                {etaSource === "scheduled"
                  ? "Scheduled ETA"
                  : etaSource === "calculated"
                    ? "Calculated ETA"
                    : "Simulated ETA"}
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
                  const timestamp = formatSampleTimestamp(milestone.at);
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
