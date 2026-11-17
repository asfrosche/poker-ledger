"use client";

import { useEffect, useState } from "react";
import type { ExtrasRequest } from "./extras.worker";

type Reply<T> = { key: string; result?: T; error?: string };
type Job<T> = { key: string; result: T | null; error: string | null };

export type ExtrasJob<T> =
  | { status: "idle"; result: null; error: null }
  | { status: "running"; result: null; error: null }
  | { status: "error"; result: null; error: string }
  | { status: "ready"; result: T; error: null };

/**
 * Runs one analysis request in a worker. Pass null to stay idle. A new request starts a new worker,
 * and results for an earlier request are never shown.
 */
export function useExtrasJob<T>(request: ExtrasRequest | null): ExtrasJob<T> {
  const key = request === null ? null : JSON.stringify(request);
  const [job, setJob] = useState<Job<T> | null>(null);

  useEffect(() => {
    if (key === null || typeof Worker === "undefined") return;
    const worker = new Worker(new URL("./extras.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<Reply<T>>) => {
      if (event.data.key !== key) return;
      setJob({ key, result: event.data.result ?? null, error: event.data.error ?? null });
    };
    worker.onerror = () => setJob({ key, result: null, error: "The calculation stopped unexpectedly." });
    worker.postMessage({ key, request: JSON.parse(key) as ExtrasRequest });
    return () => worker.terminate();
  }, [key]);

  if (key === null) return { status: "idle", result: null, error: null };
  if (typeof Worker === "undefined") {
    return { status: "error", result: null, error: "This browser cannot run the calculation." };
  }
  if (job === null || job.key !== key) return { status: "running", result: null, error: null };
  if (job.error !== null) return { status: "error", result: null, error: job.error };
  return { status: "ready", result: job.result as T, error: null };
}
