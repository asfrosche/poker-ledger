import { describe, expect, it } from "vitest";
import { chipsForFraction, paiseForChips, resolveChipBuyIn } from "@/lib/calculations/buy-in";

const rate = { buyInPaise: 50000, chipsPerBuyIn: 1000, currency: "INR" };

describe("quick buy-in fractions", () => {
  it("gives whole chip counts for 1x, 0.5x and 0.25x", () => {
    expect(chipsForFraction(1000, 1)).toBe(1000);
    expect(chipsForFraction(1000, 0.5)).toBe(500);
    expect(chipsForFraction(1000, 0.25)).toBe(250);
  });

  it("refuses fractions that don't give whole chips", () => {
    expect(chipsForFraction(10, 0.25)).toBeNull();
  });
});

describe("chip-based buy-ins", () => {
  it("derives money from chips at the game rate", () => {
    expect(paiseForChips(250, rate.buyInPaise, rate.chipsPerBuyIn)).toBe(12500);
    expect(paiseForChips(2000, rate.buyInPaise, rate.chipsPerBuyIn)).toBe(100000);
  });

  it("refuses chip counts that would need fractional paise", () => {
    expect(paiseForChips(1, 50000, 3)).toBeNull();
  });

  it("resolves typed chips into chips + money", () => {
    expect(resolveChipBuyIn("1,000", rate)).toEqual({ chips: 1000, amountPaise: 50000 });
  });

  it("explains invalid input", () => {
    expect(resolveChipBuyIn("", rate)).toEqual({ error: "Enter the chips bought" });
    expect(resolveChipBuyIn("0", rate)).toEqual({ error: "Whole number above zero" });
    expect("error" in resolveChipBuyIn("1", { buyInPaise: 50000, chipsPerBuyIn: 3, currency: "INR" })).toBe(true);
  });
});
