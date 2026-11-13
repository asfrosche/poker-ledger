/**
 * Core domain types. All money is stored as integer paise (1 INR = 100 paise).
 */

export type GameStatus = "open" | "settling" | "settled" | "archived";

/** Status shown to users. `draft`/`live`/`ready` are derived from the game's data. */
export type DisplayStatus =
  | "draft"
  | "live"
  | "ready"
  | "settling"
  | "settled"
  | "archived";

export interface Settings {
  defaultCurrency: string;
  defaultBuyInPaise: number;
  defaultChipsPerBuyIn: number;
  defaultFormat: string;
}

/** Reusable player profile, shared across games. */
export interface Player {
  id: string;
  name: string;
  isSample: boolean;
  createdAt: string;
}

export interface Game {
  id: string;
  number: number;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  currency: string;
  /** Standard buy-in snapshot for this game. */
  buyInPaise: number;
  /** Standard chips issued per standard buy-in. */
  chipsPerBuyIn: number;
  venue: string;
  format: string;
  notes: string;
  status: GameStatus;
  isSample: boolean;
  createdAt: string;
  settledAt: string | null;
  archivedAt: string | null;
}

/** A player's participation in one game. Composite key: (gameId, playerId). */
export interface GamePlayer {
  gameId: string;
  playerId: string;
  /** Null until the host enters the final chip count. */
  finalChips: number | null;
}

/** One individual buy-in / rebuy transaction. */
export interface BuyIn {
  id: string;
  gameId: string;
  playerId: string;
  amountPaise: number;
  chips: number;
  note: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface SettlementPayment {
  id: string;
  settlementId: string;
  fromPlayerId: string;
  toPlayerId: string;
  amountPaise: number;
  paid: boolean;
  paidAt: string | null;
  upiRef: string;
  note: string;
}

export interface BalanceSnapshot {
  playerId: string;
  netPaise: number;
}

/** How a chip difference is settled: winners absorb it, or it is split evenly. */
export type AdjustmentMethod = "winners" | "even";

export interface AdjustmentLine {
  playerId: string;
  /** Net before the adjustment (chip value − invested). */
  rawNetPaise: number;
  /** Added to rawNetPaise to get the balance used for payments. */
  adjustmentPaise: number;
}

/** Recorded only when the chips did not add up at settlement time. */
export interface SettlementAdjustment {
  method: AdjustmentMethod;
  /** Sum of raw nets. Non-zero means the chip counts did not balance the pot. */
  residualPaise: number;
  lines: AdjustmentLine[];
}

/** Frozen figures at the moment the settlement was generated. */
export interface SettlementSnapshot {
  totalInvestedPaise: number;
  totalChipValuePaise: number;
  /** Balances used for the payments (raw net plus adjustment). */
  balances: BalanceSnapshot[];
  adjustment?: SettlementAdjustment | null;
}

export interface Settlement {
  id: string;
  gameId: string;
  createdAt: string;
  /** Set when a correction unlocks the game and this settlement is replaced. */
  supersededAt: string | null;
  supersedeReason: string | null;
  snapshot: SettlementSnapshot;
  payments: SettlementPayment[];
}

export interface AuditEntry {
  id: string;
  at: string;
  gameId: string | null;
  message: string;
}

export interface LedgerState {
  schemaVersion: 1;
  settings: Settings;
  players: Player[];
  games: Game[];
  gamePlayers: GamePlayer[];
  buyIns: BuyIn[];
  settlements: Settlement[];
  audit: AuditEntry[];
  selectedGameId: string | null;
}
