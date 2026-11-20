import { createFileRoute, Link, type ErrorComponentProps } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/myos/PublicHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleRegistryTable } from "@/components/clinic/SampleRegistryTable";
import { SampleTransferDemo } from "@/components/clinic/SampleTransferDemo";
import { sampleDataSource } from "@/lib/samples/data";

export const Route = createFileRoute("/clinic/samples")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { selectedClinicId?: string } => {
    const selectedClinicId = search["selectedClinicId"];
    return typeof selectedClinicId === "string" ? { selectedClinicId } : {};
  },
  loader: () => sampleDataSource.listSamples(),
  pendingComponent: SampleRegistryLoading,
  errorComponent: SampleRegistryError,
  head: () => ({
    meta: [
      { title: "Clinic sample registry — MYOS" },
      {
        name: "description",
        content: "A sample registry and transfer journey for the MYOS demonstration.",
      },
    ],
  }),
  component: ClinicSamples,
});

function RegistryPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8 md:px-10 md:pt-14">
        {children}
      </main>
      <div className="bg-card">
        <PublicFooter />
      </div>
    </div>
  );
}

function RegistryHeading() {
  return (
    <header className="mb-8 max-w-3xl">
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
      <h1 className="mt-5 text-5xl md:text-7xl">
        Sample <span className="serif-accent">registry</span>
      </h1>
      <p className="mt-5 text-lg leading-8 text-muted-foreground">
        Demonstration environment. All patient and transfer records are simulated. Forms are
        not valid clinical or legal authorisations.
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Al Noor Fertility Centre — Abu Dhabi is a fictional example created for this
        demonstration, not a MYOS partner.
      </p>
    </header>
  );
}

function ClinicSamples() {
  const samples = Route.useLoaderData();

  return (
    <RegistryPage>
      <RegistryHeading />
      {samples.length > 0 ? (
        <SampleRegistryTable samples={samples} />
      ) : (
        <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-2xl">No sample records yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No sample records are available.
            </p>
          </CardContent>
        </Card>
      )}
      <SampleTransferDemo />
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
