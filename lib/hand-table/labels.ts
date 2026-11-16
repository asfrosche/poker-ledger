import type { Card } from "@/lib/poker/cards";
import { cardLocation, readTarget, type TableState, type Target } from "./table-state";

const STREET_NAMES = ["Flop", "Flop", "Flop", "Turn", "River"] as const;

/** Name of a board position, e.g. "Flop 2", "Turn", "River". */
export function streetLabel(index: number): string {
  if (index < 0 || index > 4) return "Board";
  return index < 3 ? `Flop ${index + 1}` : STREET_NAMES[index];
}

/** Human description of a target, e.g. "Alex · hole 1", "Board · Turn", "Run 2 · River". */
export function describeTarget(state: TableState, target: Target, seatLabel: (seatId: string) => string): string {
  if (target.kind === "hole") return `${seatLabel(target.seatId)} · hole ${target.index + 1}`;
  if (target.kind === "board") return `Board · ${streetLabel(target.index)}`;
  return `Run ${target.run + 1} · ${streetLabel(target.index)}`;
}

/** Where a card currently sits, for labelling unavailable cards in the picker. Null if free. */
export function describeCardLocation(
  state: TableState,
  card: Card,
  seatLabel: (seatId: string) => string,
): string | null {
  const target = cardLocation(state, card);
  return target ? describeTarget(state, target, seatLabel) : null;
}

/** Whether a target currently holds a card. */
export function isFilled(state: TableState, target: Target): boolean {
  return readTarget(state, target) !== null;
}
