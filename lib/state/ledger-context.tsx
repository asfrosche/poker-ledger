"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { computeGameLedger, type GameLedger } from "@/lib/calculations/ledger";
import { createEmptyState, ledgerReducer, type LedgerAction, type LedgerActionInput } from "@/lib/state/reducer";
import { loadLedgerState, saveLedgerState } from "@/lib/state/storage";
import { useToast } from "@/components/ui/toast";
import type { Game, LedgerState } from "@/types";

interface LedgerContextValue {
  state: LedgerState;
  dispatch: (action: LedgerActionInput) => void;
  selectedGame: Game | null;
  selectedLedger: GameLedger | null;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Wrapped = LedgerState | null;

function wrappedReducer(state: Wrapped, action: LedgerAction): Wrapped {
  if (action.type === "hydrate") return action.state;
  if (state === null) return null;
  return ledgerReducer(state, action);
}

/**
 * Holds the whole app state. Renders children only after the saved ledger has been
 * loaded from localStorage (or started empty on first launch), which avoids
 * server/client hydration mismatches.
 */
export function LedgerProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(wrappedReducer, null as Wrapped);
  const saveFailedRef = useRef(false);
  const { notify } = useToast();

  useEffect(() => {
    const loaded = loadLedgerState() ?? createEmptyState();
    rawDispatch({ type: "hydrate", state: loaded, id: newId(), at: new Date().toISOString() });
  }, []);

  useEffect(() => {
    if (!state) return;
    const saved = saveLedgerState(state);
    if (!saved && !saveFailedRef.current) {
      notify("Browser storage is full or blocked. Changes may not survive a refresh.", "error");
    }
    saveFailedRef.current = !saved;
  }, [state, notify]);

  const dispatch = useCallback((action: LedgerActionInput) => {
    rawDispatch({ ...action, id: newId(), at: new Date().toISOString() } as LedgerAction);
  }, []);

  const value = useMemo<LedgerContextValue | null>(() => {
    if (!state) return null;
    const selectedGame = state.games.find((g) => g.id === state.selectedGameId) ?? null;
    return {
      state,
      dispatch,
      selectedGame,
      selectedLedger: selectedGame ? computeGameLedger(state, selectedGame.id) : null,
    };
  }, [state, dispatch]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Loading ledger</p>
      </div>
    );
  }

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used inside LedgerProvider");
  return ctx;
}
