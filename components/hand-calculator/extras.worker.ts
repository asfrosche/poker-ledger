// Runs the bottom-of-page analysis (heatmap and next-card odds) off the main thread.

import { heatmapEquities } from "@/lib/hand-table/heatmap";
import { nextCardOdds } from "@/lib/hand-table/next-card";
import type { EngineInput } from "@/lib/hand-table/table-state";
import type { Card } from "@/lib/poker/cards";

export type ExtrasRequest =
  | { kind: "heatmap"; board: Card[]; trials: number }
  | { kind: "next"; input: EngineInput; trials: number };

type Message = { key: string; request: ExtrasRequest };

addEventListener("message", (event: MessageEvent<Message>) => {
  const { key, request } = event.data;
  try {
    const result =
      request.kind === "heatmap"
        ? heatmapEquities(request.board, request.trials, Math.random)
        : nextCardOdds(request.input, request.trials, Math.random);
    postMessage({ key, result });
  } catch (error) {
    postMessage({ key, error: error instanceof Error ? error.message : "Calculation failed." });
  }
});
