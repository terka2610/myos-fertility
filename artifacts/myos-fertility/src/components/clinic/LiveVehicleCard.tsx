import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatJourneyTimestamp,
  type JourneyMetrics,
  type JourneySnapshot,
} from "@/lib/samples/cryo-journey";

export function LiveVehicleCard({
  snapshot,
  metrics,
}: {
  snapshot: JourneySnapshot;
  metrics: JourneyMetrics;
}) {
  const fix = metrics.lastFix;
  const stale = metrics.locationStale !== false;

  return (
    <Card className="rounded-2xl border-0 bg-card shadow-soft">
      <CardHeader className="p-5 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Courier GPS</CardTitle>
          <Badge variant="secondary">{snapshot.feed.assetId}</Badge>
          <Badge variant={stale ? "outline" : "secondary"}>
            {fix ? (stale ? "Stale · last known" : "Fresh") : "No fix"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-1">
        {fix ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Position</dt>
              <dd className="mt-1 font-medium">{fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Speed</dt>
              <dd className="mt-1 font-medium">{fix.speedKmh === null ? "Not reported" : `${Math.round(fix.speedKmh)} km/h`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last update</dt>
              <dd className="mt-1 font-medium">{formatJourneyTimestamp(fix.recordedAt)}</dd>
            </div>
          </dl>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">{snapshot.feed.message}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Synthetic courier feed only. This position is not linked to a patient or sample record.
        </p>
      </CardContent>
    </Card>
  );
}
