import { describe, expect, it } from "vitest";
import { parseCardText, type Card } from "@/lib/poker/cards";
import { createTableState, type TableState } from "./table-state";
import { codeFromInput, decodeTable, encodeTable } from "./share";

const card = (code: string): Card => {
  const c = parseCardText(code);
  if (c === null) throw new Error(`bad card ${code}`);
  return c;
};

let counter = 0;
const newId = () => `seat-${++counter}`;

function sampleTable(): TableState {
  const base = createTableState("holdem");
  return {
    ...base,
    seats: [
      { id: "a", playerId: "p1", hole: [card("Ah"), card("Kd"), null, null] },
      { id: "b", playerId: null, hole: [card("10c"), null, null, null] },
    ],
    runCount: 2,
    board: [card("7s"), card("8s"), card("2c"), null, null],
    runs: [
      [card("7s"), card("8s"), card("2c"), card("Qh"), null],
      [card("7s"), card("8s"), card("2c"), card("Jd"), null],
      [null, null, null, null, null],
    ],
  };
}

describe("share links", () => {
  it("round-trips the cards, variant and run count", () => {
    const code = encodeTable(sampleTable());
    const decoded = decodeTable(code, newId);
    expect(decoded).not.toBeNull();
    expect(decoded?.variant).toBe("holdem");
    expect(decoded?.runCount).toBe(2);
    expect(decoded?.seats.map((s) => s.hole.slice(0, 2))).toEqual([
      [card("Ah"), card("Kd")],
      [card("10c"), null],
    ]);
    expect(decoded?.board.slice(0, 3)).toEqual([card("7s"), card("8s"), card("2c")]);
    expect(decoded?.runs[1][3]).toBe(card("Jd"));
  });

  it("does not carry player ids across to another ledger", () => {
    const decoded = decodeTable(encodeTable(sampleTable()), newId);
    expect(decoded?.seats.every((s) => s.playerId === null)).toBe(true);
  });

  it("rejects a code that is not valid", () => {
    expect(decodeTable("not-a-real-code", newId)).toBeNull();
    expect(decodeTable("", newId)).toBeNull();
  });

  it("rejects a code that repeats a card", () => {
    const table = sampleTable();
    table.seats[1].hole[0] = card("Ah");
    expect(decodeTable(encodeTable(table), newId)).toBeNull();
  });

  it("pulls the code out of a pasted link", () => {
    expect(codeFromInput("https://example.com/hand-calculator#table=abc_DEF-123")).toBe("abc_DEF-123");
    expect(codeFromInput("  abc123  ")).toBe("abc123");
  });
});
