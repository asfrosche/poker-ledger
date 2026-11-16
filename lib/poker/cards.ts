// A card is an integer 0..51. rank = card % 13 (0 = deuce ... 12 = ace), suit = floor(card / 13).

export type Card = number;

export const SUIT_SYMBOLS = ["♣", "♦", "♥", "♠"] as const;
export const SUIT_LETTERS = ["c", "d", "h", "s"] as const;
export const RANK_LETTERS = "23456789TJQKA";
export const RANK_NAMES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

/** Rank value used for comparisons: 2..14 (ace high). */
export function cardRank(card: Card): number {
  return (card % 13) + 2;
}

export function cardSuit(card: Card): number {
  return Math.floor(card / 13);
}

export function makeCard(rankValue: number, suit: number): Card {
  return suit * 13 + (rankValue - 2);
}

/** Short text form such as "Ah" or "10c". */
export function cardText(card: Card): string {
  return RANK_LETTERS[cardRank(card) - 2] + SUIT_LETTERS[cardSuit(card)];
}

/** Parse "Ah", "10c" or "td" (case-insensitive). Returns null if the text is not a card. */
export function parseCardText(text: string): Card | null {
  const match = /^(10|[2-9tjqka])([cdhs])$/i.exec(text.trim());
  if (!match) return null;
  const rankText = match[1].toUpperCase();
  const rankIndex = rankText === "10" ? RANK_LETTERS.indexOf("T") : RANK_LETTERS.indexOf(rankText);
  const suitIndex = SUIT_LETTERS.indexOf(match[2].toLowerCase() as (typeof SUIT_LETTERS)[number]);
  return suitIndex * 13 + rankIndex;
}

export const FULL_DECK: readonly Card[] = Array.from({ length: 52 }, (_, i) => i);
