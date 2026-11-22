import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/myos/PublicHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clinicDataSource } from "@/lib/clinics/data";
import { resolveClinicSelection, validatePatientSearch } from "@/lib/clinics/selection";

export const Route = createFileRoute("/patient")({
  validateSearch: validatePatientSearch,
  loaderDeps: ({ search }) => ({ selectedClinicId: search.selectedClinicId }),
  loader: ({ deps }) => resolveClinicSelection(deps.selectedClinicId, clinicDataSource),
  head: () => ({
    meta: [
      { title: "Selected demo clinic — MYOS" },
      { name: "description", content: "Review a fictional clinic selection before entering the sample workflow demo." },
    ],
  }),
  component: Patient,
});

function Patient() {
  const selection = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8 md:px-10 md:pt-14">
        <div className="mx-auto max-w-2xl">
          {selection.status === "selected" ? (
            <>
              <Card className="rounded-[1.75rem] border-0 bg-card shadow-soft">
                <CardHeader className="p-7 pb-4 md:p-9 md:pb-5">
                  <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Fictional demo clinic</Badge>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-pink-soft text-accent">
                      <Building2 aria-hidden="true" className="size-6" />
                    </span>
                    <CardTitle className="text-4xl md:text-5xl">{selection.clinic.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-7 pb-7 pt-2 md:px-9 md:pb-9">
                  <p className="text-lg leading-8 text-muted-foreground">{selection.clinic.description}</p>
                  <p className="mt-5 text-sm text-muted-foreground">{selection.clinic.location}</p>
                  <p role="note" className="mt-5 rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
                    Demo only. This selection is not a real facility ID and does not filter patient or sample records.
                  </p>
                </CardContent>
              </Card>
              <Button asChild variant="outline" className="mt-6 rounded-full border-primary text-primary">
                <Link
                  to="/clinic/samples"
                  search={{ selectedClinicId: selection.clinic.id, place: "centre" }}
                  data-testid="link-enter-sample-workflow"
                >
                  Continue to clinic workflow
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            </>
          ) : (
            <Card className="rounded-[1.75rem] border-0 bg-card shadow-soft">
              <CardHeader className="p-7 pb-3 md:p-9 md:pb-4">
                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Clinic selection</Badge>
                <CardTitle className="mt-4 text-4xl md:text-5xl">
                  {selection.status === "missing" ? "Choose a clinic" : "Clinic not found"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-7 pb-7 pt-2 md:px-9 md:pb-9">
                <p className="leading-7 text-muted-foreground">
                  {selection.status === "missing"
                    ? "Choose one of the fictional demo clinics before continuing."
                    : "That demo selection is no longer available. Choose a clinic from the list."}
                </p>
                <Button asChild variant="outline" className="mt-6 rounded-full border-primary text-primary">
                  <Link to="/clinics">
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    Browse demo clinics
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <div className="bg-card"><PublicFooter /></div>
    </div>
  );
}
