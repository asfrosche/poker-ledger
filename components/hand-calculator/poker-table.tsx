"use client";

import { clsx } from "clsx";
import { CardFace } from "./card-face";
import { isSelectable, readTarget, sameTarget, sharedPrefix, type Seat, type TableState, type Target } from "@/lib/hand-table/table-state";
import { streetLabel } from "@/lib/hand-table/labels";
import { cardText } from "@/lib/poker/cards";

type Props = {
  state: TableState;
  /** Display name for a seat: the player's name, or "Seat n" when empty. */
  seatName: (seat: Seat) => string;
  onSelect: (target: Target) => void;
  onClear: (target: Target) => void;
};

/**
 * Oval table with the shared board in the centre and seats around the rail.
 * Seat positions use CSS variables (--rx, --ry) so the ring stretches with the table.
 */
export function PokerTable({ state, seatName, onSelect, onClear }: Props) {
  const count = state.seats.length;
  const prefix = sharedPrefix(state);
  const active = state.active;

  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-[46rem] [--rx:37%] [--ry:35%] sm:aspect-[16/10] sm:[--rx:39%] sm:[--ry:37%]">
      {/* Wooden rail and green felt */}
      <div className="absolute inset-0 rounded-[50%] bg-[#4b2e1a] shadow-[0_18px_40px_rgba(41,42,39,0.28),inset_0_0_0_2px_rgba(255,255,255,0.06)]" aria-hidden />
      <div className="absolute inset-[3.5%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,#2f7d57_0%,#21643f_62%,#17492f_100%)] shadow-[inset_0_0_36px_rgba(0,0,0,0.38)]" aria-hidden />
      <div className="absolute inset-[9%] rounded-[50%] border border-white/12" aria-hidden />

      {/* Shared board, centred */}
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
        <p className="max-w-[16rem] text-center font-mono text-[10px] uppercase leading-snug tracking-[0.12em] text-white/60">
          {state.runCount > 1
            ? prefix === 0
              ? "Each run deals its own board"
              : `Shared to ${streetLabel(prefix - 1)} · rest per run`
            : "Flop · Turn · River"}
        </p>
      </div>

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
          />
        );
      })}

      {count === 0 ? (
        <div className="absolute inset-x-0 bottom-[12%] text-center font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">
          Add a seat to start
        </div>
      ) : null}
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
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/65">{streetLabel(index)}</span>
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
        {([0, 1] as const).map((index) => {
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
    </div>
  );
}
