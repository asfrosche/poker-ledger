/**
 * Display form for a player name: trimmed, with the first letter of every word capitalised.
 * The rest of each word is left exactly as typed, so "McDonald" or "de la Cruz" keep their casing.
 */
export function capitalizeName(name: string): string {
  return name
    .trim()
    .replace(/(^|[\s\-'’])(\p{Ll})/gu, (_, boundary: string, letter: string) => boundary + letter.toUpperCase());
}
