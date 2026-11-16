"use client";

import { clsx } from "clsx";
import { CardFace } from "./card-face";
import { isSelectable, readTarget, runBoard, sameTarget, sharedPrefix, type Seat, type TableState, type Target } from "@/lib/hand-table/table-state";
import { streetLabel } from "@/lib/hand-table/labels";
import { cardText } from "@/lib/poker/cards";
import type { SeatOuts } from "@/lib/hand-table/outs";
import { HOLE_COUNT } from "@/lib/hand-table/variant";

type Props = {
  state: TableState;
  /** Display name for a seat: the player's name, or "Seat n" when empty. */
  seatName: (seat: Seat) => string;
  onSelect: (target: Target) => void;
  onClear: (target: Target) => void;
  /** Outs per seat id. Omitted until the cards needed for them are dealt. */
  outs?: Record<string, SeatOuts>;
};

/**
 * Oval table with the shared board in the centre and seats around the rail.
 * Seat positions use CSS variables (--rx, --ry) so the ring stretches with the table.
 */
export function PokerTable({ state, seatName, onSelect, onClear, outs }: Props) {
  const count = state.seats.length;
  const prefix = sharedPrefix(state);
  const active = state.active;

  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-[46rem] [--rx:37%] [--ry:35%] sm:aspect-[16/10] sm:[--rx:39%] sm:[--ry:37%]">
      {/* Wooden rail and green felt */}
      <div
        className="absolute inset-0 rounded-[50%] transition-[background-color,box-shadow] duration-300"
        style={{ backgroundColor: "var(--table-rail)", boxShadow: "var(--table-rail-shadow)" }}
        aria-hidden
      />
      {/* Dark mode felt: the original gradient. */}
      <div
        className="absolute rounded-[50%] bg-[radial-gradient(ellipse_at_center,#2f7d57_0%,#21643f_62%,#17492f_100%)]"
        style={{ inset: "var(--table-inset)", boxShadow: "var(--table-vignette)" }}
        aria-hidden
      />
      {/* Light mode felt: flat and softer. It fades in over the gradient when the theme changes. */}
      <div
        className="absolute rounded-[50%] transition-opacity duration-300"
        style={{
          inset: "var(--table-inset)",
          backgroundColor: "var(--table-felt)",
          opacity: "var(--table-felt-cover)",
          boxShadow: "var(--table-vignette)",
        }}
        aria-hidden
      />
      <div className="absolute inset-[9%] rounded-[50%] border transition-colors duration-300" style={{ borderColor: "var(--table-line)" }} aria-hidden />

      {/* Centre: one shared board, or one stacked board per runout */}
      {state.runCount === 1 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3" role="group" aria-label="Shared board">
          <div className="flex items-end gap-1.5 sm:gap-2.5">
            {[0, 1, 2].map((index) => (
              <BoardSlot key={index} state={state} index={index} active={active} onSelect={onSelect} onClear={onClear} />
            ))}
            <span className="mx-0.5 h-12 w-px bg-white/15 sm:mx-1 sm:h-16" aria-hidden />
            {[3, 4].map((index) => (
              <BoardSlot key={index} state={state} index={index} active={active} onSelect={onSelect} onClear={onClear} />
            ))}
          </div>
          <p className="max-w-[16rem] text-center font-mono text-[10px] uppercase leading-snug tracking-[0.12em]" style={{ color: "var(--table-text)" }}>
            Flop · Turn · River
          </p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 sm:gap-2" role="group" aria-label="Runout boards">
          {prefix >= 3 ? (
            <FlopWithRuns state={state} active={active} onSelect={onSelect} onClear={onClear} />
          ) : (
            <>
              <StreetHeader />
              <SharedRow state={state} active={active} onSelect={onSelect} onClear={onClear} />
              {Array.from({ length: state.runCount }, (_, run) => (
                <RunRow key={run} state={state} run={run} active={active} onSelect={onSelect} onClear={onClear} />
              ))}
            </>
          )}
          {prefix < 3 ? (
            <p className="max-w-[16rem] pt-0.5 text-center font-mono text-[10px] uppercase leading-snug tracking-[0.12em]" style={{ color: "var(--table-text)" }}>
              Deal the shared flop above, or each run&apos;s own board below
            </p>
          ) : null}
        </div>
      )}

      {/* Seats */}
      {state.seats.map((seat, i) => {
        const angle = Math.PI / 2 + (i * 2 * Math.PI) / count;
        const owns = active !== null && active.kind === "hole" && active.seatId === seat.id;
        return (
          <SeatView
            key={seat.id}
            seat={seat}
            label={seatName(seat)}
            number={i + 1}
            cos={Math.cos(angle)}
            sin={Math.sin(angle)}
            owns={owns}
            active={active}
            onSelect={onSelect}
            onClear={onClear}
            outs={outs?.[seat.id]}
            multiRun={state.runCount > 1}
            holeCount={HOLE_COUNT[state.variant]}
          />
        );
      })}

      {count === 0 ? (
        <div className="absolute inset-x-0 bottom-[12%] text-center font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--table-text)" }}>
          Add a seat to start
        </div>
      ) : null}
    </div>
  );
}

// Run colours match the badges used across the app, so each board is easy to tell apart on the felt.
const RUN_COLORS = ["#e96532", "#2f6fb3", "#7a4fb5"] as const;

/** Column labels above the runout rows, so each card reads as flop, turn or river. Widths match the cards. */
function StreetHeader() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="w-12 shrink-0" />
      <div className="flex gap-1 sm:gap-1.5">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className="w-[30px] text-center font-mono text-[8px] uppercase tracking-[0.08em] sm:w-[36px] sm:text-[9px]"
            style={{ color: "var(--table-text)" }}
          >
            {index < 3 ? "Flop" : streetLabel(index)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** One runout on the felt: a coloured badge, then the full board. Shared cards are shown but not editable here. */
function RunRow({
  state,
  run,
  active,
  onSelect,
  onClear,
}: {
  state: TableState;
  run: number;
  active: Target | null;
  onSelect: (target: Target) => void;
  onClear: (target: Target) => void;
}) {
  const board = runBoard(state, run);
  const prefix = sharedPrefix(state);
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-12 shrink-0 rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white"
        style={{ backgroundColor: RUN_COLORS[run] }}
      >
        Run {run + 1}
      </span>
      <div className="flex gap-1 sm:gap-1.5">
        {board.map((card, index) => {
          // Shared cards are shown once in the shared row, so this row leaves those columns blank.
          if (index < prefix) return <CardSpacer key={index} />;
          const target: Target = { kind: "run", run, index };
          const selectable = isSelectable(state, target);
          return (
            <CardFace
              key={index}
              size="sm"
              card={card}
              label={`Run ${run + 1}, ${streetLabel(index)}${card === null ? ", empty" : ""}`}
              selected={sameTarget(active, target)}
              onSelect={selectable || card !== null ? () => onSelect(target) : undefined}
              onClear={() => onClear(target)}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Flop dealt: the shared flop stays in the middle, and each run's turn and river sit to its right.
 * With two runs, one pair sits slightly above the flop line and one slightly below. With three, they spread evenly.
 */
function FlopWithRuns({
  state,
  active,
  onSelect,
  onClear,
}: {
  state: TableState;
  active: Target | null;
  onSelect: (target: Target) => void;
  onClear: (target: Target) => void;
}) {
  const prefix = sharedPrefix(state);
  const sharedIndexes = Array.from({ length: prefix }, (_, index) => index);
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex gap-1.5 sm:gap-2">
        {sharedIndexes.map((index) => {
          const target: Target = { kind: "board", index };
          const card = readTarget(state, target);
          return (
            <CardFace
              key={index}
              size="md"
              card={card}
              label={`Shared ${streetLabel(index)}${card === null ? ", empty" : ""}`}
              selected={sameTarget(active, target)}
              onSelect={() => onSelect(target)}
              onClear={() => onClear(target)}
            />
          );
        })}
      </div>

      <div
        className="relative h-[54px] w-[112px] shrink-0 [--run-step:62px] sm:h-[68px] sm:w-[136px] sm:[--run-step:76px]"
        role="group"
        aria-label="Turn and river for each run"
      >
        {Array.from({ length: state.runCount }, (_, run) => {
          const offset = run - (state.runCount - 1) / 2;
          const remaining = Array.from({ length: 5 - prefix }, (_, i) => prefix + i);
          return (
            <div
              key={run}
              className="absolute left-0 flex items-center gap-1.5"
              style={{ top: `calc(50% + var(--run-step) * ${offset.toFixed(2)})`, transform: "translateY(-50%)" }}
            >
              {remaining.map((index) => {
                const target: Target = { kind: "run", run, index };
                const card = readTarget(state, target);
                const selectable = isSelectable(state, target);
                return (
                  <CardFace
                    key={index}
                    size="md"
                    card={card}
                    label={`Run ${run + 1}, ${streetLabel(index)}${card === null ? ", empty" : ""}`}
                    selected={sameTarget(active, target)}
                    onSelect={selectable || card !== null ? () => onSelect(target) : undefined}
                    onClear={() => onClear(target)}
                  />
                );
              })}
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white"
                style={{ backgroundColor: RUN_COLORS[run] }}
                aria-hidden
              >
                R{run + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** An empty card-sized gap, so a run row's turn and river line up under the shared row's columns. */
function CardSpacer() {
  return <span className="h-[42px] w-[30px] sm:h-[50px] sm:w-[36px]" aria-hidden />;
}

/** The shared cards, dealt once for every runout. Filled cards can be replaced or cleared here. */
function SharedRow({
  state,
  active,
  onSelect,
  onClear,
}: {
  state: TableState;
  active: Target | null;
  onSelect: (target: Target) => void;
  onClear: (target: Target) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-12 shrink-0 rounded-full border border-white/30 px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white"
        aria-hidden
      >
        Shared
      </span>
      <div className="flex gap-1 sm:gap-1.5">
        {/* The flop always has a place here. Turn and river appear only once they are dealt to the shared board. */}
        {[0, 1, 2, 3, 4].filter((index) => index < 3 || index < sharedPrefix(state)).map((index) => {
          const target: Target = { kind: "board", index };
          const card = readTarget(state, target);
          const selectable = isSelectable(state, target);
          return (
            <div key={index} className={clsx(card === null && !selectable && "opacity-40")}>
              <CardFace
                size="sm"
                card={card}
                label={`Shared ${streetLabel(index)}${card === null ? ", empty" : ""}`}
                selected={sameTarget(active, target)}
                onSelect={selectable || card !== null ? () => onSelect(target) : undefined}
                onClear={() => onClear(target)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardSlot({
  state,
  index,
  active,
  onSelect,
  onClear,
}: {
  state: TableState;
  index: number;
  active: Target | null;
  onSelect: (target: Target) => void;
  onClear: (target: Target) => void;
}) {
  const target: Target = { kind: "board", index };
  const card = readTarget(state, target);
  const selectable = isSelectable(state, target);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--table-text)" }}>{streetLabel(index)}</span>
      <CardFace
        size="md"
        card={card}
        label={card === null ? `${streetLabel(index)}, empty` : `${streetLabel(index)}, ${cardText(card)}`}
        selected={sameTarget(active, target)}
        onSelect={selectable || card !== null ? () => onSelect(target) : undefined}
        onClear={() => onClear(target)}
      />
    </div>
  );
}

function SeatView({
  seat,
  label,
  number,
  cos,
  sin,
  owns,
  active,
  onSelect,
  onClear,
  outs,
  multiRun,
  holeCount,
}: {
  seat: Seat;
  label: string;
  number: number;
  cos: number;
  sin: number;
  owns: boolean;
  active: Target | null;
  onSelect: (target: Target) => void;
  onClear: (target: Target) => void;
  outs?: SeatOuts;
  multiRun: boolean;
  holeCount: number;
}) {
  const seated = seat.playerId !== null;
  return (
    <div
      className="absolute flex flex-col items-center gap-1"
      style={{
        left: `calc(50% + var(--rx) * ${cos.toFixed(4)})`,
        top: `calc(50% + var(--ry) * ${sin.toFixed(4)})`,
        transform: "translate(-50%, -50%)",
      }}
      data-seat={number}
    >
      <span
        className={clsx(
          "max-w-[5.5rem] truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight sm:text-xs",
          seated ? "bg-black/45 text-white" : "bg-black/25 text-white/60",
          owns && "ring-2 ring-accent",
        )}
        title={label}
      >
        {label}
      </span>
      <div className={clsx("flex gap-1 rounded-[10px] p-0.5", owns && "bg-accent/15")}>
        {Array.from({ length: holeCount }, (_, index) => {
          const target: Target = { kind: "hole", seatId: seat.id, index };
          const card = seat.hole[index];
          return (
            <CardFace
              key={index}
              size="sm"
              card={card}
              label={`${label}, hole card ${index + 1}${card === null ? ", empty" : ""}`}
              selected={sameTarget(active, target)}
              onSelect={() => onSelect(target)}
              onClear={() => onClear(target)}
            />
          );
        })}
      </div>
      {outs && outs.length > 0 ? <SeatOutsBox entries={outs} multiRun={multiRun} /> : null}
    </div>
  );
}

const MAX_MINI_CARDS = 5;

/** A small box under a seat listing that player's outs as mini cards. Shows "Ahead" when they lead. */
function SeatOutsBox({ entries, multiRun }: { entries: SeatOuts; multiRun: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-[8px] border border-white/25 bg-black/40 px-1.5 py-1 text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
      {entries.map((entry) => (
        <div key={entry.run} className="flex items-center gap-1">
          {multiRun ? (
            <span
              className="rounded-full px-1 font-mono text-[8px] font-semibold text-white"
              style={{ backgroundColor: RUN_COLORS[entry.run] }}
            >
              R{entry.run + 1}
            </span>
          ) : null}
          {entry.ahead ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-white/80">Ahead</span>
          ) : (
            <>
              <span className="font-mono text-[9px] tabular-nums text-white/80">
                {entry.cards.length} {entry.cards.length === 1 ? "out" : "outs"}
              </span>
              <div className="flex gap-0.5">
                {entry.cards.slice(0, MAX_MINI_CARDS).map((card) => (
                  <CardFace key={card} size="xs" card={card} label={cardText(card)} />
                ))}
                {entry.cards.length > MAX_MINI_CARDS ? (
                  <span className="self-center font-mono text-[8px] text-white/70">+{entry.cards.length - MAX_MINI_CARDS}</span>
                ) : null}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
