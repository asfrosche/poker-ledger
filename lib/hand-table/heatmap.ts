// Starting-hand heatmap: the equity of each Hold'em starting hand against one random hand on the current board.
// Each hand class (for example AKs) is sampled over its suit combinations, so the number is an average over them.

import { FULL_DECK, makeCard, RANK_NAMES, type Card } from "@/lib/poker/cards";
import { evaluateHand } from "./variant";

export type HandClass = {
  label: string;
  /** Rank values 2..14, high card first. */
  high: number;
  low: number;
  suited: boolean;
  pair: boolean;
  combos: [Card, Card][];
};

const RANKS_DESC = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const rankName = (value: number) => RANK_NAMES[value - 2];

/**
 * The standard 13x13 grid. Row and column both run from ace to deuce. Pairs sit on the diagonal,
 * suited hands above it and offsuit hands below it.
 */
export function handGrid(): HandClass[][] {
  return RANKS_DESC.map((rowRank, row) =>
    RANKS_DESC.map((colRank, col) => {
      const high = Math.max(rowRank, colRank);
      const low = Math.min(rowRank, colRank);
      const pair = high === low;
      const suited = !pair && row < col;
      const label = pair ? `${rankName(high)}${rankName(high)}` : `${rankName(high)}${rankName(low)}${suited ? "s" : "o"}`;
      return { label, high, low, suited, pair, combos: combosFor(high, low, pair, suited) };
    }),
  );
}

/** Every suit pairing for one class: 6 for a pair, 4 for suited, 12 for offsuit. */
function combosFor(high: number, low: number, pair: boolean, suited: boolean): [Card, Card][] {
  const combos: [Card, Card][] = [];
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (pair && s2 <= s1) continue;
      if (suited && s1 !== s2) continue;
      if (!pair && !suited && s1 === s2) continue;
      combos.push([makeCard(high, s1), makeCard(low, s2)]);
    }
  }
  return combos;
}

/**
 * Equity of one class against one random hand, given the board. Returns NaN if the board blocks every combo.
 * `rng` returns numbers in [0, 1), so tests can pass a seeded generator.
 */
export function classEquity(cls: HandClass, board: readonly Card[], trials: number, rng: () => number): number {
  const usable = cls.combos.filter(([a, b]) => !board.includes(a) && !board.includes(b));
  if (usable.length === 0) return Number.NaN;

  const toDeal = 2 + (5 - board.length);
  let score = 0;
  for (let t = 0; t < trials; t++) {
    const [a, b] = usable[Math.floor(rng() * usable.length)];
    const deck = FULL_DECK.filter((c) => c !== a && c !== b && !board.includes(c));
    // Partial Fisher-Yates: the first `toDeal` entries are a uniform random sample.
    for (let i = 0; i < toDeal; i++) {
      const j = i + Math.floor(rng() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const opponent = deck.slice(0, 2);
    const full = [...board, ...deck.slice(2, toDeal)];
    const mine = evaluateHand("holdem", [a, b], full);
    const theirs = evaluateHand("holdem", opponent, full);
    score += mine > theirs ? 1 : mine === theirs ? 0.5 : 0;
  }
  return score / trials;
}

/**
 * Equity for all 169 classes, in grid order (row by row). On the river the result is exact: every
 * opponent hand is checked, so there is no sampling. Earlier streets sample, as before.
 */
export function heatmapEquities(board: readonly Card[], trials: number, rng: () => number): number[][] {
  if (board.length === 5) return riverEquities(board);
  return handGrid().map((row) => row.map((cls) => classEquity(cls, board, trials, rng)));
}

/**
 * Exact river equities. A hand's strength depends only on its own cards and the board, so every
 * unblocked two-card hand is scored once. Each hero combo is then compared with every opponent
 * combo that shares no card with it. A class is the average over its hero combos, which matches
 * the sampling in classEquity in expectation.
 */
function riverEquities(board: readonly Card[]): number[][] {
  const hands: [Card, Card][] = [];
  for (let a = 0; a < 52; a++) {
    for (let b = a + 1; b < 52; b++) {
      if (!board.includes(a) && !board.includes(b)) hands.push([a, b]);
    }
  }
  const scores = hands.map(([a, b]) => evaluateHand("holdem", [a, b], board));

  return handGrid().map((row) =>
    row.map((cls) => {
      const heroes = cls.combos.filter(([a, b]) => !board.includes(a) && !board.includes(b));
      if (heroes.length === 0) return Number.NaN;
      let sum = 0;
      for (const [ha, hb] of heroes) {
        const heroScore = evaluateHand("holdem", [ha, hb], board);
        let points = 0;
        let count = 0;
        for (let i = 0; i < hands.length; i++) {
          const [oa, ob] = hands[i];
          if (oa === ha || oa === hb || ob === ha || ob === hb) continue;
          count++;
          if (heroScore > scores[i]) points += 1;
          else if (heroScore === scores[i]) points += 0.5;
        }
        sum += points / count;
      }
      return sum / heroes.length;
    }),
  );
}
