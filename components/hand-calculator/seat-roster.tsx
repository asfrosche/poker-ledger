"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, UserPlus, X } from "lucide-react";
import { Button, FieldLabel } from "@/components/ui/primitives";
import { MAX_SEATS, type Seat, type TableState } from "@/lib/hand-table/table-state";
import type { Player } from "@/types";

type Props = {
  state: TableState;
  players: Player[];
  seatName: (seat: Seat) => string;
  onAssign: (seatId: string, playerId: string | null) => void;
  onMove: (seatId: string, direction: -1 | 1) => void;
  onRemove: (seatId: string) => void;
  onAddSeat: (playerId: string | null) => void;
  onCreatePlayer: (name: string) => string | null;
};

/**
 * Seat list with assignment, ordering and removal. Players come from the shared ledger list,
 * so a player seated here is the same record used everywhere else in the app.
 */
export function SeatRoster({ state, players, seatName, onAssign, onMove, onRemove, onAddSeat, onCreatePlayer }: Props) {
  const seatedIds = new Set(state.seats.map((s) => s.playerId).filter((id): id is string => id !== null));
  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const unseated = sortedPlayers.filter((p) => !seatedIds.has(p.id));
  const full = state.seats.length >= MAX_SEATS;

  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [pickId, setPickId] = useState("");

  function submitNewPlayer(event: React.FormEvent) {
    event.preventDefault();
    const created = onCreatePlayer(newName);
    if (created === null) {
      setNameError("Enter a name first.");
      return;
    }
    setNameError(null);
    setNewName("");
  }

  return (
    <section aria-labelledby="roster-heading" className="panel flex flex-col gap-4 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="roster-heading" className="label">
          Seats · {state.seats.length} of {MAX_SEATS}
        </h2>
        <Button type="button" variant="secondary" onClick={() => onAddSeat(null)} disabled={full} className="h-8 px-2.5 text-xs">
          <Plus className="size-3.5" aria-hidden />
          Empty seat
        </Button>
      </div>

      {state.seats.length === 0 ? (
        <p className="text-sm text-muted">No one is seated yet. Add a player from your list or create a new one below.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {state.seats.map((seat, index) => (
            <li key={seat.id} className="flex items-center gap-2">
              <span className="w-12 shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Seat {index + 1}</span>
              <label className="sr-only" htmlFor={`seat-${seat.id}`}>
                Player for {seatName(seat)}
              </label>
              <select
                id={`seat-${seat.id}`}
                className="field field-compact min-w-0 flex-1 text-sm"
                value={seat.playerId ?? ""}
                onChange={(event) => onAssign(seat.id, event.target.value || null)}
              >
                <option value="">Empty seat</option>
                {sortedPlayers
                  .filter((p) => p.id === seat.playerId || !seatedIds.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton label={`Move ${seatName(seat)} up`} disabled={index === 0} onClick={() => onMove(seat.id, -1)}>
                  <ChevronUp className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label={`Move ${seatName(seat)} down`}
                  disabled={index === state.seats.length - 1}
                  onClick={() => onMove(seat.id, 1)}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </IconButton>
                <IconButton label={`Remove ${seatName(seat)} from the table`} onClick={() => onRemove(seat.id)}>
                  <X className="size-4" aria-hidden />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <FieldLabel htmlFor="add-existing">Add an existing player</FieldLabel>
        <div className="flex gap-2">
          <select
            id="add-existing"
            className="field field-compact min-w-0 flex-1 text-sm"
            value={pickId}
            onChange={(event) => setPickId(event.target.value)}
            disabled={full || unseated.length === 0}
          >
            <option value="">{unseated.length === 0 ? "Everyone is seated" : "Choose a player"}</option>
            {unseated.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            disabled={!pickId || full}
            onClick={() => {
              onAddSeat(pickId);
              setPickId("");
            }}
            className="h-10 shrink-0 px-3 text-sm"
          >
            Seat
          </Button>
        </div>
      </div>

      <form onSubmit={submitNewPlayer} className="flex flex-col gap-2">
        <FieldLabel htmlFor="new-player">Create a new player</FieldLabel>
        <div className="flex gap-2">
          <input
            id="new-player"
            className="field field-compact min-w-0 flex-1 text-sm"
            placeholder="Name"
            value={newName}
            maxLength={40}
            onChange={(event) => setNewName(event.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "new-player-error" : undefined}
          />
          <Button type="submit" variant="secondary" disabled={full} className="h-10 shrink-0 px-3 text-sm">
            <UserPlus className="size-4" aria-hidden />
            Add
          </Button>
        </div>
        {nameError ? (
          <p id="new-player-error" className="text-xs text-[var(--loss)]">
            {nameError}
          </p>
        ) : null}
        <p className="text-xs text-muted">New players are saved with your other players and show up across the app.</p>
      </form>
    </section>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-[9px] border border-line bg-panel text-muted hover:text-ink disabled:opacity-35 sm:size-8"
    >
      {children}
    </button>
  );
}
