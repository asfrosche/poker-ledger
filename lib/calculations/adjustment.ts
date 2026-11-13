import type { Balance } from "@/lib/calculations/ledger";
import type { AdjustmentMethod, SettlementAdjustment } from "@/types";

/**
 * Settling a chip difference. Pure functions only.
 *
 * When final chip counts do not add up to the chips issued, the player nets no
 * longer sum to zero. The residual (sum of nets) is spread so that the adjusted
 * balances sum to exactly zero again. The rule is that nobody loses more money:
 * the difference is absorbed by the winners (in proportion to their profit).
 * If chips went missing and nobody is in profit, players who broke even receive it.
 *  - "winners": the default and the rule the app uses.
 *  - "even":    legacy option, kept so older settlements still read correctly.
 */

export const ADJUSTMENT_LABELS: Record<AdjustmentMethod, string> = {
  winners: "Winners absorb it",
  even: "Split evenly",
};

export const ADJUSTMENT_HINTS: Record<AdjustmentMethod, string> = {
  winners: "Each winner's payout shifts in proportion to their profit.",
  even: "Spread across every player, in whole paise.",
};

/** Chip differences up to this many chips are treated as a miscount and settled automatically. */
export const ROUNDING_TOLERANCE_CHIPS = 2;

export function isRoundingDifference(chipDifference: number): boolean {
  return chipDifference !== 0 && Math.abs(chipDifference) <= ROUNDING_TOLERANCE_CHIPS;
}

/**
 * Splits a whole-paise total across keys in proportion to their weights.
 * Largest remainder keeps the parts summing to exactly `totalPaise`; leftover paise
 * go to the largest remainders, ties by input order. Negative totals are supported.
 */
export function splitByWeight(
  totalPaise: number,
  weights: { key: string; weight: number }[],
): Map<string, number> {
  const result = new Map<string, number>();
  const sign = totalPaise < 0 ? -1 : 1;
  const total = BigInt(Math.abs(totalPaise));
  const weightSum = weights.reduce((sum, w) => sum + BigInt(w.weight), BigInt(0));
  if (weightSum === BigInt(0)) {
    for (const w of weights) result.set(w.key, 0);
    return result;
  }

  const parts = weights.map((w, index) => {
    const numerator = total * BigInt(w.weight);
    return { key: w.key, index, floor: numerator / weightSum, remainder: numerator % weightSum };
  });
  let deficit = total - parts.reduce((sum, p) => sum + p.floor, BigInt(0));

  const byRemainder = [...parts].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.index - b.index;
  });
  const extra = new Map<string, bigint>();
  for (let step = 0; deficit > BigInt(0); step++, deficit--) {
    const key = byRemainder[step % byRemainder.length].key;
    extra.set(key, (extra.get(key) ?? BigInt(0)) + BigInt(1));
  }

  for (const part of parts) {
    const value = Number(part.floor + (extra.get(part.key) ?? BigInt(0)));
    result.set(part.key, value === 0 ? 0 : sign * value);
  }
  return result;
}

export type AdjustmentPlan =
  | { ok: true; adjustment: SettlementAdjustment }
  | { ok: false; reason: string };

/** Works out how each player's balance changes so the balances sum to zero. */
export function computeAdjustment(raw: Balance[], method: AdjustmentMethod): AdjustmentPlan {
  const sorted = [...raw].sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
  const residual = sorted.reduce((sum, b) => sum + b.netPaise, 0);
  const lines = (amounts: Map<string, number>) =>
    sorted.map((b) => ({
      playerId: b.playerId,
      rawNetPaise: b.netPaise,
      adjustmentPaise: amounts.get(b.playerId) ?? 0,
    }));

  if (residual === 0) {
    return { ok: true, adjustment: { method, residualPaise: 0, lines: lines(new Map()) } };
  }

  // Amount the balances must gain in total so that they sum to zero.
  const need = -residual;
  let weights: { key: string; weight: number }[];
  if (method === "winners") {
    const winners = sorted.filter((b) => b.netPaise > 0);
    if (winners.length > 0) {
      weights = winners.map((b) => ({ key: b.playerId, weight: b.netPaise }));
    } else {
      // Nobody profited, so any money still to be absorbed goes to the players who broke even.
      const even = sorted.filter((b) => b.netPaise === 0);
      if (need > 0 && even.length > 0) {
        weights = even.map((b) => ({ key: b.playerId, weight: 1 }));
      } else {
        return {
          ok: false,
          reason: "Nobody is in profit to absorb this difference, so the settlement cannot be generated yet. Re-check the final counts.",
        };
      }
    }
  } else {
    weights = sorted.map((b) => ({ key: b.playerId, weight: 1 }));
  }

  return {
    ok: true,
    adjustment: { method, residualPaise: residual, lines: lines(splitByWeight(need, weights)) },
  };
}

/** Balances used for payments: raw nets with the adjustment applied. */
export function applyAdjustment(raw: Balance[], adjustment: SettlementAdjustment | null): Balance[] {
  if (!adjustment) return raw.map((b) => ({ ...b }));
  const adds = new Map(adjustment.lines.map((l) => [l.playerId, l.adjustmentPaise]));
  return raw.map((b) => ({ playerId: b.playerId, netPaise: b.netPaise + (adds.get(b.playerId) ?? 0) }));
}
