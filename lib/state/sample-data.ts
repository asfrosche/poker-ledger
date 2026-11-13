import { createEmptyState, ledgerReducer, type LedgerAction } from "@/lib/state/reducer";
import type { LedgerState } from "@/types";

/**
 * First-launch demo data. Every record is flagged `isSample` and the names are
 * prefixed so it is obvious this is not real game history. Built through the
 * reducer so the sample obeys the same rules as real data.
 */
export function buildSampleState(now: Date = new Date()): LedgerState {
  let state = createEmptyState();
  let counter = 0;
  const apply = (action: LedgerAction) => {
    state = ledgerReducer(state, action);
  };
  const stamp = (daysAgo: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const dateOnly = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  const nextId = () => `sample-${++counter}`;
  const playerId = (name: string) =>
    state.players.find((p) => p.name === name)?.id ?? "";

  // Game 1: a finished night, fully paid.
  const g1 = nextId();
  const t1 = stamp(7, 20);
  apply({
    type: "game/create",
    id: g1,
    at: t1,
    name: "SAMPLE · Friday Night",
    date: dateOnly(7),
    currency: "INR",
    buyInPaise: 50000,
    chipsPerBuyIn: 1000,
    venue: "Sample venue",
    format: "No-limit Hold'em",
    notes: "Sample data. Alex rebought once.",
    isSample: true,
  });
  for (const name of ["Alex", "Sam", "Jordan", "Riya"]) {
    apply({ type: "gameplayer/add", id: nextId(), at: t1, gameId: g1, playerName: name });
  }
  apply({ type: "buyin/add", id: nextId(), at: stamp(7, 20), gameId: g1, playerId: playerId("Alex"), amountPaise: 50000, chips: 1000, note: "" });
  apply({ type: "buyin/add", id: nextId(), at: stamp(7, 22), gameId: g1, playerId: playerId("Alex"), amountPaise: 50000, chips: 1000, note: "Rebuy" });
  apply({ type: "buyin/add", id: nextId(), at: stamp(7, 20), gameId: g1, playerId: playerId("Sam"), amountPaise: 50000, chips: 1000, note: "" });
  apply({ type: "buyin/add", id: nextId(), at: stamp(7, 20), gameId: g1, playerId: playerId("Jordan"), amountPaise: 50000, chips: 1000, note: "" });
  apply({ type: "buyin/add", id: nextId(), at: stamp(7, 20), gameId: g1, playerId: playerId("Riya"), amountPaise: 50000, chips: 1000, note: "" });
  apply({ type: "final/set", id: nextId(), at: stamp(7, 23), gameId: g1, playerId: playerId("Alex"), chips: 2600 });
  apply({ type: "final/set", id: nextId(), at: stamp(7, 23), gameId: g1, playerId: playerId("Sam"), chips: 900 });
  apply({ type: "final/set", id: nextId(), at: stamp(7, 23), gameId: g1, playerId: playerId("Jordan"), chips: 1100 });
  apply({ type: "final/set", id: nextId(), at: stamp(7, 23), gameId: g1, playerId: playerId("Riya"), chips: 400 });
  const settlement1 = nextId();
  apply({ type: "settlement/generate", id: settlement1, at: stamp(7, 23), gameId: g1 });
  const s1 = state.settlements.find((s) => s.id === settlement1);
  for (const payment of s1?.payments ?? []) {
    apply({
      type: "payment/set",
      id: nextId(),
      at: stamp(6, 10),
      settlementId: settlement1,
      paymentId: payment.id,
      paid: true,
      upiRef: "SAMPLE-UPI-REF",
      note: "",
    });
  }

  // Game 2: tonight's game, still live. Dev's final count is missing on purpose.
  const g2 = nextId();
  const t2 = stamp(0, 19);
  apply({
    type: "game/create",
    id: g2,
    at: t2,
    name: "SAMPLE · Saturday Rematch",
    date: dateOnly(0),
    currency: "INR",
    buyInPaise: 50000,
    chipsPerBuyIn: 1000,
    venue: "Sample venue",
    format: "No-limit Hold'em",
    notes: "Sample data. Dev has not handed in a chip count yet.",
    isSample: true,
  });
  for (const name of ["Alex", "Sam", "Jordan", "Dev"]) {
    apply({ type: "gameplayer/add", id: nextId(), at: t2, gameId: g2, playerName: name });
  }
  apply({ type: "buyin/add", id: nextId(), at: t2, gameId: g2, playerId: playerId("Alex"), amountPaise: 50000, chips: 1000, note: "" });
  apply({ type: "buyin/add", id: nextId(), at: t2, gameId: g2, playerId: playerId("Sam"), amountPaise: 50000, chips: 1000, note: "" });
  apply({ type: "buyin/add", id: nextId(), at: t2, gameId: g2, playerId: playerId("Sam"), amountPaise: 50000, chips: 1000, note: "Rebuy" });
  apply({ type: "buyin/add", id: nextId(), at: t2, gameId: g2, playerId: playerId("Jordan"), amountPaise: 50000, chips: 1000, note: "" });
  apply({ type: "buyin/add", id: nextId(), at: t2, gameId: g2, playerId: playerId("Jordan"), amountPaise: 100000, chips: 2000, note: "Custom: ₹1,000 for 2,000 chips" });
  apply({ type: "buyin/add", id: nextId(), at: t2, gameId: g2, playerId: playerId("Dev"), amountPaise: 50000, chips: 1000, note: "" });
  apply({ type: "final/set", id: nextId(), at: t2, gameId: g2, playerId: playerId("Alex"), chips: 2500 });
  apply({ type: "final/set", id: nextId(), at: t2, gameId: g2, playerId: playerId("Sam"), chips: 1500 });
  apply({ type: "final/set", id: nextId(), at: t2, gameId: g2, playerId: playerId("Jordan"), chips: 2500 });

  return { ...state, selectedGameId: g2 };
}
