/**
 * Sample games and players were removed from the app. Ledgers saved before that still carry them, so
 * they are stripped from the raw saved data before it is validated. Real records are never touched.
 */

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowsOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Returns the saved data without sample games, their buy-ins, settlements and game-player links,
 * and without sample players that no real game uses. Unknown shapes are returned unchanged.
 */
export function removeSampleData<T>(raw: T): T {
  if (!isRow(raw) || !Array.isArray(raw.games)) return raw;

  const isSampleGame = (game: unknown) => isRow(game) && game.isSample === true;
  const sampleGameIds = new Set(rowsOf(raw.games).filter(isSampleGame).map((g) => (g as Row).id));
  if (sampleGameIds.size === 0 && !rowsOf(raw.players).some((p) => isRow(p) && p.isSample === true)) return raw;

  const games = rowsOf(raw.games).filter((g) => !isSampleGame(g));
  const gamePlayers = rowsOf(raw.gamePlayers).filter((gp) => !(isRow(gp) && sampleGameIds.has(gp.gameId)));
  const usedPlayerIds = new Set(gamePlayers.map((gp) => (gp as Row).playerId));
  const players = rowsOf(raw.players).filter(
    (p) => !(isRow(p) && p.isSample === true && !usedPlayerIds.has(p.id)),
  );
  const keptGameIds = new Set(games.map((g) => (g as Row).id));
  const selected = raw.selectedGameId;
  const cleaned: Row = {
    ...raw,
    games,
    gamePlayers,
    players,
    buyIns: rowsOf(raw.buyIns).filter((b) => !(isRow(b) && sampleGameIds.has(b.gameId))),
    settlements: rowsOf(raw.settlements).filter((s) => !(isRow(s) && sampleGameIds.has(s.gameId))),
    selectedGameId: typeof selected === "string" && keptGameIds.has(selected) ? selected : null,
  };
  return cleaned as T;
}
