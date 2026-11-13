import { computeAdjustment } from "@/lib/calculations/adjustment";
import type { AdjustmentMethod, DisplayStatus, Game, LedgerState } from "@/types";

/**
 * Game-level financial engine. Pure functions only; no React.
 *
 * Definitions
 *  - Money pool        = sum of all buy-in amounts (paise).
 *  - Chips issued      = sum of all buy-in chips.
 *  - Value per chip    = money pool / chips issued. For standard buy-ins this equals
 *                        buy-in / chips-per-buy-in exactly.
 *  - Final chip value  = final chips x value per chip, allocated in whole paise so the
 *                        allocated values always sum to the rounded exact total.
 *  - Net               = final chip value - total invested.
 */

export interface PlayerRow {
  playerId: string;
  name: string;
  buyInCount: number;
  investedPaise: number;
  chipsIssued: number;
  finalChips: number | null;
  chipValuePaise: number | null;
  netPaise: number | null;
}

export interface GameTotals {
  playerCount: number;
  buyInCount: number;
  moneyCollectedPaise: number;
  chipsIssued: number;
  finalChipsTotal: number;
  missingFinalCount: number;
  /** chipsIssued - finalChipsTotal. Positive = chips unaccounted for. */
  chipDifference: number;
  hasBuyIns: boolean;
  reconciled: boolean;
  valuePerChipPaise: number | null;
  allocatedChipValuePaise: number;
}

export interface Balance {
  playerId: string;
  netPaise: number;
}

export interface GameLedger {
  game: Game | null;
  rows: PlayerRow[];
  totals: GameTotals;
  /** Present only when every player has a final count and chips reconcile. */
  balances: Balance[] | null;
  /** Nets before any chip-difference adjustment. Present once every player has a final count. */
  rawBalances: Balance[] | null;
  /** Sum of rawBalances. Non-zero when the chips do not add up to the pot. */
  residualPaise: number | null;
  /** True when balances sum to exactly zero (always true when reconciled). */
  balanced: boolean;
  displayStatus: DisplayStatus;
}

export interface ChipEntry {
  key: string;
  chips: number;
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (BigInt(2) * numerator + denominator) / (BigInt(2) * denominator);
}

/**
 * Allocates `poolPaise` across the entries in proportion to their chips.
 * The total allocated equals round(sum(chips) * pool / issued), and any rounding
 * paise are handed out by largest remainder (ties broken by input order), so
 * nothing is silently lost or invented.
 */
export function allocateChipValues(
  entries: ChipEntry[],
  poolPaise: number,
  issuedChips: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (issuedChips <= 0 || entries.length === 0) {
    for (const entry of entries) result.set(entry.key, 0);
    return result;
  }

  const pool = BigInt(poolPaise);
  const issued = BigInt(issuedChips);
  const totalChips = entries.reduce((sum, entry) => sum + entry.chips, 0);
  const target = roundHalfUp(BigInt(totalChips) * pool, issued);

  const parts = entries.map((entry, index) => {
    const numerator = BigInt(entry.chips) * pool;
    return {
      key: entry.key,
      index,
      floor: numerator / issued,
      remainder: numerator % issued,
    };
  });

  const floorSum = parts.reduce((sum, part) => sum + part.floor, BigInt(0));
  let deficit = Number(target - floorSum);

  const byRemainder = [...parts].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.index - b.index;
  });

  const extra = new Map<string, number>();
  for (let step = 0; deficit > 0; step++, deficit--) {
    const key = byRemainder[step % byRemainder.length].key;
    extra.set(key, (extra.get(key) ?? 0) + 1);
  }

  for (const part of parts) {
    result.set(part.key, Number(part.floor) + (extra.get(part.key) ?? 0));
  }
  return result;
}

export function getGameBuyIns(state: LedgerState, gameId: string) {
  return state.buyIns.filter((buyIn) => buyIn.gameId === gameId);
}

/** Reconciled = every player has a final count and total chips match the issued total. */
export function computeGameTotals(state: LedgerState, gameId: string): GameTotals {
  const gamePlayers = state.gamePlayers.filter((gp) => gp.gameId === gameId);
  const buyIns = getGameBuyIns(state, gameId);

  const moneyCollectedPaise = buyIns.reduce((sum, b) => sum + b.amountPaise, 0);
  const chipsIssued = buyIns.reduce((sum, b) => sum + b.chips, 0);
  const entered = gamePlayers.filter((gp) => gp.finalChips !== null);
  const finalChipsTotal = entered.reduce((sum, gp) => sum + (gp.finalChips ?? 0), 0);
  const missingFinalCount = gamePlayers.length - entered.length;
  const chipDifference = chipsIssued - finalChipsTotal;
  const hasBuyIns = buyIns.length > 0;
  const reconciled =
    hasBuyIns && missingFinalCount === 0 && chipDifference === 0 && chipsIssued > 0;

  const allocation = allocateChipValues(
    entered.map((gp) => ({ key: gp.playerId, chips: gp.finalChips ?? 0 })),
    moneyCollectedPaise,
    chipsIssued,
  );
  const allocatedChipValuePaise = [...allocation.values()].reduce((s, v) => s + v, 0);

  return {
    playerCount: gamePlayers.length,
    buyInCount: buyIns.length,
    moneyCollectedPaise,
    chipsIssued,
    finalChipsTotal,
    missingFinalCount,
    chipDifference,
    hasBuyIns,
    reconciled,
    valuePerChipPaise: chipsIssued > 0 ? moneyCollectedPaise / chipsIssued : null,
    allocatedChipValuePaise,
  };
}

export function deriveDisplayStatus(game: Game, totals: GameTotals): DisplayStatus {
  switch (game.status) {
    case "archived":
      return "archived";
    case "settled":
      return "settled";
    case "settling":
      return "settling";
    default:
      if (!totals.hasBuyIns) return "draft";
      return totals.reconciled ? "ready" : "live";
  }
}

export function computeGameLedger(state: LedgerState, gameId: string): GameLedger {
  const game = state.games.find((g) => g.id === gameId) ?? null;
  const gamePlayers = state.gamePlayers.filter((gp) => gp.gameId === gameId);
  const buyIns = getGameBuyIns(state, gameId);
  const totals = computeGameTotals(state, gameId);

  const allocation = allocateChipValues(
    gamePlayers
      .filter((gp) => gp.finalChips !== null)
      .map((gp) => ({ key: gp.playerId, chips: gp.finalChips ?? 0 })),
    totals.moneyCollectedPaise,
    totals.chipsIssued,
  );

  const rows: PlayerRow[] = gamePlayers.map((gp) => {
    const mine = buyIns.filter((b) => b.playerId === gp.playerId);
    const investedPaise = mine.reduce((sum, b) => sum + b.amountPaise, 0);
    const chipValuePaise =
      gp.finalChips === null ? null : (allocation.get(gp.playerId) ?? 0);
    return {
      playerId: gp.playerId,
      name: state.players.find((p) => p.id === gp.playerId)?.name ?? "Unknown player",
      buyInCount: mine.length,
      investedPaise,
      chipsIssued: mine.reduce((sum, b) => sum + b.chips, 0),
      finalChips: gp.finalChips,
      chipValuePaise,
      netPaise: chipValuePaise === null ? null : chipValuePaise - investedPaise,
    };
  });

  const rawBalances: Balance[] | null =
    totals.missingFinalCount === 0 && totals.hasBuyIns
      ? rows.map((row) => ({ playerId: row.playerId, netPaise: row.netPaise ?? 0 }))
      : null;
  const residualPaise = rawBalances
    ? rawBalances.reduce((sum, b) => sum + b.netPaise, 0)
    : null;
  const balances: Balance[] | null = totals.reconciled ? rawBalances : null;
  const balanced = balances
    ? balances.reduce((sum, b) => sum + b.netPaise, 0) === 0
    : false;

  return {
    game,
    rows,
    totals,
    balances,
    rawBalances,
    residualPaise,
    balanced,
    displayStatus: game ? deriveDisplayStatus(game, totals) : "draft",
  };
}

export type SettlementEligibility = { ok: true } | { ok: false; reason: string };

/**
 * Explains whether a settlement can be generated for the game right now.
 * When chips do not add up, the winners absorb the difference (the default method).
 */
export function checkSettlementEligibility(
  state: LedgerState,
  gameId: string,
  method?: AdjustmentMethod,
): SettlementEligibility {
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, reason: "Game not found." };
  if (game.status !== "open") {
    return { ok: false, reason: "This game already has a settlement. Unlock it to change it." };
  }
  const totals = computeGameTotals(state, gameId);
  if (!totals.hasBuyIns) return { ok: false, reason: "Record at least one buy-in first." };
  if (totals.missingFinalCount > 0) {
    return {
      ok: false,
      reason: `${totals.missingFinalCount} player${totals.missingFinalCount === 1 ? " is" : "s are"} missing a final chip count.`,
    };
  }
  if (totals.chipDifference !== 0) {
    const raw = computeGameLedger(state, gameId).rawBalances;
    if (raw) {
      const plan = computeAdjustment(raw, method ?? "winners");
      if (!plan.ok) return { ok: false, reason: plan.reason };
    }
  }
  return { ok: true };
}
