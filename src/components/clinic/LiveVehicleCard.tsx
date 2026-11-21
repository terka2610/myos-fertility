import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSampleTimestamp } from "@/components/clinic/SampleRegistryTable";
import type { VehicleFixResult } from "@/lib/samples/gps-monitor";

const STALE_AFTER_SECONDS = 5 * 60;

const UNAVAILABLE_TEXT: Record<Exclude<VehicleFixResult, { ok: true }>["reason"], string> = {
  not_configured: "The GPS monitor is not configured.",
  unreachable: "The GPS monitor cannot be reached.",
  no_fix: "The courier has not reported a position yet.",
  invalid_response: "The GPS monitor sent an unexpected response.",
};

/** The courier's own latest GPS fix. Shows only vehicle data, never sample or patient details. */
export function LiveVehicleCard({ result, now }: { result: VehicleFixResult; now: Date }) {
  if (!result.ok) {
    return (
      <Card className="rounded-2xl border-0 bg-card shadow-soft">
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-base">Live courier GPS</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-1 text-sm text-muted-foreground">
          {UNAVAILABLE_TEXT[result.reason]}
        </CardContent>
      </Card>
    );
  }

  const { fix } = result;
  const ageSeconds = Math.max(0, Math.round((now.getTime() - Date.parse(fix.recordedAt)) / 1000));
  const stale = !Number.isFinite(ageSeconds) || ageSeconds > STALE_AFTER_SECONDS;
  const ageText =
    ageSeconds < 60 ? "less than a minute ago" : `${Math.round(ageSeconds / 60)} min ago`;

  return (
    <Card className="rounded-2xl border-0 bg-card shadow-soft">
      <CardHeader className="p-5 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Live courier GPS</CardTitle>
          <Badge variant="outline">{fix.assetId}</Badge>
          <Badge
            variant="outline"
            className={
              stale
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }
          >
            {stale ? "Stale — last known point" : "Live"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 p-5 pt-1 text-sm sm:grid-cols-3">
        <p>
          <span className="block text-muted-foreground">Position</span>
          {fix.lat.toFixed(4)}, {fix.lon.toFixed(4)}
        </p>
        <p>
          <span className="block text-muted-foreground">Speed</span>
          {fix.speedKmh === null ? "Not reported" : `${Math.round(fix.speedKmh)} km/h`}
        </p>
        <p>
          <span className="block text-muted-foreground">Last update</span>
          {formatSampleTimestamp(fix.recordedAt).text} · {ageText}
        </p>
      </CardContent>
    </Card>
  );
}
