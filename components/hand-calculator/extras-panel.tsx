"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { boardTexture, type BoardTexture } from "@/lib/hand-table/board-texture";
import { handGrid, type HandClass } from "@/lib/hand-table/heatmap";
import { equityColour, labelColour, legendGradient, legendPosition, LEGEND_MARKERS } from "@/lib/hand-table/heatmap-colour";
import type { NextCardOdds } from "@/lib/hand-table/next-card";
import { codeFromInput, decodeTable, encodeTable } from "@/lib/hand-table/share";
import {
  placeCard,
  sharedPrefix,
  toEngineInput,
  usedCards,
  type Seat,
  type TableState,
} from "@/lib/hand-table/table-state";
import { cardText, parseCardText, type Card } from "@/lib/poker/cards";
import type { EquityView } from "./use-table-equity";
import { useExtrasJob } from "./use-extras-job";

type Props = {
  table: TableState;
  seatName: (seat: Seat) => string;
  equity: EquityView;
  /** Replaces the whole table, used by typed cards, shared links and saved scenarios. */
  onReplace: (table: TableState) => void;
  newId: () => string;
};

/**
 * Analysis tools kept at the very bottom of the page. Collapsed by default, and nothing inside runs until
 * it is opened, so the main calculator is unchanged.
 */
export function ExtrasPanel(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <details className="panel group" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-3 sm:p-4">
        <span className="label">Extras</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          Texture, heatmap, next card, links, scenarios
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>

      {open ? (
        <div className="flex flex-col gap-6 border-t border-line p-3 sm:p-4">
          <BoardTextureSection table={props.table} />
          <TypedCardsSection table={props.table} onReplace={props.onReplace} />
          <HeatmapSection table={props.table} />
          <NextCardSection table={props.table} seatName={props.seatName} />
          <ShareSection table={props.table} onReplace={props.onReplace} newId={props.newId} />
          <ScenariosSection table={props.table} equity={props.equity} seatName={props.seatName} onReplace={props.onReplace} />
        </div>
      ) : null}
    </details>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="label">{children}</h3>;
}

function boardCards(table: TableState): Card[] {
  const prefix = sharedPrefix(table);
  return table.board.slice(0, prefix).filter((c): c is Card => c !== null);
}

/* ---------- Board texture ---------- */

const RATING_CLASS: Record<BoardTexture["rating"], string> = {
  dry: "text-accent",
  "semi-wet": "text-ink",
  wet: "text-loss",
};

function BoardTextureSection({ table }: { table: TableState }) {
  const texture = useMemo(() => boardTexture(boardCards(table)), [table]);
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Board texture</SectionTitle>
      {texture === null ? (
        <p className="text-sm text-muted">Deal the flop to see how the board connects.</p>
      ) : (
        <>
          <p className="text-sm">
            <span className={clsx("font-mono font-semibold uppercase tracking-[0.08em]", RATING_CLASS[texture.rating])}>
              {texture.rating}
            </span>
            <span className="text-muted"> · {texture.points} draw point{texture.points === 1 ? "" : "s"}</span>
          </p>
          <ul className="list-disc pl-5 text-sm text-muted">
            {texture.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---------- Typed cards ---------- */

function TypedCardsSection({ table, onReplace }: { table: TableState; onReplace: (t: TableState) => void }) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    const tokens = text.split(/[\s,]+/).filter(Boolean);
    if (tokens.length === 0) return;
    const cards = tokens.map((token) => parseCardText(token));
    const badIndex = cards.findIndex((card) => card === null);
    if (badIndex !== -1) {
      setMessage(`"${tokens[badIndex]}" is not a card. Use the rank then the suit, such as Ah or 10c.`);
      return;
    }
    if (table.active === null) {
      setMessage("Tap an empty slot on the table first, then type the cards.");
      return;
    }
    const valid = cards as Card[];
    const next = valid.reduce((t, card) => placeCard(t, card), table);
    const placed = usedCards(next).size - usedCards(table).size;
    onReplace(next);
    setMessage(`Placed ${placed} of ${valid.length} card${valid.length === 1 ? "" : "s"}.`);
    setText("");
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Type cards</SectionTitle>
      <p className="text-xs text-muted">Select a slot, then type cards separated by spaces, for example “Ah Kd 10c”.</p>
      <div className="flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          aria-label="Cards to type"
          placeholder="Ah Kd 10c"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-panel px-3 font-mono text-sm"
        />
        <button type="button" onClick={submit} className="h-10 rounded-[10px] border border-line bg-panel px-4 text-sm font-medium hover:bg-surface">
          Place
        </button>
      </div>
      {message ? <p className="text-xs text-muted" role="status">{message}</p> : null}
    </section>
  );
}

/* ---------- Heatmap ---------- */

const GRID = handGrid();

function HeatmapLegend() {
  return (
    <div className="flex flex-col gap-1" aria-hidden="true">
      <div className="h-2.5 rounded-full border border-black/10" style={{ background: legendGradient() }} />
      <div className="relative h-4 font-mono text-[10px] tabular-nums text-muted">
        {LEGEND_MARKERS.map((marker) => (
          <span key={marker} className="absolute -translate-x-1/2" style={{ left: `${legendPosition(marker)}%` }}>
            {Math.round(marker * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function HeatmapDetail({ cls, value, board }: { cls: HandClass; value: number; board: readonly Card[] }) {
  const known = Number.isFinite(value);
  const combos = cls.combos.filter(([a, b]) => !board.includes(a) && !board.includes(b));
  return (
    <div aria-live="polite" className="rounded-[10px] border border-line bg-surface p-3 text-sm">
      <p className="font-medium">
        {cls.label}: {known ? `${(value * 100).toFixed(1)}% equity` : "blocked by the board"}
      </p>
      {known ? (
        <p className="mt-1 text-xs text-muted">
          Suit combinations ({combos.length}): {combos.map(([a, b]) => `${cardText(a)} ${cardText(b)}`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function HeatmapSection({ table }: { table: TableState }) {
  const board = boardCards(table);
  const holdem = table.variant === "holdem";
  const ready = holdem && board.length >= 3;
  const job = useExtrasJob<number[][]>(ready ? { kind: "heatmap", board, trials: 400 } : null);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Starting-hand heatmap</SectionTitle>
      {!holdem ? (
        <p className="text-sm text-muted">Available for Texas Hold&apos;em only.</p>
      ) : !ready ? (
        <p className="text-sm text-muted">Deal the flop to see every starting hand against the board.</p>
      ) : job.status === "running" ? (
        <p className="text-sm text-muted">Calculating every starting hand…</p>
      ) : job.status === "error" ? (
        <p className="text-sm text-loss">{job.error}</p>
      ) : job.status === "ready" ? (
        <>
          <div role="group" aria-label="Starting hand equity heatmap" className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-[2px]">
            {GRID.map((row, r) =>
              row.map((cls, c) => {
                const value = job.result[r][c];
                const known = Number.isFinite(value);
                const isSelected = selected?.r === r && selected?.c === c;
                return (
                  <button
                    type="button"
                    key={cls.label}
                    aria-pressed={isSelected}
                    onClick={() => setSelected({ r, c })}
                    title={known ? `${cls.label}: ${(value * 100).toFixed(1)}%` : `${cls.label}: blocked by the board`}
                    className={clsx(
                      "flex aspect-square items-center justify-center rounded-[4px] border border-black/10 text-[13.5px] font-medium tabular-nums sm:text-[15px]",
                      isSelected && "ring-2 ring-ink ring-offset-1 ring-offset-panel",
                    )}
                    style={{
                      background: known ? equityColour(value) : "var(--surface)",
                      color: known ? labelColour(value) : "var(--muted)",
                    }}
                  >
                    {cls.label}
                  </button>
                );
              }),
            )}
          </div>
          <HeatmapLegend />
          {selected ? (
            <HeatmapDetail cls={GRID[selected.r][selected.c]} value={job.result[selected.r][selected.c]} board={board} />
          ) : (
            <p className="text-xs text-muted">Tap or click a hand to see its exact equity and suit combinations.</p>
          )}
          <p className="text-xs text-muted">
            Each square is the equity of that hand against one random hand on this board. The scale runs from 20% (red) to 90% (deep green).
          </p>
        </>
      ) : null}
    </section>
  );
}

/* ---------- Next card ---------- */

function NextCardSection({ table, seatName }: { table: TableState; seatName: (seat: Seat) => string }) {
  const input = useMemo(() => toEngineInput(table), [table]);
  const boardLength = input?.runs[0]?.length ?? 0;
  const ready = input !== null && boardLength >= 3 && boardLength <= 4;
  const job = useExtrasJob<NextCardOdds[]>(ready && input ? { kind: "next", input, trials: 300 } : null);
  const heroSeat = input ? table.seats.find((s) => s.id === input.seats[0]?.seatId) : undefined;
  const label = boardLength === 3 ? "turn" : "river";

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Next card</SectionTitle>
      {input === null ? (
        <p className="text-sm text-muted">Seat at least two players to see how each next card changes the odds.</p>
      ) : !ready ? (
        <p className="text-sm text-muted">Deal the flop or turn to see how the next card changes the odds.</p>
      ) : job.status === "running" ? (
        <p className="text-sm text-muted">Checking every possible {label}…</p>
      ) : job.status === "error" ? (
        <p className="text-sm text-loss">{job.error}</p>
      ) : job.status === "ready" && heroSeat ? (
        <NextCardList odds={job.result} seatIndex={0} heroName={seatName(heroSeat)} label={label} />
      ) : null}
    </section>
  );
}

function NextCardList({ odds, seatIndex, heroName, label }: { odds: NextCardOdds[]; seatIndex: number; heroName: string; label: string }) {
  const ranked = [...odds].sort((a, b) => b.equities[seatIndex] - a.equities[seatIndex]);
  const best = ranked.slice(0, 5);
  const worst = ranked.slice(-5).reverse();
  const row = (item: NextCardOdds) => (
    <li key={item.card} className="flex items-center justify-between font-mono text-sm">
      <span>{cardText(item.card)}</span>
      <span className="tabular-nums">{(item.equities[seatIndex] * 100).toFixed(1)}%</span>
    </li>
  );
  return (
    <>
      <p className="text-xs text-muted">
        Equity for {heroName} for each possible {label}. Top and bottom five shown. Equity is an estimate.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="label mb-1">Best {label}s</p>
          <ul className="flex flex-col gap-1">{best.map(row)}</ul>
        </div>
        <div>
          <p className="label mb-1">Worst {label}s</p>
          <ul className="flex flex-col gap-1">{worst.map(row)}</ul>
        </div>
      </div>
    </>
  );
}

/* ---------- Share ---------- */

function ShareSection({ table, onReplace, newId }: { table: TableState; onReplace: (t: TableState) => void; newId: () => string }) {
  const [pasted, setPasted] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const code = useMemo(() => encodeTable(table), [table]);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}#table=${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Link copied.");
    } catch {
      setStatus("Could not copy. Select the link and copy it by hand.");
    }
  }

  function open() {
    const decoded = decodeTable(codeFromInput(pasted), newId);
    if (decoded === null) {
      setStatus("That link or code is not valid.");
      return;
    }
    onReplace(decoded);
    setPasted("");
    setStatus("Table opened from the link.");
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Share this table</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Link to this table"
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 font-mono text-xs text-muted"
        />
        <button type="button" onClick={copy} className="h-10 rounded-[10px] border border-line bg-panel px-4 text-sm font-medium hover:bg-surface">
          Copy link
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          aria-label="Paste a table link"
          placeholder="Paste a link to open it"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-panel px-3 font-mono text-xs"
        />
        <button
          type="button"
          onClick={open}
          disabled={pasted.trim() === ""}
          className="h-10 rounded-[10px] border border-line bg-panel px-4 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          Open
        </button>
      </div>
      <p className="text-xs text-muted">The link holds the cards only. Player names are not included.</p>
      {status ? <p className="text-xs text-muted" role="status">{status}</p> : null}
    </section>
  );
}

/* ---------- Scenarios ---------- */

type Scenario = {
  id: number;
  label: string;
  table: TableState;
  rows: { name: string; equity: number | null }[];
};

function ScenariosSection({
  table,
  equity,
  seatName,
  onReplace,
}: {
  table: TableState;
  equity: EquityView;
  seatName: (seat: Seat) => string;
  onReplace: (t: TableState) => void;
}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [nextId, setNextId] = useState(1);
  const result = equity.kind === "ready" || equity.kind === "refining" ? equity.result : null;

  function save() {
    if (result === null) return;
    const rows = table.seats.map((seat) => ({
      name: seatName(seat),
      equity: result.overall.find((r) => r.seatId === seat.id)?.outcome.equity ?? null,
    }));
    const board = boardCards(table).map((c) => cardText(c)).join(" ") || "Preflop";
    setScenarios((list) => [...list, { id: nextId, label: `${board}`, table, rows }]);
    setNextId((n) => n + 1);
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Scenarios</SectionTitle>
      <p className="text-xs text-muted">
        Save the current table with its numbers, then compare saved spots side by side. Scenarios are kept until you leave the page.
      </p>
      <div>
        <button
          type="button"
          onClick={save}
          disabled={result === null}
          className="h-10 rounded-[10px] border border-line bg-panel px-4 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          Save this scenario
        </button>
      </div>
      {scenarios.length === 0 ? (
        <p className="text-sm text-muted">No saved scenarios yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {scenarios.map((scenario) => (
            <article key={scenario.id} className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm">{scenario.label}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onReplace(scenario.table)} className="h-8 rounded-[8px] border border-line bg-panel px-2 text-xs font-medium hover:bg-surface">
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => setScenarios((list) => list.filter((s) => s.id !== scenario.id))}
                    className="h-8 rounded-[8px] border border-line bg-panel px-2 text-xs font-medium text-muted hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <ul className="flex flex-col gap-1 font-mono text-xs">
                {scenario.rows.map((row, i) => (
                  <li key={`${row.name}-${i}`} className="flex justify-between gap-3">
                    <span className="truncate">{row.name}</span>
                    <span className="tabular-nums">{row.equity === null ? "—" : `${(row.equity * 100).toFixed(1)}%`}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
