import { describe, expect, it } from "vitest";
import { parseCardText, type Card } from "@/lib/poker/cards";
import { evaluateBest, evaluateOmaha, handCategoryName } from "@/lib/poker/evaluate";
import { equityStatus } from "./equity";
import { simulateTable } from "./simulate";
import { addSeat, createTableState, placeCard, selectTarget, setVariant, toEngineInput } from "./table-state";

const c = (text: string): Card => {
  const card = parseCardText(text);
  if (card === null) throw new Error(`bad card ${text}`);
  return card;
};
const cards = (...texts: string[]) => texts.map(c);

describe("evaluateOmaha", () => {
  it("must use exactly two hole cards: a board flush is not enough on its own", () => {
    // Board is a royal flush in hearts. Hold'em plays the board. Omaha needs two hole cards in the hand,
    // so the best Omaha hand is a flush using 2h 3h plus three board hearts.
    const hole = cards("2h", "3h", "4d", "5d");
    const board = cards("Ah", "Kh", "Qh", "Jh", "Th");
    expect(handCategoryName(evaluateBest(board))).toBe("Straight flush");
    const omaha = evaluateOmaha(hole, board);
    expect(handCategoryName(omaha)).toBe("Flush");
    expect(omaha).toBeLessThan(evaluateBest(board));
  });

  it("finds a straight flush that uses exactly two hole cards and three board cards", () => {
    const hole = cards("As", "Ks", "2d", "3c");
    const board = cards("Qs", "Js", "Ts", "4h", "5d");
    expect(handCategoryName(evaluateOmaha(hole, board))).toBe("Straight flush");
  });

  it("needs four hole cards and at least three board cards", () => {
    expect(() => evaluateOmaha(cards("As", "Ks"), cards("Qs", "Js", "Ts"))).toThrow();
    expect(() => evaluateOmaha(cards("As", "Ks", "2d", "3c"), cards("Qs", "Js"))).toThrow();
  });
});

describe("variants on the table", () => {
  it("switching to Texas Hold'em clears the third and fourth hole cards", () => {
    let s = createTableState("omaha");
    s = addSeat(addSeat(s, "a", "p1"), "b", "p2");
    s = selectTarget(s, { kind: "hole", seatId: "a", index: 0 });
    s = placeCard(s, c("As"));
    s = placeCard(s, c("Ks"));
    s = placeCard(s, c("Qd"));
    s = placeCard(s, c("Jd"));
    const holdem = setVariant(s, "holdem");
    expect(holdem.seats[0].hole).toEqual([c("As"), c("Ks"), null, null]);
    expect(holdem.variant).toBe("holdem");
  });

  it("switching to Omaha keeps the cards already dealt", () => {
    let s = createTableState("holdem");
    s = addSeat(addSeat(s, "a", "p1"), "b", "p2");
    s = selectTarget(s, { kind: "hole", seatId: "a", index: 0 });
    s = placeCard(s, c("As"));
    s = placeCard(s, c("Ks"));
    const omaha = setVariant(s, "omaha");
    expect(omaha.seats[0].hole.slice(0, 2)).toEqual([c("As"), c("Ks")]);
    // Third and fourth cards are hidden, so the calculation can still run.
    expect(equityStatus(omaha).kind).toBe("ready");
  });

  it("Omaha seats with fewer than four known cards still build engine input, with the rest hidden", () => {
    let s = setVariant(createTableState("holdem"), "omaha");
    s = addSeat(addSeat(s, "a", "p1"), "b", "p2");
    expect(toEngineInput(s)?.seats.map((x) => x.hole)).toEqual([[], []]);
  });
});

describe("Omaha simulation", () => {
  it("gives win, tie, lose and equity that add up, using the Omaha rules", () => {
    const input = {
      variant: "omaha" as const,
      seats: [
        { seatId: "a", playerId: "p1", hole: cards("As", "Ks", "Qd", "Jd") },
        { seatId: "b", playerId: "p2", hole: cards("2c", "3c", "4h", "5h") },
      ],
      runs: [[]],
      dead: [],
    };
    const result = simulateTable(input, 2000);
    for (const seat of result.runs[0].seats) {
      const o = seat.outcome;
      expect(o.win + o.tie + o.lose).toBeCloseTo(1, 9);
    }
    // Ace-high suited broadway-style hand against a low hand: the first seat should be a clear favourite.
    expect(result.overall[0].outcome.equity).toBeGreaterThan(0.5);
  });
});
