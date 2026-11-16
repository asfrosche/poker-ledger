"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { RANK_NAMES, SUIT_SYMBOLS, cardRank, cardSuit, type Card } from "@/lib/poker/cards";

export type CardSize = "seat" | "xs" | "sm" | "md";

/**
 * Card sizes. Each card shows its rank once, in the top-left corner, and a large suit in the middle.
 * `clear` sizes the remove button to the card, and it sits in the bottom-right corner, which is always empty.
 */
const SIZE: Record<CardSize, { box: string; corner: string; suit: string; clear: string; clearIcon: string }> = {
  // Player seats: small on phones so the seat fits the flat table, the usual size on desktop.
  seat: {
    box: "h-[30px] w-[22px] sm:h-[50px] sm:w-[36px]",
    corner: "text-[7px] sm:text-[10px]",
    suit: "text-[12px] sm:text-lg",
    clear: "size-4 -right-2 -bottom-2 sm:size-5 sm:-right-2.5 sm:-bottom-2.5",
    clearIcon: "size-2.5 sm:size-3",
  },
  xs: {
    box: "h-[30px] w-[22px] sm:h-[42px] sm:w-[30px]",
    corner: "text-[7px] sm:text-[9px]",
    suit: "text-[12px] sm:text-base",
    clear: "size-4 -right-2 -bottom-2",
    clearIcon: "size-2.5",
  },
  sm: {
    box: "h-[42px] w-[30px] sm:h-[50px] sm:w-[36px]",
    corner: "text-[9px] sm:text-[10px]",
    suit: "text-base sm:text-lg",
    clear: "size-5 -right-2.5 -bottom-2.5",
    clearIcon: "size-3",
  },
  md: {
    box: "h-[40px] w-[28px] sm:h-[68px] sm:w-[48px]",
    corner: "text-[9px] sm:text-[11px]",
    suit: "text-lg sm:text-2xl",
    clear: "size-5 -right-2.5 -bottom-2.5",
    clearIcon: "size-3",
  },
};

export function isRedSuit(suit: number): boolean {
  return suit === 1 || suit === 2; // diamonds, hearts
}

/** A playing card face, or an empty slot when `card` is null. */
export function CardFace({
  card,
  size = "sm",
  selected = false,
  shared = false,
  label,
  onSelect,
  onClear,
}: {
  card: Card | null;
  size?: CardSize;
  /** The slot the picker is currently filling. */
  selected?: boolean;
  /** A card shared by every runout. Shown but not editable from the run row. */
  shared?: boolean;
  label: string;
  onSelect?: () => void;
  onClear?: () => void;
}) {
  const s = SIZE[size];
  const inner = (
    <span
      className={clsx(
        "relative flex shrink-0 items-center justify-center rounded-[7px] border font-mono leading-none transition-all",
        s.box,
        card === null && "border-dashed border-white/40 bg-white/5 text-white/50",
        card !== null && "border-black/15 bg-[#fdfcf8] shadow-[0_1px_2px_rgba(0,0,0,0.25)]",
        card !== null && (isRedSuit(cardSuit(card)) ? "text-[#c62828]" : "text-[#1d1d1b]"),
        shared && "opacity-80",
        selected && "ring-2 ring-accent ring-offset-2 ring-offset-transparent",
      )}
    >
      {card === null ? (
        <span aria-hidden className="text-lg">+</span>
      ) : (
        <>
          {/* The one and only rank on the card: top-left corner. */}
          <span className={clsx("absolute left-1 top-0.5 font-semibold", s.corner)} aria-hidden>
            {RANK_NAMES[cardRank(card) - 2]}
          </span>
          {/* Large centred suit. */}
          <span className={s.suit} aria-hidden>
            {SUIT_SYMBOLS[cardSuit(card)]}
          </span>
        </>
      )}
    </span>
  );

  if (!onSelect) {
    return (
      <span className="relative inline-flex" aria-label={label} role="img">
        {inner}
      </span>
    );
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onSelect}
        aria-label={label}
        aria-pressed={selected}
        className="rounded-[7px] focus-visible:outline-offset-4 disabled:cursor-default"
      >
        {inner}
      </button>
      {card !== null && onClear ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
          aria-label={`Clear ${label}`}
          className={clsx(
            "absolute z-10 flex items-center justify-center rounded-full border border-black/20 bg-[#fdfcf8] text-[#1d1d1b] shadow-sm hover:bg-accent-soft",
            // Invisible enlarged tap area, so the visible button stays small but the target is about 44px.
            "before:absolute before:-inset-3.5 before:content-['']",
            s.clear,
          )}
        >
          <X className={s.clearIcon} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
