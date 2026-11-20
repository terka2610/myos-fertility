import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/myos/PublicHeader";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clinicDataSource } from "@/lib/clinics/data";

export const Route = createFileRoute("/clinics")({
  loader: () => clinicDataSource.listClinics(),
  head: () => ({
    meta: [
      { title: "Clinics — MYOS" },
      { name: "description", content: "Browse fictional clinic profiles in the MYOS demo." },
    ],
  }),
  component: Clinics,
});

function Clinics() {
  const clinics = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8 md:px-10 md:pt-14">
        <header className="max-w-3xl">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Fictional demo clinics
          </Badge>
          <h1 className="mt-5 text-5xl md:text-7xl">
            Find your <span className="serif-accent">clinic</span>
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Explore sample fertility clinic profiles for the MYOS demo. These are fictional
            examples, not real clinics or facility records.
          </p>
        </header>

        <section aria-label="Demo clinics" className="mt-10 grid gap-5 md:grid-cols-3">
          {clinics.map((clinic, index) => (
            <Link
              key={clinic.id}
              to="/patient"
              search={{ selectedClinicId: clinic.id }}
              aria-label={`Select ${clinic.name}`}
              className="block rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
            >
              <Card
                className={`h-full overflow-hidden rounded-[1.5rem] border-0 shadow-soft transition-shadow hover:shadow-lg ${
                  index === 1 ? "bg-gold-soft" : "bg-card"
                }`}
              >
                <CardHeader className="gap-4 p-6 pb-4">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-pink-soft text-accent">
                    <Building2 aria-hidden="true" className="size-6" />
                  </span>
                  <div>
                    <CardTitle className="text-3xl">{clinic.name}</CardTitle>
                    <CardDescription className="mt-2 flex items-center gap-1.5">
                      <MapPin aria-hidden="true" className="size-4" />
                      {clinic.location}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                  <p className="text-sm leading-6 text-muted-foreground">{clinic.description}</p>
                  <h2 className="mt-6 text-base font-semibold">Demo care options</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {clinic.careOptions.map((option) => (
                      <li
                        key={option}
                        className="rounded-full bg-background/80 px-3 py-1.5 text-xs text-foreground"
                      >
                        {option}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <p className="mt-8 text-sm text-muted-foreground">
          This sample directory uses temporary local fixture data and is not connected to
          facility records.
        </p>
      </main>
      <div className="bg-card">
        <PublicFooter />
      </div>
    </div>
  );
}
