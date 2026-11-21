import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSampleTimestamp } from "@/components/clinic/SampleRegistryTable";
import type { JourneyMetrics } from "@/lib/samples/journey-metrics";

const SOURCE_LABELS: Record<JourneyMetrics["source"], string> = {
  live_vehicle: "Live vehicle GPS",
  recorded_route: "Recorded route",
  simulation: "Simulated data",
};

function formatDuration(minutes: number | null) {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatAge(seconds: number) {
  if (seconds < 60) return "less than a minute ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${formatDuration(minutes)} ago`;
}

function Metric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string | undefined;
  tone?: "default" | "muted" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 font-medium ${
          tone === "muted"
            ? "text-muted-foreground"
            : tone === "warning"
              ? "text-amber-700 dark:text-amber-400"
              : ""
        }`}
      >
        {value}
      </dd>
      {detail && <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>}
    </div>
  );
}

export function JourneyMetricsPanel({
  metrics,
  asOf,
  saveStatus,
}: {
  metrics: JourneyMetrics;
  /** For simulations: the simulated moment the metrics describe. */
  asOf?: string | undefined;
  /** Whether the latest numbers were written for the WhatsApp agent. */
  saveStatus?: { saved: boolean; error: string | null } | undefined;
}) {
  const location = metrics.lastLocation;
  const locationTime = location ? formatSampleTimestamp(location.recordedAt).text : undefined;
  const pickup = metrics.pickupAt ? formatSampleTimestamp(metrics.pickupAt).text : undefined;
  const eta = metrics.etaAt ? formatSampleTimestamp(metrics.etaAt).text : null;
  const transport = formatDuration(metrics.transportMinutes);
  const freezer = formatDuration(metrics.inTransportFreezerMinutes);

  return (
    <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
      <CardHeader className="p-6 pb-3 md:p-8 md:pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-2xl">Journey metrics</CardTitle>
          <Badge variant={metrics.source === "live_vehicle" ? "outline" : "secondary"}>
            {SOURCE_LABELS[metrics.source]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {asOf
            ? `Calculated for ${metrics.sampleId} as of ${formatSampleTimestamp(asOf).text} (simulated clock).`
            : `Calculated for ${metrics.sampleId} from location and custody records.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-2 md:p-8 md:pt-3">
        <dl aria-label="Journey metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Journey stage"
            value={metrics.stage}
            detail={
              metrics.leg ? (metrics.leg === "return" ? "Return trip" : "Outbound trip") : undefined
            }
          />
          <Metric
            label="Last known location"
            value={location ? `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}` : "Unknown"}
            detail={
              location && metrics.locationAgeSeconds !== null
                ? `${locationTime} · ${formatAge(metrics.locationAgeSeconds)}`
                : undefined
            }
            tone={!location ? "muted" : metrics.locationStale ? "warning" : "default"}
          />
          <Metric
            label="GPS freshness"
            value={
              metrics.locationStale === null
                ? "No GPS data"
                : metrics.locationStale
                  ? "Stale — position unknown"
                  : "Fresh"
            }
            tone={
              metrics.locationStale === null
                ? "muted"
                : metrics.locationStale
                  ? "warning"
                  : "default"
            }
          />
          <Metric
            label={metrics.arrivedAt ? "Total transport time" : "Time since pickup"}
            value={transport ?? "Not picked up yet"}
            detail={pickup ? `Picked up ${pickup}` : undefined}
            tone={transport ? "default" : "muted"}
          />
          <Metric
            label="Time in transport freezer"
            value={freezer ?? "Not loaded yet"}
            detail={freezer ? "From pickup until arrival" : undefined}
            tone={freezer ? "default" : "muted"}
          />
          <Metric
            label="Estimated arrival"
            value={metrics.etaMethod === "arrived" ? "Arrived" : (eta ?? "ETA unavailable")}
            detail={
              metrics.etaMethod === "distance_speed_estimate"
                ? "Approximate: distance and current speed"
                : undefined
            }
            tone={metrics.etaMethod === "unavailable" ? "muted" : "default"}
          />
          <Metric
            label="Delay"
            value={metrics.delayReason ?? "No delay reported"}
            tone={metrics.delayReason ? "warning" : "muted"}
          />
          <Metric
            label="Traffic"
            value="Not available"
            detail="No traffic provider connected"
            tone="muted"
          />
        </dl>
        {saveStatus && (
          <p className="text-xs text-muted-foreground">
            {saveStatus.saved
              ? "Saved for the WhatsApp agent."
              : `Not saved for the WhatsApp agent: ${saveStatus.error ?? "unknown error"}`}
          </p>
        )}
        {metrics.notices.length > 0 && (
          <ul aria-label="Journey data notices" className="space-y-1 text-xs text-muted-foreground">
            {metrics.notices.map((notice) => (
              <li key={notice}>• {notice}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
