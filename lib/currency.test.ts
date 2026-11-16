import { describe, expect, it } from "vitest";
import { CURRENCY_CODES, currencyForTimezone, effectiveCurrency } from "./currency";
import { parseBlinds } from "@/lib/validation/schemas";
import { variantLabel } from "@/lib/game-variants";
import { ledgerStateSchema } from "@/lib/validation/schemas";
import { createEmptyState, ledgerReducer } from "@/lib/state/reducer";
import { formatMoney } from "@/lib/money";

describe("currencyForTimezone", () => {
  it.each([
    ["Asia/Kolkata", "INR"],
    ["America/New_York", "USD"],
    ["Europe/London", "GBP"],
    ["Europe/Paris", "EUR"],
    ["Australia/Sydney", "AUD"],
    ["America/Toronto", "CAD"],
    ["Asia/Dubai", "AED"],
  ])("%s maps to %s", (zone, code) => {
    expect(currencyForTimezone(zone)).toEqual({ code, matched: true, timezone: zone });
  });

  it("falls back to USD for unknown or missing timezones and says so", () => {
    expect(currencyForTimezone("Mars/Olympus")).toMatchObject({ code: "USD", matched: false });
    expect(currencyForTimezone(null)).toMatchObject({ code: "USD", matched: false, timezone: null });
  });

  it("does not guess the euro for European zones outside the euro area", () => {
    expect(currencyForTimezone("Europe/Warsaw")).toMatchObject({ matched: false });
  });

  it("only maps to currencies the app supports", () => {
    for (const zone of ["Asia/Kolkata", "Europe/London", "Europe/Paris", "America/Toronto"]) {
      expect(CURRENCY_CODES).toContain(currencyForTimezone(zone).code);
    }
  });
});

describe("effectiveCurrency", () => {
  it("Auto uses the detected currency", () => {
    expect(effectiveCurrency({ currencyAuto: true, defaultCurrency: "GBP" }, "INR")).toBe("INR");
  });

  it("manual overrides Auto", () => {
    expect(effectiveCurrency({ currencyAuto: false, defaultCurrency: "GBP" }, "INR")).toBe("GBP");
  });

  it("falls back to detected if the saved manual code is not supported", () => {
    expect(effectiveCurrency({ currencyAuto: false, defaultCurrency: "XXX" }, "USD")).toBe("USD");
  });
});

describe("currency formatting", () => {
  it("changing the display currency never converts the stored paise", () => {
    expect(formatMoney(50000, "INR")).toContain("500");
    expect(formatMoney(50000, "GBP")).toContain("500");
  });
});

describe("blinds", () => {
  it("accepts two blank blinds as 'not recorded'", () => {
    expect(parseBlinds("", "")).toEqual({ small: null, big: null });
  });

  it("accepts a zero small blind and a larger big blind", () => {
    expect(parseBlinds("0", "10")).toEqual({ small: 0, big: 1000 });
  });

  it("rejects a big blind that is not larger than the small blind", () => {
    expect(parseBlinds("10", "10").error).toMatch(/more than the small blind/);
    expect(parseBlinds("10", "5").error).toMatch(/more than the small blind/);
  });

  it("rejects one blind without the other, and invalid amounts", () => {
    expect(parseBlinds("5", "").error).toMatch(/both/);
    expect(parseBlinds("-5", "10").error).toBeTruthy();
    expect(parseBlinds("abc", "10").error).toBeTruthy();
  });
});

describe("variants and blinds on saved games", () => {
  it("labels every variant and falls back to Hold'em for unknown keys", () => {
    expect(variantLabel("plo")).toBe("Pot-Limit Omaha");
    expect(variantLabel("nonsense")).toBe("No-Limit Texas Hold'em");
  });

  it("an older game saved without variant or blinds loads with safe defaults", () => {
    const state = createEmptyState();
    const created = ledgerReducer(state, {
      type: "game/create",
      id: "g1",
      at: "2026-11-16T10:00:00.000Z",
      name: "Old game",
      date: "2026-11-01",
      currency: "INR",
      buyInPaise: 50000,
      chipsPerBuyIn: 1000,
      venue: "",
      format: "",
      notes: "",
    });
    // Simulate a ledger saved before these fields existed.
    const legacy = JSON.parse(JSON.stringify(created));
    for (const game of legacy.games) {
      delete game.variant;
      delete game.smallBlindPaise;
      delete game.bigBlindPaise;
    }
    delete legacy.settings.currencyAuto;
    delete legacy.settings.defaultSmallBlindPaise;
    delete legacy.settings.defaultBigBlindPaise;

    const parsed = ledgerStateSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.games[0]).toMatchObject({ variant: "nlh", smallBlindPaise: null, bigBlindPaise: null });
    expect(parsed.data.settings).toMatchObject({ currencyAuto: true, defaultSmallBlindPaise: 500, defaultBigBlindPaise: 1000 });
  });

  it("the reducer rejects a game whose big blind is not larger than its small blind", () => {
    const state = createEmptyState();
    const next = ledgerReducer(state, {
      type: "game/create",
      id: "g2",
      at: "2026-11-16T10:00:00.000Z",
      name: "Bad blinds",
      date: "2026-11-16",
      currency: "INR",
      buyInPaise: 50000,
      chipsPerBuyIn: 1000,
      venue: "",
      format: "",
      notes: "",
      smallBlindPaise: 10,
      bigBlindPaise: 10,
    });
    expect(next.games).toHaveLength(0);
  });

  it("the reducer stores variant and blinds on a valid game", () => {
    const state = createEmptyState();
    const next = ledgerReducer(state, {
      type: "game/create",
      id: "g3",
      at: "2026-11-16T10:00:00.000Z",
      name: "Omaha night",
      date: "2026-11-16",
      currency: "GBP",
      buyInPaise: 50000,
      chipsPerBuyIn: 1000,
      venue: "",
      format: "",
      notes: "",
      variant: "plo",
      smallBlindPaise: 500,
      bigBlindPaise: 1000,
    });
    expect(next.games[0]).toMatchObject({ variant: "plo", smallBlindPaise: 500, bigBlindPaise: 1000, currency: "GBP" });
  });
});
