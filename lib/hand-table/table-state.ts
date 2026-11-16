// Pure state for the hand calculator table. No React and no poker maths live here.
// The evaluation engine will read the table only through `toEngineInput`.

import type { Card } from "@/lib/poker/cards";

export const MAX_SEATS = 9;
export const BOARD_SIZE = 5;
export const MAX_RUNS = 3;
export type RunCount = 1 | 2 | 3;

/** One seat at the table. `playerId` points at a record in the shared ledger `players` list. */
export type Seat = {
  id: string;
  playerId: string | null;
  hole: [Card | null, Card | null];
};

/** Something the user can place a card into. */
export type Target =
  | { kind: "hole"; seatId: string; index: 0 | 1 }
  | { kind: "board"; index: number }
  | { kind: "run"; run: number; index: number };

export type Slot = Card | null;

export type TableState = {
  seats: Seat[];
  runCount: RunCount;
  /**
   * Shared community cards, filled left to right: flop 1-3, turn, river.
   * In Run Once this is the whole board. In Run Twice/Thrice it is the part dealt before the runout split.
   */
  board: Slot[];
  /**
   * Per-runout cards, one array of five positions per run. Only positions after the shared prefix are used.
   * Kept even when the run count drops, so switching back restores them where still compatible.
   */
  runs: Slot[][];
  active: Target | null;
};

export function createTableState(): TableState {
  return {
    seats: [],
    runCount: 1,
    board: emptyBoard(),
    runs: Array.from({ length: MAX_RUNS }, () => emptyBoard()),
    active: null,
  };
}

function emptyBoard(): Slot[] {
  return Array<Slot>(BOARD_SIZE).fill(null);
}

export function sameTarget(a: Target | null, b: Target | null): boolean {
  if (!a || !b || a.kind !== b.kind) return a === b;
  if (a.kind === "hole" && b.kind === "hole") return a.seatId === b.seatId && a.index === b.index;
  if (a.kind === "board" && b.kind === "board") return a.index === b.index;
  if (a.kind === "run" && b.kind === "run") return a.run === b.run && a.index === b.index;
  return false;
}

/** Number of shared cards dealt before any runout split. Runs start after this many positions. */
export function sharedPrefix(state: TableState): number {
  let count = 0;
  while (count < BOARD_SIZE && state.board[count] !== null) count++;
  return count;
}

/** The full board for one runout, as the user sees it: shared cards first, then that run's own cards. */
export function runBoard(state: TableState, run: number): Slot[] {
  if (state.runCount === 1) return [...state.board];
  const prefix = sharedPrefix(state);
  return [...state.board.slice(0, prefix), ...state.runs[run].slice(prefix)];
}

/** Boards the table currently shows: one in Run Once, one per run otherwise. */
export function visibleBoards(state: TableState): Slot[][] {
  return Array.from({ length: state.runCount }, (_, run) => runBoard(state, run));
}

export function readTarget(state: TableState, target: Target): Slot {
  if (target.kind === "hole") {
    const seat = state.seats.find((s) => s.id === target.seatId);
    return seat ? seat.hole[target.index] : null;
  }
  if (target.kind === "board") return state.board[target.index];
  return runBoard(state, target.run)[target.index];
}

/** A target can take a card if it is filled (replace) or the card before it is filled (no gaps). */
export function isSelectable(state: TableState, target: Target): boolean {
  if (target.kind === "hole") {
    return state.seats.some((s) => s.id === target.seatId);
  }
  if (target.kind === "board") {
    if (target.index < 0 || target.index >= BOARD_SIZE) return false;
    return state.board[target.index] !== null || target.index === 0 || state.board[target.index - 1] !== null;
  }
  // Run targets exist only when there is more than one runout, and only after the shared prefix.
  if (state.runCount === 1) return false;
  if (target.run < 0 || target.run >= state.runCount) return false;
  if (target.index < sharedPrefix(state) || target.index >= BOARD_SIZE) return false;
  const board = runBoard(state, target.run);
  return board[target.index] !== null || target.index === 0 || board[target.index - 1] !== null;
}

/** Every target in display order: seat hole cards, then the board, then each runout's own cards. */
export function targetsInOrder(state: TableState): Target[] {
  const targets: Target[] = [];
  for (const seat of state.seats) {
    targets.push({ kind: "hole", seatId: seat.id, index: 0 }, { kind: "hole", seatId: seat.id, index: 1 });
  }
  for (let index = 0; index < BOARD_SIZE; index++) targets.push({ kind: "board", index });
  if (state.runCount > 1) {
    const prefix = sharedPrefix(state);
    for (let run = 0; run < state.runCount; run++) {
      for (let index = prefix; index < BOARD_SIZE; index++) targets.push({ kind: "run", run, index });
    }
  }
  return targets;
}

/** Every physical card currently placed on the table. Used to stop duplicates. */
export function usedCards(state: TableState): Set<Card> {
  const used = new Set<Card>();
  for (const seat of state.seats) for (const card of seat.hole) if (card !== null) used.add(card);
  for (const card of state.board) if (card !== null) used.add(card);
  const prefix = sharedPrefix(state);
  for (let run = 0; run < state.runCount; run++) {
    for (let index = prefix; index < BOARD_SIZE; index++) {
      const card = state.runs[run][index];
      if (card !== null) used.add(card);
    }
  }
  return used;
}

/** Where a card is placed, or null if it is free. Used to label unavailable cards in the picker. */
export function cardLocation(state: TableState, card: Card): Target | null {
  for (const target of targetsInOrder(state)) {
    if (readTarget(state, target) === card) return target;
  }
  return null;
}

/** Drops the selection if it no longer points at a usable target (seat removed, run count lowered, etc.). */
function normalize(state: TableState): TableState {
  if (state.active && !isSelectable(state, state.active)) return { ...state, active: null };
  return state;
}

// ---- Seats and players -----------------------------------------------------

export function addSeat(state: TableState, seatId: string, playerId: string | null): TableState {
  if (state.seats.length >= MAX_SEATS) return state;
  if (state.seats.some((s) => s.id === seatId)) return state;
  if (playerId !== null && state.seats.some((s) => s.playerId === playerId)) return state;
  return { ...state, seats: [...state.seats, { id: seatId, playerId, hole: [null, null] }] };
}

export function removeSeat(state: TableState, seatId: string): TableState {
  return normalize({ ...state, seats: state.seats.filter((s) => s.id !== seatId) });
}

export function moveSeat(state: TableState, seatId: string, direction: -1 | 1): TableState {
  const from = state.seats.findIndex((s) => s.id === seatId);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= state.seats.length) return state;
  const seats = [...state.seats];
  [seats[from], seats[to]] = [seats[to], seats[from]];
  return { ...state, seats };
}

/** Seats a player, or leaves the seat empty with `null`. A player can only sit in one seat. */
export function assignPlayer(state: TableState, seatId: string, playerId: string | null): TableState {
  if (playerId !== null && state.seats.some((s) => s.id !== seatId && s.playerId === playerId)) return state;
  return {
    ...state,
    seats: state.seats.map((s) => (s.id === seatId ? { ...s, playerId } : s)),
  };
}

/**
 * Call when the shared ledger changes. Seats whose player was deleted become empty, keeping their cards.
 */
export function syncPlayers(state: TableState, validPlayerIds: ReadonlySet<string>): TableState {
  let changed = false;
  const seats = state.seats.map((s) => {
    if (s.playerId === null || validPlayerIds.has(s.playerId)) return s;
    changed = true;
    return { ...s, playerId: null };
  });
  return changed ? { ...state, seats } : state;
}

// ---- Selection and cards ---------------------------------------------------

export function selectTarget(state: TableState, target: Target | null): TableState {
  if (target !== null && !isSelectable(state, target)) return state;
  return { ...state, active: target };
}

/**
 * Puts `card` into the active target, then moves the selection to the next empty target in display order.
 * Rejects cards already on the table (unless they are the card being replaced in the same slot).
 */
export function placeCard(state: TableState, card: Card): TableState {
  const target = state.active;
  if (!target || !isSelectable(state, target)) return state;
  const current = readTarget(state, target);
  if (current !== card && usedCards(state).has(card)) return state;

  const next = writeTarget(state, target, card);
  return advance(next, target);
}

/**
 * Clears a card. Clearing a board card also clears the cards after it, on the shared board and every run,
 * so the board never has gaps.
 */
export function clearTarget(state: TableState, target: Target): TableState {
  if (readTarget(state, target) === null) return { ...state, active: target };
  let next: TableState;
  if (target.kind === "hole") {
    next = writeTarget(state, target, null);
  } else if (target.kind === "board") {
    const board = state.board.map((c, i) => (i >= target.index ? null : c));
    const runs = state.runs.map((run) => run.map((c, i) => (i >= target.index ? null : c)));
    next = { ...state, board, runs };
  } else {
    const runs = state.runs.map((run, r) =>
      r === target.run ? run.map((c, i) => (i >= target.index ? null : c)) : run,
    );
    next = { ...state, runs };
  }
  return normalize({ ...next, active: isSelectable(next, target) ? target : null });
}

/** Changes the number of runouts. Dropping to one run keeps the first run's cards where they form a clean prefix. */
export function setRunCount(state: TableState, runCount: RunCount): TableState {
  if (runCount === state.runCount) return state;
  let next: TableState = { ...state, runCount };
  if (runCount === 1) {
    const adopted = runBoard(state, 0);
    const board = emptyBoard();
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (adopted[i] === null) break;
      board[i] = adopted[i];
    }
    next = { ...next, board };
  }
  return normalize(next);
}

/** Empties every card from the table but keeps the seats and their players. */
export function clearCards(state: TableState): TableState {
  return {
    ...state,
    seats: state.seats.map((s) => ({ ...s, hole: [null, null] })),
    board: emptyBoard(),
    runs: Array.from({ length: MAX_RUNS }, () => emptyBoard()),
    active: null,
  };
}

function writeTarget(state: TableState, target: Target, card: Card | null): TableState {
  if (target.kind === "hole") {
    const seats = state.seats.map((s) => {
      if (s.id !== target.seatId) return s;
      const hole: [Card | null, Card | null] = [s.hole[0], s.hole[1]];
      hole[target.index] = card;
      return { ...s, hole };
    });
    return { ...state, seats };
  }
  if (target.kind === "board") {
    const board = [...state.board];
    board[target.index] = card;
    return { ...state, board };
  }
  const runs = state.runs.map((run, r) => {
    if (r !== target.run) return run;
    const copy = [...run];
    copy[target.index] = card;
    return copy;
  });
  return { ...state, runs };
}

/** Moves the selection to the next empty, selectable target after `from`. Wraps to the first if needed. */
function advance(state: TableState, from: Target): TableState {
  const order = targetsInOrder(state);
  const start = order.findIndex((t) => sameTarget(t, from));
  const candidates = [...order.slice(start + 1), ...order.slice(0, Math.max(start, 0))];
  // With several runouts the flop is dealt as one unit, so auto-advance may fill the shared flop.
  // Shared turn and river are only dealt on purpose (tap them), never auto-selected.
  const FLOP_END = 3;
  const autoAdvanceable = (t: Target) =>
    !(state.runCount > 1 && t.kind === "board" && t.index >= FLOP_END);
  const nextEmpty =
    candidates.find((t) => readTarget(state, t) === null && isSelectable(state, t) && autoAdvanceable(t)) ?? null;
  return { ...state, active: nextEmpty };
}

// ---- Engine seam -----------------------------------------------------------

/** Everything the evaluation engine needs. Null until every seat has two cards and every board is complete. */
export type EngineInput = {
  seats: { seatId: string; playerId: string | null; hole: [Card, Card] }[];
  boards: [Card, Card, Card, Card, Card][];
};

export function toEngineInput(state: TableState): EngineInput | null {
  if (state.seats.length === 0) return null;
  const seats: EngineInput["seats"] = [];
  for (const seat of state.seats) {
    const [a, b] = seat.hole;
    if (a === null || b === null) return null;
    seats.push({ seatId: seat.id, playerId: seat.playerId, hole: [a, b] });
  }
  const boards: EngineInput["boards"] = [];
  for (const board of visibleBoards(state)) {
    if (board.some((c) => c === null)) return null;
    boards.push(board as EngineInput["boards"][number]);
  }
  return { seats, boards };
}
