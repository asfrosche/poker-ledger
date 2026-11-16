import { Card, cardRank, cardSuit } from "./cards";

/** Hand categories, weakest first. The index is the category number used in scores. */
export const HAND_CATEGORIES = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
] as const;

// Each score is a base-15 number: category, then up to five tiebreak ranks (2..14).
// Base 15 keeps every digit below the base, so plain integer comparison is correct.
const BASE = 15;
const CATEGORY_WEIGHT = BASE ** 5;

/** Higher score = stronger hand. Only compare scores produced by these functions. */
export type HandScore = number;

/** Score a five-card hand. */
export function scoreFive(cards: readonly Card[]): HandScore {
  const ranks = cards.map(cardRank).sort((a, b) => b - a);
  const flush = cards.every((c) => cardSuit(c) === cardSuit(cards[0]));

  // Straight: five distinct ranks spanning 4, or the wheel A-2-3-4-5 (high card 5).
  let straightHigh = 0;
  if (new Set(ranks).size === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5;
  }

  // Group equal ranks, largest group first, then higher rank first.
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const top = groups[0][1];
  const second = groups[1]?.[1] ?? 0;

  let category: number;
  if (straightHigh && flush) category = 8;
  else if (top === 4) category = 7;
  else if (top === 3 && second === 2) category = 6;
  else if (flush) category = 5;
  else if (straightHigh) category = 4;
  else if (top === 3) category = 3;
  else if (top === 2 && second === 2) category = 2;
  else if (top === 2) category = 1;
  else category = 0;

  const tiebreak = straightHigh ? [straightHigh] : groups.map(([rank]) => rank);
  let score = category;
  for (let i = 0; i < 5; i++) score = score * BASE + (tiebreak[i] ?? 0);
  return score;
}

/** Best five-card hand out of 5 to 7 cards. */
export function evaluateBest(cards: readonly Card[]): HandScore {
  const n = cards.length;
  if (n < 5 || n > 7) throw new RangeError(`Need 5 to 7 cards, got ${n}`);

  let best = -1;
  const pick: Card[] = [];
  // Try every five-card subset (bitmask over the cards).
  for (let mask = 0; mask < 1 << n; mask++) {
    if (bitCount(mask) !== 5) continue;
    pick.length = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) pick.push(cards[i]);
    const score = scoreFive(pick);
    if (score > best) best = score;
  }
  return best;
}

/**
 * Best Omaha hand: exactly two hole cards plus exactly three board cards.
 * Tries every pair of hole cards with every three board cards.
 */
export function evaluateOmaha(hole: readonly Card[], board: readonly Card[]): HandScore {
  if (hole.length !== 4) throw new RangeError(`Omaha needs 4 hole cards, got ${hole.length}`);
  if (board.length < 3) throw new RangeError(`Omaha needs at least 3 board cards, got ${board.length}`);

  let best = -1;
  const five: Card[] = [];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      for (let x = 0; x < board.length; x++) {
        for (let y = x + 1; y < board.length; y++) {
          for (let z = y + 1; z < board.length; z++) {
            five.length = 0;
            five.push(hole[a], hole[b], board[x], board[y], board[z]);
            const score = scoreFive(five);
            if (score > best) best = score;
          }
        }
      }
    }
  }
  return best;
}

function bitCount(x: number): number {
  let count = 0;
  for (let v = x; v; v &= v - 1) count++;
  return count;
}

/** Hand category name for a score returned by evaluateBest. */
export function handCategoryName(score: HandScore): string {
  return HAND_CATEGORIES[Math.floor(score / CATEGORY_WEIGHT)];
}
