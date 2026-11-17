// Colour scale for the starting-hand heatmap. One piecewise-linear RGB ramp is used for both the grid
// squares and the legend, so the legend always matches the colours on screen.

type RGB = [number, number, number];

/** Equity breakpoints (0..1) and their colours, weak to strong. Colours blend linearly between breakpoints. */
// Breakpoints stay where they were. The colours sit between the saturated and the muted versions:
// deep coral, warm orange, golden amber, then emerald, with the greens getting richer toward premium.
const STOPS: readonly [equity: number, rgb: RGB][] = [
  [0.2, [224, 87, 79]], // deep coral: weak
  [0.35, [232, 132, 58]], // warm orange: below average
  [0.5, [242, 194, 48]], // golden amber: average
  [0.6, [156, 196, 74]], // yellow-green: above average
  [0.7, [63, 164, 91]], // emerald: strong
  [0.8, [34, 135, 74]], // rich emerald: very strong
  [0.9, [20, 103, 58]], // deep emerald: premium
];

const DARK_TEXT: RGB = [37, 41, 35];
const WHITE_TEXT: RGB = [255, 255, 255];

/** The equity range the legend covers. Values outside it take the nearest end colour. */
export const LEGEND_RANGE: readonly [number, number] = [STOPS[0][0], STOPS[STOPS.length - 1][0]];

/** Markers shown under the legend, in equity (0..1). */
export const LEGEND_MARKERS: readonly number[] = [0.25, 0.5, 0.62];

function colourRGB(value: number): RGB {
  if (value <= STOPS[0][0]) return STOPS[0][1];
  const last = STOPS[STOPS.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < STOPS.length; i++) {
    const [end, endRGB] = STOPS[i];
    const [start, startRGB] = STOPS[i - 1];
    if (value <= end) {
      const t = (value - start) / (end - start);
      return [0, 1, 2].map((k) => Math.round(startRGB[k] + t * (endRGB[k] - startRGB[k]))) as RGB;
    }
  }
  return last[1];
}

/** Background colour for an equity between 0 and 1. */
export function equityColour(value: number): string {
  const [r, g, b] = colourRGB(value);
  return `rgb(${r} ${g} ${b})`;
}

function relativeLuminance([r, g, b]: RGB): number {
  const linear = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG contrast ratio of the better of dark or white text on this cell's background. */
export function labelContrast(value: number): number {
  const background = colourRGB(value);
  return Math.max(contrastRatio(background, DARK_TEXT), contrastRatio(background, WHITE_TEXT));
}

/** Whichever of dark or white text has the higher WCAG contrast on this cell's background. */
export function labelColour(value: number): string {
  const background = colourRGB(value);
  const useDark = contrastRatio(background, DARK_TEXT) >= contrastRatio(background, WHITE_TEXT);
  return useDark ? "#252923" : "#ffffff";
}

/** Position of an equity along the legend bar, as a percentage. */
export function legendPosition(value: number): number {
  const [min, max] = LEGEND_RANGE;
  return (Math.min(Math.max(value, min), max) - min) / (max - min) * 100;
}

/** CSS linear-gradient for the legend: one colour stop per breakpoint, plus the two ends. */
export function legendGradient(): string {
  const stops = [
    `${equityColour(LEGEND_RANGE[0])} 0%`,
    ...STOPS.slice(1, -1).map(([equity]) => `${equityColour(equity)} ${legendPosition(equity).toFixed(2)}%`),
    `${equityColour(LEGEND_RANGE[1])} 100%`,
  ];
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
