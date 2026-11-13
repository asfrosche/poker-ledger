import { z } from "zod";
import { parseMoneyToPaise, SUPPORTED_CURRENCIES } from "@/lib/money";

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
    format: z.string().trim().max(80, "Format must be under 80 characters"),
    notes: z.string().trim().max(2000, "Notes must be under 2,000 characters"),
  })
  .transform((value, ctx) => {
    const buyInPaise = parseMoneyToPaise(value.buyInText);
    if (buyInPaise === null || buyInPaise <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter a buy-in such as 500 or 500.50", path: ["buyInText"] });
    }
    const chipsPerBuyIn = Number(value.chipsText.replace(/,/g, "").trim());
    if (!Number.isInteger(chipsPerBuyIn) || chipsPerBuyIn <= 0 || chipsPerBuyIn > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "Chips must be a whole number above zero", path: ["chipsText"] });
    }
    return { ...value, buyInPaise: buyInPaise ?? 0, chipsPerBuyIn: Number.isInteger(chipsPerBuyIn) ? chipsPerBuyIn : 0 };
  });

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
  name: z.string(),
  isSample: z.boolean(),
  createdAt: isoTimestamp,
});

const gameRecordSchema = z.object({
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
  status: z.enum(["open", "settling", "settled", "archived"]),
  isSample: z.boolean(),
  createdAt: isoTimestamp,
  settledAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
});

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
    defaultCurrency: z.string(),
    defaultBuyInPaise: z.number().int().positive(),
    defaultChipsPerBuyIn: z.number().int().positive(),
    defaultFormat: z.string(),
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
