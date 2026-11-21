import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SampleRegistryRecord } from "@/lib/samples/types";

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const DUBAI_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type FormattedSampleTimestamp =
  { text: string; dateTime: string } | { text: string; dateTime?: never };

export function formatSampleTimestamp(value: string | null | undefined): FormattedSampleTimestamp {
  if (typeof value !== "string" || value.trim() === "") {
    return { text: "Timestamp unavailable" };
  }

  if (!ISO_TIMESTAMP_PATTERN.test(value)) {
    return { text: "Invalid timestamp" };
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return { text: "Invalid timestamp" };
  }

  const datePart = value.slice(0, 10);
  const calendarDate = new Date(`${datePart}T00:00:00.000Z`);
  if (
    !Number.isFinite(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== datePart
  ) {
    return { text: "Invalid timestamp" };
  }

  return {
    text: `${DUBAI_TIMESTAMP_FORMATTER.format(date)} GST (UTC+4)`,
    dateTime: value,
  };
}

export function SampleRegistryTable({ samples }: { samples: readonly SampleRegistryRecord[] }) {
  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-0 bg-card shadow-soft">
      <CardHeader className="p-6 pb-4 md:p-8 md:pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-2xl">Sample records</CardTitle>
          {samples.length > 0 && (
            <Badge
              variant="outline"
              className={
                samples.every((sample) => sample.source === "supabase")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }
            >
              {samples.every((sample) => sample.source === "supabase")
                ? "Recorded data"
                : "Simulated data"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 md:px-8 md:pb-8">
        <Table>
          <TableCaption>Sample registry records.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Sample display ID</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Sample type</TableHead>
              <TableHead>Current state</TableHead>
              <TableHead>Storage site</TableHead>
              <TableHead>Latest event timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {samples.map((sample) => {
              const timestamp = formatSampleTimestamp(sample.latestEventAt);

              return (
                <TableRow key={sample.displayId}>
                  <TableCell className="font-medium">{sample.displayId}</TableCell>
                  <TableCell>{sample.patientDisplayName}</TableCell>
                  <TableCell>{sample.sampleType}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{sample.currentState}</Badge>
                  </TableCell>
                  <TableCell>{sample.storageSite}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {timestamp.dateTime ? (
                      <time dateTime={timestamp.dateTime}>{timestamp.text}</time>
                    ) : (
                      timestamp.text
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
