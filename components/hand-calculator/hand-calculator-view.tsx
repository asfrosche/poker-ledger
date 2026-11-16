"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { PageHeading } from "@/components/ui/primitives";
import { useLedger } from "@/lib/state/ledger-context";
import {
  addSeat,
  assignPlayer,
  clearCards,
  clearTarget,
  createTableState,
  moveSeat,
  placeCard,
  removeSeat,
  selectTarget,
  setRunCount,
  syncPlayers,
  type RunCount,
  type Seat,
  type Target,
} from "@/lib/hand-table/table-state";
import type { Card } from "@/lib/poker/cards";
import { CardPicker } from "./card-picker";
import { EquityPanel } from "./equity-panel";
import { OutsChip } from "./outs-chip";
import { useTableEquity } from "./use-table-equity";
import { setVariant, sharedPrefix, toEngineInput } from "@/lib/hand-table/table-state";
import { VARIANT_LABELS } from "@/lib/hand-table/variant";
import { outsForSeats } from "@/lib/hand-table/outs";
import { PokerTable, RunoutList } from "./poker-table";
import { SeatRoster } from "./seat-roster";

const RUN_OPTIONS: { count: RunCount; label: string; short: string }[] = [
  { count: 1, label: "Run once", short: "1x" },
  { count: 2, label: "Run twice", short: "2x" },
  { count: 3, label: "Run thrice", short: "3x" },
];

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function HandCalculatorView() {
  const { state: ledger, dispatch } = useLedger();
  const players = ledger.players;
  // Start with two seats filled from the shared player list. Missing players leave the seat empty,
  // and any seat can be reassigned later. Nothing new is written to the ledger.
  const [draft, setTable] = useState(() => {
    let t = createTableState();
    const starting = players.slice(0, 2);
    for (let i = 0; i < 2; i++) t = addSeat(t, newId(), starting[i]?.id ?? null);
    return t;
  });

  // Players can be removed elsewhere in the app. Any seat pointing at a missing player is shown empty,
  // derived at render time so no effect has to write state back.
  const playerIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);
  const table = useMemo(() => syncPlayers(draft, playerIds), [draft, playerIds]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  function seatName(seat: Seat): string {
    const player = seat.playerId ? playerById.get(seat.playerId) : undefined;
    if (player) return player.name;
    const number = table.seats.findIndex((s) => s.id === seat.id) + 1;
    return `Seat ${number}`;
  }
  const seatLabel = (seatId: string) => {
    const seat = table.seats.find((s) => s.id === seatId);
    return seat ? seatName(seat) : "Seat";
  };

  const [pickerOpen, setPickerOpen] = useState(true);
  // One calculation shared by the outs card and the equity panel.
  const equity = useTableEquity(table);
  // Outs for every seated player, shown in a box beside each seat.
  const seatOuts = useMemo(() => {
    const input = toEngineInput(table);
    return input ? outsForSeats(input) : undefined;
  }, [table]);

  // Tapping a slot opens the picker, so the cards are one tap away.
  function selectSlot(target: Target) {
    setPickerOpen(true);
    setTable((t) => selectTarget(t, target));
  }

  function addSeatFor(playerId: string | null) {
    const seatId = newId();
    setTable((t) => addSeat(t, seatId, playerId));
  }

  function createPlayer(rawName: string): string | null {
    const name = rawName.trim();
    if (!name) return null;
    const existing = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const playerId = existing?.id ?? newId();
    if (!existing) dispatch({ type: "player/create", playerId, name });

    // Seat the player in the first empty seat, or add a new seat. Already-seated players are left alone.
    const seatId = newId();
    setTable((t) => {
      if (t.seats.some((s) => s.playerId === playerId)) return t;
      const empty = t.seats.find((s) => s.playerId === null);
      return empty ? assignPlayer(t, empty.id, playerId) : addSeat(t, seatId, playerId);
    });
    return playerId;
  }

  const runCount = table.runCount;
  // Runouts are only offered once the flop is down. Stays visible while runs are set, so it can be turned back to Run once.
  const showRunout = sharedPrefix(table) >= 3 || table.runCount > 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Tools"
        title="Hand calculator"
        keepRow
        actions={
          <button
            type="button"
            onClick={() => setTable((t) => clearCards(t))}
            className="h-9 rounded-[10px] border border-line bg-panel px-3 text-xs font-medium hover:bg-surface"
          >
            Clear cards
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="game-heading" className="panel flex flex-col gap-3 p-3 sm:p-4">
            <h2 id="game-heading" className="label">
              Game
            </h2>
            <div role="radiogroup" aria-label="Game" className="grid grid-cols-2 gap-1 rounded-[12px] border border-line bg-surface p-1">
              {(["holdem", "omaha"] as const).map((variant) => {
                const checked = table.variant === variant;
                return (
                  <button
                    key={variant}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setTable((t) => setVariant(t, variant))}
                    className={clsx(
                      "h-10 rounded-[9px] text-sm font-medium transition-colors",
                      checked ? "bg-panel text-ink shadow-[0_1px_2px_rgba(41,42,39,0.12)]" : "text-muted hover:text-ink",
                    )}
                  >
                    {VARIANT_LABELS[variant]}
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="runout-heading" className={clsx("panel flex flex-col gap-3 p-3 sm:p-4", !showRunout && "hidden")}>
            <h2 id="runout-heading" className="label">
              Runout
            </h2>
            <div role="radiogroup" aria-label="Runout mode" className="grid grid-cols-3 gap-1 rounded-[12px] border border-line bg-surface p-1">
              {RUN_OPTIONS.map((option) => {
                const checked = runCount === option.count;
                return (
                  <button
                    key={option.count}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setTable((t) => setRunCount(t, option.count))}
                    className={clsx(
                      "flex h-10 items-center justify-center gap-1.5 rounded-[9px] text-sm font-medium transition-colors",
                      checked ? "bg-panel text-ink shadow-[0_1px_2px_rgba(41,42,39,0.12)]" : "text-muted hover:text-ink",
                    )}
                  >
                    <span>{option.label}</span>
                    <span className="font-mono text-[11px] text-muted">({option.short})</span>
                  </button>
                );
              })}
            </div>
          </section>

          <EquityPanel state={table} seatName={seatName} equity={equity} />

          <PokerTable
            state={table}
            outs={seatOuts}
            seatName={seatName}
            onSelect={selectSlot}
            onClear={(target: Target) => setTable((t) => clearTarget(t, target))}
          />

          <RunoutList
            state={table}
            active={table.active}
            onSelect={selectSlot}
            onClear={(target: Target) => setTable((t) => clearTarget(t, target))}
          />

          <div className="flex justify-end">
            <OutsChip state={table} equity={equity} seatName={seatName} />
          </div>

        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24">
          <CardPicker
            state={table}
            seatLabel={seatLabel}
            onPick={(card: Card) => setTable((t) => placeCard(t, card))}
            open={pickerOpen}
            onToggle={() => setPickerOpen((open) => !open)}
          />

          <SeatRoster
            state={table}
            players={players}
            seatName={seatName}
            onAssign={(seatId, playerId) => setTable((t) => assignPlayer(t, seatId, playerId))}
            onMove={(seatId, direction) => setTable((t) => moveSeat(t, seatId, direction))}
            onRemove={(seatId) => setTable((t) => removeSeat(t, seatId))}
            onAddSeat={addSeatFor}
            onCreatePlayer={createPlayer}
          />
        </div>
      </div>
    </div>
  );
}
