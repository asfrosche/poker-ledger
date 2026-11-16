import type { GameVariant } from "@/types";

export type VariantInfo = {
  key: GameVariant;
  label: string;
  description: string;
};

/** Shown in the game form. Metadata only: picking a variant never changes calculations or money. */
export const GAME_VARIANTS: readonly VariantInfo[] = [
  {
    key: "nlh",
    label: "No-Limit Texas Hold'em",
    description: "Two private cards and five shared cards. A bet can be any amount up to your stack.",
  },
  {
    key: "plo",
    label: "Pot-Limit Omaha",
    description: "Four private cards. A hand must use exactly two of them with three board cards. Bets are capped at the pot.",
  },
  {
    key: "omaha5",
    label: "5-Card Omaha",
    description: "Five private cards. A hand must use exactly two of them with three board cards.",
  },
  {
    key: "hilo",
    label: "Omaha Hi-Lo",
    description: "Four private cards. The pot is split between the best high hand and the best low hand.",
  },
  {
    key: "stud7",
    label: "Seven-Card Stud",
    description: "No shared cards. Each player gets seven cards, some face up and some face down.",
  },
  {
    key: "short",
    label: "Short Deck (6+)",
    description: "Hold'em with 36 cards, from 6 to Ace. A flush beats a full house.",
  },
];

export const DEFAULT_VARIANT: GameVariant = "nlh";

/** Label for a stored variant. Falls back to Hold'em for anything unrecognised. */
export function variantLabel(key: string | null | undefined): string {
  return GAME_VARIANTS.find((v) => v.key === key)?.label ?? GAME_VARIANTS[0].label;
}

/** Labels for a game's variants, joined in order, e.g. "No-Limit Texas Hold'em + Pot-Limit Omaha". */
export function variantsLabel(keys: readonly string[] | null | undefined): string {
  if (!keys || keys.length === 0) return variantLabel(null);
  return keys.map((k) => variantLabel(k)).join(" + ");
}

/** Removes repeats and keeps the order picked. An empty list falls back to No-Limit Hold'em. */
export function normalizeVariants(keys: readonly GameVariant[] | null | undefined): GameVariant[] {
  const unique = [...new Set(keys ?? [])];
  return unique.length > 0 ? unique : [DEFAULT_VARIANT];
}
