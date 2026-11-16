// Equity from partial information. Each seat has zero or more known hole cards; the rest are unknown and are
// dealt at random, as are the missing board cards. No card is used twice in any deal.
//
// Method:
// - Exact: when at most EXACT_MAX_DRAWS cards are still to be dealt, every possible deal is evaluated.
// - Monte Carlo: otherwise, a fixed number of random deals (scaled to the table) is evaluated.
// The result records which method was used.

import { FULL_DECK, type Card } from "@/lib/poker/cards";
import type { Outcome, RunEquity, SeatEquity, TableEquity } from "./equity";
import type { EngineInput } from "./table-state";
import { evaluateHand, HOLE_COUNT } from "./variant";

/** Up to this many cards still to deal, every possible deal is checked instead of sampled. */
export const EXACT_MAX_DRAWS = 2;

/** Deals per Monte Carlo calculation are scaled to the table. Worst case (nine players, three runouts) ≈ 3 s. */
const WORK_BUDGET = 81_000; // seat-runout evaluations per calculation
export const MIN_TRIALS = 3000;
export const MAX_TRIALS = 20000;

/** How often a partial result is reported while a Monte Carlo calculation runs. */
export const PROGRESS_EVERY = 1000;

export type ProgressReport = (partial: TableEquity, done: number, total: number) => void;
export type Rng = () => number;

export function trialsFor(seatCount: number, runCount: number): number {
  const scaled = Math.round(WORK_BUDGET / Math.max(1, seatCount * runCount));
  return Math.min(MAX_TRIALS, Math.max(MIN_TRIALS, scaled));
}

/** Cards still to be dealt across all seats and runouts. */
export function drawsNeeded(input: EngineInput): number {
  const holes = input.seats.reduce((sum, s) => sum + (HOLE_COUNT[input.variant] - s.hole.length), 0);
  const board = input.runs.reduce((sum, run) => sum + (5 - run.length), 0);
  return holes + board;
}

/** Cards that could still appear: the full deck minus every card already placed. */
export function unseenCards(input: EngineInput): Card[] {
  const known = new Set<Card>([...input.dead, ...input.seats.flatMap((s) => s.hole), ...input.runs.flat()]);
  return FULL_DECK.filter((c) => !known.has(c));
}

export function simulateTable(
  input: EngineInput,
  requestedTrials?: number,
  rng: Rng = Math.random,
  onProgress?: ProgressReport,
): TableEquity {
  const seatCount = input.seats.length;
  if (seatCount < 2) throw new RangeError("Need at least two seated players");
  const runCount = input.runs.length;
  const holeCount = HOLE_COUNT[input.variant];
  const deck = unseenCards(input);
  const draws = drawsNeeded(input);
  if (draws > deck.length) throw new RangeError("Not enough unseen cards for the cards still to be dealt");

  // Counts per runout and seat, summed over every evaluated deal.
  const wins = zeros(runCount, seatCount);
  const ties = zeros(runCount, seatCount);
  const share = zeros(runCount, seatCount);

  /** Evaluates one deal: `drawn` holds the cards still to be dealt, in order. */
  function evaluateDeal(drawn: readonly Card[]) {
    let next = 0;
    const holes = input.seats.map((seat) => {
      const unknown = holeCount - seat.hole.length;
      const extra = drawn.slice(next, next + unknown);
      next += unknown;
      return [...seat.hole, ...extra];
    });
    for (let r = 0; r < runCount; r++) {
      const board = [...input.runs[r]];
      while (board.length < 5) board.push(drawn[next++]);

      const scores = holes.map((hole) => evaluateHand(input.variant, hole, board));
      let best = -1;
      for (const score of scores) if (score > best) best = score;
      const sharing = scores.filter((score) => score === best).length;
      for (let s = 0; s < seatCount; s++) {
        if (scores[s] !== best) continue;
        if (sharing === 1) wins[r][s]++;
        else {
          ties[r][s]++;
          share[r][s] += 1 / sharing;
        }
      }
    }
  }

  let deals: number;
  let method: TableEquity["method"];

  if (draws <= EXACT_MAX_DRAWS) {
    // Every ordered way to deal the remaining cards is equally likely, so their average is exact.
    method = "exact";
    deals = 0;
    const picked: Card[] = [];
    const taken = new Array<boolean>(deck.length).fill(false);
    const walk = (depth: number) => {
      if (depth === draws) {
        evaluateDeal(picked);
        deals++;
        return;
      }
      for (let i = 0; i < deck.length; i++) {
        if (taken[i]) continue;
        taken[i] = true;
        picked.push(deck[i]);
        walk(depth + 1);
        picked.pop();
        taken[i] = false;
      }
    };
    walk(0);
  } else {
    method = "monte-carlo";
    const total = requestedTrials ?? trialsFor(seatCount, runCount);
    deals = total;
    const pool = deck.slice();
    for (let t = 0; t < total; t++) {
      // Partial Fisher-Yates: move the cards still to be dealt to the front of the pool.
      for (let i = 0; i < draws; i++) {
        const j = i + Math.floor(rng() * (pool.length - i));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      evaluateDeal(pool.slice(0, draws));
      if (onProgress && (t + 1) % PROGRESS_EVERY === 0 && t + 1 < total) {
        onProgress(build(t + 1), t + 1, total);
      }
    }
  }

  return build(deals);

  // Builds the full result from the counts so far, using `n` deals as the denominator.
  function build(n: number): TableEquity {
    const runs: RunEquity[] = [];
    for (let r = 0; r < runCount; r++) {
      runs.push({
        run: r,
        seats: input.seats.map((seat, s) => ({
          seatId: seat.seatId,
          outcome: toOutcome(wins[r][s], ties[r][s], share[r][s], n),
        })),
      });
    }

    // Aggregate: every runout counts equally.
    const overall: SeatEquity[] = input.seats.map((seat, s) => {
      const sum: Outcome = { win: 0, tie: 0, lose: 0, equity: 0 };
      for (const run of runs) {
        const o = run.seats[s].outcome;
        sum.win += o.win;
        sum.tie += o.tie;
        sum.lose += o.lose;
        sum.equity += o.equity;
      }
      return {
        seatId: seat.seatId,
        outcome: {
          win: sum.win / runCount,
          tie: sum.tie / runCount,
          lose: sum.lose / runCount,
          equity: sum.equity / runCount,
        },
      };
    });

    return { runs, overall, trials: n, method };
  }
}

function zeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array<number>(cols).fill(0));
}

function toOutcome(wins: number, ties: number, shares: number, deals: number): Outcome {
  if (deals === 0) return { win: 0, tie: 0, lose: 0, equity: 0 };
  const win = wins / deals;
  const tie = ties / deals;
  return {
    win,
    tie,
    lose: Math.max(0, 1 - win - tie),
    equity: shares / deals + win,
  };
}
