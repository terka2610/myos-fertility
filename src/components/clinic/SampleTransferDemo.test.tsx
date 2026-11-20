import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { SampleTransferDemo } from "./SampleTransferDemo";
import {
  SAMPLE_TRANSFER_STORAGE_KEY,
  type SampleTransferActivity,
} from "@/lib/demo/sample-transfer";

beforeEach(() => {
  window.localStorage.removeItem(SAMPLE_TRANSFER_STORAGE_KEY);
});

describe("SampleTransferDemo", () => {
  it("lists the three operational entities, named documents, and transfer routes", async () => {
    render(<SampleTransferDemo />);

    const entities = screen.getByRole("region", { name: "Operational entities" });
    expect(within(entities).getByText("Fertility Clinic")).toBeInTheDocument();
    expect(within(entities).getByText("Cryoport Transport")).toBeInTheDocument();
    expect(within(entities).getByText("Cryogenic Storage")).toBeInTheDocument();

    const namedDocuments = [
      ["CLI-001", "Patient registration"],
      ["CON-004", "Storage consent"],
      ["CON-007", "Transfer consent"],
      ["LAB-013", "Sample release authorisation"],
      ["SHP-001", "Shipment booking"],
      ["SHP-011", "Chain-of-custody"],
      ["SHP-012", "Condition monitoring"],
      ["SHP-014", "Handover/collection confirmation"],
      ["INV-003", "Sample receipt"],
      ["INV-005", "Tank/location register"],
    ];
    for (const [reference, title] of namedDocuments) {
      const row = screen.getByRole("row", { name: new RegExp(reference) });
      expect(within(row).getByText(title)).toBeInTheDocument();
      expect(within(row).getByText("Not Started")).toBeInTheDocument();
    }

    const clinicRow = screen.getByRole("row", { name: /LAB-013/ });
    expect(within(clinicRow).getByText("Fertility Clinic")).toBeInTheDocument();
    expect(
      within(clinicRow).getByText("Al Noor Fertility Centre — Abu Dhabi → Cryoport"),
    ).toBeInTheDocument();
    const journey = screen.getByRole("list", {
      name: "Al Noor Fertility Centre to storage and return journey",
    });
    expect(
      within(journey).getAllByRole("listitem").map((item) => item.textContent?.trim()),
    ).toEqual([
      "Al Noor Fertility Centre — Abu Dhabi",
      "Cryoport",
      "Cryogenic Storage",
      "Several years later — patient requests return",
      "Cryoport",
      "Al Noor Fertility Centre — Abu Dhabi",
    ]);

    expect(
      screen.getByRole("button", {
        name: "Open closure checkpoint SHP-016 Receiving facility acceptance Document Form",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Open closure checkpoint SHP-016 Receiving facility acceptance — return transfer Document Form",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("SHP-016")).toHaveLength(2);
    expect(screen.getAllByText("SHP-017")).toHaveLength(2);
  });

  it("saves document-specific fields and updates the shared activity timeline", async () => {
    render(<SampleTransferDemo />);

    const openForm = await screen.findByRole("button", {
      name: "Open CLI-001 Patient registration Document Form",
    });
    await waitFor(() => expect(openForm).toBeEnabled());
    fireEvent.click(openForm);
    fireEvent.change(screen.getByLabelText("Record Title"), {
      target: { value: "Registration record 01" },
    });
    fireEvent.change(screen.getByLabelText("Additional Notes"), {
      target: { value: "Sample metadata notes" },
    });
    fireEvent.change(screen.getByLabelText(/^Patient/), {
      target: { value: "Patient 02" },
    });
    fireEvent.change(screen.getByLabelText(/Registration date and time/), {
      target: { value: "2026-03-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(await screen.findByText("CLI-001 Patient registration: Draft saved")).toBeInTheDocument();
    const clinicRow = screen.getByRole("row", { name: /CLI-001/ });
    expect(within(clinicRow).getByText("Draft Saved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: "Open CLI-001 Patient registration Document Form",
    }));
    expect(screen.getByLabelText("Record Title")).toHaveValue("Registration record 01");
    expect(screen.getByLabelText("Additional Notes")).toHaveValue("Sample metadata notes");
    expect(screen.getByLabelText(/^Patient/)).toHaveValue("Patient 02");
    fireEvent.click(screen.getByRole("button", { name: "Mark as Completed" }));
    expect(
      await screen.findByText("CLI-001 Patient registration: Marked as Completed"),
    ).toBeInTheDocument();
    expect(within(clinicRow).getByText("Completed")).toBeInTheDocument();
  });

  it("requires separate outbound and return acceptance and reconciliation records before closure", async () => {
    render(<SampleTransferDemo />);

    const closeButton = await screen.findByRole("button", { name: "Close Transfer" });
    await waitFor(() => expect(closeButton).toBeDisabled());

    async function completeCheckpoint(
      reference: string,
      title: string,
      dateLabel: string,
      reconciliation = false,
      reconciliationResult = "Matched",
    ) {
      fireEvent.click(
        screen.getByRole("button", {
          name: `Open closure checkpoint ${reference} ${title} Document Form`,
        }),
      );
      fireEvent.change(screen.getByLabelText(new RegExp(dateLabel)), {
        target: { value: "2026-03-01T10:00" },
      });
      if (reconciliation) {
        fireEvent.change(screen.getByLabelText(/^Reconciliation Result/), {
          target: { value: reconciliationResult },
        });
      }
      fireEvent.click(screen.getByRole("button", { name: "Mark as Completed" }));
      if (reconciliationResult === "Pending") {
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "A pending reconciliation cannot be marked complete.",
        );
        expect(closeButton).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/^Reconciliation Result/), {
          target: { value: "Matched" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Mark as Completed" }));
      }
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }

    await completeCheckpoint(
      "SHP-016",
      "Receiving facility acceptance",
      "Acceptance record date and time",
    );
    expect(closeButton).toBeDisabled();
    await completeCheckpoint(
      "SHP-017",
      "Sample and seal reconciliation",
      "Reconciliation date and time",
      true,
      "Pending",
    );
    expect(closeButton).toBeDisabled();
    await completeCheckpoint(
      "SHP-016",
      "Receiving facility acceptance — return transfer",
      "Acceptance record date and time",
    );
    expect(closeButton).toBeDisabled();
    await completeCheckpoint(
      "SHP-017",
      "Sample and seal reconciliation — return transfer",
      "Reconciliation date and time",
      true,
    );

    await waitFor(() => expect(closeButton).toBeEnabled());
    fireEvent.click(closeButton);
    expect(await screen.findByText("Transfer Closed", { selector: "p" })).toBeInTheDocument();
  });

  it("preserves older generic drafts and activity without treating them as complete", async () => {
    const legacyActivity: SampleTransferActivity = {
      id: "legacy-event",
      at: "2026-02-01T10:00:00.000Z",
      message: "Earlier synthetic activity",
    };
    window.localStorage.setItem(
      SAMPLE_TRANSFER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        records: {
          "CLI-001": {
            label: "",
            notes: "",
            handoff: "Clinic A -> Cryoport",
            fields: {
              sampleId: "SMP-0001",
              patientAlias: "Fictional demo patient",
              sourceFacility: "Clinic A (demo)",
              destination: "Cryoport (demo)",
              registeredAt: "",
              staffMember: "Demo staff",
            },
            status: "draft",
            updatedAt: "2026-02-01T10:00:00.000Z",
          },
          "SHP-014": {
            label: "",
            notes: "",
            handoff: "Cryoport -> Clinic A",
            status: "draft",
            updatedAt: "2026-02-01T10:00:00.000Z",
          },
          "checkpoint:receiving-acceptance": {
            label: "Legacy acceptance draft",
            notes: "Older notes remain preserved",
            handoff: "Cryoport -> Storage",
            status: "complete",
            updatedAt: "2026-02-01T10:00:00.000Z",
          },
        },
        activity: [legacyActivity],
        closedAt: null,
      }),
    );
    render(<SampleTransferDemo />);

    expect(await screen.findByText("Earlier synthetic activity")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Transfer" })).toBeDisabled();
    const acceptanceRows = screen.getAllByRole("row", { name: /SHP-016/ });
    expect(within(acceptanceRows[0]!).getByText("Draft Saved")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /SHP-014/ })).getByText(
        "Cryogenic Storage → Cryoport",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open CLI-001 Patient registration Document Form",
      }),
    );
    expect(screen.getByLabelText(/^Source Facility/)).toHaveValue(
      "Al Noor Fertility Centre — Abu Dhabi",
    );
    expect(screen.getByLabelText(/^Destination/)).toHaveValue("Cryoport");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open closure checkpoint SHP-016 Receiving facility acceptance Document Form",
      }),
    );
    expect(screen.getByLabelText("Record Title")).toHaveValue("Legacy acceptance draft");
    expect(screen.getByLabelText("Additional Notes")).toHaveValue(
      "Older notes remain preserved",
    );
  });
});
