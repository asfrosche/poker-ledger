/**
 * Money helpers. Internally everything is integer paise.
 * Display formatting is the only place where floats appear.
 */

export const PAISE_PER_RUPEE = 100;

export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

/** Parses a user-entered amount such as "500", "1,000" or "500.5" into paise. */
export function parseMoneyToPaise(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * PAISE_PER_RUPEE + Number((fraction + "00").slice(0, 2));
}

/** Converts paise into an editable input string, e.g. 50000 -> "500", 50050 -> "500.50". */
export function paiseToInput(paise: number): string {
  const rupees = Math.trunc(paise / PAISE_PER_RUPEE);
  const remainder = Math.abs(paise % PAISE_PER_RUPEE);
  return remainder === 0
    ? String(rupees)
    : `${rupees}.${String(remainder).padStart(2, "0")}`;
}

function localeFor(currency: string): string {
  return currency === "INR" ? "en-IN" : "en-US";
}

/**
 * Formats paise as currency. Shows decimals only when there is a fraction.
 * `signed` prefixes positives with "+" and negatives with "-".
 */
export function formatMoney(
  paise: number,
  currency: string = "INR",
  options: { signed?: boolean } = {},
): string {
  const absolute = Math.abs(paise) / PAISE_PER_RUPEE;
  const hasFraction = Math.abs(paise) % PAISE_PER_RUPEE !== 0;
  const formatted = new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(absolute);

  if (!options.signed) return paise < 0 ? `-${formatted}` : formatted;
  if (paise > 0) return `+${formatted}`;
  if (paise < 0) return `-${formatted}`;
  return formatted;
}

/** Formats a per-chip rate, which may have more precision than paise. */
export function formatRate(paisePerChip: number, currency: string = "INR"): string {
  return new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(paisePerChip / PAISE_PER_RUPEE);
}

export function formatChips(chips: number): string {
  return new Intl.NumberFormat("en-US").format(chips);
}

/** Plain decimal rupees for CSV exports, e.g. 50050 -> "500.50". */
export function paiseToDecimalString(paise: number): string {
  return (paise / PAISE_PER_RUPEE).toFixed(2);
}
