import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/poker/cards";
import { addSeat, createTableState, randomFlop, randomHands, setVariant, type TableState } from "./table-state";

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function withSeats(count: number, variant: "holdem" | "omaha" = "holdem"): TableState {
  let t = setVariant(createTableState(), variant);
  for (let i = 0; i < count; i++) t = addSeat(t, `s${i}`, null);
  return t;
}

const allCards = (t: TableState): Card[] => [
  ...t.seats.flatMap((s) => s.hole.filter((c): c is Card => c !== null)),
  ...t.board.filter((c): c is Card => c !== null),
];

describe("randomHands", () => {
  it("gives every seat two distinct hole cards in Hold'em", () => {
    const t = randomHands(withSeats(4), seeded(3));
    for (const seat of t.seats) {
      expect(seat.hole.slice(0, 2).every((c) => c !== null)).toBe(true);
      expect(seat.hole[2]).toBeNull();
    }
    const cards = allCards(t);
    expect(new Set(cards).size).toBe(cards.length);
  });

  it("gives four cards per seat in Omaha", () => {
    const t = randomHands(withSeats(3, "omaha"), seeded(5));
    for (const seat of t.seats) expect(seat.hole.every((c) => c !== null)).toBe(true);
  });

  it("keeps the board and avoids its cards", () => {
    const base = randomFlop(withSeats(2), seeded(1));
    const boardBefore = base.board.slice(0, 3);
    const t = randomHands(base, seeded(2));
    expect(t.board.slice(0, 3)).toEqual(boardBefore);
    const holes = t.seats.flatMap((s) => s.hole.filter((c): c is Card => c !== null));
    for (const card of holes) expect(boardBefore.includes(card)).toBe(false);
  });
});

describe("randomFlop", () => {
  it("sets three distinct flop cards and clears the turn and river", () => {
    const t = randomFlop(randomHands(withSeats(3), seeded(4)), seeded(9));
    expect(t.board.slice(0, 3).every((c) => c !== null)).toBe(true);
    expect(t.board[3]).toBeNull();
    expect(t.board[4]).toBeNull();
    const cards = allCards(t);
    expect(new Set(cards).size).toBe(cards.length);
  });

  it("does not put a flop card in anyone's hand", () => {
    const hands = randomHands(withSeats(6), seeded(11));
    const t = randomFlop(hands, seeded(12));
    const holes = hands.seats.flatMap((s) => s.hole.filter((c): c is Card => c !== null));
    for (const card of t.board.slice(0, 3)) expect(holes.includes(card as Card)).toBe(false);
  });
});
