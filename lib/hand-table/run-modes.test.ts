import { describe, expect, it } from "vitest";
import { parseCardText, type Card } from "@/lib/poker/cards";
import { equityStatus } from "./equity";
import {
  addSeat,
  createTableState,
  placeCard,
  readTarget,
  runBoard,
  selectTarget,
  setRunCount,
  toEngineInput,
  usedCards,
  type TableState,
  type Target,
} from "./table-state";

const c = (text: string): Card => {
  const card = parseCardText(text);
  if (card === null) throw new Error(`bad card ${text}`);
  return card;
};

/** Two seated players, both with two cards, so the table is always calculable. */
function twoPlayers(): TableState {
  let s = addSeat(addSeat(createTableState(), "a", "p1"), "b", "p2");
  s = selectTarget(s, { kind: "hole", seatId: "a", index: 0 });
  s = placeCard(s, c("Ah"));
  s = placeCard(s, c("Kh"));
  s = placeCard(s, c("2d"));
  s = placeCard(s, c("3d"));
  return s;
}

/** Deals the shared flop 2c 7d 9h, starting from the first empty board slot. */
function dealFlop(s: TableState): TableState {
  let t = selectTarget(s, { kind: "board", index: 0 });
  t = placeCard(t, c("2c"));
  t = placeCard(t, c("7d"));
  return placeCard(t, c("9h"));
}

describe("Run once to Run twice", () => {
  it("keeps the dealt flop and gives each run its own engine board", () => {
    const once = dealFlop(twoPlayers());
    expect(toEngineInput(once)?.runs).toEqual([[c("2c"), c("7d"), c("9h")]]);

    const twice = setRunCount(once, 2);
    const input = toEngineInput(twice);
    expect(input?.runs).toEqual([
      [c("2c"), c("7d"), c("9h")],
      [c("2c"), c("7d"), c("9h")],
    ]);
    expect(equityStatus(twice).kind).toBe("ready");
  });

  it("preflop, Run twice gives two empty boards and remains calculable", () => {
    const twice = setRunCount(twoPlayers(), 2);
    expect(toEngineInput(twice)?.runs).toEqual([[], []]);
    expect(equityStatus(twice).kind).toBe("ready");
  });

  it("lets each run deal its own turn and river after a shared flop", () => {
    let s = setRunCount(dealFlop(twoPlayers()), 2);
    s = selectTarget(s, { kind: "run", run: 0, index: 3 });
    s = placeCard(s, c("Qs"));
    s = placeCard(s, c("Js"));
    s = selectTarget(s, { kind: "run", run: 1, index: 3 });
    s = placeCard(s, c("Tc"));
    expect(runBoard(s, 0).slice(3)).toEqual([c("Qs"), c("Js")]);
    expect(runBoard(s, 1).slice(3)).toEqual([c("Tc"), null]);
    expect(toEngineInput(s)?.runs).toEqual([
      [c("2c"), c("7d"), c("9h"), c("Qs"), c("Js")],
      [c("2c"), c("7d"), c("9h"), c("Tc")],
    ]);
  });
});

describe("Run twice to Run once", () => {
  it("keeps the first run's turn as the board's turn", () => {
    let s = setRunCount(dealFlop(twoPlayers()), 2);
    s = selectTarget(s, { kind: "run", run: 0, index: 3 });
    s = placeCard(s, c("Qs"));
    const once = setRunCount(s, 1);
    expect(once.board.slice(0, 4)).toEqual([c("2c"), c("7d"), c("9h"), c("Qs")]);
    expect(toEngineInput(once)?.runs).toEqual([[c("2c"), c("7d"), c("9h"), c("Qs")]]);
  });

  it("frees cards that were only on hidden runs, so they can be dealt elsewhere", () => {
    let s = setRunCount(dealFlop(twoPlayers()), 2);
    s = selectTarget(s, { kind: "run", run: 1, index: 3 });
    s = placeCard(s, c("Qs"));
    const once = setRunCount(s, 1);
    expect(usedCards(once).has(c("Qs"))).toBe(false);
    // Placing Qs on the single board must now be allowed.
    const target: Target = { kind: "board", index: 3 };
    const dealt = placeCard(selectTarget(once, target), c("Qs"));
    expect(readTarget(dealt, target)).toBe(c("Qs"));
  });

  it("round trip Once, Twice, Once returns the same board", () => {
    const original = dealFlop(twoPlayers());
    const back = setRunCount(setRunCount(setRunCount(original, 2), 3), 1);
    expect(back.board).toEqual(original.board);
    expect(toEngineInput(back)?.runs).toEqual(toEngineInput(original)?.runs);
  });
});

describe("Run thrice", () => {
  it("gives three engine boards that share the dealt flop", () => {
    const thrice = setRunCount(dealFlop(twoPlayers()), 3);
    const runs = toEngineInput(thrice)?.runs ?? [];
    expect(runs).toHaveLength(3);
    for (const run of runs) expect(run.slice(0, 3)).toEqual([c("2c"), c("7d"), c("9h")]);
  });
});
