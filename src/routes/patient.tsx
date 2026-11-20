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
      { title: "Your clinic — MYOS" },
      { name: "description", content: "View your selected fictional demo clinic." },
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
                  <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                    Fictional demo clinic
                  </Badge>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-pink-soft text-accent">
                      <Building2 aria-hidden="true" className="size-6" />
                    </span>
                    <CardTitle className="text-4xl md:text-5xl">
                      {selection.clinic.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-7 pb-7 pt-2 md:px-9 md:pb-9">
                  <p className="text-lg leading-8 text-muted-foreground">
                    {selection.clinic.description}
                  </p>
                  <p className="mt-5 text-sm text-muted-foreground">
                    {selection.clinic.location}
                  </p>
                </CardContent>
              </Card>
              <div className="mt-6">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-primary text-primary"
                >
                  <Link
                    to="/clinic/samples"
                    search={{ selectedClinicId: selection.clinic.id }}
                  >
                    View synthetic sample registry demo
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">
                  Demo only: this keeps the local clinic selection in the URL, but it is not a
                  backend ID. The registry shows synthetic Clinic A data and is not live or
                  filtered by this selection.
                </p>
              </div>
            </>
          ) : (
            <Card className="rounded-[1.75rem] border-0 bg-card shadow-soft">
              <CardHeader className="p-7 pb-3 md:p-9 md:pb-4">
                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                  Clinic selection
                </Badge>
                <CardTitle className="mt-4 text-4xl md:text-5xl">
                  {selection.status === "missing"
                    ? "Choose a clinic"
                    : "Clinic not found"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-7 pb-7 pt-2 md:px-9 md:pb-9">
                <p className="leading-7 text-muted-foreground">
                  {selection.status === "missing"
                    ? "No clinic was selected yet. Choose one of the fictional demo clinics to continue."
                    : "That clinic selection is no longer available. Please choose a clinic from the demo list."}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-6 rounded-full border-primary text-primary"
                >
                  <Link to="/clinics">
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    Browse clinics
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <div className="bg-card">
        <PublicFooter />
      </div>
    </div>
  );
}
