import {
  checkSettlementEligibility,
  computeGameLedger,
} from "@/lib/calculations/ledger";
import { computeTransfers } from "@/lib/calculations/settlement";
import { applyAdjustment, computeAdjustment } from "@/lib/calculations/adjustment";
import type { AdjustmentMethod } from "@/types";
import type {
  AuditEntry,
  BuyIn,
  Game,
  LedgerState,
  Player,
  Settlement,
  Settings,
} from "@/types";

/**
 * Every action carries `id` and `at` so the reducer is deterministic and testable.
 * The provider fills these in at dispatch time.
 */
interface ActionBase {
  id: string;
  at: string;
}

export type GameConfigPatch = Partial<
  Pick<Game, "name" | "date" | "currency" | "buyInPaise" | "chipsPerBuyIn" | "venue" | "format" | "notes">
>;

export type LedgerAction = ActionBase &
  (
    | { type: "hydrate"; state: LedgerState }
    | { type: "settings/update"; patch: Partial<Settings> }
    | { type: "game/select"; gameId: string }
    | {
        type: "game/create";
        name: string;
        date: string;
        currency: string;
        buyInPaise: number;
        chipsPerBuyIn: number;
        venue: string;
        format: string;
        notes: string;
        isSample?: boolean;
      }
    | { type: "game/update"; gameId: string; patch: GameConfigPatch }
    | { type: "game/archive"; gameId: string }
    | { type: "game/unlock"; gameId: string; reason: string }
    | { type: "game/delete"; gameId: string }
    | { type: "gameplayer/add"; gameId: string; playerId?: string; playerName?: string }
    | { type: "gameplayer/remove"; gameId: string; playerId: string }
    | {
        type: "buyin/add";
        gameId: string;
        playerId: string;
        amountPaise: number;
        chips: number;
        note: string;
      }
    | { type: "buyin/update"; buyInId: string; amountPaise: number; chips: number; note: string }
    | { type: "buyin/delete"; buyInId: string }
    | { type: "final/set"; gameId: string; playerId: string; chips: number | null }
    | { type: "settlement/generate"; gameId: string; adjustment?: AdjustmentMethod }
    | {
        type: "payment/set";
        settlementId: string;
        paymentId: string;
        paid: boolean;
        upiRef: string;
        note: string;
      }
    | { type: "data/clear-samples" }
    | { type: "data/reset" }
  );

export type LedgerActionInput = LedgerAction extends infer A
  ? A extends unknown
    ? Omit<A, "id" | "at">
    : never
  : never;

export const DEFAULT_SETTINGS: Settings = {
  defaultCurrency: "INR",
  defaultBuyInPaise: 50000,
  defaultChipsPerBuyIn: 1000,
  defaultFormat: "No-limit Hold'em",
};

export function createEmptyState(): LedgerState {
  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    games: [],
    gamePlayers: [],
    buyIns: [],
    settlements: [],
    audit: [],
    selectedGameId: null,
  };
}

function withAudit(state: LedgerState, action: ActionBase, gameId: string | null, message: string): LedgerState {
  const entry: AuditEntry = { id: `audit-${action.id}`, at: action.at, gameId, message };
  return { ...state, audit: [...state.audit, entry] };
}

function findGame(state: LedgerState, gameId: string): Game | undefined {
  return state.games.find((g) => g.id === gameId);
}

function replaceGame(state: LedgerState, game: Game): LedgerState {
  return { ...state, games: state.games.map((g) => (g.id === game.id ? game : g)) };
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Pure state transition. Invalid requests (unknown ids, editing a locked game,
 * unbalanced chips) return the state unchanged; the UI explains why beforehand.
 */
export function ledgerReducer(state: LedgerState, action: LedgerAction): LedgerState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "settings/update":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case "game/select":
      return state.games.some((g) => g.id === action.gameId)
        ? { ...state, selectedGameId: action.gameId }
        : state;

    case "game/create": {
      if (!isPositiveInt(action.buyInPaise) || !isPositiveInt(action.chipsPerBuyIn)) return state;
      const number = state.games.reduce((max, g) => Math.max(max, g.number), 0) + 1;
      const game: Game = {
        id: action.id,
        number,
        name: action.name.trim(),
        date: action.date,
        currency: action.currency,
        buyInPaise: action.buyInPaise,
        chipsPerBuyIn: action.chipsPerBuyIn,
        venue: action.venue,
        format: action.format,
        notes: action.notes,
        status: "open",
        isSample: action.isSample ?? false,
        createdAt: action.at,
        settledAt: null,
        archivedAt: null,
      };
      const next = { ...state, games: [...state.games, game], selectedGameId: game.id };
      return withAudit(next, action, game.id, `Game #${number} created: ${game.name}`);
    }

    case "game/update": {
      const game = findGame(state, action.gameId);
      if (!game || game.status !== "open") return state;
      const patch = action.patch;
      if (patch.buyInPaise !== undefined && !isPositiveInt(patch.buyInPaise)) return state;
      if (patch.chipsPerBuyIn !== undefined && !isPositiveInt(patch.chipsPerBuyIn)) return state;
      const updated = { ...game, ...patch, name: (patch.name ?? game.name).trim() };
      return withAudit(
        replaceGame(state, updated),
        action,
        game.id,
        `Game settings updated (${Object.keys(patch).join(", ")})`,
      );
    }

    case "game/archive": {
      const game = findGame(state, action.gameId);
      if (!game || game.status !== "settled") return state;
      const updated: Game = { ...game, status: "archived", archivedAt: action.at };
      return withAudit(replaceGame(state, updated), action, game.id, "Game archived");
    }

    case "game/unlock": {
      const game = findGame(state, action.gameId);
      const reason = action.reason.trim();
      if (!game || game.status === "open" || reason.length < 3) return state;
      const updated: Game = { ...game, status: "open", settledAt: null, archivedAt: null };
      const settlements: Settlement[] = state.settlements.map((s) =>
        s.gameId === game.id && s.supersededAt === null
          ? { ...s, supersededAt: action.at, supersedeReason: reason }
          : s,
      );
      const next = { ...replaceGame(state, updated), settlements };
      return withAudit(next, action, game.id, `Unlocked for correction: ${reason}`);
    }

    case "game/delete": {
      const game = findGame(state, action.gameId);
      if (!game) return state;
      const next: LedgerState = {
        ...state,
        games: state.games.filter((g) => g.id !== game.id),
        gamePlayers: state.gamePlayers.filter((gp) => gp.gameId !== game.id),
        buyIns: state.buyIns.filter((b) => b.gameId !== game.id),
        settlements: state.settlements.filter((s) => s.gameId !== game.id),
        selectedGameId: state.selectedGameId === game.id ? null : state.selectedGameId,
      };
      return withAudit(next, action, null, `Game #${game.number} deleted: ${game.name}`);
    }

    case "gameplayer/add": {
      const game = findGame(state, action.gameId);
      if (!game || game.status !== "open") return state;

      let players = state.players;
      let playerId = action.playerId;
      if (!playerId) {
        const name = (action.playerName ?? "").trim();
        if (!name) return state;
        const existing = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          playerId = existing.id;
        } else {
          playerId = action.id;
          const player: Player = { id: playerId, name, isSample: game.isSample, createdAt: action.at };
          players = [...players, player];
        }
      }
      if (!players.some((p) => p.id === playerId)) return state;
      if (state.gamePlayers.some((gp) => gp.gameId === game.id && gp.playerId === playerId)) {
        return state;
      }
      const name = players.find((p) => p.id === playerId)?.name ?? "Player";
      const next: LedgerState = {
        ...state,
        players,
        gamePlayers: [...state.gamePlayers, { gameId: game.id, playerId, finalChips: null }],
      };
      return withAudit(next, action, game.id, `${name} added to game`);
    }

    case "gameplayer/remove": {
      const game = findGame(state, action.gameId);
      if (!game || game.status !== "open") return state;
      const player = state.players.find((p) => p.id === action.playerId);
      const next: LedgerState = {
        ...state,
        gamePlayers: state.gamePlayers.filter(
          (gp) => !(gp.gameId === game.id && gp.playerId === action.playerId),
        ),
        buyIns: state.buyIns.filter(
          (b) => !(b.gameId === game.id && b.playerId === action.playerId),
        ),
      };
      return withAudit(next, action, game.id, `${player?.name ?? "Player"} removed (with their buy-ins)`);
    }

    case "buyin/add": {
      const game = findGame(state, action.gameId);
      if (!game || game.status !== "open") return state;
      if (!isPositiveInt(action.amountPaise) || !isPositiveInt(action.chips)) return state;
      const enrolled = state.gamePlayers.some(
        (gp) => gp.gameId === game.id && gp.playerId === action.playerId,
      );
      if (!enrolled) return state;
      const buyIn: BuyIn = {
        id: action.id,
        gameId: game.id,
        playerId: action.playerId,
        amountPaise: action.amountPaise,
        chips: action.chips,
        note: action.note.trim(),
        createdAt: action.at,
        updatedAt: null,
      };
      const name = state.players.find((p) => p.id === action.playerId)?.name ?? "Player";
      return withAudit(
        { ...state, buyIns: [...state.buyIns, buyIn] },
        action,
        game.id,
        `Buy-in recorded for ${name}`,
      );
    }

    case "buyin/update": {
      const buyIn = state.buyIns.find((b) => b.id === action.buyInId);
      if (!buyIn) return state;
      const game = findGame(state, buyIn.gameId);
      if (!game || game.status !== "open") return state;
      if (!isPositiveInt(action.amountPaise) || !isPositiveInt(action.chips)) return state;
      const updated: BuyIn = {
        ...buyIn,
        amountPaise: action.amountPaise,
        chips: action.chips,
        note: action.note.trim(),
        updatedAt: action.at,
      };
      const name = state.players.find((p) => p.id === buyIn.playerId)?.name ?? "Player";
      return withAudit(
        { ...state, buyIns: state.buyIns.map((b) => (b.id === buyIn.id ? updated : b)) },
        action,
        game.id,
        `Buy-in edited for ${name}`,
      );
    }

    case "buyin/delete": {
      const buyIn = state.buyIns.find((b) => b.id === action.buyInId);
      if (!buyIn) return state;
      const game = findGame(state, buyIn.gameId);
      if (!game || game.status !== "open") return state;
      const name = state.players.find((p) => p.id === buyIn.playerId)?.name ?? "Player";
      return withAudit(
        { ...state, buyIns: state.buyIns.filter((b) => b.id !== buyIn.id) },
        action,
        game.id,
        `Buy-in deleted for ${name} (${buyIn.chips} chips)`,
      );
    }

    case "final/set": {
      const game = findGame(state, action.gameId);
      if (!game || game.status !== "open") return state;
      if (action.chips !== null && (!Number.isInteger(action.chips) || action.chips < 0)) return state;
      const exists = state.gamePlayers.some(
        (gp) => gp.gameId === game.id && gp.playerId === action.playerId,
      );
      if (!exists) return state;
      return {
        ...state,
        gamePlayers: state.gamePlayers.map((gp) =>
          gp.gameId === game.id && gp.playerId === action.playerId
            ? { ...gp, finalChips: action.chips }
            : gp,
        ),
      };
    }

    case "settlement/generate": {
      const game = findGame(state, action.gameId);
      if (!game) return state;
      const eligibility = checkSettlementEligibility(state, game.id, action.adjustment);
      if (!eligibility.ok) return state;
      const ledger = computeGameLedger(state, game.id);
      if (!ledger.rawBalances) return state;

      // Chips that add up need no adjustment; otherwise the winners absorb the difference.
      const plan = computeAdjustment(ledger.rawBalances, action.adjustment ?? "winners");
      if (!plan.ok) return state;
      const adjustment = ledger.totals.chipDifference === 0 ? null : plan.adjustment;
      const balances = applyAdjustment(ledger.rawBalances, adjustment);
      if (balances.reduce((sum, b) => sum + b.netPaise, 0) !== 0) return state;

      const transfers = computeTransfers(balances);
      const settlement: Settlement = {
        id: action.id,
        gameId: game.id,
        createdAt: action.at,
        supersededAt: null,
        supersedeReason: null,
        snapshot: {
          totalInvestedPaise: ledger.totals.moneyCollectedPaise,
          totalChipValuePaise: ledger.totals.allocatedChipValuePaise,
          balances: balances.map((b) => ({ ...b })),
          adjustment,
        },
        payments: transfers.map((t, index) => ({
          id: `${action.id}:${index}`,
          settlementId: action.id,
          fromPlayerId: t.fromPlayerId,
          toPlayerId: t.toPlayerId,
          amountPaise: t.amountPaise,
          paid: false,
          paidAt: null,
          upiRef: "",
          note: "",
        })),
      };
      const settled = settlement.payments.length === 0;
      const updated: Game = {
        ...game,
        status: settled ? "settled" : "settling",
        settledAt: settled ? action.at : null,
      };
      const next = { ...replaceGame(state, updated), settlements: [...state.settlements, settlement] };
      return withAudit(
        next,
        action,
        game.id,
        `Settlement generated: ${settlement.payments.length} transfer${settlement.payments.length === 1 ? "" : "s"}${adjustment ? `. Chip difference of ${Math.abs(ledger.totals.chipDifference)} chips settled by ${action.adjustment === "even" ? "an even split" : "winners absorbing it"}` : ""}`,
      );
    }

    case "payment/set": {
      const settlement = state.settlements.find((s) => s.id === action.settlementId);
      if (!settlement || settlement.supersededAt) return state;
      const game = findGame(state, settlement.gameId);
      if (!game || (game.status !== "settling" && game.status !== "settled")) return state;
      const target = settlement.payments.find((p) => p.id === action.paymentId);
      if (!target) return state;

      const payments = settlement.payments.map((p) =>
        p.id === target.id
          ? {
              ...p,
              paid: action.paid,
              paidAt: action.paid ? action.at : null,
              upiRef: action.paid ? action.upiRef.trim() : "",
              note: action.paid ? action.note.trim() : "",
            }
          : p,
      );
      const allPaid = payments.every((p) => p.paid);
      const updatedSettlement: Settlement = { ...settlement, payments };
      const updatedGame: Game = allPaid
        ? { ...game, status: "settled", settledAt: game.settledAt ?? action.at }
        : { ...game, status: "settling", settledAt: null };

      const next = {
        ...replaceGame(state, updatedGame),
        settlements: state.settlements.map((s) => (s.id === settlement.id ? updatedSettlement : s)),
      };
      const payer = state.players.find((p) => p.id === target.fromPlayerId)?.name ?? "Payer";
      const payee = state.players.find((p) => p.id === target.toPlayerId)?.name ?? "Payee";
      const message = action.paid
        ? `Payment marked paid: ${payer} → ${payee}`
        : `Payment reverted to unpaid: ${payer} → ${payee}`;
      return withAudit(next, action, game.id, message);
    }

    case "data/clear-samples": {
      const sampleGameIds = new Set(state.games.filter((g) => g.isSample).map((g) => g.id));
      const games = state.games.filter((g) => !g.isSample);
      const gamePlayers = state.gamePlayers.filter((gp) => !sampleGameIds.has(gp.gameId));
      const usedPlayerIds = new Set(gamePlayers.map((gp) => gp.playerId));
      const next: LedgerState = {
        ...state,
        games,
        gamePlayers,
        buyIns: state.buyIns.filter((b) => !sampleGameIds.has(b.gameId)),
        settlements: state.settlements.filter((s) => !sampleGameIds.has(s.gameId)),
        players: state.players.filter((p) => !p.isSample || usedPlayerIds.has(p.id)),
        selectedGameId: games.some((g) => g.id === state.selectedGameId)
          ? state.selectedGameId
          : (games[games.length - 1]?.id ?? null),
      };
      return withAudit(next, action, null, "Sample data cleared");
    }

    case "data/reset":
      return {
        ...createEmptyState(),
        settings: state.settings,
        audit: [{ id: `audit-${action.id}`, at: action.at, gameId: null, message: "All data reset" }],
      };

    default:
      return state;
  }
}
