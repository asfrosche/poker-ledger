import { computeGameLedger } from "@/lib/calculations/ledger";
import type { DisplayStatus, Game, LedgerState, Player, SettlementPayment } from "@/types";

export interface PlayerGameRecord {
  game: Game;
  displayStatus: DisplayStatus;
  buyInCount: number;
  investedPaise: number;
  chipsIssued: number;
  finalChips: number | null;
  chipValuePaise: number | null;
  /** Null while the game has not been reconciled, so it does not count yet. */
  netPaise: number | null;
}

export interface PlayerPaymentRecord {
  gameName: string;
  direction: "made" | "received";
  counterpartyName: string;
  amountPaise: number;
  paid: boolean;
  paidAt: string | null;
  upiRef: string;
}

export interface PlayerHistory {
  player: Player;
  records: PlayerGameRecord[];
  gamesPlayed: number;
  completedGames: number;
  buyInCount: number;
  totalInvestedPaise: number;
  /** Actual profit/loss in money, summed over completed games only. */
  netProfitPaise: number;
  /** Chip value received, summed over completed games only. Not the same as profit. */
  totalChipValuePaise: number;
  paymentsMadePaise: number;
  paymentsReceivedPaise: number;
  payments: PlayerPaymentRecord[];
}

export function computePlayerHistory(state: LedgerState, playerId: string): PlayerHistory | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const records: PlayerGameRecord[] = [];
  for (const gp of state.gamePlayers.filter((x) => x.playerId === playerId)) {
    const ledger = computeGameLedger(state, gp.gameId);
    const row = ledger.rows.find((r) => r.playerId === playerId);
    if (!ledger.game || !row) continue;
    records.push({
      game: ledger.game,
      displayStatus: ledger.displayStatus,
      buyInCount: row.buyInCount,
      investedPaise: row.investedPaise,
      chipsIssued: row.chipsIssued,
      finalChips: row.finalChips,
      chipValuePaise: row.chipValuePaise,
      netPaise: row.netPaise,
    });
  }
  records.sort((a, b) => (a.game.date < b.game.date ? 1 : a.game.date > b.game.date ? -1 : b.game.number - a.game.number));

  const completed = records.filter((r) => r.netPaise !== null);
  const payments: PlayerPaymentRecord[] = [];
  for (const settlement of state.settlements) {
    if (settlement.supersededAt) continue;
    const game = state.games.find((g) => g.id === settlement.gameId);
    for (const payment of settlement.payments) {
      if (payment.fromPlayerId !== playerId && payment.toPlayerId !== playerId) continue;
      payments.push(toPaymentRecord(state, game?.name ?? "Unknown game", payment, playerId));
    }
  }

  const paidOut = payments.filter((p) => p.direction === "made" && p.paid);
  const paidIn = payments.filter((p) => p.direction === "received" && p.paid);

  return {
    player,
    records,
    gamesPlayed: records.length,
    completedGames: completed.length,
    buyInCount: records.reduce((s, r) => s + r.buyInCount, 0),
    totalInvestedPaise: records.reduce((s, r) => s + r.investedPaise, 0),
    netProfitPaise: completed.reduce((s, r) => s + (r.netPaise ?? 0), 0),
    totalChipValuePaise: completed.reduce((s, r) => s + (r.chipValuePaise ?? 0), 0),
    paymentsMadePaise: paidOut.reduce((s, p) => s + p.amountPaise, 0),
    paymentsReceivedPaise: paidIn.reduce((s, p) => s + p.amountPaise, 0),
    payments,
  };
}

function toPaymentRecord(
  state: LedgerState,
  gameName: string,
  payment: SettlementPayment,
  playerId: string,
): PlayerPaymentRecord {
  const outgoing = payment.fromPlayerId === playerId;
  const counterpartyId = outgoing ? payment.toPlayerId : payment.fromPlayerId;
  return {
    gameName,
    direction: outgoing ? "made" : "received",
    counterpartyName: state.players.find((p) => p.id === counterpartyId)?.name ?? "Unknown",
    amountPaise: payment.amountPaise,
    paid: payment.paid,
    paidAt: payment.paidAt,
    upiRef: payment.upiRef,
  };
}
