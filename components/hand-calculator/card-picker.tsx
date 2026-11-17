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
// Phone rows split the 13 ranks as 5, 4, 4.
const PHONE_RANK_ROWS = [RANK_ROWS.slice(0, 5), RANK_ROWS.slice(5, 9), RANK_ROWS.slice(9)];

/**
 * Card grid for filling the active slot. Collapsible: the header always shows which slot is active,
 * and the grid can be hidden to free up space on a phone.
 *
 * Desktop (sm and up) shows ranks as rows and suits as columns. Phones show four suit groups in a
 * 2x2 layout, each group holding its ranks in rows of 5, 4 and 4 so the whole deck fits without scrolling.
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

  const cardButton = (rank: number, suit: number) => {
    const card = makeCard(rank, suit);
    const isSelected = current === card && active !== null;
    const isUsed = used.has(card) && !isSelected;
    const where = isUsed ? describeCardLocation(state, card, seatLabel) : null;
    const disabled = active === null || isUsed;
    const name = `${RANK_NAMES[rank - 2]} of ${SUIT_NAMES[suit].toLowerCase()}`;

    return (
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
    );
  };

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
        {/* Phones: suit groups side by side, ranks wrapped across four columns. */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:hidden">
          {SUIT_COLUMNS.map((suit) => (
            <div key={suit} role="group" aria-label={SUIT_NAMES[suit]} className="flex min-w-0 flex-col items-center gap-1.5">
              <span
                className={clsx(
                  "text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted",
                  isRedSuit(suit) && "text-red-600",
                )}
              >
                {SUIT_SYMBOLS[suit]} {SUIT_NAMES[suit]}
              </span>
              <div className="flex w-full flex-col gap-1">
                {PHONE_RANK_ROWS.map((ranks) => (
                  // Each row is centred on its own; cells share one width so spacing stays even.
                  <div key={ranks[0]} className="flex justify-center gap-1">
                    {ranks.map((rank) => (
                      <div key={rank} className="w-[calc((100%-1rem)/5)] shrink-0">
                        {cardButton(rank, suit)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop and tablet: ranks as rows, suits as columns. */}
        <div role="grid" aria-label="Playing cards" className="hidden flex-col gap-1 sm:flex">
          <div role="row" className="grid grid-cols-[2.25rem_repeat(4,minmax(0,1fr))] gap-1">
            {/* Kept in the grid flow so the suit headers line up with the card columns below. */}
            <span role="columnheader" className="flex items-center justify-center">
              <span className="sr-only">Rank</span>
            </span>
            {SUIT_COLUMNS.map((suit) => (
              <span
                key={suit}
                role="columnheader"
                className={clsx(
                  "flex flex-col items-center text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted",
                  isRedSuit(suit) && "text-red-600",
                )}
              >
                <span>{SUIT_SYMBOLS[suit]}</span>
                <span>{SUIT_NAMES[suit]}</span>
              </span>
            ))}
          </div>

          {RANK_ROWS.map((rank) => (
            <div key={rank} role="row" className="grid grid-cols-[2.25rem_repeat(4,minmax(0,1fr))] gap-1">
              <span role="rowheader" className="flex items-center justify-center font-mono text-xs font-semibold text-muted">
                {RANK_NAMES[rank - 2]}
              </span>
              {SUIT_COLUMNS.map((suit) => (
                <div role="gridcell" key={makeCard(rank, suit)}>
                  {cardButton(rank, suit)}
                </div>
              ))}
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
