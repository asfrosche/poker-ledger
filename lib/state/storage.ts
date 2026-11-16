import type { LedgerState } from "@/types";
import { ledgerStateSchema } from "@/lib/validation/schemas";
import { removeSampleData } from "@/lib/state/remove-sample-data";

const STORAGE_KEY = "poker-ledger:v1";

/** Returns the saved ledger, or null if nothing valid is stored. Never throws. */
export function loadLedgerState(): LedgerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const json: unknown = JSON.parse(raw);
    const cleaned = removeSampleData(json);
    // Write the cleaned copy back once, so sample data doesn't linger in storage.
    if (cleaned !== json) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    const parsed = ledgerStateSchema.safeParse(cleaned);
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
