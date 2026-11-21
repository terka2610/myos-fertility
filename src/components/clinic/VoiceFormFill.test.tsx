import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getFormDefinition } from "@/lib/demo/ai-form-validation";
import { VoiceFormFill, type VoiceFormUpdates } from "./VoiceFormFill";

describe("VoiceFormFill Groq extraction", () => {
  it("merges actual CON-004 suggestions for the browser transcript", async () => {
    render(
      <VoiceFormFill
        formId="CON-004"
        fields={[
          {
            key: "consentVersion",
            label: "Consent Version",
            type: "text",
            required: true,
            placeholder: "Version reference",
          },
          {
            key: "recordedAt",
            label: "Record Date",
            type: "date",
            required: true,
          },
        ]}
        notesLabel="Additional Notes"
        formTitle="Storage consent"
        currentValues={{ consentVersion: "", recordedAt: "" }}
        currentLabel=""
        currentNotes=""
        onApply={() => {}}
        extractor={async () => ({
          enabled: true,
          suggestions: [
            { fieldId: "Record Date", value: "2026-11-21", confidence: 0.96 },
            { fieldId: "Additional NERS", value: "shipped today", confidence: 0.91 },
          ],
          message: "AI suggestions are ready for review.",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
    fireEvent.change(screen.getByLabelText("Recognized transcript (or type/paste)"), {
      target: {
        value: "Record date is 21st November, additional NERS shipped today",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() =>
      expect(screen.getByText("AI suggestions are ready for review.")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Proposed Record Date")).toHaveValue("2026-11-21");
    expect(screen.getByLabelText("Proposed Additional Notes")).toHaveValue("shipped today");
  });

  it("applies AI field assignments instead of greedy keyword captures for natural speech", async () => {
    const form = getFormDefinition("CON-004")!;
    let applied: VoiceFormUpdates | null = null;
    render(
      <VoiceFormFill
        formId="CON-004"
        fields={form.fields}
        notesLabel="Additional Notes"
        formTitle={form.title}
        currentValues={{ staffMember: "", recordedAt: "" }}
        currentLabel=""
        currentNotes=""
        onApply={(updates) => {
          applied = updates;
        }}
        extractor={async () => ({
          enabled: true,
          suggestions: [
            { fieldId: "staffMember", value: "Staff 02", confidence: 0.95 },
            { fieldId: "recordedAt", value: "2026-11-21", confidence: 0.95 },
            { fieldId: "notes", value: "shipped today", confidence: 0.9 },
          ],
          message: "AI suggestions are ready for review.",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
    fireEvent.change(screen.getByLabelText("Recognized transcript (or type/paste)"), {
      target: {
        value:
          "Staff member is staff two and it is going to storage, record date is 21st November, notes shipped today",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Proposed Staff Member")).toHaveValue("Staff 02"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(applied).toEqual({
      fields: { staffMember: "Staff 02", recordedAt: "2026-11-21" },
      notes: "shipped today",
    });
  });

  it("falls back to keyword matches when AI is unavailable", async () => {
    const form = getFormDefinition("CON-004")!;
    render(
      <VoiceFormFill
        formId="CON-004"
        fields={form.fields}
        notesLabel="Additional Notes"
        formTitle={form.title}
        currentValues={{}}
        currentLabel=""
        currentNotes=""
        onApply={() => {}}
        extractor={async () => {
          throw new Error("network");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
    fireEvent.change(screen.getByLabelText("Recognized transcript (or type/paste)"), {
      target: { value: "Record date is 21st November" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() =>
      expect(screen.getByText(/AI field extraction is unavailable/)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Proposed Record Date")).toHaveValue("2026-11-21");
  });
  it("fills a spoken date into a date-and-time field and asks for the time before applying", async () => {
    const form = getFormDefinition("SHP-016")!;
    let applied: VoiceFormUpdates | null = null;
    render(
      <VoiceFormFill
        formId="SHP-016"
        fields={form.fields}
        notesLabel="Additional Notes"
        formTitle={form.title}
        currentValues={{ acceptedAt: "" }}
        currentLabel=""
        currentNotes=""
        onApply={(updates) => {
          applied = updates;
        }}
        extractor={async () => ({
          enabled: true,
          suggestions: [
            { fieldId: "acceptedAt", value: "2026-11-21", confidence: 0.95 },
            { fieldId: "notes", value: "safe cryo", confidence: 0.9 },
          ],
          message: "AI suggestions are ready for review.",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
    fireEvent.change(screen.getByLabelText("Recognized transcript (or type/paste)"), {
      target: { value: "Record date is 21st November, additional notes safe cryo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    const dateLabel = "Proposed Acceptance record date and time date";
    await waitFor(() => expect(screen.getByLabelText(dateLabel)).toHaveValue("2026-11-21"));
    expect(screen.getByText(/Date heard, but no time/)).toBeInTheDocument();
    // A missing time does not block the other values.
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(applied).toEqual({ fields: {}, notes: "safe cryo" });
    expect(screen.getByText(/Add a time for Acceptance record date and time/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Proposed Acceptance record date and time time"), {
      target: { value: "14:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(applied).toEqual({ fields: { acceptedAt: "2026-11-21T14:30" }, notes: "safe cryo" });
  });
  it("lists fields that are still empty and offers one-click suggestions", async () => {
    const form = getFormDefinition("CON-004")!;
    let applied: VoiceFormUpdates | null = null;
    render(
      <VoiceFormFill
        formId="CON-004"
        fields={form.fields}
        notesLabel="Additional Notes"
        formTitle={form.title}
        currentValues={Object.fromEntries(
          form.fields.map((field) => [field.key, field.initialValue ?? ""]),
        )}
        currentLabel=""
        currentNotes=""
        onApply={(updates) => {
          applied = updates;
        }}
        extractor={async () => ({
          enabled: true,
          suggestions: [{ fieldId: "recordedAt", value: "2026-11-21", confidence: 0.95 }],
          message: "AI suggestions are ready for review.",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
    fireEvent.change(screen.getByLabelText("Recognized transcript (or type/paste)"), {
      target: { value: "record date is 21st November" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    const notice = await screen.findByRole("status", { name: "Fields still empty" });
    expect(notice).toHaveTextContent("Record Title");
    expect(notice).toHaveTextContent("Say them and review again");
    expect(notice).toHaveTextContent("Consent Version. Type these in the form");
    expect(notice).not.toHaveTextContent("Record Date");
    expect(notice).not.toHaveTextContent("Staff Member");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Use suggestion for Record Title: Storage consent — SMP-0001",
      }),
    );
    expect(screen.getByLabelText("Proposed Record Title")).toHaveValue(
      "Storage consent — SMP-0001",
    );
    expect(screen.queryByRole("status", { name: "Fields still empty" })).toHaveTextContent(
      "Consent Version",
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(applied).toEqual({
      fields: { recordedAt: "2026-11-21" },
      label: "Storage consent — SMP-0001",
    });
  });
});

describe("VoiceFormFill server transcription", () => {
  it("records audio, transcribes it on the server and reviews the fields", async () => {
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = "inactive";
      mimeType = "audio/webm";
      stream: { getTracks: () => { stop: () => void }[] };
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(stream: FakeRecorder["stream"]) {
        this.stream = stream;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
        this.onstop?.();
      }
    }
    const stream = { getTracks: () => [{ stop: () => {} }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder;

    let sentType = "";
    try {
      render(
        <VoiceFormFill
          formId="CON-004"
          fields={getFormDefinition("CON-004")!.fields}
          notesLabel="Additional Notes"
          formTitle="Storage consent"
          currentValues={{ recordedAt: "" }}
          currentLabel=""
          currentNotes=""
          onApply={() => {}}
          transcriber={async (input) => {
            sentType = input.mimeType;
            return { ok: true, text: "record date is 21st November", provider: "groq" };
          }}
          extractor={async () => ({
            enabled: true,
            suggestions: [{ fieldId: "recordedAt", value: "2026-11-21", confidence: 0.95 }],
            message: "AI suggestions are ready for review.",
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Fill by Voice" }));
      fireEvent.click(screen.getByRole("button", { name: "Start" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "Stop" }));

      await waitFor(() =>
        expect(screen.getByLabelText("Recognized transcript (or type/paste)")).toHaveValue(
          "record date is 21st November",
        ),
      );
      expect(sentType).toBe("audio/webm");
      expect(screen.getByText(/Transcribed by Groq Whisper/)).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByLabelText("Proposed Record Date")).toHaveValue("2026-11-21"),
      );
    } finally {
      delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
      delete (navigator as { mediaDevices?: unknown }).mediaDevices;
    }
  });
});
