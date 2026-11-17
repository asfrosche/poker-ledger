import { describe, expect, it } from "vitest";
import { parseCardText, type Card } from "@/lib/poker/cards";
import { classEquity, handGrid, heatmapEquities } from "./heatmap";

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const cards = (...codes: string[]): Card[] =>
  codes.map((code) => {
    const card = parseCardText(code);
    if (card === null) throw new Error(`bad card ${code}`);
    return card;
  });

describe("handGrid", () => {
  const classes = handGrid().flat();

  it("has 169 starting-hand classes", () => {
    expect(classes).toHaveLength(169);
  });

  it("covers all 1326 two-card combinations exactly once", () => {
    const total = classes.reduce((sum, cls) => sum + cls.combos.length, 0);
    expect(total).toBe(1326);
  });

  it("labels pairs, suited and offsuit hands", () => {
    const labels = new Set(classes.map((c) => c.label));
    expect(labels.has("AA")).toBe(true);
    expect(labels.has("AKs")).toBe(true);
    expect(labels.has("AKo")).toBe(true);
    expect(labels.has("72o")).toBe(true);
  });
});

describe("classEquity", () => {
  const find = (label: string) => handGrid().flat().find((c) => c.label === label)!;

  it("ranks aces well above seven-deuce offsuit on an empty flop", () => {
    const rng = seeded(7);
    const aces = classEquity(find("AA"), cards("Kc", "9d", "4h"), 1500, rng);
    const trash = classEquity(find("72o"), cards("Kc", "9d", "4h"), 1500, rng);
    expect(aces).toBeGreaterThan(0.6);
    expect(trash).toBeLessThan(0.35);
    expect(aces).toBeGreaterThan(trash);
  });

  it("returns NaN when the board blocks every combination of the class", () => {
    const board = cards("Ah", "Ad", "Ac", "As");
    expect(Number.isNaN(classEquity(find("AA"), board, 10, seeded(1)))).toBe(true);
  });
});

describe("river heatmap", () => {
  const find = (grid: number[][], label: string) => {
    const flat = handGrid().flat();
    const index = flat.findIndex((c) => c.label === label);
    return grid[Math.floor(index / 13)][index % 13];
  };
  const river = cards("Kc", "9d", "4h", "2s", "Qd");

  it("is exact: the same result whatever the random source", () => {
    const first = heatmapEquities(river, 1, seeded(1));
    const second = heatmapEquities(river, 1, seeded(99));
    expect(first).toEqual(second);
  });

  it("ranks aces above seven-deuce offsuit on the river", () => {
    const grid = heatmapEquities(river, 1, seeded(1));
    expect(find(grid, "AA")).toBeGreaterThan(find(grid, "72o"));
    expect(find(grid, "AA")).toBeGreaterThan(0.6);
  });
});
