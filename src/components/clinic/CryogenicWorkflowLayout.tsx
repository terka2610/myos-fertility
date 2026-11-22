import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PublicFooter, PublicHeader } from "@/components/myos/PublicHeader";
import { SYNTHETIC_ROLES, useSyntheticRole } from "@/lib/demo/synthetic-role";
import { PatientJourneyView } from "@/components/clinic/PatientJourneyView";

type WorkflowPage = "sample-registry" | "journey-calendar";

export function CryogenicWorkflowNavigation({ activePage }: { activePage: WorkflowPage }) {
  const linkClass =
    "inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors";

  return (
    <nav
      aria-label="Cryogenic workflow"
      className="mb-8 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-soft"
    >
      <div className="flex min-w-max gap-2">
        <Link
          to="/clinic/samples"
          hash="sample-registry"
          aria-current={activePage === "sample-registry" ? "page" : undefined}
          className={`${linkClass} ${
            activePage === "sample-registry"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          }`}
        >
          Sample Registry
        </Link>
        <Link
          to="/clinic/samples"
          hash="documents"
          className={`${linkClass} text-muted-foreground hover:bg-secondary/70 hover:text-foreground`}
        >
          Transfer Documents
        </Link>
        <Link
          to="/clinic/journey-calendar"
          search={{ sampleId: "SMP-0001" }}
          aria-current={activePage === "journey-calendar" ? "page" : undefined}
          className={`${linkClass} ${
            activePage === "journey-calendar"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          }`}
        >
          Journey Calendar
        </Link>
        <Link
          to="/clinic/samples"
          hash="activity-history"
          className={`${linkClass} text-muted-foreground hover:bg-secondary/70 hover:text-foreground`}
        >
          Activity History
        </Link>
      </div>
    </nav>
  );
}

export function CryogenicWorkflowLayout({
  title,
  accent,
  activePage,
  children,
}: {
  title: string;
  accent: string;
  activePage: WorkflowPage;
  children: ReactNode;
}) {
  const [role, setRole] = useSyntheticRole();
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-14">
        <header className="mb-8 max-w-3xl">
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to Home
          </Link>
          <h1 className="mt-5 text-5xl md:text-7xl">
            {title} <span className="serif-accent">{accent}</span>
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Sample and transfer records are used for clinical workflow review. Forms are not valid
            clinical or legal authorisations.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Clinic and transfer details use generic facility names.
          </p>
        </header>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            <span className="text-muted-foreground">Viewing as</span>
            <select
              aria-label="Viewing as"
              value={role}
              onChange={(event) => setRole(event.target.value as (typeof SYNTHETIC_ROLES)[number])}
              className="h-10 min-w-48 rounded-md border border-input bg-background px-3"
            >
              {SYNTHETIC_ROLES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        {role === "Patient" ? (
          <PatientJourneyView />
        ) : (
          <>
            <CryogenicWorkflowNavigation activePage={activePage} />
            {children}
          </>
        )}
      </main>
      <div className="bg-card">
        <PublicFooter />
      </div>
    </div>
  );
}
