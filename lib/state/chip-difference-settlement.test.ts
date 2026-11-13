import { describe, expect, it } from "vitest";
import { checkSettlementEligibility } from "@/lib/calculations/ledger";
import { createEmptyState, ledgerReducer, type LedgerAction, type LedgerActionInput } from "@/lib/state/reducer";
import type { LedgerState } from "@/types";

let counter = 0;
const T = "2026-11-01T20:00:00.000Z";

function run(state: LedgerState, actions: LedgerActionInput[]): LedgerState {
  return actions.reduce<LedgerState>(
    (s, a) => ledgerReducer(s, { ...a, id: `c${++counter}`, at: T } as LedgerAction),
    state,
  );
}

/**
 * Three players buy in for 3,000 chips total (₹1,500 pool, 50 paise per chip).
 * Nets before adjustment depend on the final counts. The default finals
 * (1,200 / 900 / 800 = 2,900 chips) leave Alex +10,000 paise, Sam −5,000,
 * Jordan −10,000, which sums to −5,000 (a ₹50 residual).
 */
function mismatchedGame(finals: [number, number, number] = [1200, 900, 800]) {
  let state = run(createEmptyState(), [
    {
      type: "game/create",
      name: "Friday",
      date: "2026-11-01",
      currency: "INR",
      buyInPaise: 50000,
      chipsPerBuyIn: 1000,
      venue: "",
      format: "",
      notes: "",
      isSample: false,
    },
  ]);
  const gameId = state.games[0].id;
  const names = ["Alex", "Sam", "Jordan"];
  state = run(state, names.map((playerName) => ({ type: "gameplayer/add", gameId, playerName })));
  const ids = Object.fromEntries(names.map((n) => [n, state.players.find((p) => p.name === n)!.id]));
  state = run(
    state,
    names.map((n) => ({ type: "buyin/add", gameId, playerId: ids[n], amountPaise: 50000, chips: 1000, note: "" })),
  );
  state = run(state, [
    { type: "final/set", gameId, playerId: ids.Alex, chips: finals[0] },
    { type: "final/set", gameId, playerId: ids.Sam, chips: finals[1] },
    { type: "final/set", gameId, playerId: ids.Jordan, chips: finals[2] },
  ]);
  return { state, gameId, ids };
}

describe("settling when chips do not add up", () => {
  it("a 1-chip miscount settles with no choice; nobody in profit, so break-even players absorb it", () => {
    // 2,999 chips against 3,000 issued: a 50-paise shortfall. Alex and Sam broke even, Jordan lost 50 paise.
    const { state, gameId, ids } = mismatchedGame([1000, 1000, 999]);
    expect(checkSettlementEligibility(state, gameId).ok).toBe(true);
    const after = run(state, [{ type: "settlement/generate", gameId }]);
    const settlement = after.settlements[0];
    expect(settlement).toBeDefined();
    expect(settlement.snapshot.adjustment?.method).toBe("winners");
    expect(settlement.snapshot.adjustment?.residualPaise).toBe(-50);
    const lineFor = (id: string) => settlement.snapshot.adjustment?.lines.find((l) => l.playerId === id);
    expect(lineFor(ids.Jordan)?.adjustmentPaise).toBe(0);
    expect(lineFor(ids.Alex)!.adjustmentPaise + lineFor(ids.Sam)!.adjustmentPaise).toBe(50);
    expect(settlement.snapshot.balances.reduce((s, b) => s + b.netPaise, 0)).toBe(0);
  });

  it("winners absorb a larger shortfall: only the winner's payout changes and no loser pays more", () => {
    const { state, gameId, ids } = mismatchedGame();
    const after = run(state, [{ type: "settlement/generate", gameId }]);
    const settlement = after.settlements[0];
    expect(settlement).toBeDefined();

    const adj = settlement.snapshot.adjustment;
    expect(adj?.method).toBe("winners");
    expect(adj?.residualPaise).toBe(-5000);
    const lineFor = (id: string) => adj?.lines.find((l) => l.playerId === id);
    expect(lineFor(ids.Alex)?.adjustmentPaise).toBe(5000);
    expect(lineFor(ids.Sam)?.adjustmentPaise).toBe(0);
    expect(lineFor(ids.Jordan)?.adjustmentPaise).toBe(0);

    // Alex nets +10,000 raw, +15,000 after absorbing; Sam −5,000 and Jordan −10,000 are unchanged.
    const payments = settlement.payments.map((p) => [p.fromPlayerId, p.toPlayerId, p.amountPaise]);
    expect(payments).toEqual([
      [ids.Jordan, ids.Alex, 10000],
      [ids.Sam, ids.Alex, 5000],
    ]);
    expect(settlement.snapshot.balances.reduce((s, b) => s + b.netPaise, 0)).toBe(0);
  });

  it("an over-count is taken back from the winners, not from the losers", () => {
    // 3,100 chips against 3,000 issued: Jordan's stack is worth ₹50 more than was put in.
    const { state, gameId, ids } = mismatchedGame([1000, 1000, 1100]);
    const after = run(state, [{ type: "settlement/generate", gameId }]);
    const settlement = after.settlements[0];
    expect(settlement).toBeDefined();
    expect(settlement.snapshot.adjustment?.residualPaise).toBe(5000);
    const lineFor = (id: string) => settlement.snapshot.adjustment?.lines.find((l) => l.playerId === id);
    expect(lineFor(ids.Jordan)?.adjustmentPaise).toBe(-5000);
    expect(lineFor(ids.Alex)?.adjustmentPaise).toBe(0);
    expect(lineFor(ids.Sam)?.adjustmentPaise).toBe(0);
    expect(settlement.snapshot.balances.reduce((s, b) => s + b.netPaise, 0)).toBe(0);
  });
});
