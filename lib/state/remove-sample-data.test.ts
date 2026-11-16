import { describe, expect, it } from "vitest";
import { removeSampleData } from "./remove-sample-data";

const base = {
  schemaVersion: 1,
  players: [
    { id: "p1", name: "Alex", createdAt: "t" },
    { id: "p2", name: "Old guest", isSample: true, createdAt: "t" },
    { id: "p3", name: "Sam", isSample: true, createdAt: "t" },
  ],
  games: [
    { id: "g1", name: "Real night", isSample: false },
    { id: "g2", name: "Old sample", isSample: true },
  ],
  gamePlayers: [
    { gameId: "g1", playerId: "p1", finalChips: null },
    { gameId: "g2", playerId: "p2", finalChips: null },
    { gameId: "g1", playerId: "p3", finalChips: null },
  ],
  buyIns: [
    { id: "b1", gameId: "g1", playerId: "p1" },
    { id: "b2", gameId: "g2", playerId: "p2" },
  ],
  settlements: [{ id: "s1", gameId: "g2" }],
  selectedGameId: "g2",
};

describe("removeSampleData", () => {
  it("removes sample games with their buy-ins, settlements and links", () => {
    const cleaned = removeSampleData(base) as typeof base;
    expect(cleaned.games.map((g) => g.id)).toEqual(["g1"]);
    expect(cleaned.buyIns.map((b) => b.id)).toEqual(["b1"]);
    expect(cleaned.settlements).toEqual([]);
    expect(cleaned.gamePlayers.every((gp) => gp.gameId === "g1")).toBe(true);
  });

  it("removes sample players no real game uses, but keeps sample players who are in a real game", () => {
    const cleaned = removeSampleData(base) as typeof base;
    expect(cleaned.players.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("clears the selected game when it was a sample game", () => {
    expect((removeSampleData(base) as typeof base).selectedGameId).toBeNull();
  });

  it("returns the same object when there is no sample data", () => {
    const clean = { ...base, games: [base.games[0]], buyIns: [], settlements: [], gamePlayers: [], players: [base.players[0]] };
    expect(removeSampleData(clean)).toBe(clean);
  });

  it("returns unknown shapes unchanged", () => {
    expect(removeSampleData(null)).toBeNull();
    expect(removeSampleData("text")).toBe("text");
  });
});
