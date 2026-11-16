"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RANK_NAMES, SUIT_SYMBOLS, makeCard, type Card } from "@/lib/poker/cards";
import { describeCardLocation, describeTarget } from "@/lib/hand-table/labels";
import { readTarget, usedCards, type TableState } from "@/lib/hand-table/table-state";
import { isRedSuit } from "./card-face";

// Columns in the order Spades, Hearts, Diamonds, Clubs. Suit indices come from lib/poker/cards.
const SUIT_COLUMNS = [3, 2, 1, 0] as const;
const SUIT_NAMES = ["Clubs", "Diamonds", "Hearts", "Spades"] as const;
// Rows from Ace down to 2, so the high cards sit at the top.
const RANK_ROWS = Array.from({ length: 13 }, (_, i) => 14 - i);

/**
 * Card grid for filling the active slot. Collapsible: the header always shows which slot is active,
 * and the grid can be hidden to free up space on a phone.
 */
export function CardPicker({
  state,
  seatLabel,
  onPick,
  open,
  onToggle,
}: {
  state: TableState;
  seatLabel: (seatId: string) => string;
  onPick: (card: Card) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const used = useMemo(() => usedCards(state), [state]);
  const active = state.active;
  const current = active ? readTarget(state, active) : null;
  const activeText = active ? describeTarget(state, active, seatLabel) : null;

  return (
    <section aria-labelledby="picker-heading" className="panel flex flex-col gap-3 p-3 sm:p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="picker-body"
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-[10px] text-left focus-visible:outline-offset-4"
      >
        <span className="min-w-0">
          <span id="picker-heading" className="label block">
            Card picker
          </span>
          <span className="mt-1 block truncate text-sm font-medium" aria-live="polite">
            {activeText ?? "Tap an empty slot to start"}
          </span>
        </span>
        {open ? (
          <ChevronUp className="size-5 shrink-0 text-muted" aria-hidden />
        ) : (
          <ChevronDown className="size-5 shrink-0 text-muted" aria-hidden />
        )}
        <span className="sr-only">{open ? "Hide cards" : "Show cards"}</span>
      </button>

      <div id="picker-body" hidden={!open} className="flex flex-col gap-3">
        <div role="grid" aria-label="Playing cards" className="flex flex-col gap-1">
          <div role="row" className="grid grid-cols-[2.25rem_repeat(4,minmax(0,1fr))] gap-1">
            <span role="columnheader" className="sr-only">
              Rank
            </span>
            {SUIT_COLUMNS.map((suit) => (
              <span
                key={suit}
                role="columnheader"
                className={clsx(
                  "text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted",
                  isRedSuit(suit) && "text-red-600",
                )}
              >
                {SUIT_SYMBOLS[suit]} {SUIT_NAMES[suit]}
              </span>
            ))}
          </div>

          {RANK_ROWS.map((rank) => (
            <div key={rank} role="row" className="grid grid-cols-[2.25rem_repeat(4,minmax(0,1fr))] gap-1">
              <span role="rowheader" className="flex items-center justify-center font-mono text-xs font-semibold text-muted">
                {RANK_NAMES[rank - 2]}
              </span>
              {SUIT_COLUMNS.map((suit) => {
                const card = makeCard(rank, suit);
                const isSelected = current === card && active !== null;
                const isUsed = used.has(card) && !isSelected;
                const where = isUsed ? describeCardLocation(state, card, seatLabel) : null;
                const disabled = active === null || isUsed;
                const name = `${RANK_NAMES[rank - 2]} of ${SUIT_NAMES[suit].toLowerCase()}`;

                return (
                  <div role="gridcell" key={card}>
                    <button
                      type="button"
                      onClick={() => onPick(card)}
                      disabled={disabled}
                      aria-label={
                        isSelected
                          ? `${name}, selected in ${activeText}`
                          : isUsed
                            ? `${name}, already placed at ${where}`
                            : `${name}`
                      }
                      aria-pressed={isSelected}
                      className={clsx(
                        "flex min-h-10 w-full flex-col items-center justify-center rounded-[8px] border px-0.5 font-mono leading-tight transition-colors sm:min-h-9",
                        isRedSuit(suit) ? "text-red-600" : "text-ink",
                        isSelected && "border-accent bg-accent-soft font-semibold ring-1 ring-accent",
                        !isSelected && !isUsed && !disabled && "border-line bg-panel hover:bg-surface",
                        !isSelected && (isUsed || disabled) && "border-line bg-surface",
                        isUsed && "opacity-40",
                        disabled && !isUsed && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="text-sm">
                        {RANK_NAMES[rank - 2]}
                        {SUIT_SYMBOLS[suit]}
                      </span>
                      {isUsed && where ? (
                        <span className="max-w-full truncate text-[9px] font-sans text-muted" aria-hidden>
                          {where}
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted">
          {active === null
            ? "Pick a seat, board or run slot first. Greyed cards are already on the table."
            : "Tap a card to place it. Greyed cards are already on the table and show where."}
        </p>
      </div>
    </section>
  );
}
