const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/**
 * Time-of-day part of a default game name, using the hour of the day (0-23):
 * Morning 6am to noon, Afternoon noon to 3pm, Evening 3pm to 6pm, Night 6pm to 6am.
 */
export function timeOfDayLabel(hour: number): "Morning" | "Afternoon" | "Evening" | "Night" {
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 15) return "Afternoon";
  if (hour >= 15 && hour < 18) return "Evening";
  return "Night";
}

/** Default game name for a given moment, e.g. "Monday Morning Poker". Uses local time. */
export function defaultGameName(now: Date): string {
  return `${WEEKDAYS[now.getDay()]} ${timeOfDayLabel(now.getHours())} Poker`;
}
