"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { FieldLabel, PageHeading, Panel } from "@/components/ui/primitives";
import { Card, RANK_NAMES, SUIT_SYMBOLS, cardRank, cardSuit, makeCard } from "@/lib/poker/cards";
import { evaluateBest, handCategoryName } from "@/lib/poker/evaluate";
import { estimateEquity } from "@/lib/poker/equity";
import { potOdds } from "@/lib/poker/pot-odds";

const SUIT_NAMES = ["clubs", "diamonds", "hearts", "spades"] as const;
const SLOT_NAMES = ["Hole 1", "Hole 2", "Flop 1", "Flop 2", "Flop 3", "Turn", "River"] as const;
const SIMULATION_TRIALS = 5000;

type Slots = (Card | null)[];

/** Hole cards (0-1) are always open. Flop cards open in order, then turn, then river. */
function slotUnlocked(slots: Slots, index: number): boolean {
  if (index <= 4) return true;
  if (index === 5) return slots[2] !== null && slots[3] !== null && slots[4] !== null;
  return slots[5] !== null;
}

function parseAmount(text: string): number {
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function CalculatorView() {
  const [slots, setSlots] = useState<Slots>(() => Array<Card | null>(7).fill(null));
  const [active, setActive] = useState(0);
  const [opponents, setOpponents] = useState(1);
  const [pot, setPot] = useState("");
  const [toCall, setToCall] = useState("");

  const used = new Set(slots.filter((c): c is Card => c !== null));

  const { hole, board } = useMemo(
    () => ({
      hole: slots.slice(0, 2).filter((c): c is Card => c !== null),
      board: slots.slice(2).filter((c): c is Card => c !== null),
    }),
    [slots],
  );

  const equity = useMemo(() => {
    if (hole.length !== 2) return null;
    return estimateEquity({ hole, board, opponents, trials: SIMULATION_TRIALS });
  }, [hole, board, opponents]);

  const handName = useMemo(() => {
    const cards = [...hole, ...board];
    return cards.length >= 5 ? handCategoryName(evaluateBest(cards)) : null;
  }, [hole, board]);

  const odds = potOdds(parseAmount(pot), parseAmount(toCall));

  function placeCard(card: Card) {
    if (used.has(card)) return;
    const next = [...slots];
    next[active] = card;
    setSlots(next);

    // Move to the next empty slot that is open, so the user can keep clicking cards.
    const following = next.findIndex((value, i) => i > active && value === null && slotUnlocked(next, i));
    const first = next.findIndex((value, i) => value === null && slotUnlocked(next, i));
    const target = following !== -1 ? following : first;
    if (target !== -1) setActive(target);
  }

  function pickSlot(index: number) {
    if (slots[index] !== null) {
      // Clearing a hole card clears only that card. Clearing a board card also clears the cards after it.
      const next = [...slots];
      const clearTo = index < 2 ? index : 6;
      for (let i = index; i <= clearTo; i++) next[i] = null;
      setSlots(next);
      setActive(index);
      return;
    }
    if (slotUnlocked(slots, index)) setActive(index);
  }

  function reset() {
    setSlots(Array<Card | null>(7).fill(null));
    setActive(0);
  }

  const verdict = (() => {
    if (!equity || odds.breakEven === null) return null;
    const diff = equity.equity - odds.breakEven;
    if (Math.abs(diff) < 0.005) return { tone: "neutral" as const, text: "Your equity is about the same as the price. Calling is roughly break-even on pot odds." };
    if (diff > 0) return { tone: "good" as const, text: "Your equity is above the price. Calling is profitable on pot odds alone." };
    return { tone: "bad" as const, text: "Your equity is below the price. Folding is better on pot odds alone." };
  })();

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Tools"
        title="Odds calculator"
        actions={
          <button type="button" onClick={reset} className="h-9 rounded-[10px] border border-line bg-panel px-3 text-xs font-medium hover:bg-surface">
            Clear cards
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          <Panel className="flex flex-col gap-4 p-4 sm:p-5">
            <p className="label">Cards</p>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="group" aria-label="Card slots">
              {SLOT_NAMES.map((name, index) => {
                const card = slots[index];
                const unlocked = card !== null || slotUnlocked(slots, index);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => pickSlot(index)}
                    disabled={!unlocked}
                    aria-pressed={active === index}
                    aria-label={card !== null ? `${name}: ${cardLabel(card)}. Tap to clear` : `${name}, empty`}
                    className={clsx(
                      "flex min-h-14 flex-col items-center justify-center rounded-[10px] border px-1 text-center transition-colors disabled:opacity-40",
                      active === index ? "border-accent bg-accent-soft" : "border-line bg-panel hover:bg-surface",
                    )}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{name}</span>
                    <span className={clsx("font-mono text-sm font-semibold", card !== null && isRed(card) && "text-red-600")}>
                      {card !== null ? cardLabel(card) : "–"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1.5" role="group" aria-label="Deck">
              {[0, 1, 2, 3].map((suit) => (
                <div key={suit} className="grid grid-cols-13 gap-0.5 sm:gap-1">
                  {Array.from({ length: 13 }, (_, r) => {
                    const card = makeCard(r + 2, suit);
                    const taken = used.has(card);
                    return (
                      <button
                        key={card}
                        type="button"
                        onClick={() => placeCard(card)}
                        disabled={taken}
                        aria-label={`${RANK_NAMES[r]} of ${SUIT_NAMES[suit]}`}
                        className={clsx(
                          "h-8 min-w-0 rounded-[6px] border border-line bg-panel font-mono text-[11px] leading-none transition-colors hover:bg-surface disabled:opacity-25 sm:h-9 sm:text-xs",
                          suit === 1 || suit === 2 ? "text-red-600" : "text-ink",
                        )}
                      >
                        {RANK_NAMES[r]}
                        {SUIT_SYMBOLS[suit]}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">Pick a slot, then tap a card. Board cards open in order: flop, turn, river.</p>
          </Panel>

          <Panel className="flex flex-col gap-4 p-4 sm:p-5">
            <p className="label">Pot odds</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel htmlFor="opponents">Opponents</FieldLabel>
                <select
                  id="opponents"
                  className="field h-10 w-full font-mono text-sm"
                  value={opponents}
                  onChange={(event) => setOpponents(Number(event.target.value))}
                >
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="pot">Pot size</FieldLabel>
                <input
                  id="pot"
                  inputMode="decimal"
                  placeholder="0"
                  className="field h-10 w-full font-mono text-sm"
                  value={pot}
                  onChange={(event) => setPot(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel htmlFor="to-call">To call</FieldLabel>
                <input
                  id="to-call"
                  inputMode="decimal"
                  placeholder="0"
                  className="field h-10 w-full font-mono text-sm"
                  value={toCall}
                  onChange={(event) => setToCall(event.target.value)}
                />
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="flex flex-col gap-5 p-4 sm:p-5 lg:sticky lg:top-24 lg:self-start">
          <p className="label">Result</p>

          {equity === null ? (
            <p className="text-sm text-muted">Pick your two hole cards to see your chance of winning.</p>
          ) : (
            <>
              <div>
                <p className="font-mono text-4xl font-semibold tabular-nums">{percent(equity.equity)}</p>
                <p className="text-sm text-muted">
                  Equity vs {opponents} random {opponents === 1 ? "hand" : "hands"}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
                  <div className="h-full bg-accent" style={{ width: percent(equity.equity) }} />
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-center">
                <Breakdown label="Win" value={equity.win} />
                <Breakdown label="Tie" value={equity.tie} />
                <Breakdown label="Lose" value={equity.lose} />
              </dl>

              {handName ? (
                <p className="text-sm">
                  Current hand: <span className="font-semibold">{handName}</span>
                </p>
              ) : null}

              {odds.breakEven !== null ? (
                <div className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
                  <p>
                    Pot odds <span className="font-mono">{odds.ratio?.toFixed(2)} : 1</span>. You need{" "}
                    <span className="font-mono font-semibold">{percent(odds.breakEven)}</span> to break even.
                  </p>
                  {verdict ? (
                    <p
                      className={clsx(
                        "rounded-[10px] border px-3 py-2",
                        verdict.tone === "good" && "border-line text-ink",
                        verdict.tone === "bad" && "border-accent text-accent",
                        verdict.tone === "neutral" && "border-line text-muted",
                      )}
                    >
                      {verdict.text}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <p className="text-xs text-muted">
                Estimated from {equity.trials.toLocaleString()} random deals. Opponents get random cards, not a range. Pot odds ignore
                future betting (implied odds).
              </p>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface px-2 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className="font-mono text-sm font-semibold tabular-nums">{percent(value)}</dd>
    </div>
  );
}

function isRed(card: Card): boolean {
  const suit = cardSuit(card);
  return suit === 1 || suit === 2;
}

function cardLabel(card: Card): string {
  return `${RANK_NAMES[cardRank(card) - 2]}${SUIT_SYMBOLS[cardSuit(card)]}`;
}
