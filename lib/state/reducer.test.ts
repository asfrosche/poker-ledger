import { describe, expect, it } from "vitest";
import { computeGameLedger, checkSettlementEligibility, computeGameTotals } from "@/lib/calculations/ledger";
import { computePlayerHistory } from "@/lib/calculations/player-history";
import { createEmptyState, ledgerReducer, type LedgerAction, type LedgerActionInput } from "@/lib/state/reducer";
import { buildSampleState } from "@/lib/state/sample-data";
import type { LedgerState } from "@/types";

let counter = 0;
const T = "2026-11-01T20:00:00.000Z";

/** Applies actions with auto-generated ids and a fixed timestamp. */
function run(state: LedgerState, actions: LedgerActionInput[]): LedgerState {
  return actions.reduce<LedgerState>(
    (s, a) => ledgerReducer(s, { ...a, id: `t${++counter}`, at: T } as LedgerAction),
    state,
  );
}

function newGame(state: LedgerState, name = "Friday", buyInPaise = 50000, chips = 1000, isSample = false) {
  const before = state.games.length;
  const next = run(state, [
    {
      type: "game/create",
      name,
      date: "2026-11-01",
      currency: "INR",
      buyInPaise,
      chipsPerBuyIn: chips,
      venue: "",
      format: "",
      notes: "",
      isSample,
    },
  ]);
  expect(next.games.length).toBe(before + 1);
  return { state: next, gameId: next.games[next.games.length - 1].id };
}

function playerId(state: LedgerState, name: string): string {
  const id = state.players.find((p) => p.name === name)?.id;
  if (!id) throw new Error(`no player ${name}`);
  return id;
}

describe("game creation and configuration", () => {
  it("creates an independent game with its own config and numbering", () => {
    const first = newGame(createEmptyState(), "One");
    const second = newGame(first.state, "Two", 100000, 2000);
    const games = second.state.games;
    expect(games.map((g) => g.number)).toEqual([1, 2]);
    expect(games[1].buyInPaise).toBe(100000);
    expect(games[1].chipsPerBuyIn).toBe(2000);
    expect(second.state.selectedGameId).toBe(second.gameId);
  });

  it("changing game settings does not affect historical games", () => {
    const { state, gameId } = newGame(createEmptyState(), "Old");
    const withPlayer = run(state, [{ type: "gameplayer/add", gameId, playerName: "Alex" }]);
    const pid = playerId(withPlayer, "Alex");
    const withPlayers = run(withPlayer, [
      { type: "buyin/add", gameId, playerId: pid, amountPaise: 50000, chips: 1000, note: "" },
    ]);
    // Settle the old game so it is locked.
    const finalised = run(withPlayers, [
      { type: "final/set", gameId, playerId: pid, chips: 1000 },
      { type: "settlement/generate", gameId },
    ]);
    const afterChange = run(finalised, [
      { type: "game/create", name: "New", date: "2026-11-08", currency: "INR", buyInPaise: 100000, chipsPerBuyIn: 500, venue: "", format: "", notes: "" },
    ]);
    const old = afterChange.games.find((g) => g.id === gameId);
    expect(old?.buyInPaise).toBe(50000);
    expect(old?.chipsPerBuyIn).toBe(1000);
    // Editing a settled game is refused.
    const attempt = run(afterChange, [{ type: "game/update", gameId, patch: { buyInPaise: 99900 } }]);
    expect(attempt.games.find((g) => g.id === gameId)?.buyInPaise).toBe(50000);
  });
});

describe("players and buy-ins", () => {
  it("prevents duplicate players within a game", () => {
    const { state, gameId } = newGame(createEmptyState());
    const once = run(state, [{ type: "gameplayer/add", gameId, playerName: "Sam" }]);
    const twice = run(once, [{ type: "gameplayer/add", gameId, playerName: "sam " }]);
    expect(twice.gamePlayers.filter((gp) => gp.gameId === gameId)).toHaveLength(1);
    expect(twice.players.filter((p) => p.name === "Sam")).toHaveLength(1);
  });

  it("reuses an existing player profile across games", () => {
    const g1 = newGame(createEmptyState(), "One");
    const a = run(g1.state, [{ type: "gameplayer/add", gameId: g1.gameId, playerName: "Alex" }]);
    const g2 = newGame(a, "Two");
    const b = run(g2.state, [{ type: "gameplayer/add", gameId: g2.gameId, playerName: "Alex" }]);
    expect(b.players.filter((p) => p.name === "Alex")).toHaveLength(1);
    expect(b.gamePlayers.filter((gp) => gp.playerId === playerId(b, "Alex"))).toHaveLength(2);
  });

  it("buy-ins and rebuys add money and chips but not the final chip count", () => {
    const { state, gameId } = newGame(createEmptyState());
    const s = run(state, [{ type: "gameplayer/add", gameId, playerName: "Alex" }]);
    const pid = playerId(s, "Alex");
    const withBuyIn = run(s, [{ type: "buyin/add", gameId, playerId: pid, amountPaise: 50000, chips: 1000, note: "" }]);
    const withRebuy = run(withBuyIn, [{ type: "buyin/add", gameId, playerId: pid, amountPaise: 50000, chips: 1000, note: "Rebuy" }]);
    const row = computeGameLedger(withRebuy, gameId).rows[0];
    expect(row.buyInCount).toBe(2);
    expect(row.investedPaise).toBe(100000);
    expect(row.chipsIssued).toBe(2000);
    expect(row.finalChips).toBeNull();
  });

  it("refuses negative or zero buy-ins and chips", () => {
    const { state, gameId } = newGame(createEmptyState());
    const s = run(state, [{ type: "gameplayer/add", gameId, playerName: "Alex" }]);
    const pid = playerId(s, "Alex");
    const bad = run(s, [
      { type: "buyin/add", gameId, playerId: pid, amountPaise: 0, chips: 1000, note: "" },
      { type: "buyin/add", gameId, playerId: pid, amountPaise: 50000, chips: -1, note: "" },
      { type: "final/set", gameId, playerId: pid, chips: -5 },
    ]);
    expect(bad.buyIns).toHaveLength(0);
    expect(bad.gamePlayers[0].finalChips).toBeNull();
  });

  it("supports custom buy-ins with different money and chips", () => {
    const { state, gameId } = newGame(createEmptyState());
    const s = run(state, [{ type: "gameplayer/add", gameId, playerName: "Jordan" }]);
    const pid = playerId(s, "Jordan");
    const custom = run(s, [{ type: "buyin/add", gameId, playerId: pid, amountPaise: 100000, chips: 2000, note: "Custom" }]);
    const totals = computeGameTotals(custom, gameId);
    expect(totals.moneyCollectedPaise).toBe(100000);
    expect(totals.chipsIssued).toBe(2000);
  });

  it("edits and removes transactions, and updates totals", () => {
    const { state, gameId } = newGame(createEmptyState());
    const s = run(state, [{ type: "gameplayer/add", gameId, playerName: "Sam" }]);
    const pid = playerId(s, "Sam");
    const added = run(s, [{ type: "buyin/add", gameId, playerId: pid, amountPaise: 50000, chips: 1000, note: "" }]);
    const buyInId = added.buyIns[0].id;
    const edited = run(added, [{ type: "buyin/update", buyInId, amountPaise: 60000, chips: 1200, note: "fixed" }]);
    expect(computeGameTotals(edited, gameId).chipsIssued).toBe(1200);
    const deleted = run(edited, [{ type: "buyin/delete", buyInId }]);
    expect(deleted.buyIns).toHaveLength(0);
    expect(computeGameTotals(deleted, gameId).chipsIssued).toBe(0);
  });

  it("removing a player removes their buy-ins from this game only", () => {
    const g1 = newGame(createEmptyState(), "One");
    let s = run(g1.state, [
      { type: "gameplayer/add", gameId: g1.gameId, playerName: "Alex" },
      { type: "gameplayer/add", gameId: g1.gameId, playerName: "Sam" },
    ]);
    s = run(s, [
      { type: "buyin/add", gameId: g1.gameId, playerId: playerId(s, "Alex"), amountPaise: 50000, chips: 1000, note: "" },
      { type: "buyin/add", gameId: g1.gameId, playerId: playerId(s, "Sam"), amountPaise: 50000, chips: 1000, note: "" },
    ]);
    const removed = run(s, [{ type: "gameplayer/remove", gameId: g1.gameId, playerId: playerId(s, "Sam") }]);
    expect(removed.buyIns.map((b) => b.playerId)).toEqual([playerId(s, "Alex")]);
    expect(removed.players.some((p) => p.name === "Sam")).toBe(true);
  });
});

describe("chip reconciliation and settlement", () => {
  function table(chipsByName: Record<string, number | null>) {
    const { state, gameId } = newGame(createEmptyState(), "Table", 50000, 1000);
    let s = run(state, Object.keys(chipsByName).map((name) => ({ type: "gameplayer/add" as const, gameId, playerName: name })));
    for (const name of Object.keys(chipsByName)) {
      s = run(s, [{ type: "buyin/add", gameId, playerId: playerId(s, name), amountPaise: 50000, chips: 1000, note: "" }]);
    }
    for (const [name, chips] of Object.entries(chipsByName)) {
      s = run(s, [{ type: "final/set", gameId, playerId: playerId(s, name), chips }]);
    }
    return { state: s, gameId };
  }

  it("single winner and loser settles with one transfer", () => {
    const { state, gameId } = table({ Alex: 1500, Sam: 500 });
    const ledger = computeGameLedger(state, gameId);
    expect(ledger.totals.reconciled).toBe(true);
    expect(ledger.rows.map((r) => r.netPaise)).toEqual([25000, -25000]);
    const after = run(state, [{ type: "settlement/generate", gameId }]);
    const settlement = after.settlements[0];
    expect(settlement.payments).toHaveLength(1);
    expect(settlement.payments[0].amountPaise).toBe(25000);
    expect(after.games[0].status).toBe("settling");
  });

  it("unbalanced chips settle with the winners absorbing the difference", () => {
    const { state, gameId } = table({ Alex: 1500, Sam: 400 });
    expect(checkSettlementEligibility(state, gameId).ok).toBe(true);
    const after = run(state, [{ type: "settlement/generate", gameId }]);
    const settlement = after.settlements[0];
    expect(settlement).toBeDefined();
    expect(settlement.snapshot.adjustment?.method).toBe("winners");
    expect(settlement.snapshot.balances.reduce((s, b) => s + b.netPaise, 0)).toBe(0);
  });

  it("missing final chip count blocks settlement", () => {
    const { state, gameId } = table({ Alex: 1500, Sam: null });
    expect(checkSettlementEligibility(state, gameId).ok).toBe(false);
  });

  it("zero balances settle immediately with no payments", () => {
    const { state, gameId } = table({ Alex: 1000, Sam: 1000 });
    const after = run(state, [{ type: "settlement/generate", gameId }]);
    expect(after.settlements[0].payments).toHaveLength(0);
    expect(after.games[0].status).toBe("settled");
  });

  it("multiple winners and losers: balances sum to zero and every payment is tracked", () => {
    // Pool ₹2,000 over 4,000 chips => ₹0.50/chip. Nets: Alex +300, Sam -50, Jordan +50, Riya -300.
    const { state, gameId } = table({ Alex: 1600, Sam: 900, Jordan: 1100, Riya: 400 });
    const ledger = computeGameLedger(state, gameId);
    expect(ledger.balanced).toBe(true);
    expect(ledger.rows.map((r) => r.netPaise)).toEqual([30000, -5000, 5000, -30000]);
    const after = run(state, [{ type: "settlement/generate", gameId }]);
    const payments = after.settlements[0].payments;
    expect(payments).toHaveLength(2);
    expect(payments.reduce((s, p) => s + p.amountPaise, 0)).toBe(35000);
    expect(payments.every((p) => !p.paid)).toBe(true);
  });

  it("payment tracking: settles the game only when every payment is recorded as paid", () => {
    const { state, gameId } = table({ Alex: 1600, Sam: 900, Jordan: 1100, Riya: 400 });
    const generated = run(state, [{ type: "settlement/generate", gameId }]);
    const settlement = generated.settlements[0];
    const [first, ...rest] = settlement.payments;
    const partial = run(generated, [
      { type: "payment/set", settlementId: settlement.id, paymentId: first.id, paid: true, upiRef: "UPI1", note: "" },
    ]);
    expect(partial.games[0].status).toBe("settling");
    expect(partial.settlements[0].payments[0].paidAt).toBe(T);
    expect(partial.settlements[0].payments[0].upiRef).toBe("UPI1");

    const done = rest.reduce(
      (s, p) => run(s, [{ type: "payment/set", settlementId: settlement.id, paymentId: p.id, paid: true, upiRef: "", note: "" }]),
      partial,
    );
    expect(done.games[0].status).toBe("settled");
    expect(done.games[0].settledAt).toBe(T);

    const reverted = run(done, [
      { type: "payment/set", settlementId: settlement.id, paymentId: first.id, paid: false, upiRef: "", note: "" },
    ]);
    expect(reverted.games[0].status).toBe("settling");
    expect(reverted.settlements[0].payments[0].paidAt).toBeNull();
  });

  it("settlement is generated once; reopening keeps the same payments", () => {
    const { state, gameId } = table({ Alex: 1600, Sam: 900, Jordan: 1100, Riya: 400 });
    const once = run(state, [{ type: "settlement/generate", gameId }]);
    const twice = run(once, [{ type: "settlement/generate", gameId }]);
    expect(twice.settlements).toHaveLength(1);
    expect(twice.settlements[0].payments).toEqual(once.settlements[0].payments);
  });

  it("a settled game cannot be edited until it is unlocked with a reason", () => {
    const { state, gameId } = table({ Alex: 1500, Sam: 500 });
    const settled = run(state, [{ type: "settlement/generate", gameId }]);
    const sid = settled.settlements[0].id;
    const paid = run(settled, [{ type: "payment/set", settlementId: sid, paymentId: settled.settlements[0].payments[0].id, paid: true, upiRef: "", note: "" }]);
    expect(paid.games[0].status).toBe("settled");
    const blocked = run(paid, [{ type: "final/set", gameId, playerId: playerId(paid, "Alex"), chips: 999 }]);
    expect(blocked.gamePlayers.find((gp) => gp.playerId === playerId(blocked, "Alex"))?.finalChips).toBe(1500);

    const noReason = run(paid, [{ type: "game/unlock", gameId, reason: "x" }]);
    expect(noReason.games[0].status).toBe("settled");

    const unlocked = run(paid, [{ type: "game/unlock", gameId, reason: "Sam chips were miscounted" }]);
    expect(unlocked.games[0].status).toBe("open");
    expect(unlocked.settlements[0].supersededAt).toBe(T);
    expect(unlocked.audit.some((a) => a.message.includes("miscounted"))).toBe(true);
  });

  it("archived games stay read-only and can be archived only once settled", () => {
    const { state, gameId } = table({ Alex: 1000, Sam: 1000 });
    const notYet = run(state, [{ type: "game/archive", gameId }]);
    expect(notYet.games[0].status).toBe("open");
    const settled = run(state, [{ type: "settlement/generate", gameId }]);
    const archived = run(settled, [{ type: "game/archive", gameId }]);
    expect(archived.games[0].status).toBe("archived");
  });
});

describe("historical isolation and player history", () => {
  it("player history separates money profit from chip value", () => {
    const g1 = newGame(createEmptyState(), "One");
    let s = run(g1.state, [
      { type: "gameplayer/add", gameId: g1.gameId, playerName: "Alex" },
      { type: "gameplayer/add", gameId: g1.gameId, playerName: "Sam" },
    ]);
    s = run(s, [
      { type: "buyin/add", gameId: g1.gameId, playerId: playerId(s, "Alex"), amountPaise: 50000, chips: 1000, note: "" },
      { type: "buyin/add", gameId: g1.gameId, playerId: playerId(s, "Sam"), amountPaise: 50000, chips: 1000, note: "" },
      { type: "final/set", gameId: g1.gameId, playerId: playerId(s, "Alex"), chips: 1500 },
      { type: "final/set", gameId: g1.gameId, playerId: playerId(s, "Sam"), chips: 500 },
    ]);
    const history = computePlayerHistory(s, playerId(s, "Alex"));
    expect(history?.gamesPlayed).toBe(1);
    expect(history?.totalChipValuePaise).toBe(75000);
    expect(history?.netProfitPaise).toBe(25000);
    expect(history?.totalInvestedPaise).toBe(50000);
  });

  it("clearing sample data leaves real games untouched", () => {
    const sample = buildSampleState(new Date("2026-11-13T12:00:00Z"));
    const real = newGame(sample, "Real night").state;
    const cleared = run(real, [{ type: "data/clear-samples" }]);
    expect(cleared.games.map((g) => g.name)).toEqual(["Real night"]);
    expect(cleared.buyIns.every((b) => cleared.games.some((g) => g.id === b.gameId))).toBe(true);
  });
});

describe("sample data", () => {
  it("first-launch sample is internally consistent and flagged as sample", () => {
    const state = buildSampleState(new Date("2026-11-13T12:00:00Z"));
    expect(state.games.every((g) => g.isSample)).toBe(true);
    const finished = state.games.find((g) => g.status === "settled");
    expect(finished).toBeDefined();
    const ledger = computeGameLedger(state, finished!.id);
    expect(ledger.balanced).toBe(true);
    expect(state.settlements.find((s) => s.gameId === finished!.id)?.payments.every((p) => p.paid)).toBe(true);
    const live = computeGameLedger(state, state.selectedGameId!);
    expect(live.totals.reconciled).toBe(false);
    expect(live.totals.chipDifference).toBe(500);
  });
});
