import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DemoFormField, DemoFormFieldType } from "@/lib/demo/sample-transfer";

type RecognitionMode = "on-device" | "browser";
type SpeechPart = "pickup-date" | "pickup-time";
type VoiceTargetKind = "field" | "label" | "notes";

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }>;

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

interface SpeechAlias {
  label: string;
  part?: SpeechPart;
}

interface VoiceTarget {
  id: string;
  key: string;
  kind: VoiceTargetKind;
  label: string;
  type: DemoFormFieldType;
  maxLength: number;
  initialValue?: string;
  options?: readonly string[];
  aliases: readonly SpeechAlias[];
}

interface VoiceProposal extends VoiceTarget {
  value: string;
  replaceExisting: boolean;
}

interface VoiceFormUpdates {
  fields: Record<string, string>;
  label?: string;
  notes?: string;
}

interface VoiceFormFillProps {
  fields: readonly DemoFormField[];
  notesLabel: string;
  formTitle: string;
  currentValues: Record<string, string>;
  currentLabel: string;
  currentNotes: string;
  onApply: (updates: VoiceFormUpdates) => void;
}

interface SpeechSession {
  recognition: SpeechRecognitionLike;
  mode: RecognitionMode;
}

interface SpeechMatch {
  start: number;
  end: number;
  target: VoiceTarget;
  part?: SpeechPart;
}

interface ExtractedVoiceValues {
  proposals: VoiceProposal[];
  issues: string[];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_NUMBERS = new Map(
  MONTHS.flatMap((month, index) => [
    [month.toLowerCase(), index + 1] as const,
    [month.slice(0, 3).toLowerCase(), index + 1] as const,
  ]),
);

function getSpeechRecognitionConstructor() {
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function createSpeechSession(mode: RecognitionMode): SpeechSession | null {
  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  if (mode === "on-device") {
    if (!("processLocally" in recognition)) return null;
    recognition.processLocally = true;
    if (!recognition.processLocally) return null;
  } else if ("processLocally" in recognition) {
    recognition.processLocally = false;
  }

  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = true;
  return { recognition, mode };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createTargets(fields: readonly DemoFormField[], notesLabel: string): VoiceTarget[] {
  const fieldTargets = fields.map((field): VoiceTarget => {
    const aliases: SpeechAlias[] = [{ label: field.label }];
    if (field.key === "bookedAt") {
      aliases.push(
        { label: "Pickup date", part: "pickup-date" },
        { label: "Pickup time", part: "pickup-time" },
      );
    }

    return {
      id: `field:${field.key}`,
      key: field.key,
      kind: "field",
      label: field.label,
      type: field.type,
      maxLength: field.type === "textarea" ? 1000 : 200,
      ...(field.initialValue ? { initialValue: field.initialValue } : {}),
      ...(field.options ? { options: field.options } : {}),
      aliases,
    };
  });
  const recordNotesAliases = [
    { label: notesLabel },
    { label: notesLabel === "Transport Notes" ? "Additional Notes" : "Transport Notes" },
  ];

  return [
    ...fieldTargets,
    {
      id: "label",
      key: "label",
      kind: "label",
      label: "Record Title",
      type: "text",
      maxLength: 120,
      aliases: [{ label: "Record Title" }],
    },
    {
      id: "notes",
      key: "notes",
      kind: "notes",
      label: notesLabel,
      type: "textarea",
      maxLength: 1000,
      aliases: recordNotesAliases,
    },
  ];
}

function labelPattern(label: string) {
  const words = label
    .split(/[\s/]+/)
    .filter(Boolean)
    .map(escapeRegExp);
  return words.join("\\s+");
}

function findSpeechMatches(transcript: string, targets: readonly VoiceTarget[]) {
  const matches: SpeechMatch[] = [];
  for (const target of targets) {
    for (const alias of target.aliases) {
      const matcher = new RegExp(
        `\\b${labelPattern(alias.label)}\\b\\s*(?:(?:is|are)\\s+|[:=,]\\s*)?`,
        "gi",
      );
      for (const match of transcript.matchAll(matcher)) {
        const start = match.index ?? 0;
        matches.push({
          start,
          end: start + match[0].length,
          target,
          ...(alias.part ? { part: alias.part } : {}),
        });
      }
    }
  }

  matches.sort(
    (first, second) =>
      first.start - second.start || second.end - second.start - (first.end - first.start),
  );
  const nonOverlapping: SpeechMatch[] = [];
  for (const match of matches) {
    if (nonOverlapping.some((existing) => match.start < existing.end)) continue;
    nonOverlapping.push(match);
  }
  return nonOverlapping;
}

function spokenSection(transcript: string, start: number, end: number) {
  return transcript
    .slice(start, end)
    .trim()
    .replace(/^[,;:\s]+/, "")
    .replace(/^and\s+/i, "")
    .replace(/[,;.!?\s]+$/, "")
    .trim();
}

function normalizeSpokenDate(value: string): string | null {
  const cleanValue = value.replace(/(\d)(st|nd|rd|th)\b/gi, "$1").trim();
  const monthNames = MONTHS.join("|");
  const monthAbbreviations = MONTHS.map((month) => month.slice(0, 3)).join("|");
  const monthFirstMatch = new RegExp(
    `^(${monthNames}|${monthAbbreviations})\\s+(\\d{1,2}),?\\s+(\\d{4})$`,
    "i",
  ).exec(cleanValue);
  const dayFirstMatch = new RegExp(
    `^(\\d{1,2})\\s+(${monthNames}|${monthAbbreviations})\\s+(\\d{4})$`,
    "i",
  ).exec(cleanValue);
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(cleanValue);

  let year: number;
  let month: number;
  let day: number;
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (monthFirstMatch) {
    year = Number(monthFirstMatch[3]);
    month = MONTH_NUMBERS.get(monthFirstMatch[1]!.toLowerCase())!;
    day = Number(monthFirstMatch[2]);
  } else if (dayFirstMatch) {
    year = Number(dayFirstMatch[3]);
    month = MONTH_NUMBERS.get(dayFirstMatch[2]!.toLowerCase())!;
    day = Number(dayFirstMatch[1]);
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function normalizeSpokenTime(value: string): string | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i.exec(
    value.replace(/\./g, "").trim(),
  );
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59 || (meridiem && (hour < 1 || hour > 12)) || hour > 23) return null;
  if (meridiem?.startsWith("p") && hour < 12) hour += 12;
  if (meridiem?.startsWith("a") && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function normalizeSpokenDateTime(value: string): string | null {
  const isoDateTime = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})$/.exec(value.trim());
  if (isoDateTime) {
    const date = normalizeSpokenDate(isoDateTime[1]!);
    const time = normalizeSpokenTime(isoDateTime[2]!);
    return date && time ? `${date}T${time}` : null;
  }

  const spokenDateTime =
    /^(.+?)(?:\s+at\s+|\s+)(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)$/i.exec(value.trim());
  if (!spokenDateTime) return null;
  const date = normalizeSpokenDate(spokenDateTime[1]!);
  const time = normalizeSpokenTime(spokenDateTime[2]!);
  return date && time ? `${date}T${time}` : null;
}

function normalizeVoiceValue(target: VoiceTarget, rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;

  if (target.type === "select") {
    const selectedOption = target.options?.find(
      (option) => option.toLowerCase() === value.toLowerCase(),
    );
    return selectedOption ?? null;
  }
  if (target.type === "datetime-local") return normalizeSpokenDateTime(value);
  return value.length <= target.maxLength ? value : null;
}

function extractVoiceValues(
  transcript: string,
  targets: readonly VoiceTarget[],
): ExtractedVoiceValues {
  const matches = findSpeechMatches(transcript, targets);
  const issues: string[] = [];
  const proposalsById = new Map<string, VoiceProposal>();
  const pickupDateTimes = new Map<string, { date?: string; time?: string }>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const section = spokenSection(
      transcript,
      match.end,
      matches[index + 1]?.start ?? transcript.length,
    );
    if (!section) continue;

    if (match.part) {
      const dateTimes = pickupDateTimes.get(match.target.id) ?? {};
      if (match.part === "pickup-date") {
        const date = normalizeSpokenDate(section);
        if (date) dateTimes.date = date;
        else issues.push("Use a full pickup date, such as November 25, 2026.");
      } else {
        const time = normalizeSpokenTime(section);
        if (time) dateTimes.time = time;
        else issues.push("Use a pickup time such as 14:30 or 2:30 PM.");
      }
      pickupDateTimes.set(match.target.id, dateTimes);
      continue;
    }

    const value = normalizeVoiceValue(match.target, section);
    if (value === null) {
      issues.push(
        match.target.type === "select"
          ? `${match.target.label} must match one of its listed options.`
          : `Could not read a valid value for ${match.target.label}.`,
      );
      continue;
    }
    proposalsById.set(match.target.id, {
      ...match.target,
      value,
      replaceExisting: false,
    });
  }

  for (const target of targets) {
    const pickupDateTime = pickupDateTimes.get(target.id);
    if (!pickupDateTime) continue;
    if (pickupDateTime.date && pickupDateTime.time) {
      proposalsById.set(target.id, {
        ...target,
        value: `${pickupDateTime.date}T${pickupDateTime.time}`,
        replaceExisting: false,
      });
    } else {
      issues.push("Speak both a pickup date and pickup time to fill the booking field.");
    }
  }

  if (matches.length === 0) {
    issues.push(
      "No form fields were recognized. Say a displayed field label followed by its value, or type the transcript.",
    );
  }
  return { proposals: [...proposalsById.values()], issues };
}

function exampleValue(target: VoiceTarget) {
  if (target.type === "datetime-local") return "November 25, 2026 at 2:30 PM";
  if (target.type === "select") return target.options?.[0] ?? "Matched";
  if (target.kind === "notes") return "synthetic demo notes";
  if (target.kind === "label") return "synthetic demo record";
  return target.initialValue || "synthetic demo value";
}

function currentValueForTarget(
  target: VoiceTarget,
  currentValues: Record<string, string>,
  currentLabel: string,
  currentNotes: string,
) {
  if (target.kind === "field") return currentValues[target.key] ?? "";
  if (target.kind === "label") return currentLabel;
  return currentNotes;
}

export function VoiceFormFill({
  fields,
  notesLabel,
  formTitle,
  currentValues,
  currentLabel,
  currentNotes,
  onApply,
}: VoiceFormFillProps) {
  const [open, setOpen] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [mode, setMode] = useState<RecognitionMode | null>(null);
  const [modeMessage, setModeMessage] = useState("");
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<VoiceProposal[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptId = useId();
  const targets = useMemo(() => createTargets(fields, notesLabel), [fields, notesLabel]);
  const example = targets
    .slice(0, 3)
    .map((target) => `${target.label} ${exampleValue(target)}`)
    .join(", ");

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  function openAssistant() {
    setSpeechAvailable(Boolean(getSpeechRecognitionConstructor()));
    setListening(false);
    setTranscript("");
    setMode(null);
    setModeMessage("");
    setRecognitionError(null);
    setProposals([]);
    setIssues([]);
    setApplyMessage(null);
    setApplied(false);
    setOpen(true);
  }

  function startRecognitionSession(session: SpeechSession, message?: string) {
    const recognition = session.recognition;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const recognized = Array.from(event.results, (result) => result[0]?.transcript.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      setTranscript(recognized);
      setProposals([]);
      setIssues([]);
      setApplied(false);
      setApplyMessage(null);
    };
    recognition.onerror = (event) => {
      if (session.mode === "on-device" && event.error === "language-not-supported") {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        startBrowserRecognition(
          "On-device en-US recognition is unavailable. Switched to standard browser recognition, which may process audio online.",
        );
        return;
      }
      setListening(false);
      setRecognitionError(
        event.error === "not-allowed"
          ? "Microphone access was denied. Allow microphone access or type/paste a transcript."
          : `Speech recognition failed (${event.error}). You can type or paste a transcript.`,
      );
    };
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
      setMode(session.mode);
      if (message) {
        setModeMessage(message);
      } else if (session.mode === "on-device") {
        setModeMessage("Using on-device en-US speech recognition.");
      } else {
        setModeMessage(
          "Using standard browser speech recognition; its provider may process audio online.",
        );
      }
      setRecognitionError(null);
    } catch (error) {
      if (session.mode === "on-device") {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        startBrowserRecognition(
          "On-device recognition could not start. Switched to standard browser recognition, which may process audio online.",
        );
        return;
      }
      setListening(false);
      setRecognitionError(
        error instanceof Error
          ? `Could not start browser speech recognition: ${error.message}. Type or paste a transcript instead.`
          : "Could not start browser speech recognition. Type or paste a transcript instead.",
      );
    }
  }

  function startBrowserRecognition(message?: string) {
    let session: SpeechSession | null = null;
    try {
      session = createSpeechSession("browser");
    } catch (error) {
      console.error("Could not initialize browser speech recognition", error);
    }
    if (!session) {
      setListening(false);
      setRecognitionError(
        "Browser speech recognition is unavailable. Type or paste a transcript to review the fields.",
      );
      return;
    }
    setMode("browser");
    startRecognitionSession(
      session,
      message ??
        "On-device recognition is unavailable. Standard browser speech recognition may process audio online.",
    );
  }

  function startVoiceRecognition() {
    setTranscript("");
    setProposals([]);
    setIssues([]);
    setApplyMessage(null);
    setApplied(false);
    setRecognitionError(null);

    let localSession: SpeechSession | null = null;
    try {
      localSession = createSpeechSession("on-device");
    } catch (error) {
      console.error("Could not initialize on-device speech recognition", error);
    }
    if (localSession) {
      startRecognitionSession(localSession);
      return;
    }
    startBrowserRecognition();
  }

  function stopVoiceRecognition() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
      setListening(false);
    } catch (error) {
      setRecognitionError(
        error instanceof Error
          ? `Could not stop speech recognition: ${error.message}`
          : "Could not stop speech recognition.",
      );
    }
  }

  function reviewTranscript() {
    if (!transcript.trim()) return;
    const extracted = extractVoiceValues(transcript, targets);
    setProposals(extracted.proposals);
    setIssues(extracted.issues);
    setApplied(false);
    setApplyMessage(null);
  }

  function updateProposal(
    id: string,
    update: Partial<Pick<VoiceProposal, "value" | "replaceExisting">>,
  ) {
    setProposals((previous) =>
      previous.map((proposal) => (proposal.id === id ? { ...proposal, ...update } : proposal)),
    );
    setApplied(false);
    setApplyMessage(null);
  }

  function hasConflict(proposal: VoiceProposal) {
    const currentValue = currentValueForTarget(proposal, currentValues, currentLabel, currentNotes);
    return Boolean(currentValue.trim() && currentValue !== proposal.value);
  }

  function applyProposals() {
    const updates: VoiceFormUpdates = { fields: {} };
    let appliedCount = 0;
    for (const proposal of proposals) {
      if (hasConflict(proposal) && !proposal.replaceExisting) continue;
      if (proposal.kind === "field") updates.fields[proposal.key] = proposal.value;
      if (proposal.kind === "label") updates.label = proposal.value;
      if (proposal.kind === "notes") updates.notes = proposal.value;
      appliedCount += 1;
    }
    if (appliedCount === 0) {
      setApplyMessage(
        "Existing values were kept. Confirm replacement for any value you want to overwrite.",
      );
      return;
    }
    onApply(updates);
    setApplied(true);
    setApplyMessage(
      "Selected values were applied to the open form draft. Nothing has been saved or submitted.",
    );
  }

  function cancelAssistant() {
    const recognition = recognitionRef.current;
    if (recognition && listening) {
      try {
        recognition.abort();
      } catch (error) {
        console.error("Could not cancel browser speech recognition", error);
        setRecognitionError(
          "Could not cancel speech recognition. Use Stop before closing this panel.",
        );
        return;
      }
    }
    recognitionRef.current = null;
    setListening(false);
    setOpen(false);
    setTranscript("");
    setMode(null);
    setModeMessage("");
    setRecognitionError(null);
    setProposals([]);
    setIssues([]);
    setApplyMessage(null);
    setApplied(false);
  }

  function handleTranscriptChange(value: string) {
    setTranscript(value);
    setProposals([]);
    setIssues([]);
    setApplyMessage(null);
    setApplied(false);
  }

  const canApply = proposals.some((proposal) => !hasConflict(proposal) || proposal.replaceExisting);

  return (
    <section
      aria-label="Voice-assisted form filling"
      className="space-y-3 rounded-xl border border-border p-4"
    >
      {!open ? (
        <Button type="button" variant="outline" className="rounded-full" onClick={openAssistant}>
          <Mic aria-hidden="true" />
          Fill by Voice
        </Button>
      ) : (
        <div role="region" aria-label={`Voice assistance for ${formTitle}`} className="space-y-4">
          <div>
            <h3 className="font-medium">Voice-assisted form filling</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Say a displayed field label followed by its value. Example for {formTitle}: “{example}
              ”.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              On-device en-US recognition is attempted first. Standard browser recognition may send
              audio to an online service. Use synthetic demo data only; do not speak patient
              information.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Supported fields: {targets.map((target) => target.label).join(", ")}.
            </p>
          </div>
          {!speechAvailable && (
            <p role="status" className="text-sm text-muted-foreground">
              Browser speech recognition is unavailable. Type or paste a transcript to review the
              fields.
            </p>
          )}
          {modeMessage && (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {listening ? "Listening. Press Stop when finished. " : ""}
              {modeMessage}
            </p>
          )}
          {recognitionError && (
            <p role="alert" className="text-sm text-destructive">
              {recognitionError}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor={transcriptId}>Recognized transcript (or type/paste)</Label>
            <Textarea
              id={transcriptId}
              rows={3}
              maxLength={4000}
              value={transcript}
              onChange={(event) => handleTranscriptChange(event.target.value)}
              placeholder="Recognized words or a pasted transcript will appear here."
            />
          </div>
          {proposals.length > 0 && (
            <div
              role="region"
              aria-label="Proposed voice values"
              className="space-y-3 rounded-lg bg-secondary/60 p-3"
            >
              <h4 className="text-sm font-medium">Review proposed values</h4>
              <div className="space-y-3">
                {proposals.map((proposal) => {
                  const inputId = `${transcriptId}-${proposal.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                  const currentValue = currentValueForTarget(
                    proposal,
                    currentValues,
                    currentLabel,
                    currentNotes,
                  );
                  const conflict = hasConflict(proposal);
                  return (
                    <div
                      key={proposal.id}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={inputId}>{proposal.label}</Label>
                        {proposal.type === "select" ? (
                          <select
                            id={inputId}
                            aria-label={`Proposed ${proposal.label}`}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={proposal.value}
                            onChange={(event) =>
                              updateProposal(proposal.id, { value: event.target.value })
                            }
                          >
                            {proposal.options?.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : proposal.type === "textarea" ? (
                          <Textarea
                            id={inputId}
                            aria-label={`Proposed ${proposal.label}`}
                            maxLength={proposal.maxLength}
                            rows={2}
                            value={proposal.value}
                            onChange={(event) =>
                              updateProposal(proposal.id, { value: event.target.value })
                            }
                          />
                        ) : (
                          <Input
                            id={inputId}
                            aria-label={`Proposed ${proposal.label}`}
                            type={proposal.type}
                            maxLength={proposal.maxLength}
                            value={proposal.value}
                            onChange={(event) =>
                              updateProposal(proposal.id, { value: event.target.value })
                            }
                          />
                        )}
                      </div>
                      {currentValue && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Current value: {currentValue}
                        </p>
                      )}
                      {conflict && (
                        <div className="mt-3 flex items-center gap-2">
                          <Checkbox
                            id={`${inputId}-replace`}
                            checked={proposal.replaceExisting}
                            onCheckedChange={(checked) =>
                              updateProposal(proposal.id, { replaceExisting: checked === true })
                            }
                          />
                          <Label htmlFor={`${inputId}-replace`} className="text-xs">
                            Replace existing value
                          </Label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {issues.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {applyMessage && (
            <p role="status" className="text-sm text-muted-foreground">
              {applyMessage}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={!speechAvailable || listening}
              onClick={startVoiceRecognition}
            >
              <Mic aria-hidden="true" />
              Start
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={!listening}
              onClick={stopVoiceRecognition}
            >
              <MicOff aria-hidden="true" />
              Stop
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={!transcript.trim() || listening}
              onClick={reviewTranscript}
            >
              Review
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={!canApply || applied}
              onClick={applyProposals}
            >
              Apply
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={cancelAssistant}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
