import { describe, expect, it } from "vitest";
import { capitalizeName } from "./player-names";

describe("capitalizeName", () => {
  it("capitalises the first letter of a lowercase name", () => {
    expect(capitalizeName("alex")).toBe("Alex");
  });

  it("capitalises the first letter of each word", () => {
    expect(capitalizeName("sam  de la cruz")).toBe("Sam  De La Cruz");
  });

  it("trims spaces and handles hyphens and apostrophes", () => {
    expect(capitalizeName("  mary-jane o'neil  ")).toBe("Mary-Jane O'Neil");
  });

  it("leaves the rest of each word as typed", () => {
    expect(capitalizeName("mcDonald")).toBe("McDonald");
    expect(capitalizeName("ANNA")).toBe("ANNA");
  });

  it("returns an empty string for blank input", () => {
    expect(capitalizeName("   ")).toBe("");
  });
});
