// Board texture: how much the cards on the board suggest the next cards could change the hand.
// Counts suit and rank connections only. It does not estimate probabilities or use any action history.

import { cardRank, cardSuit, SUIT_SYMBOLS, type Card } from "@/lib/poker/cards";

export type TextureRating = "dry" | "semi-wet" | "wet";

export type BoardTexture = {
  rating: TextureRating;
  /** Higher means more draws are possible. Shown alongside the rating so the rule is visible. */
  points: number;
  notes: string[];
};

// Rank values run 2..14, with 14 the ace. The ace also plays low in the wheel (A-2-3-4-5).
const STRAIGHT_WINDOWS: number[][] = [
  ...Array.from({ length: 9 }, (_, i) => [2 + i, 3 + i, 4 + i, 5 + i, 6 + i]),
  [14, 2, 3, 4, 5],
];

/** Null until the flop is down. */
export function boardTexture(board: readonly Card[]): BoardTexture | null {
  if (board.length < 3) return null;

  let points = 0;
  const notes: string[] = [];

  // Flush draws: the most cards of one suit on the board. Two of a suit is two-tone; three or more is a flush draw.
  const suits = [0, 0, 0, 0];
  for (const card of board) suits[cardSuit(card)]++;
  const topSuit = suits.indexOf(Math.max(...suits));
  const suitCount = suits[topSuit];
  let suitPoints = 0;
  if (suitCount === 2) {
    suitPoints = 1;
    notes.push(`Two-tone board (two ${SUIT_SYMBOLS[topSuit]}): a flush needs two more of that suit`);
  } else if (suitCount >= 3) {
    suitPoints = suitCount - 1;
    const symbol = SUIT_SYMBOLS[topSuit];
    notes.push(
      suitCount === 5
        ? `Five ${symbol} on the board: a flush is already on the table`
        : `${suitCount} ${symbol} on the board: a flush draw is possible`,
    );
  }
  points += suitPoints;

  // Straight draws: the most board ranks that fit inside one five-card window. Two ranks that share a
  // window (for example T and J, or 9 and 6) already allow a straight draw.
  const ranks = new Set(board.map((card) => cardRank(card)));
  const best = Math.max(...STRAIGHT_WINDOWS.map((window) => window.filter((r) => ranks.has(r)).length));
  let rankPoints = 0;
  if (best >= 2) {
    rankPoints = best - 1;
    notes.push(
      best >= 4
        ? `${best} connected ranks: a straight is close`
        : best === 3
          ? "Three connected ranks: a straight draw is possible"
          : "Two connected ranks: a straight draw is possible",
    );
  }
  points += rankPoints;

  // Both at once: a hand can make a straight draw and a flush draw together.
  if (rankPoints > 0 && suitPoints > 0) {
    points += 1;
    notes.push("Straight and flush draws can combine on one hand");
  }

  // A paired board makes sets, full houses and quads possible.
  if (ranks.size < board.length) {
    points += 1;
    notes.push("Paired board: sets and full houses are possible");
  }

  if (notes.length === 0) notes.push("Few suit or rank connections: the board is quiet");

  const rating: TextureRating = points <= 1 ? "dry" : points <= 3 ? "semi-wet" : "wet";
  return { rating, points, notes };
}
