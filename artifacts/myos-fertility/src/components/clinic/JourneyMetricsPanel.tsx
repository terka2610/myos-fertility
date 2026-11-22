import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatJourneyDuration,
  formatJourneyTimestamp,
  type JourneyMetrics,
  type JourneySnapshot,
} from "@/lib/samples/cryo-journey";

function Metric({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: string;
  detail?: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-4" data-testid={`journey-metric-${label.toLowerCase().replaceAll(" ", "-")}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-medium ${warning ? "text-amber-800 dark:text-amber-300" : ""}`}>{value}</dd>
      {detail && <dd className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</dd>}
    </div>
  );
}

export function JourneyMetricsPanel({
  snapshot,
  metrics,
}: {
  snapshot: JourneySnapshot;
  metrics: JourneyMetrics;
}) {
  const arrivalValue = metrics.receivedAt
    ? "Received at storage"
    : metrics.liveEtaAt
      ? formatJourneyTimestamp(metrics.liveEtaAt)
      : snapshot.schedule.eta || "Unavailable";
  const arrivalDetail = metrics.receivedAt
    ? formatJourneyTimestamp(metrics.receivedAt)
    : metrics.liveEtaAt
      ? "Approximate forecast from fresh GPS and speed"
      : "Scheduled estimate, not a live forecast";
  const freshness =
    metrics.locationStale === null
      ? "No GPS fix"
      : metrics.locationStale
        ? "Stale"
        : "Fresh";
  const location = metrics.lastFix
    ? `${metrics.lastFix.latitude.toFixed(4)}, ${metrics.lastFix.longitude.toFixed(4)}`
    : "Unavailable";

  return (
    <Card className="rounded-3xl border-0 bg-card shadow-soft">
      <CardHeader className="p-6 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-2xl">Journey metrics</CardTitle>
          <Badge variant="secondary">Synthetic demo</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {metrics.stage} · {snapshot.sampleId}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-2">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Pickup"
            value={metrics.pickupAt ? formatJourneyTimestamp(metrics.pickupAt) : snapshot.schedule.pickup || "Not scheduled"}
            detail={metrics.pickupAt ? "Recorded custody event" : "Planned · awaiting confirmation"}
          />
          <Metric label="Estimated arrival" value={arrivalValue} detail={arrivalDetail} />
          <Metric
            label="Time in transit"
            value={formatJourneyDuration(metrics.transitMinutes)}
            detail={metrics.receivedAt ? "Stopped at recorded storage receipt" : "Starts at recorded pickup"}
          />
          <Metric
            label="GPS freshness"
            value={freshness}
            detail={metrics.locationAgeSeconds === null ? "No location timestamp" : `${formatJourneyDuration(Math.round(metrics.locationAgeSeconds / 60))} since last update`}
            warning={metrics.locationStale === true}
          />
          <Metric label="Last known position" value={location} detail="Courier coordinates only" />
          <Metric
            label="Delay"
            value={metrics.delayReason ?? "No delay reported"}
            warning={Boolean(metrics.delayReason)}
          />
          <Metric label="Traffic" value="Unavailable" detail="No traffic provider is connected" />
          <Metric label="Data source" value="Cryo demo feed" detail="Read from the existing GPS-backed Cryo service" />
        </dl>
        {metrics.notices.length > 0 && (
          <details className="rounded-xl border border-border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">Data notes</summary>
            <ul className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
              {metrics.notices.map((notice) => <li key={notice}>{notice}</li>)}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
