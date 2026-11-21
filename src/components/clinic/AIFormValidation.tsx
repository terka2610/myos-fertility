import { useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { validateFormWithAI } from "@/lib/demo/ai-form-validation.functions";
import type { AIValidationResult } from "@/lib/demo/ai-form-validation";

export type AIFormApply = (fieldKey: string, correction: string) => void;

interface Props {
  formId: string;
  fields: Record<string, string>;
  label: string;
  notes: string;
  handoff: string;
  onApply: AIFormApply;
  validator?: (input: {
    formId: string;
    fields: Record<string, string>;
    label: string;
    notes: string;
    handoff: string;
  }) => Promise<AIValidationResult>;
}

export function AIFormValidation({
  formId,
  fields,
  label,
  notes,
  handoff,
  onApply,
  validator,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIValidationResult | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  async function validate() {
    setLoading(true);
    setResult(null);
    setApproved({});
    try {
      const runValidator = validator ?? ((input) => validateFormWithAI({ data: input }));
      setResult(await runValidator({ formId, fields, label, notes, handoff }));
    } catch (error) {
      console.error("Could not validate form", error);
      setResult({
        enabled: false,
        issues: [],
        deterministicIssues: [],
        aiIssues: [],
        message: "AI validation is unavailable. Your manual form entry has been preserved.",
      });
    } finally {
      setLoading(false);
    }
  }

  function applyApproved() {
    if (!result) return;
    for (const issue of result.aiIssues) {
      const key = `${issue.fieldName}:${issue.detectedIssue}`;
      if (
        approved[key] &&
        issue.suggestedCorrection &&
        !issue.manualReviewRequired &&
        issue.confidence >= 0.7
      ) {
        onApply(issue.fieldName, issue.suggestedCorrection);
      }
    }
  }

  return (
    <section
      aria-label="AI-assisted form validation"
      className="space-y-3 rounded-xl border border-border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-medium">
            <Sparkles aria-hidden="true" className="size-4" />
            AI-assisted validation
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Supplementary only. Required fields, dates, identifiers and permitted values remain
            deterministically enforced.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={validate}
          disabled={loading}
        >
          {loading ? "Validating…" : "Validate with AI"}
        </Button>
      </div>

      {result?.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {result.message}
        </p>
      )}

      {(result?.deterministicIssues?.length ?? 0) > 0 && (
        <div role="alert" className="space-y-2 rounded-lg bg-destructive/10 p-3">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle aria-hidden="true" className="size-4" />
            Deterministic validation
          </h4>
          <ul className="space-y-1 text-xs">
            {result!.deterministicIssues.map((issue) => (
              <li key={`${issue.fieldName}:${issue.detectedIssue}`}>
                {issue.fieldName}: {issue.detectedIssue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(result?.aiIssues?.length ?? 0) > 0 && (
        <div
          role="region"
          aria-label="AI suggested corrections"
          className="space-y-3 rounded-lg bg-secondary/60 p-3"
        >
          <h4 className="text-sm font-medium">Review AI suggestions</h4>
          {result!.aiIssues.map((issue) => {
            const key = `${issue.fieldName}:${issue.detectedIssue}`;
            const blocked =
              issue.manualReviewRequired || !issue.suggestedCorrection || issue.confidence < 0.7;
            return (
              <div key={key} className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium">{issue.fieldName}</p>
                <p className="mt-1 text-xs">{issue.detectedIssue}</p>
                <p className="mt-1 text-xs text-muted-foreground">{issue.explanation}</p>
                {issue.suggestedCorrection && (
                  <p className="mt-2 text-xs">
                    Suggested correction: <strong>{issue.suggestedCorrection}</strong>
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Confidence: {Math.round(issue.confidence * 100)}%
                </p>
                {blocked ? (
                  <p
                    role="status"
                    className="mt-2 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200"
                  >
                    <AlertTriangle aria-hidden="true" className="size-3" />
                    Manual review required; this value cannot be applied automatically.
                  </p>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <Checkbox
                      id={`approve-${key}`}
                      checked={Boolean(approved[key])}
                      onCheckedChange={(checked) =>
                        setApproved((previous) => ({ ...previous, [key]: checked === true }))
                      }
                    />
                    <Label htmlFor={`approve-${key}`} className="text-xs">
                      Approve this correction
                    </Label>
                  </div>
                )}
              </div>
            );
          })}
          {result!.aiIssues.some(
            (issue) =>
              !issue.manualReviewRequired && issue.suggestedCorrection && issue.confidence >= 0.7,
          ) && (
            <Button type="button" size="sm" className="rounded-full" onClick={applyApproved}>
              <CheckCircle2 aria-hidden="true" />
              Apply approved corrections
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
