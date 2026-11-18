// Audit suite for the hand calculator engine: regression for the river scenario, brute-force oracles for
// every street, an independent hand-ranking oracle, and invariants on the table state.

import { describe, expect, it } from "vitest";
import { FULL_DECK, cardRank, cardSuit, parseCardText, type Card } from "@/lib/poker/cards";
import { evaluateBest, scoreFive } from "@/lib/poker/evaluate";
import { equityStatus } from "./equity";
import { simulateTable, unseenCards, drawsNeeded } from "./simulate";
import {
  addSeat,
  clearTarget,
  createTableState,
  placeCard,
  selectTarget,
  setVariant,
  toEngineInput,
  type EngineInput,
  type TableState,
  type Target,
} from "./table-state";

const c = (text: string): Card => {
  const card = parseCardText(text);
  if (card === null) throw new Error(`bad card ${text}`);
  return card;
};
const cards = (list: string[]) => list.map(c);

/** Builds a two-seat table: seat "a" holds `h1`, seat "b" holds `h2`, with the given board. */
function table(h1: string[], h2: string[], board: string[]): TableState {
  let t = createTableState();
  t = addSeat(t, "a", "p1");
  t = addSeat(t, "b", "p2");
  const put = (target: Target, card: string) => {
    t = placeCard(selectTarget(t, target), c(card));
  };
  h1.forEach((card, i) => put({ kind: "hole", seatId: "a", index: i }, card));
  h2.forEach((card, i) => put({ kind: "hole", seatId: "b", index: i }, card));
  board.forEach((card, i) => put({ kind: "board", index: i }, card));
  return t;
}

function readyInput(t: TableState): EngineInput {
  const status = equityStatus(t);
  if (status.kind !== "ready") throw new Error(`table not ready: ${status.kind}`);
  return status.input;
}

/** Independent reference: exact heads-up outcomes by brute force over every unordered runout of the unseen cards. */
function bruteHeadsUp(h1: Card[], h2: Card[], board: Card[]) {
  const known = new Set<Card>([...h1, ...h2, ...board]);
  const deck = FULL_DECK.filter((x) => !known.has(x));
  const need = 5 - board.length;
  let win = 0;
  let tie = 0;
  let lose = 0;
  let total = 0;
  const pick = (start: number, chosen: Card[]) => {
    if (chosen.length === need) {
      const full = [...board, ...chosen];
      const a = evaluateBest([...h1, ...full]);
      const b = evaluateBest([...h2, ...full]);
      total++;
      if (a > b) win++;
      else if (a < b) lose++;
      else tie++;
      return;
    }
    for (let i = start; i < deck.length; i++) pick(i + 1, [...chosen, deck[i]]);
  };
  pick(0, []);
  return { total, win: win / total, tie: tie / total, lose: lose / total, equity: (win + tie / 2) / total };
}

/** Seeded generator so randomised tests are reproducible. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Independent reference ranking for five cards, as a comparable tuple (category, then tiebreak ranks). */
function refFive(five: Card[]): number[] {
  const ranks = five.map(cardRank);
  const flush = new Set(five.map(cardSuit)).size === 1;
  const distinct = [...new Set(ranks)].sort((x, y) => y - x);
  let straight = 0;
  if (distinct.length === 5) {
    if (distinct[0] - distinct[4] === 4) straight = distinct[0];
    else if (distinct.join(",") === "14,5,4,3,2") straight = 5;
  }
  const freq = new Map<number, number>();
  for (const r of ranks) freq.set(r, (freq.get(r) ?? 0) + 1);
  const groups = [...freq.keys()].sort((x, y) => freq.get(y)! - freq.get(x)! || y - x);
  const counts = groups.map((g) => freq.get(g)!);
  let category: number;
  if (straight && flush) category = 8;
  else if (counts[0] === 4) category = 7;
  else if (counts[0] === 3 && counts[1] === 2) category = 6;
  else if (flush) category = 5;
  else if (straight) category = 4;
  else if (counts[0] === 3) category = 3;
  else if (counts[0] === 2 && counts[1] === 2) category = 2;
  else if (counts[0] === 2) category = 1;
  else category = 0;
  return [category, ...(straight ? [straight] : groups)];
}

function cmpTuple(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

/** Reference best five of up to seven cards: the maximum reference tuple over every five-card subset. */
function refBest(seven: Card[]): number[] {
  let best: number[] | null = null;
  const n = seven.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let bits = 0;
    for (let v = mask; v; v &= v - 1) bits++;
    if (bits !== 5) continue;
    const five = seven.filter((_, i) => mask & (1 << i));
    const t = refFive(five);
    if (best === null || cmpTuple(t, best) > 0) best = t;
  }
  return best!;
}

// ---------------------------------------------------------------------------------------------------------------

describe("screenshot regression: flop → turn → river", () => {
  const H1 = ["9s", "Ts"];
  const H2 = ["Ah", "Kd"];
  const FLOP = ["As", "9d", "Td"];

  it("river: Seat 2 (Aces full of Tens) beats Seat 1 (Tens full of Aces) with 100% and 0%", () => {
    const r = simulateTable(readyInput(table(H1, H2, [...FLOP, "Ac", "Th"])));
    expect(r.method).toBe("exact");
    expect(r.trials).toBe(1);
    expect(r.overall[0].outcome).toEqual({ win: 0, tie: 0, lose: 1, equity: 0 });
    expect(r.overall[1].outcome).toEqual({ win: 1, tie: 0, lose: 0, equity: 1 });
  });

  it("river: both final hands are full houses, and Seat 2's is higher", () => {
    const seat1 = evaluateBest(cards(["9s", "Ts", "As", "9d", "Td", "Ac", "Th"]));
    const seat2 = evaluateBest(cards(["Ah", "Kd", "As", "9d", "Td", "Ac", "Th"]));
    // Category is the top digit in base 15 above the five tiebreak ranks: full house = 6.
    expect(Math.floor(seat1 / 15 ** 5)).toBe(6);
    expect(Math.floor(seat2 / 15 ** 5)).toBe(6);
    expect(seat2).toBeGreaterThan(seat1);
  });

  it("turn: the outcome is already decided (Seat 2 wins all 44 runouts), so the river cannot change it", () => {
    const r = simulateTable(readyInput(table(H1, H2, [...FLOP, "Ac"])));
    expect(r.method).toBe("exact");
    expect(r.trials).toBe(44);
    expect(r.overall[0].outcome).toEqual({ win: 0, tie: 0, lose: 1, equity: 0 });
    expect(r.overall[1].outcome).toEqual({ win: 1, tie: 0, lose: 0, equity: 1 });
  });

  it("turn matches an independent brute force over all 44 river cards", () => {
    const oracle = bruteHeadsUp(cards(H1), cards(H2), cards([...FLOP, "Ac"]));
    expect(oracle.total).toBe(44);
    const r = simulateTable(readyInput(table(H1, H2, [...FLOP, "Ac"])));
    expect(r.overall[0].outcome.equity).toBeCloseTo(oracle.equity, 12);
    expect(r.overall[1].outcome.equity).toBeCloseTo(1 - oracle.equity, 12);
  });

  it("flop: exact result matches an independent brute force over every turn+river pair", () => {
    const oracle = bruteHeadsUp(cards(H1), cards(H2), cards(FLOP));
    expect(oracle.total).toBe(990); // unordered pairs of the 45 unseen cards
    const r = simulateTable(readyInput(table(H1, H2, FLOP)));
    expect(r.method).toBe("exact");
    expect(r.trials).toBe(45 * 44); // ordered deals: each unordered pair counted twice
    expect(r.overall[0].outcome.win).toBeCloseTo(oracle.win, 12);
    expect(r.overall[0].outcome.tie).toBeCloseTo(oracle.tie, 12);
    expect(r.overall[0].outcome.lose).toBeCloseTo(oracle.lose, 12);
    expect(r.overall[0].outcome.equity).toBeCloseTo(oracle.equity, 12);
  });
});

describe("exact enumeration counts per street", () => {
  it("counts unseen cards and draws for each street of a heads-up hand", () => {
    const H1 = ["Ah", "Kh"];
    const H2 = ["Qc", "Qd"];
    const stages: [string[], number, number][] = [
      [[], 5, 48], // preflop: five board cards to deal, 48 unseen
      [["2s", "7d", "9c"], 2, 45],
      [["2s", "7d", "9c", "Jh"], 1, 44],
      [["2s", "7d", "9c", "Jh", "3c"], 0, 43],
    ];
    for (const [board, remainingBoard, unseen] of stages) {
      const input = readyInput(table(H1, H2, board));
      expect(drawsNeeded(input)).toBe(remainingBoard);
      expect(unseenCards(input)).toHaveLength(unseen);
    }
  });

  it("never lists a placed card as unseen", () => {
    const input = readyInput(table(["Ah", "Kh"], ["Qc", "Qd"], ["2s", "7d", "9c"]));
    const unseen = new Set(unseenCards(input));
    for (const card of cards(["Ah", "Kh", "Qc", "Qd", "2s", "7d", "9c"])) expect(unseen.has(card)).toBe(false);
  });

  it("uses exact enumeration on flop, turn and river with two cards or fewer to deal", () => {
    for (const board of [["2s", "7d", "9c"], ["2s", "7d", "9c", "Jh"], ["2s", "7d", "9c", "Jh", "3c"]]) {
      expect(simulateTable(readyInput(table(["Ah", "Kh"], ["Qc", "Qd"], board))).method).toBe("exact");
    }
  });
});

describe("exact results are consistent across streets and seats", () => {
  const H1 = ["Ah", "Kh"];
  const H2 = ["Qc", "Qd"];
  const BOARD = ["2s", "7d", "9c", "Jh"];

  it("probabilities sum to 100% for every seat on the turn and river", () => {
    for (const board of [BOARD, [...BOARD, "3c"]]) {
      const r = simulateTable(readyInput(table(H1, H2, board)));
      for (const seat of r.overall) {
        const o = seat.outcome;
        expect(o.win + o.tie + o.lose).toBeCloseTo(1, 9);
        expect(o.equity).toBeCloseTo(o.win + o.tie / 2, 9);
      }
      const total = r.overall.reduce((sum, s) => sum + s.outcome.win + s.outcome.tie / 2, 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it("swapping the seats swaps the two players' probabilities", () => {
    const put = (t: TableState, target: Target, card: string) => placeCard(selectTarget(t, target), c(card));
    let swapped = createTableState();
    swapped = addSeat(swapped, "b", "p2");
    swapped = addSeat(swapped, "a", "p1");
    H2.forEach((card, i) => (swapped = put(swapped, { kind: "hole", seatId: "b", index: i }, card)));
    H1.forEach((card, i) => (swapped = put(swapped, { kind: "hole", seatId: "a", index: i }, card)));
    BOARD.forEach((card, i) => (swapped = put(swapped, { kind: "board", index: i }, card)));
    const original = simulateTable(readyInput(table(H1, H2, BOARD))).overall;
    const flipped = simulateTable(readyInput(swapped)).overall;
    const byId = new Map(flipped.map((s) => [s.seatId, s.outcome]));
    expect(byId.get("a")!.equity).toBeCloseTo(original[0].outcome.equity, 12);
    expect(byId.get("b")!.equity).toBeCloseTo(original[1].outcome.equity, 12);
  });

  it("is deterministic: the same river board gives identical results on every call", () => {
    const input = readyInput(table(H1, H2, [...BOARD, "3c"]));
    expect(simulateTable(input)).toEqual(simulateTable(input));
  });
});

describe("Monte Carlo converges to the exact answer", () => {
  it("AA vs KK preflop lands near the known equity (about 81%)", () => {
    const r = simulateTable(readyInput(table(["As", "Ad"], ["Ks", "Kd"], [])), 6000, lcg(7));
    expect(r.method).toBe("monte-carlo");
    expect(r.overall[0].outcome.equity).toBeGreaterThan(0.78);
    expect(r.overall[0].outcome.equity).toBeLessThan(0.84);
  }, 60_000);

  it("sampling spread shrinks as the number of deals grows", () => {
    const input = readyInput(table(["As", "Ad"], ["Ks", "Kd"], []));
    const spread = (trials: number) => {
      const values: number[] = [];
      for (let seed = 1; seed <= 8; seed++) values.push(simulateTable(input, trials, lcg(seed)).overall[0].outcome.equity);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    };
    expect(spread(1500)).toBeLessThan(spread(100));
  }, 60_000);
});

describe("hand evaluator matches an independent reference", () => {
  it("evaluateBest orders random seven-card hands exactly as the reference does", () => {
    const rng = lcg(12345);
    const draw = (n: number): Card[] => {
      const pool = [...FULL_DECK];
      const hand: Card[] = [];
      for (let i = 0; i < n; i++) hand.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      return hand;
    };
    for (let i = 0; i < 400; i++) {
      const a = draw(7);
      const b = draw(7);
      expect(Math.sign(evaluateBest(a) - evaluateBest(b))).toBe(Math.sign(cmpTuple(refBest(a), refBest(b))));
    }
  });

  it("scoreFive agrees with the reference on random five-card hands", () => {
    const rng = lcg(99);
    const draw = (pool: Card[], n: number) => Array.from({ length: n }, () => pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    for (let i = 0; i < 300; i++) {
      const pool = [...FULL_DECK];
      const five = draw(pool, 5);
      const other = draw(pool, 5);
      expect(Math.sign(scoreFive(five) - scoreFive(other))).toBe(Math.sign(cmpTuple(refFive(five), refFive(other))));
    }
  });
});

describe("specific ranking edge cases", () => {
  const score = (list: string[]) => evaluateBest(cards(list));
  const beats = (a: string[], b: string[]) => score(a) > score(b);
  const ties = (a: string[], b: string[]) => score(a) === score(b);

  it("the wheel is the lowest straight, and ace-high beats it", () => {
    expect(beats(["6s", "5d", "4c", "3h", "2s"], ["As", "5d", "4c", "3h", "2s"])).toBe(true);
    expect(beats(["As", "Kd", "Qc", "Jh", "Ts"], ["As", "5d", "4c", "3h", "2s"])).toBe(true);
  });

  it("a board straight that both players play splits the pot", () => {
    // Board 6-7-8-9-T is a straight; neither hole pair improves on it.
    expect(ties(["6s", "7d", "8c", "9h", "Th", "2h", "3c"], ["6s", "7d", "8c", "9h", "Th", "Qd", "Ks"])).toBe(true);
  });

  it("straight comparison uses the highest card", () => {
    expect(beats(["9s", "8d", "7c", "6h", "5h"], ["8s", "7d", "6c", "5h", "4h"])).toBe(true);
  });

  it("a five-card flush beats a straight; higher flush cards win", () => {
    expect(beats(["2h", "5h", "7h", "9h", "Jh"], ["Ts", "9d", "8c", "7h", "6s"])).toBe(true);
    expect(beats(["Ah", "Kh", "9h", "7h", "2h"], ["Ah", "Qh", "9h", "7h", "2h"])).toBe(true);
  });

  it("with more than five suited cards, the best five are used", () => {
    // Seven hearts: the flush uses the five highest (K-9-7-5-4).
    expect(score(["2h", "3h", "4h", "5h", "7h", "9h", "Kh"])).toBe(score(["7h", "9h", "Kh", "5h", "4h"]));
  });

  it("competing full houses compare the trips first, then the pair", () => {
    expect(beats(["Ks", "Kd", "Kc", "2h", "2s"], ["Qs", "Qd", "Qc", "As", "Ad"])).toBe(true);
    expect(beats(["Ks", "Kd", "Kc", "Ah", "Ad"], ["Ks", "Kd", "Kc", "Qh", "Qd"])).toBe(true);
  });

  it("with two sets of trips, the best full house uses the higher trips over the lower", () => {
    // Kings full of deuces is the best full house available here.
    expect(score(["Ks", "Kd", "Kc", "2h", "2s", "2d", "9c"])).toBe(score(["Ks", "Kd", "Kc", "2h", "2s"]));
  });

  it("four of a kind compares the quad, then the kicker", () => {
    expect(beats(["9s", "9d", "9c", "9h", "2s"], ["8s", "8d", "8c", "8h", "As"])).toBe(true);
    expect(beats(["9s", "9d", "9c", "9h", "As"], ["9s", "9d", "9c", "9h", "Ks"])).toBe(true);
  });

  it("identical five-card boards tie when no hole card improves them", () => {
    // Board K-Q-J-T-9 is a straight that both players play; their pocket pairs do not help.
    expect(ties(["2s", "2d", "Ks", "Qd", "Jc", "Th", "9c"], ["3s", "3d", "Ks", "Qd", "Jc", "Th", "9c"])).toBe(true);
  });

  it("a royal flush is the top straight flush", () => {
    expect(beats(["As", "Ks", "Qs", "Js", "Ts"], ["9s", "8s", "7s", "6s", "5s"])).toBe(true);
  });
});

describe("table-state invariants", () => {
  it("a card can never be placed twice", () => {
    let t = createTableState();
    t = addSeat(t, "a", null);
    t = addSeat(t, "b", null);
    t = placeCard(selectTarget(t, { kind: "hole", seatId: "a", index: 0 }), c("Ah"));
    const again = placeCard(selectTarget(t, { kind: "hole", seatId: "b", index: 0 }), c("Ah"));
    // Rejected: seat b stays empty and the card is still only in seat a.
    expect(again.seats[1].hole[0]).toBeNull();
    expect(again.seats[0].hole[0]).toBe(c("Ah"));
  });

  it("the remaining deck never contains a card on the table", () => {
    const input = readyInput(table(["Ah", "Kh"], ["Qc", "Qd"], ["2s", "7d", "9c"]));
    const unseen = new Set(unseenCards(input));
    for (const seat of input.seats) for (const card of seat.hole) expect(unseen.has(card)).toBe(false);
    for (const run of input.runs) for (const card of run) expect(unseen.has(card)).toBe(false);
  });

  it("clearing a board card also clears the cards after it", () => {
    const t = table(["Ah", "Kh"], ["Qc", "Qd"], ["2s", "7d", "9c", "Jh", "3c"]);
    const cleared = clearTarget(t, { kind: "board", index: 1 });
    expect(cleared.board.filter((x) => x !== null)).toHaveLength(1);
  });

  it("switching to Omaha keeps the cards, and Texas Hold'em clears the extra hole cards", () => {
    let t = createTableState();
    t = addSeat(t, "a", null);
    t = addSeat(t, "b", null);
    const omaha0 = setVariant(t, "omaha");
    const omaha = placeCard(selectTarget(omaha0, { kind: "hole", seatId: "a", index: 2 }), c("2c"));
    expect(omaha.seats[0].hole[2]).toBe(c("2c"));
    const holdem = setVariant(omaha, "holdem");
    expect(holdem.seats[0].hole[2]).toBeNull();
  });

  it("the engine input reflects exactly the known board cards", () => {
    const input = toEngineInput(table(["Ah", "Kh"], ["Qc", "Qd"], ["2s", "7d", "9c"]));
    expect(input).not.toBeNull();
    expect(input!.runs[0]).toHaveLength(3);
  });
});
