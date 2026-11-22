import { createFileRoute, Link, type ErrorComponentProps } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/myos/PublicHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleRegistryTable } from "@/components/clinic/SampleRegistryTable";
import { SampleTransferDemo } from "@/components/clinic/SampleTransferDemo";
import type { View } from "@/components/scene3d";
import { sampleDataSource } from "@/lib/samples/data";

export const Route = createFileRoute("/clinic/samples")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { selectedClinicId?: string; place?: View } => {
    const selectedClinicId = search["selectedClinicId"];
    const place = search["place"];
    return {
      ...(typeof selectedClinicId === "string" ? { selectedClinicId } : {}),
      ...(place === "network" ||
      place === "centre" ||
      place === "transport" ||
      place === "storage" ||
      place === "patient"
        ? { place }
        : {}),
    };
  },
  loader: () => sampleDataSource.listSamples(),
  pendingComponent: SampleRegistryLoading,
  errorComponent: SampleRegistryError,
  head: () => ({
    meta: [
      { title: "Cryostorage journey — MYOS" },
      {
        name: "description",
        content: "Explore the MYOS cryostorage journey and open clinic, transport, and storage workflows.",
      },
    ],
  }),
  component: ClinicSamples,
});

function RegistryPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-14">{children}</main>
      <div className="bg-card">
        <PublicFooter />
      </div>
    </div>
  );
}

function RegistryHeading() {
  return (
    <header className="mb-6 max-w-4xl">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to Home
      </Link>
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        Demo
      </Badge>
      <h1 className="mt-4 text-4xl md:text-5xl">
        Cryostorage <span className="serif-accent">journey</span>
      </h1>
      <p role="note" className="mt-3 text-sm leading-6 text-muted-foreground" data-testid="text-demo-warning">
        Synthetic demo. Not clinical or legal authorisation; edits stay in this browser.
      </p>
      <Link
        to="/clinic/journey-calendar"
        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <CalendarDays aria-hidden="true" className="size-4" />
        Open journey calendar
      </Link>
    </header>
  );
}

function ClinicSamples() {
  const samples = Route.useLoaderData();
  const { place } = Route.useSearch();

  return (
    <RegistryPage>
      <RegistryHeading />
      <SampleTransferDemo initialPlace={place ?? "centre"} />
      <details className="mt-8 rounded-3xl border border-border p-5">
        <summary className="cursor-pointer font-medium">Sample registry · synthetic records</summary>
        <div className="mt-5">
        {samples.length > 0 ? (
        <SampleRegistryTable samples={samples} />
      ) : (
        <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-2xl">No sample records yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No sample records are available.</p>
          </CardContent>
        </Card>
        )}
        </div>
      </details>
    </RegistryPage>
  );
}

function SampleRegistryLoading() {
  return (
    <RegistryPage>
      <RegistryHeading />
      <p role="status" aria-live="polite" className="text-muted-foreground">
        Loading sample records…
      </p>
    </RegistryPage>
  );
}

function SampleRegistryError({ error, reset }: ErrorComponentProps) {
  console.error("Sample registry failed to load", error);

  return (
    <RegistryPage>
      <RegistryHeading />
      <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
        <CardHeader>
          <CardTitle className="text-2xl">Sample registry unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="text-muted-foreground">
            We couldn’t load the sample records. Please try again.
          </p>
          <Button className="mt-5 rounded-full" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </RegistryPage>
  );
}
