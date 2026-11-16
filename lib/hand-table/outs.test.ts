import { describe, expect, it } from "vitest";
import { parseCardText, type Card } from "@/lib/poker/cards";
import type { EngineInput } from "./table-state";
import { computeOuts, outsForSeats, playerBehind } from "./outs";
import type { SeatEquity } from "./equity";

const c = (text: string): Card => {
  const card = parseCardText(text);
  if (card === null) throw new Error(`bad card ${text}`);
  return card;
};

describe("computeOuts", () => {
  it("finds the cards that give an open-ended straight draw the lead over a pair", () => {
    // Hero 8h 5c has an open-ended straight draw on 2d 6h 7h. Villain Ad Ac has a pair of aces.
    // Any 4 or 9 completes hero's straight (4-8 or 5-9), which beats a pair. Nothing else does.
    const input: EngineInput = {
      variant: "holdem",
      seats: [
        { seatId: "hero", playerId: "p1", hole: [c("8h"), c("5c")] },
        { seatId: "villain", playerId: "p2", hole: [c("Ad"), c("Ac")] },
      ],
      runs: [[c("2d"), c("6h"), c("7h")]],
      dead: [],
    };
    const outs = (computeOuts(input, 0, 0) ?? []).slice().sort((a, b) => a - b);
    const expected = ["4c", "4d", "4h", "4s", "9c", "9d", "9h", "9s"].map(c).sort((a, b) => a - b);
    expect(outs).toEqual(expected);
  });

  it("returns null preflop and on a complete board", () => {
    const preflop: EngineInput = {
      variant: "holdem",
      seats: [
        { seatId: "a", playerId: "p1", hole: [c("Ah"), c("Kh")] },
        { seatId: "b", playerId: "p2", hole: [c("2c"), c("3d")] },
      ],
      runs: [[]],
      dead: [],
    };
    expect(computeOuts(preflop, 0, 0)).toBeNull();

    const river = { ...preflop, runs: [[c("Qh"), c("Jh"), c("Th"), c("9c"), c("4s")]] };
    expect(computeOuts(river, 0, 0)).toBeNull();
  });

  it("excludes cards already on the table, including other runs", () => {
    const input: EngineInput = {
      variant: "holdem",
      seats: [
        { seatId: "hero", playerId: "p1", hole: [c("7s"), c("2h")] },
        { seatId: "villain", playerId: "p2", hole: [c("9s"), c("9d")] },
      ],
      runs: [
        [c("2d"), c("7c"), c("9h")],
        [c("2d"), c("7c"), c("9h")],
      ],
      dead: [c("7h")],
    };
    const outs = computeOuts(input, 0, 0) ?? [];
    expect(outs).not.toContain(c("7h"));
    expect(outs).not.toContain(c("2d"));
  });
});

describe("outsForSeats", () => {
  it("gives each seat its own outs on the same board", () => {
    // Same spot as the straight-draw test. Villain's pair of aces has two outs: the remaining aces make trips.
    const input: EngineInput = {
      variant: "holdem",
      seats: [
        { seatId: "hero", playerId: "p1", hole: [c("8h"), c("5c")] },
        { seatId: "villain", playerId: "p2", hole: [c("Ad"), c("Ac")] },
      ],
      runs: [[c("2d"), c("6h"), c("7h")]],
      dead: [],
    };
    const result = outsForSeats(input);
    expect(result.hero).toEqual([{ run: 0, ahead: false, cards: expect.any(Array) }]);
    expect(result.hero[0].cards).toHaveLength(8);
    // Villain is already ahead with the pair, so no outs are listed for them.
    expect(result.villain).toEqual([{ run: 0, ahead: true, cards: [] }]);
  });

  it("returns no entries preflop", () => {
    const input: EngineInput = {
      variant: "holdem",
      seats: [
        { seatId: "a", playerId: "p1", hole: [c("Ah"), c("Kh")] },
        { seatId: "b", playerId: "p2", hole: [c("2c"), c("3d")] },
      ],
      runs: [[]],
      dead: [],
    };
    expect(outsForSeats(input)).toEqual({ a: [], b: [] });
  });
});

describe("playerBehind", () => {
  it("picks the lowest equity seat", () => {
    const overall: SeatEquity[] = [
      { seatId: "a", outcome: { win: 0.6, tie: 0, lose: 0.4, equity: 0.6 } },
      { seatId: "b", outcome: { win: 0.4, tie: 0, lose: 0.6, equity: 0.4 } },
    ];
    expect(playerBehind(overall)).toBe("b");
    expect(playerBehind([])).toBeNull();
  });
});
