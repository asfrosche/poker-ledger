"use client";

import { useEffect, useMemo, useState } from "react";
import { equityStatus, type TableEquity } from "@/lib/hand-table/equity";
import type { EngineInput, TableState } from "@/lib/hand-table/table-state";

export type EquityView =
  | { kind: "waiting"; message: string }
  | { kind: "calculating" }
  | { kind: "refining"; result: TableEquity; done: number; total: number }
  | { kind: "ready"; result: TableEquity }
  | { kind: "error"; message: string };

/** Messages the worker sends back. Partial results come every few thousand deals; the last one is final. */
type WorkerMessage =
  | { key: string; progress: TableEquity; done: number; total: number }
  | { key: string; result: TableEquity }
  | { key: string; error: string };

type Progress = {
  key: string;
  /** Result currently on screen while the calculation refines. Only replaced for a meaningful change. */
  shown?: TableEquity;
  done: number;
  total: number;
  final?: TableEquity;
  error?: string;
};

/** Wait this long after the last change before calculating, so fast clicking doesn't queue work. */
const DEBOUNCE_MS = 150;

/** Refresh the displayed numbers only when some equity moves by at least this much (0.5 points). */
export const MOVE_THRESHOLD = 0.005;

/** Largest change in any equity figure between two results, as a fraction. */
function largestMove(a: TableEquity, b: TableEquity): number {
  let biggest = 0;
  for (const [x, y] of [...a.overall.map((s, i) => [s, b.overall[i]] as const), ...a.runs.flatMap((r, ri) => r.seats.map((s, si) => [s, b.runs[ri].seats[si]] as const))]) {
    biggest = Math.max(biggest, Math.abs(x.outcome.equity - y.outcome.equity), Math.abs(x.outcome.win - y.outcome.win));
  }
  return biggest;
}

/**
 * Recalculates equity whenever the table changes. A quick first answer appears after the first batch,
 * then refines. Results for an earlier table state are never shown.
 */
export function useTableEquity(state: TableState): EquityView {
  const status = useMemo(() => equityStatus(state), [state]);
  const input: EngineInput | null = status.kind === "ready" ? status.input : null;
  const key = input ? JSON.stringify(input) : null;

  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    if (key === null || input === null || typeof Worker === "undefined") return;
    const worker = new Worker(new URL("./equity.worker.ts", import.meta.url), { type: "module" });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.key !== key) return;
      if ("error" in message) {
        setProgress({ key, done: 0, total: 0, error: message.error });
        return;
      }
      if ("result" in message) {
        setProgress((prev) => ({ key, shown: message.result, done: prev?.total ?? 0, total: prev?.total ?? 0, final: message.result }));
        return;
      }
      setProgress((prev) => {
        // The first partial result always shows. After that, only a meaningful move replaces the screen.
        const previous = prev?.key === key ? prev.shown : undefined;
        const shown = previous && largestMove(previous, message.progress) < MOVE_THRESHOLD ? previous : message.progress;
        return { key, shown, done: message.done, total: message.total };
      });
    };
    worker.onerror = () => setProgress({ key, done: 0, total: 0, error: "The calculation stopped unexpectedly." });

    const timer = setTimeout(() => worker.postMessage({ key, input }), DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
    // `input` is derived from `key`, which captures every change that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (status.kind !== "ready") return { kind: "waiting", message: status.message };
  if (typeof Worker === "undefined") {
    return { kind: "error", message: "This browser cannot run the calculation." };
  }
  if (!progress || progress.key !== key) return { kind: "calculating" };
  if (progress.error !== undefined) return { kind: "error", message: progress.error };
  if (progress.final) return { kind: "ready", result: progress.final };
  if (progress.shown) {
    return { kind: "refining", result: progress.shown, done: progress.done, total: progress.total };
  }
  return { kind: "calculating" };
}
