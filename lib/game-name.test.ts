import { describe, expect, it } from "vitest";
import { defaultGameName, timeOfDayLabel } from "./game-name";

describe("timeOfDayLabel", () => {
  it.each([
    [0, "Night"],
    [5, "Night"],
    [6, "Morning"],
    [11, "Morning"],
    [12, "Afternoon"],
    [14, "Afternoon"],
    [15, "Evening"],
    [17, "Evening"],
    [18, "Night"],
    [23, "Night"],
  ])("hour %i is %s", (hour, expected) => {
    expect(timeOfDayLabel(hour)).toBe(expected);
  });
});

describe("defaultGameName", () => {
  it("combines the weekday and time of day", () => {
    // Monday 16 November 2026, 9:30 local time.
    expect(defaultGameName(new Date(2026, 10, 16, 9, 30))).toBe("Monday Morning Poker");
  });

  it("uses the weekday of the given date", () => {
    // Friday 13 November 2026, 20:00 local time.
    expect(defaultGameName(new Date(2026, 10, 13, 20, 0))).toBe("Friday Night Poker");
  });
});
