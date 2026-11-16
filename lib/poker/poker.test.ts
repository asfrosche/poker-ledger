import { describe, expect, it } from "vitest";
import { Card, makeCard, parseCardText } from "./cards";
import { evaluateBest, handCategoryName } from "./evaluate";
import { estimateEquity } from "./equity";
import { potOdds } from "./pot-odds";

// Helper: "Ah" -> card index. Suits: c, d, h, s.
const c = (text: string): Card => {
  const card = parseCardText(text);
  if (card === null) throw new Error(`bad card ${text}`);
  return card;
};
const hand = (...texts: string[]) => texts.map(c);

describe("evaluateBest", () => {
  it("ranks the nine hand categories in order", () => {
    const hands = [
      hand("2c", "5d", "9h", "Js", "Kc"), // high card
      hand("2c", "2d", "9h", "Js", "Kc"), // pair
      hand("2c", "2d", "9h", "9s", "Kc"), // two pair
      hand("2c", "2d", "2h", "9s", "Kc"), // trips
      hand("5c", "6d", "7h", "8s", "9c"), // straight
      hand("2c", "5c", "9c", "Jc", "Kc"), // flush
      hand("2c", "2d", "2h", "9s", "9c"), // full house
      hand("2c", "2d", "2h", "2s", "Kc"), // quads
      hand("5c", "6c", "7c", "8c", "9c"), // straight flush
    ].map((h) => evaluateBest(h));
    for (let i = 1; i < hands.length; i++) expect(hands[i]).toBeGreaterThan(hands[i - 1]);
  });

  it("names the categories", () => {
    expect(handCategoryName(evaluateBest(hand("Ah", "Ad", "Kc", "Ks", "2d")))).toBe("Two pair");
    expect(handCategoryName(evaluateBest(hand("Ah", "2d", "3c", "4s", "5d")))).toBe("Straight");
  });

  it("treats the wheel as the lowest straight", () => {
    const wheel = evaluateBest(hand("Ah", "2d", "3c", "4s", "5d"));
    const six = evaluateBest(hand("2h", "3d", "4c", "5s", "6d"));
    expect(wheel).toBeLessThan(six);
    expect(wheel).toBeGreaterThan(evaluateBest(hand("Ah", "2d", "3c", "4s", "Kd")));
  });

  it("does not count A-K-Q-J-T broken by a gap as a straight", () => {
    expect(handCategoryName(evaluateBest(hand("Ah", "Kd", "Qc", "Js", "9d")))).toBe("High card");
  });

  it("breaks ties by kickers", () => {
    const pairAcesKingKicker = evaluateBest(hand("Ah", "Ad", "Kc", "7s", "3d"));
    const pairAcesQueenKicker = evaluateBest(hand("Ah", "Ad", "Qc", "7s", "3d"));
    expect(pairAcesKingKicker).toBeGreaterThan(pairAcesQueenKicker);
  });

  it("finds the best five out of seven", () => {
    // Board pairs the nine; hero has trips of nines via hole card.
    const score = evaluateBest(hand("9h", "9d", "9c", "Kc", "2d", "7s", "3h"));
    expect(handCategoryName(score)).toBe("Three of a kind");
  });

  it("rejects hands that are not 5 to 7 cards", () => {
    expect(() => evaluateBest(hand("Ah", "Kd", "Qc", "Js"))).toThrow();
  });
});

describe("estimateEquity", () => {
  it("returns exact-looking results on the river with a fixed rng", () => {
    // Hero holds the nut straight flush on a dry board: it should win every time.
    const result = estimateEquity({
      hole: hand("Ah", "Kh"),
      board: hand("Qh", "Jh", "Th"),
      opponents: 1,
      trials: 500,
      rng: () => 0.5,
    });
    expect(result.equity).toBeGreaterThan(0.99);
    expect(result.win + result.tie + result.lose).toBeCloseTo(1, 9);
  });

  it("gives roughly 50% to a pair of aces against one random hand preflop", () => {
    // Known benchmark: AA vs a random hand is about 85%. Allow a loose tolerance for sampling.
    const result = estimateEquity({ hole: hand("Ah", "Ad"), board: [], opponents: 1, trials: 20000 });
    expect(result.equity).toBeGreaterThan(0.82);
    expect(result.equity).toBeLessThan(0.88);
  });

  it("rejects bad input", () => {
    expect(() => estimateEquity({ hole: hand("Ah"), board: [], opponents: 1 })).toThrow();
    expect(() => estimateEquity({ hole: hand("Ah", "Ad"), board: [], opponents: 0 })).toThrow();
  });

  it("uses makeCard consistently", () => {
    expect(makeCard(14, 2)).toBe(c("Ah"));
  });
});

describe("potOdds", () => {
  it("computes the break-even share and ratio", () => {
    const odds = potOdds(75, 25);
    expect(odds.breakEven).toBeCloseTo(0.25, 9);
    expect(odds.ratio).toBeCloseTo(3, 9);
  });

  it("returns nulls when there is nothing to call", () => {
    expect(potOdds(100, 0)).toEqual({ breakEven: null, ratio: null });
  });
});
