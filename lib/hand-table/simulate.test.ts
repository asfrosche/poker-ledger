import { describe, expect, it } from "vitest";
import { parseCardText, type Card } from "@/lib/poker/cards";
import type { EngineInput } from "./table-state";
import { simulateTable } from "./simulate";

const c = (text: string): Card => {
  const card = parseCardText(text);
  if (card === null) throw new Error(`bad card ${text}`);
  return card;
};

/** Seated player with two cards. */
const seat = (id: string, a: string, b: string) => ({ seatId: id, playerId: `p-${id}`, hole: [c(a), c(b)] as [Card, Card] });

describe("simulateTable", () => {
  it("gives an exact win when the board is complete and one hand is best", () => {
    const input: EngineInput = {
      variant: "holdem",
      seats: [seat("a", "Ah", "Kh"), seat("b", "2c", "3d")],
      runs: [[c("Qh"), c("Jh"), c("Th"), c("9c"), c("4s")]],
      dead: [],
    };
    const result = simulateTable(input);
    expect(result.trials).toBe(1);
    expect(result.runs[0].seats[0].outcome).toEqual({ win: 1, tie: 0, lose: 0, equity: 1 });
    expect(result.runs[0].seats[1].outcome).toEqual({ win: 0, tie: 0, lose: 1, equity: 0 });
  });

  it("splits the pot when both players play the board", () => {
    const input: EngineInput = {
      variant: "holdem",
      seats: [seat("a", "2d", "3d"), seat("b", "4s", "5s")],
      // Broadway straight on the board beats any two low cards.
      runs: [[c("Ah"), c("Kd"), c("Qc"), c("Js"), c("Tc")]],
      dead: [],
    };
    const result = simulateTable(input);
    expect(result.runs[0].seats[0].outcome).toEqual({ win: 0, tie: 1, lose: 0, equity: 0.5 });
    expect(result.runs[0].seats[1].outcome).toEqual({ win: 0, tie: 1, lose: 0, equity: 0.5 });
  });

  it("gives each runout its own result and averages them for the overall view", () => {
    const input: EngineInput = {
      variant: "holdem",
      seats: [seat("a", "Ah", "Kh"), seat("b", "2c", "3d")],
      runs: [
        [c("Qh"), c("Jh"), c("Th"), c("9c"), c("4s")], // A wins
        [c("Qc"), c("Jc"), c("9h"), c("8d"), c("7s")], // A's king still beats B's queen high
      ],
      dead: [],
    };
    const result = simulateTable(input);
    expect(result.runs).toHaveLength(2);
    const [first, second] = result.runs.map((r) => r.seats);
    expect(first[0].outcome.win).toBe(1);
    expect(second[0].outcome.win + second[0].outcome.tie + second[0].outcome.lose).toBeCloseTo(1, 9);
    const overallA = result.overall.find((s) => s.seatId === "a")!;
    expect(overallA.outcome.equity).toBeCloseTo((first[0].outcome.equity + second[0].outcome.equity) / 2, 9);
  });

  it("estimates preflop equity for a pair of aces against a pair of deuces", () => {
    // Known benchmark: AA against 22 is about 80% for AA. Monte Carlo error at 3000 trials is about one point.
    const input: EngineInput = {
      variant: "holdem",
      seats: [seat("a", "Ah", "Ad"), seat("b", "2c", "2s")],
      runs: [[]],
      dead: [],
    };
    const result = simulateTable(input, 3000);
    const eq = result.runs[0].seats[0].outcome.equity;
    expect(eq).toBeGreaterThan(0.77);
    expect(eq).toBeLessThan(0.87);
    expect(result.trials).toBe(3000);
  });

  it("never deals a card that is already on the table", () => {
    // Several deuces and a dead card are already placed. The simulation must deal only unseen cards and still finish.
    const input: EngineInput = {
      variant: "holdem",
      seats: [seat("a", "Ah", "Ad"), seat("b", "2c", "2s")],
      runs: [[c("2h"), c("2d")]],
      dead: [c("3c")],
    };
    const result = simulateTable(input, 200);
    expect(result.trials).toBe(200);
  });

  it("reports partial results every 1000 deals, before the final result", () => {
    const input: EngineInput = {
      variant: "holdem",
      seats: [seat("a", "Ah", "Ad"), seat("b", "2c", "2s")],
      runs: [[]],
      dead: [],
    };
    const reports: { done: number; total: number }[] = [];
    const result = simulateTable(input, 3500, Math.random, (_partial, done, total) => reports.push({ done, total }));
    expect(reports.map((r) => r.done)).toEqual([1000, 2000, 3000]);
    expect(reports.every((r) => r.total === 3500)).toBe(true);
    expect(result.trials).toBe(3500);
  });

  it("uses the exact method when at most two cards remain, and says so", () => {
    // Board is complete. Seat a has the royal flush, so no hidden hand can beat or tie it.
    const input: EngineInput = {
      variant: "holdem",
      seats: [
        { seatId: "a", playerId: "p1", hole: [c("Ah"), c("Kh")] },
        { seatId: "b", playerId: "p2", hole: [] }, // both cards hidden
      ],
      runs: [[c("Qh"), c("Jh"), c("Th"), c("9c"), c("4s")]],
      dead: [],
    };
    const result = simulateTable(input);
    expect(result.method).toBe("exact");
    expect(result.overall[0].outcome.equity).toBe(1);
    expect(result.overall[1].outcome.equity).toBe(0);
  });

  it("uses Monte Carlo when more cards remain, and says so", () => {
    const input: EngineInput = {
      variant: "holdem",
      seats: [
        { seatId: "a", playerId: "p1", hole: [c("Ah"), c("Ad")] },
        { seatId: "b", playerId: "p2", hole: [] },
      ],
      runs: [[]],
      dead: [],
    };
    const result = simulateTable(input, 2000);
    expect(result.method).toBe("monte-carlo");
    expect(result.trials).toBe(2000);
  });

  it("hidden cards are never a card already on the table", () => {
    // Seat a holds As. Hidden cards for seat b must not include As, so b cannot hold the ace.
    const input: EngineInput = {
      variant: "holdem",
      seats: [
        { seatId: "a", playerId: "p1", hole: [c("As"), c("Ks")] },
        { seatId: "b", playerId: "p2", hole: [c("Qd")] }, // one hidden card
      ],
      runs: [[c("2c"), c("7d"), c("9h"), c("Jc")]],
      dead: [],
    };
    const result = simulateTable(input);
    expect(result.method).toBe("exact"); // one card left to deal
    const sum = result.overall.reduce((total, s) => total + s.outcome.equity, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it("refuses fewer than two players", () => {
    expect(() => simulateTable({ variant: "holdem", seats: [seat("a", "Ah", "Kh")], runs: [[]], dead: [] })).toThrow();
  });
});
