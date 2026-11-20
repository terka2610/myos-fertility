import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatSampleTimestamp, SampleRegistryTable } from "./SampleRegistryTable";
import { SYNTHETIC_SAMPLE_RECORDS } from "@/lib/samples/fixtures";

describe("SampleRegistryTable", () => {
  it("displays the synthetic record and all six registry fields", () => {
    render(<SampleRegistryTable samples={SYNTHETIC_SAMPLE_RECORDS} />);

    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Sample display ID",
      "Patient",
      "Sample type",
      "Current state",
      "Storage site",
      "Latest event timestamp",
    ]);
    expect(within(table).getByText("SMP-0001")).toBeInTheDocument();
    expect(within(table).getByText("Fictional demo patient")).toBeInTheDocument();
    expect(within(table).getByText("Oocyte")).toBeInTheDocument();
    expect(within(table).getByText("Returned to Clinic A")).toBeInTheDocument();
    expect(within(table).getByText("Synthetic cryogenic storage site")).toBeInTheDocument();
    expect(
      within(table).getByText("Nov 20, 2026, 12:30 PM GST (UTC+4)"),
    ).toBeInTheDocument();
    expect(table.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-11-20T08:30:00.000Z",
    );
  });

  it("formats timestamps in Asia/Dubai across a date boundary", () => {
    expect(formatSampleTimestamp("2026-11-20T22:30:00Z")).toEqual({
      text: "Nov 21, 2026, 2:30 AM GST (UTC+4)",
      dateTime: "2026-11-20T22:30:00Z",
    });
  });

  it("handles missing and invalid timestamps", () => {
    expect(formatSampleTimestamp(undefined)).toEqual({ text: "Timestamp unavailable" });
    expect(formatSampleTimestamp("not-a-timestamp")).toEqual({ text: "Invalid timestamp" });
    expect(formatSampleTimestamp("2026-02-31T08:30:00Z")).toEqual({
      text: "Invalid timestamp",
    });
  });
});
