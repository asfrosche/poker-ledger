"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { Outcome, SeatEquity } from "@/lib/hand-table/equity";
import type { Seat, TableState } from "@/lib/hand-table/table-state";
import { HOLE_COUNT } from "@/lib/hand-table/variant";
import type { EquityView } from "./use-table-equity";

type View = "overall" | number;

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Win, tie, loss and equity for every seated player, recalculated as the table changes.
 * Run Twice and Run Thrice get an Overall view and one view per runout.
 */
export function EquityPanel({
  state,
  seatName,
  equity: view_,
}: {
  state: TableState;
  seatName: (seat: Seat) => string;
  equity: EquityView;
}) {
  const hasResult = view_.kind === "ready" || view_.kind === "refining";
  const result = hasResult ? view_.result : null;
  const working = view_.kind === "calculating" || view_.kind === "refining";

  const [requested, setRequested] = useState<View>("overall");
  // If the run count drops below the selected run, fall back to the overall view.
  const view: View = requested !== "overall" && requested >= state.runCount ? "overall" : requested;

  const rows: SeatEquity[] | null = result
    ? view === "overall"
      ? result.overall
      : (result.runs.find((r) => r.run === view)?.seats ?? null)
    : null;

  const label =
    view_.kind === "refining"
      ? `Refining ${view_.done.toLocaleString()} / ${view_.total.toLocaleString()}`
      : {
          ready: "Live",
          calculating: "Calculating",
          waiting: "Pending",
          error: "Error",
        }[view_.kind];

  return (
    <section aria-labelledby="equity-heading" className="panel flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="equity-heading" className="label">
          Win probability
        </h2>
        <span
          role="status"
          aria-live="polite"
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em]",
            hasResult ? "border-accent text-accent" : view_.kind === "error" ? "border-loss text-loss" : "border-line text-muted",
          )}
        >
          {working ? <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> : null}
          {label}
        </span>
      </div>

      {state.runCount > 1 ? (
        <div
          role="radiogroup"
          aria-label="Equity view"
          className="grid gap-1 rounded-[12px] border border-line bg-surface p-1"
          style={{ gridTemplateColumns: `repeat(${state.runCount + 1}, minmax(0, 1fr))` }}
        >
          <ViewButton label="Overall" checked={view === "overall"} onClick={() => setRequested("overall")} />
          {Array.from({ length: state.runCount }, (_, run) => (
            <ViewButton key={run} label={`Run ${run + 1}`} checked={view === run} onClick={() => setRequested(run)} />
          ))}
        </div>
      ) : null}

      {view_.kind === "waiting" || view_.kind === "error" ? (
        <p className={clsx("text-sm", view_.kind === "error" ? "text-loss" : "text-muted")}>{view_.message}</p>
      ) : null}

      {state.seats.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {state.seats.map((seat) => {
            const seated = seat.playerId !== null;
            const entry = rows?.find((r) => r.seatId === seat.id);
            return (
              <li key={seat.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={clsx("min-w-0 truncate text-sm font-medium", !seated && "text-muted")}>{seatName(seat)}</span>
                  {hiddenCards(state, seat) > 0 ? (
                    <span className="shrink-0 text-xs text-muted">{hiddenCards(state, seat)} hidden</span>
                  ) : null}
                  <span className={clsx("font-mono text-lg font-semibold tabular-nums", !entry && "text-muted")}>
                    {entry ? percent(entry.outcome.equity) : "—"}
                  </span>
                </div>
                <ProbabilityBar outcome={entry?.outcome ?? null} calculating={working} />
                {entry ? (
                  <div className="flex flex-wrap gap-x-4 font-mono text-[11px] text-muted">
                    <Stat label="Win" value={percent(entry.outcome.win)} />
                    <Stat label="Tie" value={percent(entry.outcome.tie)} />
                    <Stat label="Loss" value={percent(entry.outcome.lose)} />
                    <Stat label="Equity" value={percent(entry.outcome.equity)} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {result ? (
        <p className="border-t border-line pt-3 text-xs text-muted">
          {result.method === "exact"
            ? "Method: exact. Every possible deal was checked."
            : `Method: Monte Carlo, ${result.trials.toLocaleString()} random deals per runout.`}
          {state.runCount > 1 ? " Overall averages the runouts equally." : null}
        </p>
      ) : null}
    </section>
  );
}

/** Cards a seat in play has not had dealt. These are drawn at random by the calculation. */
function hiddenCards(state: TableState, seat: Seat): number {
  if (seat.playerId === null && seat.hole.every((c) => c === null)) return 0;
  const holeCount = HOLE_COUNT[state.variant];
  return holeCount - seat.hole.slice(0, holeCount).filter((c) => c !== null).length;
}

function ViewButton({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={clsx(
        "h-9 rounded-[9px] px-2 text-sm font-medium transition-colors",
        checked ? "bg-panel text-ink shadow-[0_1px_2px_rgba(41,42,39,0.12)]" : "text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

/** Win, tie and loss as one stacked bar. Shows a striped, pulsing placeholder while calculating. */
function ProbabilityBar({ outcome, calculating }: { outcome: Outcome | null; calculating: boolean }) {
  if (outcome === null) {
    return (
      <div
        className={clsx(
          "h-2.5 overflow-hidden rounded-full border border-line bg-[repeating-linear-gradient(135deg,var(--surface)_0_6px,var(--line)_6px_12px)]",
          calculating && "animate-pulse",
        )}
        aria-label="Probability pending"
        role="img"
      />
    );
  }
  return (
    <div
      className="flex h-2.5 overflow-hidden rounded-full border border-line bg-surface"
      role="img"
      aria-label={`Win ${percent(outcome.win)}, tie ${percent(outcome.tie)}, loss ${percent(outcome.lose)}`}
    >
      <div className="h-full bg-accent" style={{ width: percent(outcome.win) }} />
      <div className="h-full bg-muted/60" style={{ width: percent(outcome.tie) }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label} <span className="text-ink">{value}</span>
    </span>
  );
}
