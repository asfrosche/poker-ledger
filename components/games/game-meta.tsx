import { formatMoney } from "@/lib/money";
import { variantLabel } from "@/lib/game-variants";
import type { Game } from "@/types";

type MetaFields = Pick<Game, "variant" | "smallBlindPaise" | "bigBlindPaise" | "currency">;

/** "5 / 10" in the game's currency, or "Not recorded" for older games without blinds. */
export function blindsText(game: Pick<MetaFields, "smallBlindPaise" | "bigBlindPaise" | "currency">): string {
  if (game.smallBlindPaise === null || game.bigBlindPaise === null) return "Not recorded";
  return `${formatMoney(game.smallBlindPaise, game.currency)} / ${formatMoney(game.bigBlindPaise, game.currency)}`;
}

/**
 * Variant and blinds for a game, shown in headers. Blinds are formatted in the game's currency.
 * Older games without recorded blinds say so instead of showing a made-up value.
 */
export function GameMeta({ game, className }: { game: MetaFields; className?: string }) {
  const blinds = game.smallBlindPaise === null || game.bigBlindPaise === null ? "Blinds not recorded" : `Blinds ${blindsText(game)}`;
  return (
    <p className={className ?? "text-sm text-muted"}>
      {variantLabel(game.variant)} · {blinds}
    </p>
  );
}
