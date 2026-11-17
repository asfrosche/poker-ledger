import { describe, expect, it } from "vitest";
import {
  equityColour,
  labelColour,
  labelContrast,
  legendGradient,
  legendPosition,
  LEGEND_MARKERS,
  LEGEND_RANGE,
} from "./heatmap-colour";

const parse = (css: string) => css.match(/\d+/g)!.map(Number);

describe("equityColour", () => {
  it("gives visibly different shades to hands with different equities", () => {
    // Equities around 45%, 50%, 55% and 62% should all look different.
    const shades = [0.45, 0.5, 0.55, 0.62].map(equityColour);
    expect(new Set(shades).size).toBe(4);
  });

  it("runs red for weak, yellow for average and dark green for premium", () => {
    const [weakR, weakG] = parse(equityColour(0.2));
    expect(weakR).toBeGreaterThan(weakG);
    const [midR, midG] = parse(equityColour(0.5));
    expect(midR).toBeGreaterThan(200);
    expect(midG).toBeGreaterThan(150);
    const [premR, premG] = parse(equityColour(0.9));
    expect(premG).toBeGreaterThan(premR);
    expect(premG).toBeLessThan(120);
  });

  it("clamps values outside the legend range to the end colours", () => {
    expect(equityColour(0)).toBe(equityColour(LEGEND_RANGE[0]));
    expect(equityColour(1)).toBe(equityColour(LEGEND_RANGE[1]));
  });
});

describe("labelColour", () => {
  it("uses dark text on light cells and white on dark ones", () => {
    expect(labelColour(0.5)).toBe("#252923");
    expect(labelColour(0.9)).toBe("#ffffff");
  });

  it("keeps every label at or above 3.8:1 contrast with the charcoal text (below WCAG AA 4.5:1 in places; see notes)", () => {
    for (let v = 0; v <= 1.0001; v += 0.01) {
      expect(labelContrast(v)).toBeGreaterThanOrEqual(3.8);
    }
  });
});

describe("legend", () => {
  it("places the markers at 25%, 50% and 62%", () => {
    expect(LEGEND_MARKERS).toEqual([0.25, 0.5, 0.62]);
    expect(legendPosition(0.25)).toBeCloseTo(7.14, 1);
    expect(legendPosition(0.62)).toBeCloseTo(60, 0);
  });

  it("builds a gradient that starts and ends at the range colours", () => {
    const gradient = legendGradient();
    expect(gradient).toContain(`${equityColour(LEGEND_RANGE[0])} 0%`);
    expect(gradient).toContain(`${equityColour(LEGEND_RANGE[1])} 100%`);
  });
});
