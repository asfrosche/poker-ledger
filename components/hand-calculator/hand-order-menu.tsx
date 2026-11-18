"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CardText } from "@/components/ui/card-text";
import { LearningVideos } from "@/components/ui/learning-videos";
import { HAND_RANKINGS } from "@/lib/poker/hand-rankings";

/** Hand order button that opens a full-screen list of every hand ranking. */
export function HandOrderMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="h-9 rounded-[10px] border border-line bg-panel px-3 text-xs font-medium hover:bg-surface"
      >
        Hand order
      </button>

      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Hand order" className="fixed inset-0 z-50 flex flex-col whitespace-normal bg-bg">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.08em]">Hand order</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close hand order"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-panel hover:bg-surface"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col [overflow-wrap:anywhere]">
              <div className="flex flex-col gap-3 text-xs text-muted">
                <p>
                  Cards rank from 2 (lowest) up to Ace (highest).{" "}
                  <span className="hidden sm:inline">
                    Hands are ranked by how rare they are: the rarer the hand, the higher it ranks.{" "}
                  </span>
                  If two players have the same type of hand, the higher cards win.
                </p>
              </div>

              <ol className="mt-1.5 flex flex-col divide-y divide-line">
                {HAND_RANKINGS.map((hand, index) => (
                  <li key={hand.name} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3 sm:py-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span className="num w-5 shrink-0 pt-0.5 font-mono text-xs text-muted">{index + 1}</span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="sm:flex sm:flex-col sm:items-start">
                          <span className="text-sm font-medium">{hand.name}</span>
                          <span aria-hidden className="text-xs text-muted sm:hidden"> — </span>
                          <span className="text-xs font-semibold text-muted">{hand.meaning}</span>
                        </div>
                        <span className="mt-0.5 text-xs text-muted">
                          <span className="font-[450]">Example:</span> {hand.exampleNote}
                        </span>
                      </div>
                    </div>
                    <CardText cards={hand.example} className="pl-7 font-mono text-sm sm:shrink-0 sm:justify-end sm:pl-0" />
                  </li>
                ))}
              </ol>

              <section aria-labelledby="terms-heading" className="mt-6 flex flex-col gap-3">
                <h3 id="terms-heading" className="label">
                  Words you&apos;ll hear
                </h3>
                <dl className="flex flex-col gap-3 text-xs">
                  <div>
                    <dt className="font-medium">Texas Hold&apos;em</dt>
                    <dd className="text-muted">
                      Each player gets 2 private cards. Five shared cards are dealt face up in stages: the flop (3), the turn
                      (1) and the river (1). Your hand is the best 5 out of 7 cards: your 2 private cards plus the 5 shared
                      cards. You don&apos;t have to use all 7.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Omaha</dt>
                    <dd className="text-muted">
                      Like Hold&apos;em, but each player gets 4 private cards. You must use exactly 2 of your cards and exactly
                      3 of the 5 shared cards.
                      <span className="mt-1 block">
                        Example: the board shows 4 diamonds (K♦ 8♦ 6♦ 3♦) and you hold 1 diamond (A♦). That is not a flush.
                        You can use only 3 board cards, so the most diamonds you can make is 4.
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Bomb pot</dt>
                    <dd className="text-muted">
                      A special hand where everyone puts money in up front and there is no first betting round. The hand goes
                      straight to the flop with a big pot.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Pot limit</dt>
                    <dd className="text-muted">The biggest bet or raise allowed is the size of the pot at that moment.</dd>
                  </div>
                </dl>
              </section>

              <div className="mt-6">
                <LearningVideos headingTag="h3" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
