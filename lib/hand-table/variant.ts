// The two games the table supports. Everything game-specific goes through here.

import type { Card } from "@/lib/poker/cards";
import { evaluateBest, evaluateOmaha, type HandScore } from "@/lib/poker/evaluate";

export type Variant = "holdem" | "omaha";

export const VARIANT_LABELS: Record<Variant, string> = {
  holdem: "Texas Hold'em",
  omaha: "Omaha",
};

/** Private cards each seat is dealt. */
export const HOLE_COUNT: Record<Variant, number> = {
  holdem: 2,
  omaha: 4,
};

/**
 * Best hand for a seat on a full board. Texas Hold'em uses any five of the seven cards.
 * Omaha must use exactly two hole cards and three board cards.
 */
export function evaluateHand(variant: Variant, hole: readonly Card[], board: readonly Card[]): HandScore {
  if (variant === "omaha") return evaluateOmaha(hole, board);
  return evaluateBest([...hole, ...board]);
}
