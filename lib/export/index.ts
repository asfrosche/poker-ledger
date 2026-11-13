import type { GameLedger } from "@/lib/calculations/ledger";
import type { Transfer } from "@/lib/calculations/settlement";
import { formatMoney, paiseToDecimalString } from "@/lib/money";
import type { LedgerState, Settlement } from "@/types";

/** Builds a CSV string. Cells containing commas, quotes or newlines are quoted. */
export function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cell === null ? "" : String(cell);
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\r\n");
}

export function gameSummaryCsv(state: LedgerState, ledger: GameLedger): string {
  const game = ledger.game;
  return toCsv([
    ["Game", game?.name ?? ""],
    ["Number", game?.number ?? ""],
    ["Date", game?.date ?? ""],
    ["Currency", game?.currency ?? ""],
    ["Status", ledger.displayStatus],
    ["Venue", game?.venue ?? ""],
    ["Format", game?.format ?? ""],
    ["Players", ledger.totals.playerCount],
    ["Buy-ins", ledger.totals.buyInCount],
    ["Money collected", paiseToDecimalString(ledger.totals.moneyCollectedPaise)],
    ["Chips issued", ledger.totals.chipsIssued],
    ["Final chips", ledger.totals.finalChipsTotal],
    ["Chip difference", ledger.totals.chipDifference],
    ["Notes", game?.notes ?? ""],
    [],
    ...playerResultRows(ledger),
  ]);
}

function playerResultRows(ledger: GameLedger): (string | number | null)[][] {
  return [
    ["Player", "Buy-ins", "Invested", "Chips issued", "Final chips", "Chip value", "Net"],
    ...ledger.rows.map((row) => [
      row.name,
      row.buyInCount,
      paiseToDecimalString(row.investedPaise),
      row.chipsIssued,
      row.finalChips,
      row.chipValuePaise === null ? null : paiseToDecimalString(row.chipValuePaise),
      row.netPaise === null ? null : paiseToDecimalString(row.netPaise),
    ]),
  ];
}

export function playerResultsCsv(ledger: GameLedger): string {
  return toCsv(playerResultRows(ledger));
}

export function buyInHistoryCsv(state: LedgerState, gameId: string): string {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "Unknown";
  return toCsv([
    ["Player", "Amount", "Chips", "Note", "Recorded at", "Last edited at"],
    ...state.buyIns
      .filter((b) => b.gameId === gameId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((b) => [
        name(b.playerId),
        paiseToDecimalString(b.amountPaise),
        b.chips,
        b.note,
        b.createdAt,
        b.updatedAt,
      ]),
  ]);
}

export function settlementCsv(state: LedgerState, settlement: Settlement): string {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "Unknown";
  return toCsv([
    ["From", "To", "Amount", "Paid", "Paid at", "UPI reference", "Note"],
    ...settlement.payments.map((p) => [
      name(p.fromPlayerId),
      name(p.toPlayerId),
      paiseToDecimalString(p.amountPaise),
      p.paid ? "Yes" : "No",
      p.paidAt,
      p.upiRef,
      p.note,
    ]),
  ]);
}

/** Copyable WhatsApp text for the final settlement. */
export function whatsappSummary(
  state: LedgerState,
  ledger: GameLedger,
  transfers: Transfer[],
): string {
  const game = ledger.game;
  const currency = game?.currency ?? "INR";
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "Unknown";
  const lines = [
    "POKER NIGHT — FINAL SETTLEMENT",
    "",
    `Game: ${game?.name ?? ""}`,
    "",
    ...ledger.rows.map((row) => `${row.name}: ${formatMoney(row.netPaise ?? 0, currency, { signed: true })}`),
    "",
  ];
  if (transfers.length === 0) {
    lines.push("PAYMENTS: None. Everyone is square.");
  } else {
    lines.push("PAYMENTS:");
    for (const t of transfers) {
      lines.push(`${name(t.fromPlayerId)} → ${name(t.toPlayerId)}: ${formatMoney(t.amountPaise, currency)}`);
    }
  }
  return lines.join("\n");
}

/** Triggers a browser download of text content. */
export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "game";
}
