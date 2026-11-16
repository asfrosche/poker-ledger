import { z } from "zod";
import { parseMoneyToPaise, SUPPORTED_CURRENCIES } from "@/lib/money";
import { capitalizeName } from "@/lib/player-names";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");
const isoTimestamp = z.string().min(1);

/** Form-level game configuration. Money fields arrive as user-typed rupees. */
export const gameConfigFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the game a name").max(60, "Keep the name under 60 characters"),
    date: isoDate,
    currency: z.enum(SUPPORTED_CURRENCIES, { message: "Pick a supported currency" }),
    buyInText: z.string(),
    chipsText: z.string(),
    venue: z.string().trim().max(80, "Venue must be under 80 characters"),
    notes: z.string().trim().max(2000, "Notes must be under 2,000 characters"),
    variants: z
      .array(z.enum(["nlh", "plo", "omaha5", "hilo", "stud7", "short"]))
      .min(1, "Pick at least one variant")
      .max(6, "Pick up to six variants"),
    smallBlindText: z.string(),
    bigBlindText: z.string(),
  })
  .transform((value, ctx) => {
    const blinds = parseBlinds(value.smallBlindText, value.bigBlindText);
    if (blinds.error) ctx.addIssue({ code: "custom", message: blinds.error, path: ["bigBlindText"] });
    const buyInPaise = parseMoneyToPaise(value.buyInText);
    if (buyInPaise === null || buyInPaise <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter a buy-in such as 500 or 500.50", path: ["buyInText"] });
    }
    const chipsPerBuyIn = Number(value.chipsText.replace(/,/g, "").trim());
    if (!Number.isInteger(chipsPerBuyIn) || chipsPerBuyIn <= 0 || chipsPerBuyIn > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "Chips must be a whole number above zero", path: ["chipsText"] });
    }
    return {
      ...value,
      buyInPaise: buyInPaise ?? 0,
      chipsPerBuyIn: Number.isInteger(chipsPerBuyIn) ? chipsPerBuyIn : 0,
      smallBlindPaise: blinds.small,
      bigBlindPaise: blinds.big,
    };
  });

/**
 * Blinds are optional. Both empty means none recorded. If one is given, both must be valid amounts,
 * the small blind zero or more, and the big blind strictly larger than the small blind.
 */
export function parseBlinds(smallText: string, bigText: string): { small: number | null; big: number | null; error?: string } {
  const s = smallText.trim();
  const b = bigText.trim();
  if (!s && !b) return { small: null, big: null };
  if (!s || !b) return { small: null, big: null, error: "Enter both blinds, or leave both empty" };
  const small = parseMoneyToPaise(s);
  if (small === null) return { small: null, big: null, error: "Enter a small blind of zero or more, such as 5 or 5.50" };
  const big = parseMoneyToPaise(b);
  if (big === null) return { small: null, big: null, error: "Enter a big blind of zero or more, such as 10" };
  if (big <= small) return { small: null, big: null, error: "The big blind must be more than the small blind" };
  return { small, big };
}

export type GameConfigFormInput = z.input<typeof gameConfigFormSchema>;

export function validateGameConfig(input: GameConfigFormInput) {
  const result = gameConfigFormSchema.safeParse(input);
  if (result.success) return { data: result.data, errors: {} as Record<string, string> };
  return { data: null, errors: issuesToRecord(result.error.issues) };
}

/** Standard + custom buy-in form. */
export const buyInFormSchema = z
  .object({
    amountText: z.string(),
    chipsText: z.string(),
    note: z.string().trim().max(200, "Note must be under 200 characters"),
  })
  .transform((value, ctx) => {
    const amountPaise = parseMoneyToPaise(value.amountText);
    if (amountPaise === null || amountPaise <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount greater than zero", path: ["amountText"] });
    }
    const chips = Number(value.chipsText.replace(/,/g, "").trim());
    if (!Number.isInteger(chips) || chips <= 0) {
      ctx.addIssue({ code: "custom", message: "Chips must be a whole number above zero", path: ["chipsText"] });
    }
    return { amountPaise: amountPaise ?? 0, chips: Number.isInteger(chips) ? chips : 0, note: value.note };
  });

export function validateBuyIn(input: z.input<typeof buyInFormSchema>) {
  const result = buyInFormSchema.safeParse(input);
  if (result.success) return { data: result.data, errors: {} as Record<string, string> };
  return { data: null, errors: issuesToRecord(result.error.issues) };
}

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a player name")
  .max(40, "Keep names under 40 characters");

/** Final chip count: empty means "not counted yet". */
export function parseFinalChips(text: string): { value: number | null; error?: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null };
  const n = Number(trimmed.replace(/,/g, ""));
  if (!Number.isInteger(n) || n < 0) return { value: null, error: "Whole number, zero or more" };
  return { value: n };
}

export const paymentDetailsSchema = z.object({
  upiRef: z.string().trim().max(60, "Reference must be under 60 characters"),
  note: z.string().trim().max(200, "Note must be under 200 characters"),
});

export const unlockReasonSchema = z
  .string()
  .trim()
  .min(3, "Explain the correction (at least 3 characters)")
  .max(200, "Keep the reason under 200 characters");

const playerRecordSchema = z.object({
  id: z.string(),
  // Names saved before capitalisation was enforced are fixed on load.
  name: z.string().transform(capitalizeName),
  createdAt: isoTimestamp,
});

const variantKey = z.enum(["nlh", "plo", "omaha5", "hilo", "stud7", "short"]);

const gameRecordSchema = z.preprocess(
  // Games saved with the single `variant` field become a one-item `variants` list.
  (raw) => {
    if (raw && typeof raw === "object" && !("variants" in raw)) {
      const legacy = (raw as { variant?: unknown }).variant;
      return { ...raw, variants: typeof legacy === "string" ? [legacy] : ["nlh"] };
    }
    return raw;
  },
  z.object({
  id: z.string(),
  number: z.number().int(),
  name: z.string(),
  date: isoDate,
  currency: z.string(),
  buyInPaise: z.number().int().nonnegative(),
  chipsPerBuyIn: z.number().int().nonnegative(),
  venue: z.string(),
  format: z.string(),
  notes: z.string(),
  // Games saved before variants existed default to No-Limit Hold'em with no recorded blinds.
  variants: z.array(variantKey).min(1),
  smallBlindPaise: z.number().int().nonnegative().nullable().default(null),
  bigBlindPaise: z.number().int().nonnegative().nullable().default(null),
  status: z.enum(["open", "settling", "settled", "archived"]),
  createdAt: isoTimestamp,
  settledAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  }),
);

const buyInRecordSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  playerId: z.string(),
  amountPaise: z.number().int().positive(),
  chips: z.number().int().positive(),
  note: z.string(),
  createdAt: isoTimestamp,
  updatedAt: z.string().nullable(),
});

const settlementRecordSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  createdAt: isoTimestamp,
  supersededAt: z.string().nullable(),
  supersedeReason: z.string().nullable(),
  snapshot: z.object({
    totalInvestedPaise: z.number().int(),
    totalChipValuePaise: z.number().int(),
    balances: z.array(z.object({ playerId: z.string(), netPaise: z.number().int() })),
    adjustment: z
      .object({
        method: z.enum(["winners", "even"]),
        residualPaise: z.number().int(),
        lines: z.array(
          z.object({ playerId: z.string(), rawNetPaise: z.number().int(), adjustmentPaise: z.number().int() }),
        ),
      })
      .nullable()
      .optional(),
  }),
  payments: z.array(
    z.object({
      id: z.string(),
      settlementId: z.string(),
      fromPlayerId: z.string(),
      toPlayerId: z.string(),
      amountPaise: z.number().int().positive(),
      paid: z.boolean(),
      paidAt: z.string().nullable(),
      upiRef: z.string(),
      note: z.string(),
    }),
  ),
});

/** Validates a saved ledger on load so corrupted storage can't crash the app. */
export const ledgerStateSchema = z.object({
  schemaVersion: z.literal(1),
  settings: z.object({
    // Newer fields default safely, so ledgers saved before they existed still load.
    currencyAuto: z.boolean().default(true),
    defaultCurrency: z.string(),
    defaultBuyInPaise: z.number().int().positive(),
    defaultChipsPerBuyIn: z.number().int().positive(),
    defaultFormat: z.string(),
    defaultSmallBlindPaise: z.number().int().nonnegative().default(500),
    defaultBigBlindPaise: z.number().int().nonnegative().default(1000),
  }),
  players: z.array(playerRecordSchema),
  games: z.array(gameRecordSchema),
  gamePlayers: z.array(
    z.object({
      gameId: z.string(),
      playerId: z.string(),
      finalChips: z.number().int().nonnegative().nullable(),
    }),
  ),
  buyIns: z.array(buyInRecordSchema),
  settlements: z.array(settlementRecordSchema),
  audit: z.array(z.object({ id: z.string(), at: z.string(), gameId: z.string().nullable(), message: z.string() })),
  selectedGameId: z.string().nullable(),
});

function issuesToRecord(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
