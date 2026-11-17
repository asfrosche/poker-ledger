// Shareable table links. The whole table (variant, seats' known cards, board and runouts) is packed into the
// URL fragment, so nothing is stored on a server. Player names are not included: they belong to one ledger.

import { z } from "zod";
import { cardText, parseCardText, type Card } from "@/lib/poker/cards";
import { createTableState, MAX_HOLE, sharedPrefix, type Seat, type Slot, type TableState } from "./table-state";
import { HOLE_COUNT } from "./variant";

const SHARE_VERSION = 1;

const payloadSchema = z.object({
  v: z.literal(SHARE_VERSION),
  variant: z.enum(["holdem", "omaha"]),
  runCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  // "" marks an empty slot. Cards use the short text form, such as "Ah" or "10c".
  seats: z.array(z.array(z.string().max(3)).max(MAX_HOLE)).max(9),
  board: z.array(z.string().max(3)).max(5),
  runs: z.array(z.array(z.string().max(3)).max(5)).length(3),
});

type Payload = z.infer<typeof payloadSchema>;

const toText = (slot: Slot) => (slot === null ? "" : cardText(slot));

export function encodeTable(state: TableState): string {
  const holeCount = HOLE_COUNT[state.variant];
  const prefix = sharedPrefix(state);
  const payload: Payload = {
    v: SHARE_VERSION,
    variant: state.variant,
    runCount: state.runCount,
    seats: state.seats.map((seat) => seat.hole.slice(0, holeCount).map(toText)),
    board: state.board.map(toText),
    // Runouts only use the positions after the shared prefix, so the prefix is not repeated.
    runs: state.runs.map((run) => run.map((slot, i) => (i < prefix ? "" : toText(slot)))),
  };
  return toBase64Url(JSON.stringify(payload));
}

/** Rebuilds a table from a link code. Returns null if the code is malformed or repeats a card. */
export function decodeTable(code: string, newId: () => string): TableState | null {
  let payload: Payload;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(fromBase64Url(code)));
    if (!parsed.success) return null;
    payload = parsed.data;
  } catch {
    return null;
  }

  const readCard = (text: string): Card | null | "invalid" => {
    if (text === "") return null;
    const card = parseCardText(text);
    return card === null ? "invalid" : card;
  };
  const readRow = (texts: string[], length: number): Slot[] | null => {
    const row: Slot[] = [];
    for (let i = 0; i < length; i++) {
      const card = readCard(texts[i] ?? "");
      if (card === "invalid") return null;
      row.push(card);
    }
    return row;
  };

  const seatHoles: Slot[][] = [];
  for (const hole of payload.seats) {
    const row = readRow(hole, MAX_HOLE);
    if (row === null) return null;
    seatHoles.push(row);
  }
  const board = readRow(payload.board, 5);
  const runs = payload.runs.map((run) => readRow(run, 5));
  if (board === null || runs.some((run) => run === null)) return null;

  // Every card may appear only once across seats, the board and the runouts.
  const seen = new Set<Card>();
  const all = [...seatHoles.flat(), ...board, ...runs.flatMap((run) => run ?? [])];
  for (const card of all) {
    if (card === null) continue;
    if (seen.has(card)) return null;
    seen.add(card);
  }

  const base = createTableState(payload.variant);
  const seats: Seat[] = seatHoles.map((hole) => ({
    id: newId(),
    playerId: null,
    hole: [...hole, ...Array<Slot>(MAX_HOLE - hole.length).fill(null)],
  }));
  return { ...base, seats, runCount: payload.runCount, board, runs: runs as Slot[][] };
}

/** Pulls the code out of a pasted link, or accepts a bare code. */
export function codeFromInput(text: string): string {
  const trimmed = text.trim();
  const match = /table=([A-Za-z0-9_-]+)/.exec(trimmed);
  return match ? match[1] : trimmed;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
