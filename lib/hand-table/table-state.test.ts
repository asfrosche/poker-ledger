import { describe, expect, it } from "vitest";
import { parseCardText, type Card } from "@/lib/poker/cards";
import {
  addSeat,
  assignPlayer,
  cardLocation,
  clearCards,
  clearTarget,
  createTableState,
  MAX_SEATS,
  moveSeat,
  placeCard,
  readTarget,
  removeSeat,
  runBoard,
  selectTarget,
  setRunCount,
  syncPlayers,
  toEngineInput,
  type TableState,
} from "./table-state";

const c = (text: string): Card => {
  const card = parseCardText(text);
  if (card === null) throw new Error(`bad card ${text}`);
  return card;
};

/** Places a list of cards one by one into whatever target is active. */
function place(state: TableState, ...texts: string[]): TableState {
  return texts.reduce((s, t) => placeCard(s, c(t)), state);
}

function withSeats(...playerIds: string[]): TableState {
  let s = createTableState();
  playerIds.forEach((pid, i) => {
    s = addSeat(s, `seat-${i}`, pid);
  });
  return s;
}

/** Selects the first hole card of the first seat, the usual starting point. */
function startHole(s: TableState): TableState {
  return selectTarget(s, { kind: "hole", seatId: "seat-0", index: 0 });
}

describe("seats and players", () => {
  it("seats one player per seat and rejects a player sitting twice", () => {
    const s = withSeats("p1", "p2");
    expect(s.seats.map((x) => x.playerId)).toEqual(["p1", "p2"]);
    expect(addSeat(s, "seat-x", "p1")).toBe(s);
    expect(assignPlayer(s, "seat-1", "p1")).toBe(s);
  });

  it("caps the table at nine seats", () => {
    let s = createTableState();
    for (let i = 0; i < MAX_SEATS + 3; i++) s = addSeat(s, `seat-${i}`, null);
    expect(s.seats).toHaveLength(MAX_SEATS);
  });

  it("moves seats and stops at the ends", () => {
    const s = withSeats("a", "b", "c");
    expect(moveSeat(s, "seat-2", -1).seats.map((x) => x.playerId)).toEqual(["a", "c", "b"]);
    expect(moveSeat(s, "seat-0", -1)).toBe(s);
  });

  it("removing a seat frees its cards and clears the selection on it", () => {
    let s = startHole(withSeats("a", "b"));
    s = place(s, "Ah");
    const removed = removeSeat(s, "seat-0");
    expect(removed.seats.map((x) => x.id)).toEqual(["seat-1"]);
    expect(removed.active).toBeNull();
    expect(cardLocation(removed, c("Ah"))).toBeNull();
  });

  it("syncPlayers empties seats whose player was deleted but keeps their cards", () => {
    let s = startHole(withSeats("a", "b"));
    s = place(s, "Ah", "Kh");
    const synced = syncPlayers(s, new Set(["b"]));
    expect(synced.seats[0].playerId).toBeNull();
    expect(synced.seats[0].hole).toEqual([c("Ah"), c("Kh")]);
    expect(synced.seats[1].playerId).toBe("b");
  });
});

describe("hole cards and duplicates", () => {
  it("fills hole cards and moves to the next empty slot", () => {
    let s = startHole(withSeats("a", "b"));
    s = place(s, "Ah");
    expect(s.active).toEqual({ kind: "hole", seatId: "seat-0", index: 1 });
    s = place(s, "Kh");
    expect(s.active).toEqual({ kind: "hole", seatId: "seat-1", index: 0 });
  });

  it("refuses a card already on the table", () => {
    let s = startHole(withSeats("a", "b"));
    s = place(s, "Ah");
    const attempt = selectTarget(s, { kind: "hole", seatId: "seat-1", index: 0 });
    expect(placeCard(attempt, c("Ah"))).toBe(attempt);
  });

  it("replaces a card in the same slot without tripping the duplicate check", () => {
    let s = startHole(withSeats("a"));
    s = place(s, "Ah");
    s = selectTarget(s, { kind: "hole", seatId: "seat-0", index: 0 });
    s = placeCard(s, c("Ah"));
    expect(readTarget(s, { kind: "hole", seatId: "seat-0", index: 0 })).toBe(c("Ah"));
  });
});

describe("community cards (Run Once)", () => {
  it("does not allow gaps on the board", () => {
    const s = createTableState();
    expect(selectTarget(s, { kind: "board", index: 2 })).toBe(s);
  });

  it("fills flop, turn, river in order", () => {
    let s = selectTarget(createTableState(), { kind: "board", index: 0 });
    s = place(s, "2c", "3c", "4c", "5c", "6c");
    expect(s.board).toEqual([c("2c"), c("3c"), c("4c"), c("5c"), c("6c")]);
  });

  it("clearing a board card also clears the cards after it", () => {
    let s = selectTarget(createTableState(), { kind: "board", index: 0 });
    s = place(s, "2c", "3c", "4c", "5c");
    s = clearTarget(s, { kind: "board", index: 1 });
    expect(s.board).toEqual([c("2c"), null, null, null, null]);
  });
});

describe("runouts", () => {
  it("preflop with two runs gives each run its own complete board", () => {
    let s = setRunCount(createTableState(), 2);
    s = selectTarget(s, { kind: "run", run: 0, index: 0 });
    s = place(s, "2c", "3c", "4c", "5c", "6c");
    s = selectTarget(s, { kind: "run", run: 1, index: 0 });
    s = place(s, "7c", "8c", "9c", "Tc", "Jc");
    expect(runBoard(s, 0)).toEqual([c("2c"), c("3c"), c("4c"), c("5c"), c("6c")]);
    expect(runBoard(s, 1)).toEqual([c("7c"), c("8c"), c("9c"), c("Tc"), c("Jc")]);
  });

  it("with the flop dealt, runs share it and only fill turn and river", () => {
    let s = selectTarget(setRunCount(createTableState(), 2), { kind: "board", index: 0 });
    s = place(s, "2c", "3c", "4c");
    expect(s.active).toEqual({ kind: "run", run: 0, index: 3 });
    s = place(s, "5d", "6d");
    expect(runBoard(s, 0).slice(0, 3)).toEqual([c("2c"), c("3c"), c("4c")]);
    expect(runBoard(s, 1).slice(0, 3)).toEqual([c("2c"), c("3c"), c("4c")]);
  });

  it("blocks a card used on any other run or on the shared board", () => {
    let s = selectTarget(setRunCount(createTableState(), 2), { kind: "run", run: 0, index: 0 });
    s = place(s, "Ac");
    const other = selectTarget(s, { kind: "run", run: 1, index: 0 });
    expect(placeCard(other, c("Ac"))).toBe(other);
  });

  it("with three runs, each run is separate", () => {
    const s = setRunCount(createTableState(), 3);
    expect(s.runCount).toBe(3);
    expect(runBoard(s, 2)).toHaveLength(5);
  });

  it("keeps existing run cards when the run count goes up and down", () => {
    let s = selectTarget(setRunCount(createTableState(), 2), { kind: "run", run: 0, index: 0 });
    s = place(s, "2c", "3c");
    const up = setRunCount(setRunCount(s, 3), 2);
    expect(runBoard(up, 0).slice(0, 2)).toEqual([c("2c"), c("3c")]);
  });

  it("dropping to Run Once keeps the first run's cards on the board", () => {
    let s = selectTarget(setRunCount(createTableState(), 2), { kind: "run", run: 0, index: 0 });
    s = place(s, "2c", "3c", "4c");
    const once = setRunCount(s, 1);
    expect(once.board.slice(0, 3)).toEqual([c("2c"), c("3c"), c("4c")]);
    expect(once.active).toBeNull();
  });

  it("run targets are not available in Run Once", () => {
    const s = createTableState();
    expect(selectTarget(s, { kind: "run", run: 0, index: 0 })).toBe(s);
  });
});

describe("clearing", () => {
  it("clearCards keeps seats and players but empties every card", () => {
    let s = startHole(withSeats("a", "b"));
    s = place(s, "Ah", "Kh");
    s = selectTarget(s, { kind: "board", index: 0 });
    s = place(s, "2c");
    const cleared = clearCards(s);
    expect(cleared.seats.map((x) => x.playerId)).toEqual(["a", "b"]);
    expect(cleared.seats.every((x) => x.hole[0] === null && x.hole[1] === null)).toBe(true);
    expect(cleared.board.every((x) => x === null)).toBe(true);
  });
});

describe("engine seam", () => {
  it("returns nothing until every seat and board is complete", () => {
    let s = startHole(withSeats("a"));
    expect(toEngineInput(s)).toBeNull();
    s = place(s, "Ah", "Kh");
    expect(toEngineInput(s)).toBeNull(); // board still empty
    s = selectTarget(s, { kind: "board", index: 0 });
    s = place(s, "2c", "3c", "4c", "5c", "6c");
    expect(toEngineInput(s)).toEqual({
      seats: [{ seatId: "seat-0", playerId: "a", hole: [c("Ah"), c("Kh")] }],
      boards: [[c("2c"), c("3c"), c("4c"), c("5c"), c("6c")]],
    });
  });
});
