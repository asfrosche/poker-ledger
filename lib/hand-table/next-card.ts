// For each card that could come next, the equity of every seat once that card is on the board.
// Only the first runout is used. Equity comes from the same simulation as the main panel.

import type { Card } from "@/lib/poker/cards";
import { simulateTable, unseenCards, type Rng } from "./simulate";
import type { EngineInput } from "./table-state";

export type NextCardOdds = {
  card: Card;
  /** One equity per seat, in the same order as the input seats. */
  equities: number[];
};

/** Null unless the first runout shows a flop or a turn, so there is a next card to look at. */
export function nextCardOdds(input: EngineInput, trials: number, rng: Rng): NextCardOdds[] | null {
  const board = input.runs[0];
  if (!board || board.length < 3 || board.length > 4) return null;

  const oneRun: EngineInput = { ...input, runs: [board] };
  return unseenCards(oneRun).map((card) => {
    const result = simulateTable({ ...oneRun, runs: [[...board, card]] }, trials, rng);
    const equities = input.seats.map((seat) => {
      const row = result.overall.find((r) => r.seatId === seat.seatId);
      return row ? row.outcome.equity : 0;
    });
    return { card, equities };
  });
}
