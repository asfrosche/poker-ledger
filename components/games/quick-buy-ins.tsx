"use client";

import { Plus } from "lucide-react";
import { useLedger } from "@/lib/state/ledger-context";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/primitives";
import { chipsForFraction, paiseForChips, QUICK_BUY_INS } from "@/lib/calculations/buy-in";
import { formatChips, formatMoney } from "@/lib/money";
import type { Game } from "@/types";

interface Props {
  game: Game;
  playerId: string;
  playerName: string;
  editable: boolean;
  size?: "sm" | "md" | "lg";
}

/** 1x / ½x / ¼x buy-in buttons. Each records one buy-in transaction immediately. */
export function QuickBuyIns({ game, playerId, playerName, editable, size = "sm" }: Props) {
  const { dispatch } = useLedger();
  const { notify } = useToast();

  return (
    <>
      {QUICK_BUY_INS.map(({ fraction, label, noun }) => {
        const chips = chipsForFraction(game.chipsPerBuyIn, fraction);
        const amount = chips === null ? null : paiseForChips(chips, game.buyInPaise, game.chipsPerBuyIn);
        const possible = chips !== null && amount !== null;
        const primary = fraction === 1;

        return (
          <Button
            key={fraction}
            size={size}
            variant={primary ? "primary" : "secondary"}
            disabled={!editable || !possible}
            aria-label={`${noun} buy-in for ${playerName}${possible ? `, ${formatChips(chips)} chips` : ", not available at this rate"}`}
            title={possible ? `${formatMoney(amount, game.currency)} · ${formatChips(chips)} chips` : "Not a whole number of chips at this rate"}
            className={size !== "sm" && primary ? "min-w-0 flex-1 whitespace-nowrap" : undefined}
            onClick={() => {
              if (chips === null || amount === null) return;
              dispatch({
                type: "buyin/add",
                gameId: game.id,
                playerId,
                amountPaise: amount,
                chips,
                note: primary ? "" : `${label === "½" ? "½" : "¼"}× buy-in`,
              });
              notify(`${playerName}: ${formatMoney(amount, game.currency)} for ${formatChips(chips)} chips`);
            }}
          >
            {primary ? (
              <>
                <Plus className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden /> Buy-in
              </>
            ) : (
              <span className="num">{label}</span>
            )}
          </Button>
        );
      })}
    </>
  );
}
