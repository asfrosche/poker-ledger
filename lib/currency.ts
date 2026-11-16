// Currencies the app supports, and detecting a sensible default from the device's timezone.
// Amounts are always stored in paise (or the smallest unit). Changing a currency never converts balances.

export type CurrencyInfo = {
  code: string;
  name: string;
  /** Where the currency is used, shown beside the code in the settings dropdown. */
  region: string;
};

export const CURRENCIES = [
  { code: "INR", name: "Indian Rupee", region: "India" },
  { code: "USD", name: "US Dollar", region: "United States" },
  { code: "EUR", name: "Euro", region: "Eurozone" },
  { code: "GBP", name: "Pound Sterling", region: "United Kingdom" },
  { code: "AUD", name: "Australian Dollar", region: "Australia" },
  { code: "CAD", name: "Canadian Dollar", region: "Canada" },
  { code: "NZD", name: "New Zealand Dollar", region: "New Zealand" },
  { code: "SGD", name: "Singapore Dollar", region: "Singapore" },
  { code: "HKD", name: "Hong Kong Dollar", region: "Hong Kong" },
  { code: "JPY", name: "Japanese Yen", region: "Japan" },
  { code: "CNY", name: "Chinese Yuan", region: "China" },
  { code: "AED", name: "UAE Dirham", region: "United Arab Emirates" },
  { code: "CHF", name: "Swiss Franc", region: "Switzerland" },
  { code: "SEK", name: "Swedish Krona", region: "Sweden" },
  { code: "ZAR", name: "South African Rand", region: "South Africa" },
  { code: "BRL", name: "Brazilian Real", region: "Brazil" },
  { code: "MXN", name: "Mexican Peso", region: "Mexico" },
] as const satisfies readonly CurrencyInfo[];

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function currencyInfo(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/** Exact timezone matches for the common cases. */
const TIMEZONE_CURRENCY: Record<string, CurrencyCode> = {
  "Asia/Kolkata": "INR",
  "Asia/Calcutta": "INR",
  "Asia/Dubai": "AED",
  "Asia/Singapore": "SGD",
  "Asia/Hong_Kong": "HKD",
  "Asia/Tokyo": "JPY",
  "Asia/Shanghai": "CNY",
  "Europe/London": "GBP",
  "Europe/Jersey": "GBP",
  "Europe/Guernsey": "GBP",
  "Europe/Isle_of_Man": "GBP",
  "Europe/Zurich": "CHF",
  "Europe/Stockholm": "SEK",
  "Africa/Johannesburg": "ZAR",
  "America/Sao_Paulo": "BRL",
  "America/Mexico_City": "MXN",
  "America/Toronto": "CAD",
  "America/Vancouver": "CAD",
  "America/Edmonton": "CAD",
  "America/Winnipeg": "CAD",
  "America/Halifax": "CAD",
  "Pacific/Auckland": "NZD",
  "Australia/Sydney": "AUD",
  "Australia/Melbourne": "AUD",
  "Australia/Perth": "AUD",
};

/** Euro-area zones. Other European zones (e.g. Warsaw, Oslo) are not guessed and use the fallback. */
const EURO_ZONES = new Set([
  "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Brussels",
  "Europe/Vienna", "Europe/Dublin", "Europe/Lisbon", "Europe/Helsinki", "Europe/Athens", "Europe/Tallinn",
  "Europe/Riga", "Europe/Vilnius", "Europe/Bratislava", "Europe/Ljubljana", "Europe/Zagreb",
  "Europe/Luxembourg", "Europe/Malta", "Europe/Monaco", "Europe/Andorra", "Europe/Nicosia",
  "Europe/Bratislava", "Europe/San_Marino", "Europe/Vatican",
]);

/** Region prefixes used when the exact zone isn't listed. Only unambiguous regions are included. */
const REGION_CURRENCY: Array<[prefix: string, code: CurrencyCode]> = [
  ["Australia/", "AUD"],
  ["America/", "USD"], // Canada and Mexico are listed exactly above; the rest of the Americas is mostly USD
];

export type DetectedCurrency = {
  code: CurrencyCode;
  /** False when the timezone couldn't be mapped and the fallback was used. */
  matched: boolean;
  timezone: string | null;
};

/** Maps an IANA timezone (e.g. "Asia/Kolkata") to a currency. Unknown or ambiguous zones use DEFAULT_CURRENCY. */
export function currencyForTimezone(timezone: string | null | undefined): DetectedCurrency {
  if (!timezone) return { code: DEFAULT_CURRENCY, matched: false, timezone: null };
  const exact = TIMEZONE_CURRENCY[timezone];
  if (exact) return { code: exact, matched: true, timezone };
  if (EURO_ZONES.has(timezone)) return { code: "EUR", matched: true, timezone };
  for (const [prefix, code] of REGION_CURRENCY) {
    if (timezone.startsWith(prefix)) return { code, matched: true, timezone };
  }
  return { code: DEFAULT_CURRENCY, matched: false, timezone };
}

/** The device's timezone, or null where the browser doesn't report one. Runs in the browser only. */
export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** Detects the currency from the device's timezone. */
export function detectCurrency(): DetectedCurrency {
  return currencyForTimezone(browserTimezone());
}

/**
 * The default currency for new games. Auto uses the detected currency; manual uses the saved choice.
 * Manual always wins over Auto when set manually.
 */
export function effectiveCurrency(settings: { currencyAuto: boolean; defaultCurrency: string }, detected: CurrencyCode): string {
  if (settings.currencyAuto) return detected;
  return currencyInfo(settings.defaultCurrency) ? settings.defaultCurrency : detected;
}
