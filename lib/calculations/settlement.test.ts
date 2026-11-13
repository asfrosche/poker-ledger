import { describe, expect, it } from "vitest";
import { computeTransfers, UnbalancedSettlementError } from "@/lib/calculations/settlement";

const sum = (xs: { amountPaise: number }[]) => xs.reduce((s, x) => s + x.amountPaise, 0);

describe("computeTransfers (greedy minimum-transfer settlement)", () => {
  it("single winner and loser: one payment", () => {
    const transfers = computeTransfers([
      { playerId: "alex", netPaise: 30000 },
      { playerId: "sam", netPaise: -30000 },
    ]);
    expect(transfers).toEqual([{ fromPlayerId: "sam", toPlayerId: "alex", amountPaise: 30000 }]);
  });

  it("matches the spec example: Alex +500, Sam -300, Jordan -200", () => {
    const transfers = computeTransfers([
      { playerId: "alex", netPaise: 50000 },
      { playerId: "sam", netPaise: -30000 },
      { playerId: "jordan", netPaise: -20000 },
    ]);
    expect(transfers).toEqual([
      { fromPlayerId: "sam", toPlayerId: "alex", amountPaise: 30000 },
      { fromPlayerId: "jordan", toPlayerId: "alex", amountPaise: 20000 },
    ]);
  });

  it("multiple creditors and debtors: pays everyone exactly and uses few transfers", () => {
    const balances = [
      { playerId: "a", netPaise: 40000 },
      { playerId: "b", netPaise: 10000 },
      { playerId: "c", netPaise: -25000 },
      { playerId: "d", netPaise: -15000 },
      { playerId: "e", netPaise: -10000 },
    ];
    const transfers = computeTransfers(balances);
    expect(sum(transfers)).toBe(50000);
    expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);

    const net = new Map(balances.map((b) => [b.playerId, b.netPaise]));
    for (const t of transfers) {
      net.set(t.fromPlayerId, (net.get(t.fromPlayerId) ?? 0) + t.amountPaise);
      net.set(t.toPlayerId, (net.get(t.toPlayerId) ?? 0) - t.amountPaise);
    }
    for (const value of net.values()) expect(value).toBe(0);
  });

  it("zero balances: no payments required", () => {
    expect(
      computeTransfers([
        { playerId: "a", netPaise: 0 },
        { playerId: "b", netPaise: 0 },
      ]),
    ).toEqual([]);
  });

  it("ignores zero-balance players while settling the rest", () => {
    const transfers = computeTransfers([
      { playerId: "a", netPaise: 0 },
      { playerId: "b", netPaise: 5000 },
      { playerId: "c", netPaise: -5000 },
    ]);
    expect(transfers).toEqual([{ fromPlayerId: "c", toPlayerId: "b", amountPaise: 5000 }]);
  });

  it("refuses unbalanced balances rather than dropping paise", () => {
    expect(() =>
      computeTransfers([
        { playerId: "a", netPaise: 5000 },
        { playerId: "b", netPaise: -4999 },
      ]),
    ).toThrow(UnbalancedSettlementError);
  });

  it("is deterministic for equal amounts (ties broken by player id)", () => {
    const first = computeTransfers([
      { playerId: "z", netPaise: 100 },
      { playerId: "y", netPaise: 100 },
      { playerId: "x", netPaise: -100 },
      { playerId: "w", netPaise: -100 },
    ]);
    const second = computeTransfers([
      { playerId: "w", netPaise: -100 },
      { playerId: "x", netPaise: -100 },
      { playerId: "y", netPaise: 100 },
      { playerId: "z", netPaise: 100 },
    ]);
    expect(first).toEqual(second);
  });
});
