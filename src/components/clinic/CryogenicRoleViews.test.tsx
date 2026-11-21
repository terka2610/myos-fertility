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
