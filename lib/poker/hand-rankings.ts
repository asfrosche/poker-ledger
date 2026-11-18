/** Poker hand categories from strongest to weakest. Matches the categories in evaluate.ts. */
export type HandRanking = {
  name: string;
  meaning: string;
  example: string;
  exampleNote: string;
};

export const HAND_RANKINGS: readonly HandRanking[] = [
  {
    name: "Royal flush",
    meaning: "Ace, King, Queen, Jack, 10. One suit.",
    example: "A♠ K♠ Q♠ J♠ 10♠",
    exampleNote: "All five are spades, from 10 up to Ace.",
  },
  {
    name: "Straight flush",
    meaning: "Five in a row, all one suit.",
    example: "5♥ 6♥ 7♥ 8♥ 9♥",
    exampleNote: "Five hearts in a row, from 5 to 9.",
  },
  {
    name: "Four of a kind",
    meaning: "Four cards with the same number.",
    example: "9♣ 9♦ 9♥ 9♠ K♣",
    exampleNote: "Four 9s. The King is the extra card.",
  },
  {
    name: "Full house",
    meaning: "Three of one number plus a pair.",
    example: "K♣ K♦ K♥ 4♠ 4♣",
    exampleNote: "Three Kings and a pair of 4s.",
  },
  {
    name: "Flush",
    meaning: "Five cards of one suit, not in a row.",
    example: "A♦ J♦ 8♦ 5♦ 2♦",
    exampleNote: "All five are diamonds, but not in a row.",
  },
  {
    name: "Straight",
    meaning: "Five in a row, mixed suits.",
    example: "5♣ 6♦ 7♥ 8♠ 9♣",
    exampleNote: "Five cards in a row from 5 to 9, mixed suits.",
  },
  {
    name: "Three of a kind",
    meaning: "Three cards with the same number.",
    example: "7♣ 7♦ 7♥ A♠ 2♣",
    exampleNote: "Three 7s. The Ace and 2 are extra.",
  },
  {
    name: "Two pair",
    meaning: "Two different pairs.",
    example: "Q♣ Q♦ 5♥ 5♠ 9♣",
    exampleNote: "Queens and 5s make two pairs. The 9 is extra.",
  },
  {
    name: "One pair",
    meaning: "Two cards with the same number.",
    example: "10♣ 10♦ A♥ 7♠ 3♣",
    exampleNote: "A pair of 10s. The Ace, 7 and 3 are extra.",
  },
  {
    name: "High card",
    meaning: "No matches or run. Highest card wins.",
    example: "A♣ J♦ 8♥ 5♠ 2♣",
    exampleNote: "No matches or run. The Ace is highest.",
  },
];
