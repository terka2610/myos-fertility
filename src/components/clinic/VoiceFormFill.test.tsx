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
});
