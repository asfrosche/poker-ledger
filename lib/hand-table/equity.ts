// Result types for the table's win probabilities, and the rule for when they can be calculated.
// The numbers come from the simulation in simulate.ts; nothing here invents results.

import { occupiedSeats, toEngineInput, type EngineInput, type TableState } from "./table-state";
import { drawsNeeded, unseenCards } from "./simulate";

/** Fractions from 0 to 1. `equity` = win + tie share, where a split pot counts for each sharer. */
export type Outcome = {
  win: number;
  tie: number;
  lose: number;
  equity: number;
};

export type SeatEquity = {
  seatId: string;
  outcome: Outcome;
};

/** Results for one runout. Run index is 0-based. */
export type RunEquity = {
  run: number;
  seats: SeatEquity[];
};

/** Everything the panel shows: one result per runout, plus an aggregate over all runouts. */
export type TableEquity = {
  runs: RunEquity[];
  overall: SeatEquity[];
  /** Deals counted per runout: every possible deal when exact, otherwise the random deals drawn. */
  trials: number;
  /** How the numbers were produced. Shown in the panel so the method is never hidden. */
  method: "exact" | "monte-carlo";
};

export type EquityStatus =
  | { kind: "waiting"; message: string }
  | { kind: "ready"; input: EngineInput };

/** Says whether the table can be calculated yet, and if not, what is missing. */
export function equityStatus(state: TableState): EquityStatus {
  // Hidden cards are fine: any seat with a player or a card is in play, and its unknown cards are dealt at random.
  const occupied = occupiedSeats(state);
  if (occupied.length < 2) {
    return { kind: "waiting", message: "Seat at least two players to calculate." };
  }
  // No probabilities until at least one hole card is on the table.
  const anyHoleCard = state.seats.some((s) => s.hole.some((c) => c !== null));
  if (!anyHoleCard) {
    return { kind: "waiting", message: "Deal at least one hole card to see probabilities." };
  }
  const input = toEngineInput(state);
  if (input === null) {
    return { kind: "waiting", message: "Seat at least two players to calculate." };
  }
  if (drawsNeeded(input) > unseenCards(input).length) {
    return { kind: "waiting", message: "Too many cards are already placed to finish this board." };
  }
  return { kind: "ready", input };
}
