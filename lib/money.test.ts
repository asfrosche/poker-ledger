import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToPaise, paiseToInput } from "@/lib/money";
import { allocateChipValues } from "@/lib/calculations/ledger";

describe("money parsing and formatting", () => {
  it("parses rupees into integer paise", () => {
    expect(parseMoneyToPaise("500")).toBe(50000);
    expect(parseMoneyToPaise("1,000")).toBe(100000);
    expect(parseMoneyToPaise("500.5")).toBe(50050);
    expect(parseMoneyToPaise("0.10")).toBe(10);
  });

  it("rejects malformed amounts", () => {
    expect(parseMoneyToPaise("")).toBeNull();
    expect(parseMoneyToPaise("abc")).toBeNull();
    expect(parseMoneyToPaise("1.234")).toBeNull();
    expect(parseMoneyToPaise("-5")).toBeNull();
  });

  it("round-trips through the input format", () => {
    expect(paiseToInput(50000)).toBe("500");
    expect(paiseToInput(50050)).toBe("500.50");
  });

  it("formats INR with Indian grouping and signs", () => {
    expect(formatMoney(50000, "INR")).toBe("₹500");
    expect(formatMoney(100000000, "INR")).toBe("₹10,00,000");
    expect(formatMoney(30000, "INR", { signed: true })).toBe("+₹300");
    expect(formatMoney(-30000, "INR", { signed: true })).toBe("-₹300");
    expect(formatMoney(0, "INR", { signed: true })).toBe("₹0");
  });
});

describe("chip value allocation and rounding", () => {
  it("standard buy-ins: exact per-chip value with no rounding", () => {
    // ₹500 buy-in for 1,000 chips => ₹0.50 per chip.
    const alloc = allocateChipValues(
      [
        { key: "a", chips: 2600 },
        { key: "b", chips: 2400 },
      ],
      100000,
      5000,
    );
    expect(alloc.get("a")).toBe(52000);
    expect(alloc.get("b")).toBe(48000);
  });

  it("indivisible values: allocated amounts still sum to the exact pool", () => {
    // ₹1,000 across 3,000 chips, split 1,000 / 1,000 / 1,000 => 33,333.33 paise each.
    const alloc = allocateChipValues(
      [
        { key: "a", chips: 1000 },
        { key: "b", chips: 1000 },
        { key: "c", chips: 1000 },
      ],
      100000,
      3000,
    );
    const values = [...alloc.values()];
    expect(values.reduce((s, v) => s + v, 0)).toBe(100000);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("uneven split with remainders: never silently drops or invents paise", () => {
    const alloc = allocateChipValues(
      [
        { key: "a", chips: 333 },
        { key: "b", chips: 333 },
        { key: "c", chips: 334 },
      ],
      10001,
      1000,
    );
    expect([...alloc.values()].reduce((s, v) => s + v, 0)).toBe(10001);
  });

  it("zero issued chips yields zero values rather than dividing by zero", () => {
    const alloc = allocateChipValues([{ key: "a", chips: 0 }], 0, 0);
    expect(alloc.get("a")).toBe(0);
  });
});
