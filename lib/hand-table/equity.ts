// Result types for the table's win probabilities, and the rule for when they can be calculated.
// The numbers come from the simulation in simulate.ts; nothing here invents results.

import { toEngineInput, type EngineInput, type TableState } from "./table-state";
import { HOLE_COUNT } from "./variant";

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
  /** Random deals per runout. 1 when every board is complete, because the result is then exact. */
  trials: number;
};

export type EquityStatus =
  | { kind: "waiting"; message: string }
  | { kind: "ready"; input: EngineInput };

/** Says whether the table can be calculated yet, and if not, what is missing. */
export function equityStatus(state: TableState): EquityStatus {
  const seated = state.seats.filter((s) => s.playerId !== null);
  if (seated.length < 2) {
    return { kind: "waiting", message: "Seat at least two players to calculate." };
  }
  const holeCount = HOLE_COUNT[state.variant];
  if (seated.some((s) => s.hole.slice(0, holeCount).some((c) => c === null))) {
    return { kind: "waiting", message: `Deal ${holeCount} cards to every seated player to calculate.` };
  }
  const input = toEngineInput(state);
  if (input === null) {
    return { kind: "waiting", message: `Deal ${holeCount} cards to every seated player to calculate.` };
  }
  return { kind: "ready", input };
}
