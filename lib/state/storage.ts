import type { LedgerState } from "@/types";
import { ledgerStateSchema } from "@/lib/validation/schemas";

const STORAGE_KEY = "poker-ledger:v1";

/** Returns the saved ledger, or null if nothing valid is stored. Never throws. */
export function loadLedgerState(): LedgerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = ledgerStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as LedgerState) : null;
  } catch {
    return null;
  }
}

/** Saves the ledger. Returns false if the browser refused (private mode, quota, etc.). */
export function saveLedgerState(state: LedgerState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
