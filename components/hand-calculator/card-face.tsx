"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { RANK_NAMES, SUIT_SYMBOLS, cardRank, cardSuit, type Card } from "@/lib/poker/cards";

export type CardSize = "sm" | "md";

const SIZE: Record<CardSize, { box: string; rank: string; suit: string; corner: string }> = {
  sm: { box: "h-[42px] w-[30px] sm:h-[50px] sm:w-[36px]", rank: "text-[11px] sm:text-xs", suit: "text-base sm:text-lg", corner: "text-[8px] sm:text-[9px]" },
  md: { box: "h-[54px] w-[38px] sm:h-[68px] sm:w-[48px]", rank: "text-sm sm:text-base", suit: "text-xl sm:text-2xl", corner: "text-[9px] sm:text-[10px]" },
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
        "relative flex shrink-0 flex-col items-center justify-center rounded-[7px] border font-mono leading-none transition-all",
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
          <span className={clsx("absolute left-1 top-0.5 font-semibold", s.corner)} aria-hidden>
            {RANK_NAMES[cardRank(card) - 2]}
          </span>
          <span className={clsx("font-semibold", s.rank)} aria-hidden>
            {RANK_NAMES[cardRank(card) - 2]}
          </span>
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
          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-black/20 bg-[#fdfcf8] text-[#1d1d1b] shadow-sm hover:bg-accent-soft"
        >
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
