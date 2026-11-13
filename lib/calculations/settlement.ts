import type { Balance } from "@/lib/calculations/ledger";

export interface Transfer {
  fromPlayerId: string;
  toPlayerId: string;
  amountPaise: number;
}

export class UnbalancedSettlementError extends Error {
  constructor(public readonly residualPaise: number) {
    super(
      `Balances do not sum to zero (residual ${residualPaise} paise). Settlement blocked.`,
    );
    this.name = "UnbalancedSettlementError";
  }
}

/**
 * Greedy minimum-transfer settlement on integer paise.
 *
 * 1. Split balances into debtors (net < 0) and creditors (net > 0).
 * 2. Sort both by outstanding amount, largest first (ties by player id for determinism).
 * 3. Match the largest debtor with the largest creditor, pay min(outstanding) and
 *    reduce both. Repeat until everyone is settled.
 *
 * Throws if the balances do not sum to exactly zero, so rounding can never be dropped.
 */
export function computeTransfers(balances: Balance[]): Transfer[] {
  const residual = balances.reduce((sum, b) => sum + b.netPaise, 0);
  if (residual !== 0) throw new UnbalancedSettlementError(residual);

  const byAmountDesc = (a: { id: string; remaining: number }, b: { id: string; remaining: number }) =>
    b.remaining - a.remaining || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const debtors = balances
    .filter((b) => b.netPaise < 0)
    .map((b) => ({ id: b.playerId, remaining: -b.netPaise }))
    .sort(byAmountDesc);
  const creditors = balances
    .filter((b) => b.netPaise > 0)
    .map((b) => ({ id: b.playerId, remaining: b.netPaise }))
    .sort(byAmountDesc);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount > 0) {
      transfers.push({
        fromPlayerId: debtor.id,
        toPlayerId: creditor.id,
        amountPaise: amount,
      });
    }
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0) d++;
    if (creditor.remaining === 0) c++;
  }

  const owed = debtors.reduce((s, x) => s + x.remaining, 0);
  const due = creditors.reduce((s, x) => s + x.remaining, 0);
  if (owed !== 0 || due !== 0) {
    throw new UnbalancedSettlementError(due - owed);
  }
  return transfers;
}
