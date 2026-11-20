import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { SampleTransferDemo } from "./SampleTransferDemo";
import {
  createInitialSampleTransferState,
  SAMPLE_DOCUMENT_FORMS,
  SAMPLE_TRANSFER_STORAGE_KEY,
  type SampleTransferActivity,
} from "@/lib/demo/sample-transfer";

interface FakeSpeechResultEvent {
  results: Array<Array<{ transcript: string }>>;
}

class FakeSpeechRecognition {
  lang = "";
  interimResults = true;
  continuous = false;
  declare processLocally: boolean;
  onresult: ((event: FakeSpeechResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = () => {};
  stop = () => this.onend?.();
  abort = () => this.onend?.();

  constructor(localProcessing: boolean) {
    if (localProcessing) this.processLocally = false;
    speechRecognitions.push(this);
  }
}

const speechRecognitions: FakeSpeechRecognition[] = [];

function installSpeechRecognition(localProcessing: boolean) {
  class TestSpeechRecognition extends FakeSpeechRecognition {
    constructor() {
      super(localProcessing);
    }
  }
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    value: TestSpeechRecognition,
  });
}

beforeEach(() => {
  window.localStorage.removeItem(SAMPLE_TRANSFER_STORAGE_KEY);
  Reflect.deleteProperty(window, "SpeechRecognition");
  Reflect.deleteProperty(window, "webkitSpeechRecognition");
  speechRecognitions.length = 0;
});

describe("SampleTransferDemo", () => {
  it("reviews local speech proposals before applying only matching shipment fields", async () => {
    installSpeechRecognition(true);
    render(<SampleTransferDemo />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open SHP-001 Shipment booking Document Form",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    const recognition = speechRecognitions[0];
    expect(recognition?.processLocally).toBe(true);
    expect(recognition?.lang).toBe("en-US");
    act(() => {
      recognition?.onresult?.({
        results: [
          [
            {
              transcript:
                "pickup date November 25, 2026, pickup time 2:30 PM, destination Cryogenic Storage, transport notes keep upright",
            },
          ],
        ],
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByLabelText("Recognized transcript (or type/paste)")).toHaveValue(
      "pickup date November 25, 2026, pickup time 2:30 PM, destination Cryogenic Storage, transport notes keep upright",
    );

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const proposedValues = screen.getByRole("region", { name: "Proposed voice values" });
    expect(within(proposedValues).getByLabelText("Proposed Booking date and time")).toHaveValue(
      "2026-11-25T14:30",
    );
    expect(within(proposedValues).getByLabelText("Proposed Destination")).toHaveValue(
      "Cryogenic Storage",
    );
    expect(within(proposedValues).getByLabelText("Proposed Transport Notes")).toHaveValue(
      "keep upright",
    );
    expect(document.getElementById("demo-field-destination")).toHaveValue("Cryo Transport");
    expect(document.getElementById("demo-additional-notes")).toHaveValue("");

    fireEvent.click(within(proposedValues).getByLabelText("Replace existing value"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(document.getElementById("demo-field-destination")).toHaveValue("Cryogenic Storage");
    expect(document.getElementById("demo-field-bookedAt")).toHaveValue("2026-11-25T14:30");
    expect(document.getElementById("demo-additional-notes")).toHaveValue("keep upright");
    expect(document.getElementById("demo-field-shipmentId")).toHaveValue("DEMO-SHIP-0001");
    expect(document.getElementById("demo-field-sampleId")).toHaveValue("SMP-0001");
    expect(document.getElementById("demo-field-sourceFacility")).toHaveValue("Fertility Centre");
    expect(
      screen.getByText(
        "Selected values were applied to the open form draft. Nothing has been saved or submitted.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const shipmentRow = screen.getByRole("row", { name: /SHP-001 Shipment booking/ });
    expect(within(shipmentRow).getByText("Not Started")).toBeInTheDocument();
  });

  it("allows a typed transcript when browser speech recognition is unavailable", () => {
    render(<SampleTransferDemo />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open CLI-001 Patient registration Document Form",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));

    expect(screen.getByText(/Browser speech recognition is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Recognized transcript (or type/paste)"), {
      target: { value: "Registration date and time November 25, 2026 at 2:30 PM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const proposedValues = screen.getByRole("region", { name: "Proposed voice values" });
    expect(
      within(proposedValues).getByLabelText("Proposed Registration date and time"),
    ).toHaveValue("2026-11-25T14:30");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(document.getElementById("demo-field-registeredAt")).toHaveValue("2026-11-25T14:30");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("offers voice filling for every document form using that form's fields", () => {
    render(<SampleTransferDemo />);

    for (const form of SAMPLE_DOCUMENT_FORMS) {
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(
            `Open ${form.reference} ${form.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} Document Form`,
          ),
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
      const assistant = screen.getByRole("region", {
        name: `Voice assistance for ${form.title}`,
      });
      for (const field of form.fields) {
        expect(assistant.textContent).toContain(field.label);
      }
      fireEvent.click(within(assistant).getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    }
  });

  it("falls back to standard browser recognition after an on-device language error", () => {
    installSpeechRecognition(true);
    render(<SampleTransferDemo />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open SHP-001 Shipment booking Document Form",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(speechRecognitions).toHaveLength(1);
    act(() => speechRecognitions[0]?.onerror?.({ error: "language-not-supported" }));

    expect(speechRecognitions).toHaveLength(2);
    expect(speechRecognitions[1]?.lang).toBe("en-US");
    expect(screen.getByText(/Switched to standard browser recognition/)).toBeInTheDocument();
    expect(screen.getByText(/may process audio online/)).toBeInTheDocument();
  });

  it("lists the three operational entities, named documents, and transfer routes", async () => {
    render(<SampleTransferDemo />);

    const entities = screen.getByRole("region", { name: "Operational entities" });
    expect(within(entities).getByText("Fertility Centre")).toBeInTheDocument();
    expect(within(entities).getByText("Cryo Transport")).toBeInTheDocument();
    expect(within(entities).getByText("Cryogenic Storage")).toBeInTheDocument();
    expect(screen.queryByText(/Al Noor|Cryoport|Fertility Clinic/)).not.toBeInTheDocument();

    const namedDocuments: Array<[string, string]> = [
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
      expect(within(row).getByText("Not Started")).toHaveClass("bg-muted");
    }

    const clinicRow = screen.getByRole("row", { name: /LAB-013/ });
    expect(within(clinicRow).getByText("Fertility Centre")).toBeInTheDocument();
    expect(within(clinicRow).getByText("Fertility Centre → Cryo Transport")).toBeInTheDocument();
    const journey = screen.getByRole("list", {
      name: "Fertility Centre to storage and return journey",
    });
    expect(
      within(journey)
        .getAllByRole("listitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual([
      "Fertility Centre",
      "Cryo Transport",
      "Cryogenic Storage",
      "Patient requests return after several years",
      "Cryo Transport",
      "Fertility Centre",
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
    expect(screen.getAllByText("SHP-016")).toHaveLength(4);
    expect(screen.getAllByText("SHP-017")).toHaveLength(4);

    expect(screen.getByText("Action Required to Complete Transfer")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Some required documents or handover steps are still pending. Complete the outstanding items to finalize this transfer.",
      ),
    ).toBeInTheDocument();
    const outstanding = screen.getByRole("list", {
      name: "Outstanding transfer requirements",
    });
    expect(within(outstanding).getAllByText("Not Started")).toHaveLength(4);
    const outstandingItems = within(outstanding)
      .getAllByRole("listitem")
      .map((item) => item.textContent?.replace(/\s+/g, " ").trim());
    expect(outstandingItems).toHaveLength(4);
    expect(
      outstandingItems.some((item) =>
        item?.includes("SHP-016 · Receiving facility acceptance (outbound)"),
      ),
    ).toBe(true);
    expect(
      outstandingItems.some((item) =>
        item?.includes("SHP-017 · Sample and seal reconciliation (outbound)"),
      ),
    ).toBe(true);
    expect(
      outstandingItems.some((item) =>
        item?.includes("SHP-016 · Receiving facility acceptance — return transfer (return)"),
      ),
    ).toBe(true);
    expect(
      outstandingItems.some((item) =>
        item?.includes("SHP-017 · Sample and seal reconciliation — return transfer (return)"),
      ),
    ).toBe(true);
  });

  it("labels activity event types and retains their stored order and timestamps", async () => {
    const state = createInitialSampleTransferState();
    state.activity = [
      { id: "event-1", message: "Transfer closed", at: "2026-11-20T12:00:00.000Z" },
      {
        id: "event-2",
        message: "CLI-001 Patient registration: Draft saved",
        at: "2026-11-20T11:00:00.000Z",
      },
      {
        id: "event-3",
        message: "Pending action: review the handover",
        at: "2026-11-20T10:00:00.000Z",
      },
      {
        id: "event-4",
        message: "Validation error: required field missing",
        at: "2026-11-20T09:00:00.000Z",
      },
      { id: "event-5", message: "Transfer record opened", at: "2026-11-20T08:00:00.000Z" },
    ];
    window.localStorage.setItem(
      SAMPLE_TRANSFER_STORAGE_KEY,
      JSON.stringify({ version: 2, ...state }),
    );
    render(<SampleTransferDemo />);

    const timeline = await screen.findByRole("list", { name: "Activity History events" });
    const events = within(timeline).getAllByRole("listitem");
    expect(events).toHaveLength(5);
    expect(events.map((event) => event.querySelector("time")?.getAttribute("datetime"))).toEqual([
      "2026-11-20T12:00:00.000Z",
      "2026-11-20T11:00:00.000Z",
      "2026-11-20T10:00:00.000Z",
      "2026-11-20T09:00:00.000Z",
      "2026-11-20T08:00:00.000Z",
    ]);

    const statuses = [
      "Completed",
      "Draft saved",
      "Pending action",
      "Validation error",
      "Information",
    ];
    for (const [index, label] of statuses.entries()) {
      expect(within(events[index]!).getByText(label)).toBeInTheDocument();
    }
    expect(within(events[0]!).getByText("Transfer closed")).toBeInTheDocument();
    expect(
      within(events[1]!).getByText("CLI-001 Patient registration: Draft saved"),
    ).toBeInTheDocument();
    expect(within(events[1]!).getByText("Draft saved")).toHaveClass("bg-amber-50");
    expect(within(events[0]!).getByText("Completed")).toHaveClass("bg-emerald-50");
    expect(within(events[3]!).getByText("Validation error")).toHaveClass("bg-red-50");
    expect(within(events[4]!).getByText("Information")).toHaveClass("bg-muted");
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

    expect(
      await screen.findByText("CLI-001 Patient registration: Draft saved"),
    ).toBeInTheDocument();
    const timeline = screen.getByRole("list", { name: "Activity History events" });
    expect(within(timeline).getByText("Draft saved")).toHaveClass("bg-amber-50");
    const clinicRow = screen.getByRole("row", { name: /CLI-001/ });
    expect(within(clinicRow).getByText("Draft Saved")).toHaveClass("bg-amber-100");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open CLI-001 Patient registration Document Form",
      }),
    );
    expect(screen.getByLabelText("Record Title")).toHaveValue("Registration record 01");
    expect(screen.getByLabelText("Additional Notes")).toHaveValue("Sample metadata notes");
    expect(screen.getByLabelText(/^Patient/)).toHaveValue("Patient 02");
    fireEvent.click(screen.getByRole("button", { name: "Mark as Completed" }));
    expect(
      await screen.findByText("CLI-001 Patient registration: Marked as Completed"),
    ).toBeInTheDocument();
    expect(within(timeline).getByText("Completed")).toHaveClass("bg-emerald-50");
    expect(within(clinicRow).getByText("Done")).toHaveClass("bg-emerald-100");
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
              sourceFacility: "Al Noor Fertility Centre — Abu Dhabi",
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
        "Cryogenic Storage → Cryo Transport",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open CLI-001 Patient registration Document Form",
      }),
    );
    expect(screen.getByLabelText(/^Source Facility/)).toHaveValue("Fertility Centre");
    expect(screen.getByLabelText(/^Destination/)).toHaveValue("Cryo Transport");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open closure checkpoint SHP-016 Receiving facility acceptance Document Form",
      }),
    );
    expect(screen.getByLabelText("Record Title")).toHaveValue("Legacy acceptance draft");
    expect(screen.getByLabelText("Additional Notes")).toHaveValue("Older notes remain preserved");
  });
});
