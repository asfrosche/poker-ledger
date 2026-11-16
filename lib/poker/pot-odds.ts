/**
 * Pot odds: the share of the final pot you must win for a call to break even.
 * Ignores implied odds and future betting, so it is a starting point, not a full strategy.
 */
export type PotOdds = {
  /** Fraction of the total pot (including your call) you need to win. Null when there is nothing to call. */
  breakEven: number | null;
  /** Pot size compared with the call, e.g. 3 means "3 to 1". Null when there is nothing to call. */
  ratio: number | null;
};

export function potOdds(pot: number, toCall: number): PotOdds {
  if (!(toCall > 0) || !(pot >= 0)) return { breakEven: null, ratio: null };
  return {
    breakEven: toCall / (pot + toCall),
    ratio: pot / toCall,
  };
}
