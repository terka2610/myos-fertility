import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JourneyRouteReplay } from "./JourneyRouteReplay";
import { SYNTHETIC_JOURNEY_CALENDARS } from "@/lib/samples/fixtures";

describe("JourneyRouteReplay", () => {
  it("renders a clearly labeled simulated replay with route controls", () => {
    const journey = SYNTHETIC_JOURNEY_CALENDARS[0]!;
    render(
      <JourneyRouteReplay
        points={journey.routePoints}
        completedMilestones={1}
        sampleId="SMP-0001"
        connected={false}
      />,
    );

    expect(screen.getAllByText("Simulated data").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("img", { name: "Simulated route map for SMP-0001" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("supports all three synthetic sample IDs", () => {
    expect(SYNTHETIC_JOURNEY_CALENDARS.map((journey) => journey.sampleId)).toEqual([
      "SMP-0001",
      "SMP-0002",
      "SMP-0003",
    ]);
  });
});
