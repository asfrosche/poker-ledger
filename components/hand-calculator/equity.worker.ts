// Runs the equity simulation off the main thread so the table stays responsive.

import { simulateTable } from "@/lib/hand-table/simulate";
import type { EngineInput } from "@/lib/hand-table/table-state";

type Request = { key: string; input: EngineInput };

addEventListener("message", (event: MessageEvent<Request>) => {
  const { key, input } = event.data;
  try {
    // Partial results go back every PROGRESS_EVERY deals, then the final result.
    const result = simulateTable(input, undefined, Math.random, (progress, done, total) => {
      postMessage({ key, progress, done, total });
    });
    postMessage({ key, result });
  } catch (error) {
    postMessage({ key, error: error instanceof Error ? error.message : "Calculation failed." });
  }
});
