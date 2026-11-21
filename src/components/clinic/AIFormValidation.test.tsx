import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AIFormValidation } from "./AIFormValidation";

describe("AIFormValidation", () => {
  it("shows mocked AI suggestions and applies only an explicit approval", async () => {
    const apply = vi.fn();
    render(
      <AIFormValidation
        formId="SHP-001"
        fields={{ destination: "Cryo Transport" }}
        label=""
        notes=""
        handoff="Fertility Centre → Cryo Transport"
        onApply={apply}
        validator={async () => ({
          enabled: true,
          deterministicIssues: [],
          aiIssues: [
            {
              fieldName: "destination",
              detectedIssue: "Destination may be inconsistent.",
              suggestedCorrection: "Cryogenic Storage",
              explanation: "Synthetic booking context suggests storage.",
              confidence: 0.82,
              manualReviewRequired: false,
            },
          ],
          issues: [],
          message: "AI validation completed.",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Validate with AI" }));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "AI suggested corrections" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply approved corrections" }));
    expect(apply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Approve this correction"));
    fireEvent.click(screen.getByRole("button", { name: "Apply approved corrections" }));
    expect(apply).toHaveBeenCalledWith("destination", "Cryogenic Storage");
  });

  it("blocks protected corrections and preserves manual entry", async () => {
    render(
      <AIFormValidation
        formId="SHP-001"
        fields={{ sampleId: "SMP-0001" }}
        label=""
        notes=""
        handoff="Fertility Centre → Cryo Transport"
        onApply={vi.fn()}
        validator={async () => ({
          enabled: true,
          deterministicIssues: [],
          aiIssues: [
            {
              fieldName: "sampleId",
              detectedIssue: "Sample ID is uncertain.",
              suggestedCorrection: "SMP-9999",
              explanation: "Protected identifier requires manual review.",
              confidence: 0.95,
              manualReviewRequired: true,
            },
          ],
          issues: [],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Validate with AI" }));
    await waitFor(() => expect(screen.getByText(/Manual review required/)).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: "Apply approved corrections" }),
    ).not.toBeInTheDocument();
  });
});
