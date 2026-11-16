// Outs: unseen cards that, dealt as the next board card, leave one seat with the best hand outright.
// Counted for the next card only, so they are defined with a flop (3 cards) or turn (4 cards) showing.

import { FULL_DECK, type Card } from "@/lib/poker/cards";
import { evaluateHand, HOLE_COUNT } from "./variant";
import type { SeatEquity } from "./equity";
import type { EngineInput } from "./table-state";

/** True when every seat holds all the cards its variant deals. */
export function allHandsKnown(input: EngineInput): boolean {
  return input.seats.every((s) => s.hole.length === HOLE_COUNT[input.variant]);
}

/**
 * Cards that give `seatIndex` the outright best hand on `runIndex` as the next card.
 * Returns null when no next card exists (preflop, or a complete board).
 * A tie for best does not count as an out.
 */
export function computeOuts(input: EngineInput, seatIndex: number, runIndex: number): Card[] | null {
  const board = input.runs[runIndex];
  if (!board || board.length < 3 || board.length > 4) return null;
  // Outs depend on the actual hands, so every player's cards must be known.
  if (allHandsKnown(input) === false) return null;

  const known = new Set<Card>([...input.dead, ...input.seats.flatMap((s) => s.hole), ...input.runs.flat()]);
  const hole = input.seats[seatIndex].hole;
  const outs: Card[] = [];

  for (const card of FULL_DECK) {
    if (known.has(card)) continue;
    const next = [...board, card];
    const mine = evaluateHand(input.variant, hole, next);
    let outright = true;
    for (let s = 0; s < input.seats.length && outright; s++) {
      if (s === seatIndex) continue;
      if (evaluateHand(input.variant, input.seats[s].hole, next) >= mine) outright = false;
    }
    if (outright) outs.push(card);
  }
  return outs;
}

/**
 * One seat's position on a runout that has a next card.
 * `ahead` means the seat already holds the outright best hand, so outs are not meaningful; `cards` is empty then.
 */
export type SeatOuts = { run: number; ahead: boolean; cards: Card[] }[];

/** True when this seat's current best hand strictly beats every other seat's on the board as it stands. */
export function isAhead(input: EngineInput, seatIndex: number, runIndex: number): boolean {
  const board = input.runs[runIndex];
  if (board.length < 3 || allHandsKnown(input) === false) return false;
  const mine = evaluateHand(input.variant, input.seats[seatIndex].hole, board);
  return input.seats.every((seat, s) => s === seatIndex || evaluateHand(input.variant, seat.hole, board) < mine);
}

/** Outs for every seated player, keyed by seat id. Seats already ahead get no outs. */
export function outsForSeats(input: EngineInput): Record<string, SeatOuts> {
  const result: Record<string, SeatOuts> = {};
  input.seats.forEach((seat, seatIndex) => {
    const entries: SeatOuts = [];
    input.runs.forEach((_, run) => {
      const cards = computeOuts(input, seatIndex, run);
      if (cards === null) return;
      if (isAhead(input, seatIndex, run)) entries.push({ run, ahead: true, cards: [] });
      else entries.push({ run, ahead: false, cards });
    });
    result[seat.seatId] = entries;
  });
  return result;
}

/** The seat with the lowest equity: the player behind. Ties go to the earlier seat. */
export function playerBehind(overall: SeatEquity[]): string | null {
  if (overall.length === 0) return null;
  let low = overall[0];
  for (const entry of overall) if (entry.outcome.equity < low.outcome.equity) low = entry;
  return low.seatId;
}
