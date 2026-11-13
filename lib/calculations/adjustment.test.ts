import { describe, expect, it } from "vitest";
import { applyAdjustment, computeAdjustment, splitByWeight } from "@/lib/calculations/adjustment";

describe("splitByWeight", () => {
  it("splits whole paise so the parts sum exactly to the total", () => {
    const parts = splitByWeight(100, [
      { key: "a", weight: 1 },
      { key: "b", weight: 1 },
      { key: "c", weight: 1 },
    ]);
    expect(parts.get("a")).toBe(34); // leftover paise go to the first in input order
    expect(parts.get("b")).toBe(33);
    expect(parts.get("c")).toBe(33);
  });

  it("keeps the sign for negative totals", () => {
    const parts = splitByWeight(-100, [
      { key: "a", weight: 1 },
      { key: "b", weight: 1 },
      { key: "c", weight: 1 },
    ]);
    expect([...parts.values()].reduce((s, v) => s + v, 0)).toBe(-100);
    expect(parts.get("a")).toBe(-34);
  });

  it("weights shares by profit", () => {
    const parts = splitByWeight(4000, [
      { key: "a", weight: 3000 },
      { key: "b", weight: 1000 },
    ]);
    expect(parts.get("a")).toBe(3000);
    expect(parts.get("b")).toBe(1000);
  });

  it("returns zeros for a zero total", () => {
    const parts = splitByWeight(0, [{ key: "a", weight: 5 }]);
    expect(parts.get("a")).toBe(0);
  });
});

describe("computeAdjustment", () => {
  const raw = [
    { playerId: "a", netPaise: 3000 },
    { playerId: "b", netPaise: 1000 },
    { playerId: "c", netPaise: -3600 },
    { playerId: "d", netPaise: -500 },
  ];

  it("winners absorb the residual in proportion to profit and balances sum to zero", () => {
    const plan = computeAdjustment(raw, "winners");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.adjustment.residualPaise).toBe(-100);
    const adj = new Map(plan.adjustment.lines.map((l) => [l.playerId, l.adjustmentPaise]));
    expect(adj.get("a")).toBe(75);
    expect(adj.get("b")).toBe(25);
    expect(adj.get("c")).toBe(0);
    expect(adj.get("d")).toBe(0);
    const balanced = applyAdjustment(raw, plan.adjustment);
    expect(balanced.reduce((s, b) => s + b.netPaise, 0)).toBe(0);
  });

  it("even split spreads the residual across everyone and sums exactly", () => {
    const plan = computeAdjustment(raw, "even");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const adds = plan.adjustment.lines.map((l) => l.adjustmentPaise);
    expect(adds.reduce((s, v) => s + v, 0)).toBe(100);
    for (const v of adds) expect(Math.abs(v - 25)).toBeLessThanOrEqual(1);
    const balanced = applyAdjustment(raw, plan.adjustment);
    expect(balanced.reduce((s, b) => s + b.netPaise, 0)).toBe(0);
  });

  it("refuses 'winners' when nobody is in profit and money is still to be absorbed", () => {
    const plan = computeAdjustment(
      [
        { playerId: "a", netPaise: -100 },
        { playerId: "b", netPaise: -200 },
      ],
      "winners",
    );
    expect(plan.ok).toBe(false);
  });

  it("when nobody profited, players who broke even absorb a shortfall and losers are untouched", () => {
    const plan = computeAdjustment(
      [
        { playerId: "a", netPaise: 0 },
        { playerId: "b", netPaise: 0 },
        { playerId: "c", netPaise: -50 },
      ],
      "winners",
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const adj = new Map(plan.adjustment.lines.map((l) => [l.playerId, l.adjustmentPaise]));
    expect(adj.get("a")! + adj.get("b")!).toBe(50);
    expect(adj.get("c")).toBe(0);
  });

  it("returns zero adjustments when the balances already sum to zero", () => {
    const plan = computeAdjustment(
      [
        { playerId: "a", netPaise: 500 },
        { playerId: "b", netPaise: -500 },
      ],
      "even",
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.adjustment.residualPaise).toBe(0);
    expect(plan.adjustment.lines.every((l) => l.adjustmentPaise === 0)).toBe(true);
  });
});
