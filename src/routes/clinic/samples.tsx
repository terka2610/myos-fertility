import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CryogenicWorkflowLayout } from "@/components/clinic/CryogenicWorkflowLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SampleRegistryTable } from "@/components/clinic/SampleRegistryTable";
import { SampleTransferDemo } from "@/components/clinic/SampleTransferDemo";
import { sampleDataSource } from "@/lib/samples/data";
import { readSupabaseSample } from "@/lib/samples/supabase.functions";
import type { SupabaseSampleResponse } from "@/lib/samples/supabase.functions";
import type { SampleRegistryRecord } from "@/lib/samples/types";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/clinic/samples")({
  validateSearch: (search: Record<string, unknown>): { selectedClinicId?: string } => {
    const selectedClinicId = search["selectedClinicId"];
    return typeof selectedClinicId === "string" ? { selectedClinicId } : {};
  },
  loader: async (): Promise<{
    samples: readonly SampleRegistryRecord[];
    connected: boolean;
  }> => {
    try {
      const result = (await readSupabaseSample({
        data: { sampleId: "SMP-0001" },
      })) as SupabaseSampleResponse;
      if (result.connected && result.sample) {
        return { samples: [result.sample], connected: true };
      }
      return {
        samples: await sampleDataSource.listSamples(),
        connected: false,
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Sample data unavailable; using simulation", error);
      }
      return {
        samples: await sampleDataSource.listSamples(),
        connected: false,
      };
    }
  },
  pendingComponent: SampleRegistryLoading,
  errorComponent: SampleRegistryError,
  head: () => ({
    meta: [
      { title: "Clinic sample registry — MYOS" },
      {
        name: "description",
        content: "A sample registry and transfer journey for the MYOS cryogenic workflow.",
      },
    ],
  }),
  component: ClinicSamples,
});

function ClinicSamples() {
  const loaded = Route.useLoaderData();
  const { session } = useAuth();
  const [liveState, setLiveState] = useState(loaded);

  useEffect(() => {
    if (!session) {
      setLiveState(loaded);
      return;
    }
    let cancelled = false;
    void readSupabaseSample({ data: { sampleId: "SMP-0001" } })
      .then((result) => {
        if (cancelled) return;
        if (result.connected && result.sample) {
          setLiveState({ samples: [result.sample], connected: true });
        }
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.warn("Authenticated sample read unavailable", error);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, session]);

  const { samples, connected } = liveState;

  return (
    <CryogenicWorkflowLayout title="Sample" accent="registry" activePage="sample-registry">
      <div id="sample-registry" className="scroll-mt-24">
        {!connected && (
          <p
            role="status"
            className="mb-4 inline-flex rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            Simulated data. Live sample information is unavailable.
          </p>
        )}
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
      <SampleTransferDemo />
    </CryogenicWorkflowLayout>
  );
}

function SampleRegistryLoading() {
  return (
    <CryogenicWorkflowLayout title="Sample" accent="registry" activePage="sample-registry">
      <p role="status" aria-live="polite" className="text-muted-foreground">
        Loading sample records…
      </p>
    </CryogenicWorkflowLayout>
  );
}

function SampleRegistryError({ error, reset }: ErrorComponentProps) {
  console.error("Sample registry failed to load", error);

  return (
    <CryogenicWorkflowLayout title="Sample" accent="registry" activePage="sample-registry">
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
    </CryogenicWorkflowLayout>
  );
}
