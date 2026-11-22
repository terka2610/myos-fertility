import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SampleTransferDemo } from "./SampleTransferDemo";
import { SYNTHETIC_ROLE_STORAGE_KEY, useSyntheticRole } from "@/lib/demo/synthetic-role";

beforeEach(() => {
  window.localStorage.removeItem(SYNTHETIC_ROLE_STORAGE_KEY);
});

describe("Cryogenic synthetic role views", () => {
  it("switches between all three role views", () => {
    function RoleProbe() {
      const [role, setRole] = useSyntheticRole();
      return (
        <select
          aria-label="Viewing as"
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
        >
          <option>Fertility Centre</option>
          <option>Cryo Transport</option>
          <option>Cryogenic Storage</option>
        </select>
      );
    }
    render(<RoleProbe />);

    const selector = screen.getByRole("combobox", { name: "Viewing as" });
    expect(selector).toHaveValue("Fertility Centre");

    fireEvent.change(selector, { target: { value: "Cryo Transport" } });
    expect(selector).toHaveValue("Cryo Transport");

    fireEvent.change(selector, { target: { value: "Cryogenic Storage" } });
    expect(selector).toHaveValue("Cryogenic Storage");
  });

  it("shows the transport role context while preserving the full document workflow", () => {
    window.localStorage.setItem(SYNTHETIC_ROLE_STORAGE_KEY, "Cryo Transport");
    render(<SampleTransferDemo />);

    const section = document.getElementById("documents");
    expect(section).not.toBeNull();
    expect(within(section!).getByText("Shipment booking")).toBeInTheDocument();
    expect(within(section!).getByText("Patient registration")).toBeInTheDocument();
    expect(within(section!).getByText("Sample receipt")).toBeInTheDocument();
  });

  it("shows storage custody actions only for the storage role", () => {
    window.localStorage.setItem(SYNTHETIC_ROLE_STORAGE_KEY, "Cryogenic Storage");
    render(<SampleTransferDemo />);

    expect(screen.getByRole("region", { name: "Storage role custody" })).toBeInTheDocument();
  });
});

describe("Patient view", () => {
  it("is offered in the Viewing as menu", async () => {
    const { SYNTHETIC_ROLES } = await import("@/lib/demo/synthetic-role");
    expect(SYNTHETIC_ROLES).toContain("Patient");
  });

  it("shows the patient's treatments and answers how to use stored eggs", async () => {
    const { PatientJourneyView } = await import("./PatientJourneyView");
    render(<PatientJourneyView />);

    expect(screen.getByText("Unique ID")).toBeInTheDocument();
    expect(screen.getByText("PT-0142")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Signed documents" })).toHaveTextContent(
      "Consent to transfer eggs to the storage facility",
    );
    expect(screen.getByRole("link", { name: /Your Eggs, Safely Stored/ })).toHaveAttribute(
      "href",
      "/leaflets/your-eggs-safely-stored.pdf",
    );
    expect(screen.getByRole("link", { name: /Renewing the Storage of Your Eggs/ })).toHaveAttribute(
      "href",
      "/leaflets/renewing-your-storage.pdf",
    );
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    const treatments = screen.getByRole("list", { name: "Treatments" });
    expect(within(treatments).getByText("Egg freezing · cycle 1")).toBeInTheDocument();
    expect(within(treatments).getByText("Egg freezing · cycle 2")).toBeInTheDocument();

    fireEvent.click(within(treatments).getByText("Egg freezing · cycle 1"));
    expect(screen.getByRole("list", { name: "Treatment journey" })).toHaveTextContent(
      "Frozen and safely stored",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "I want to use my eggs. What should I do?" }),
    );
    expect(
      screen.getByText(/To use your stored eggs, contact your Fertility Centre/),
    ).toBeInTheDocument();
  });
});
