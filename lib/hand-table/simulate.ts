// Equity by simulation. Every seated player's cards are known, so the only randomness is the
// remaining board cards for each runout. Each trial deals those cards from the unseen deck,
// with no card used twice, then ranks every hand with the real evaluator.

import { FULL_DECK, type Card } from "@/lib/poker/cards";
import { evaluateHand } from "./variant";
import type { Outcome, RunEquity, SeatEquity, TableEquity } from "./equity";
import type { EngineInput } from "./table-state";

/**
 * Deals per calculation are scaled to the table. Work grows with seats × runouts, so a fixed budget
 * keeps the worst case (nine players, three runouts) near 3 seconds, while smaller tables get more deals.
 */
const WORK_BUDGET = 81_000; // seat-runout evaluations per calculation
export const MIN_TRIALS = 3000;
export const MAX_TRIALS = 20000;

export function trialsFor(seatCount: number, runCount: number): number {
  const scaled = Math.round(WORK_BUDGET / Math.max(1, seatCount * runCount));
  return Math.min(MAX_TRIALS, Math.max(MIN_TRIALS, scaled));
}

export type Rng = () => number;

/** How often a partial result is reported while a calculation runs. */
export const PROGRESS_EVERY = 1000;

export type ProgressReport = (partial: TableEquity, done: number, total: number) => void;

export function simulateTable(
  input: EngineInput,
  requestedTrials?: number,
  rng: Rng = Math.random,
  onProgress?: ProgressReport,
): TableEquity {
  const seatCount = input.seats.length;
  if (seatCount < 2) throw new RangeError("Need at least two seated players");
  const runCount = input.runs.length;
  const trials = requestedTrials ?? trialsFor(seatCount, runCount);

  const known = new Set<Card>([
    ...input.dead,
    ...input.seats.flatMap((s) => s.hole),
    ...input.runs.flat(),
  ]);
  const deck = FULL_DECK.filter((c) => !known.has(c));

  const missing = input.runs.map((run) => 5 - run.length);
  const totalMissing = missing.reduce((sum, n) => sum + n, 0);
  if (totalMissing > deck.length) throw new RangeError("Not enough unseen cards to finish the boards");

  // With no cards left to deal, every trial is identical, so one pass gives the exact answer.
  const iterations = totalMissing === 0 ? 1 : trials;

  // Counts per runout and seat.
  const wins = zeros(runCount, seatCount);
  const ties = zeros(runCount, seatCount);
  const share = zeros(runCount, seatCount);

  for (let t = 0; t < iterations; t++) {
    // Partial Fisher-Yates: move the cards needed for every runout to the front of the deck.
    for (let i = 0; i < totalMissing; i++) {
      const j = i + Math.floor(rng() * (deck.length - i));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }

    let next = 0;
    for (let r = 0; r < runCount; r++) {
      const board = [...input.runs[r]];
      while (board.length < 5) board.push(deck[next++]);

      const scores = input.seats.map((s) => evaluateHand(input.variant, s.hole, board));
      let best = -1;
      for (const score of scores) if (score > best) best = score;
      const sharing = scores.filter((score) => score === best).length;

      for (let s = 0; s < seatCount; s++) {
        if (scores[s] !== best) continue;
        if (sharing === 1) {
          wins[r][s]++;
        } else {
          ties[r][s]++;
          share[r][s] += 1 / sharing;
        }
      }
    }
    // Report a partial result every PROGRESS_EVERY deals, so the first answer appears quickly.
    if (onProgress && (t + 1) % PROGRESS_EVERY === 0 && t + 1 < iterations) {
      onProgress(build(t + 1), t + 1, iterations);
    }
  }

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

  return { runs, overall, trials: n };
  }

  return build(iterations);
}

function zeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array<number>(cols).fill(0));
}

function toOutcome(wins: number, ties: number, shares: number, iterations: number): Outcome {
  const win = wins / iterations;
  const tie = ties / iterations;
  return {
    win,
    tie,
    lose: Math.max(0, 1 - win - tie),
    equity: shares / iterations + win,
  };
}
