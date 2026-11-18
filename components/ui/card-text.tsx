import { clsx } from "clsx";

const RED_SUITS = new Set(["♥", "♦"]);

/**
 * Renders cards written like "10♥ A♠". Hearts and diamonds use the app's red token; spades and clubs use the
 * normal text colour, so both read correctly in light and dark themes.
 */
export function CardText({ cards, className }: { cards: string; className?: string }) {
  return (
    <span className={clsx("inline-flex whitespace-nowrap", className)}>
      {cards.split(" ").map((card, index) => {
        const suit = card.slice(-1);
        const rank = card.slice(0, -1);
        return (
          <span key={`${card}-${index}`} className="whitespace-nowrap mr-1.5 last:mr-0">
            {rank}
            <span className={RED_SUITS.has(suit) ? "text-loss" : "text-ink"}>{suit}</span>
          </span>
        );
      })}
    </span>
  );
}
