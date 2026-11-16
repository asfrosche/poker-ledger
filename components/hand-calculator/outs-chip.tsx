"use client";

import { useMemo } from "react";
import { RANK_NAMES, SUIT_SYMBOLS, cardRank, cardSuit, type Card } from "@/lib/poker/cards";
import { computeOuts, playerBehind } from "@/lib/hand-table/outs";
import { toEngineInput, type Seat, type TableState } from "@/lib/hand-table/table-state";
import type { EquityView } from "./use-table-equity";
import { HOLE_COUNT } from "@/lib/hand-table/variant";

const MAX_CARDS_SHOWN = 12;

function cardLabel(card: Card): string {
  return `${RANK_NAMES[cardRank(card) - 2]}${SUIT_SYMBOLS[cardSuit(card)]}`;
}

/**
 * The outs for the player behind (lowest overall equity): the unseen cards that would give them the
 * outright best hand on the next card. Sits just above the table's top-right corner, outside the felt.
 */
export function OutsChip({
  state,
  equity,
  seatName,
}: {
  state: TableState;
  equity: EquityView;
  seatName: (seat: Seat) => string;
}) {
  const input = useMemo(() => toEngineInput(state), [state]);
  const behindId =
    equity.kind === "ready" || equity.kind === "refining" ? playerBehind(equity.result.overall) : null;
  const behindSeat = behindId ? state.seats.find((s) => s.id === behindId) : undefined;

  let body: React.ReactNode;
  if (!input) {
    body = "Outs appear once two players are dealt in.";
  } else if (input.runs[0].length < 3) {
    body = "Outs appear from the flop.";
  } else if (input.runs.every((run) => run.length === 5)) {
    body = "Board complete, so there is no next card.";
  } else if (input.seats.some((s) => s.hole.length < HOLE_COUNT[input.variant])) {
    body = "Outs need every player's cards dealt. Hidden cards can't be counted as outs.";
  } else if (!behindSeat || !behindId) {
    body = "Waiting for the odds to show who is behind.";
  } else {
    const seatIndex = input.seats.findIndex((s) => s.seatId === behindId);
    body = (
      <ul className="flex flex-col gap-1.5">
        {input.runs.map((run, runIndex) => {
          const outs = computeOuts(input, seatIndex, runIndex);
          if (outs === null) return null;
          const street = run.length === 3 ? "turn" : "river";
          const label = input.runs.length > 1 ? `Run ${runIndex + 1} · ${street}` : `Next card · ${street}`;
          const shown = outs.slice(0, MAX_CARDS_SHOWN).map(cardLabel).join(" ");
          const more = outs.length > MAX_CARDS_SHOWN ? ` +${outs.length - MAX_CARDS_SHOWN}` : "";
          return (
            <li key={runIndex}>
              <span className="font-medium text-ink">
                {outs.length} {outs.length === 1 ? "out" : "outs"}
              </span>{" "}
              <span className="text-muted">({label})</span>
              {outs.length > 0 ? <div className="font-mono text-[11px] text-muted">{shown}{more}</div> : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <aside aria-label="Outs for the player behind" className="panel w-full max-w-[17rem] px-3 py-2 text-xs sm:w-auto">
      <p className="label mb-1">{behindSeat ? `Behind · ${seatName(behindSeat)}` : "Outs"}</p>
      <div className="text-muted">{body}</div>
    </aside>
  );
}
