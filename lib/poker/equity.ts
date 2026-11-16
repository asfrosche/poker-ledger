import { Card, FULL_DECK } from "./cards";
import { evaluateBest } from "./evaluate";

export type Rng = () => number;

export type EquityResult = {
  trials: number;
  /** Fractions from 0 to 1. `equity` = win + tie share, where a split pot counts for each sharer. */
  win: number;
  tie: number;
  lose: number;
  equity: number;
};

export type EquityInput = {
  hole: readonly Card[];
  board: readonly Card[];
  /** Number of random opponents, each holding two unknown cards. */
  opponents: number;
  trials?: number;
  rng?: Rng;
};

/**
 * Monte Carlo estimate of hero's share of the pot against random opponent hands.
 * Each trial deals the missing board cards and every opponent two cards from the unseen deck.
 */
export function estimateEquity({ hole, board, opponents, trials = 6000, rng = Math.random }: EquityInput): EquityResult {
  if (hole.length !== 2) throw new RangeError("Hero needs exactly two hole cards");
  if (board.length > 5) throw new RangeError("Board can have at most five cards");
  if (opponents < 1) throw new RangeError("Need at least one opponent");

  const known = new Set<Card>([...hole, ...board]);
  const deck = FULL_DECK.filter((c) => !known.has(c));
  const boardNeeded = 5 - board.length;
  const cardsNeeded = boardNeeded + 2 * opponents;
  if (cardsNeeded > deck.length) throw new RangeError("Not enough unseen cards for this many opponents");

  let win = 0;
  let tie = 0;
  let lose = 0;
  let share = 0;
  const oppScores = new Array<number>(opponents);

  for (let t = 0; t < trials; t++) {
    // Partial Fisher-Yates: move `cardsNeeded` random cards to the front of the array.
    for (let i = 0; i < cardsNeeded; i++) {
      const j = i + Math.floor(rng() * (deck.length - i));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }

    const runout = [...board, ...deck.slice(0, boardNeeded)];
    const heroScore = evaluateBest([...hole, ...runout]);

    let bestOpp = -1;
    let tiedOpps = 0;
    for (let o = 0; o < opponents; o++) {
      const start = boardNeeded + 2 * o;
      oppScores[o] = evaluateBest([deck[start], deck[start + 1], ...runout]);
      if (oppScores[o] > bestOpp) {
        bestOpp = oppScores[o];
        tiedOpps = 1;
      } else if (oppScores[o] === bestOpp) {
        tiedOpps++;
      }
    }

    if (heroScore > bestOpp) {
      win++;
      share += 1;
    } else if (heroScore < bestOpp) {
      lose++;
    } else {
      // Hero shares the pot with every opponent who has the same best hand.
      tie++;
      share += 1 / (tiedOpps + 1);
    }
  }

  return {
    trials,
    win: win / trials,
    tie: tie / trials,
    lose: lose / trials,
    equity: share / trials,
  };
}
