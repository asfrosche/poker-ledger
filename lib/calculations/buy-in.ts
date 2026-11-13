import { formatChips, formatMoney } from "@/lib/money";

/** Quick-select buy-in sizes, as fractions of the game's standard buy-in. */
export const QUICK_BUY_INS = [
  { fraction: 1, label: "Buy-in", noun: "Full" },
  { fraction: 0.5, label: "½", noun: "Half" },
  { fraction: 0.25, label: "¼", noun: "Quarter" },
] as const;

/** Chips for a fraction of the standard buy-in, or null if that isn't a whole number of chips. */
export function chipsForFraction(chipsPerBuyIn: number, fraction: number): number | null {
  const chips = chipsPerBuyIn * fraction;
  return Number.isInteger(chips) && chips > 0 ? chips : null;
}

/**
 * Money for a chip count at the game's rate (buy-in ÷ chips per buy-in), in whole paise.
 * Returns null rather than rounding, so no paise are ever invented or lost.
 */
export function paiseForChips(chips: number, buyInPaise: number, chipsPerBuyIn: number): number | null {
  if (!Number.isInteger(chips) || chips <= 0 || chipsPerBuyIn <= 0) return null;
  const numerator = chips * buyInPaise;
  return numerator % chipsPerBuyIn === 0 ? numerator / chipsPerBuyIn : null;
}

/** Parses a typed chip count. Commas are allowed. */
export function parseChipCount(text: string): { chips: number } | { error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { error: "Enter the chips bought" };
  const n = Number(trimmed.replace(/,/g, ""));
  if (!Number.isInteger(n) || n <= 0) return { error: "Whole number above zero" };
  return { chips: n };
}

/** Turns a typed chip count into a full buy-in (chips + money), or explains why it can't be recorded. */
export function resolveChipBuyIn(
  text: string,
  rate: { buyInPaise: number; chipsPerBuyIn: number; currency: string },
): { chips: number; amountPaise: number } | { error: string } {
  const parsed = parseChipCount(text);
  if ("error" in parsed) return parsed;
  const amountPaise = paiseForChips(parsed.chips, rate.buyInPaise, rate.chipsPerBuyIn);
  if (amountPaise === null) {
    return {
      error: `${formatChips(parsed.chips)} chips doesn't come to a whole amount at this rate. Try a nearby count.`,
    };
  }
  return { chips: parsed.chips, amountPaise };
}

/** Short preview for the form, e.g. "= ₹250". */
export function previewBuyIn(text: string, rate: { buyInPaise: number; chipsPerBuyIn: number; currency: string }): string {
  const result = resolveChipBuyIn(text, rate);
  return "error" in result ? "" : `= ${formatMoney(result.amountPaise, rate.currency)}`;
}
