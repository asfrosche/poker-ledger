"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Target } from "lucide-react";
import { useLedger } from "@/lib/state/ledger-context";
import { useToast } from "@/components/ui/toast";
import { computeGameLedger } from "@/lib/calculations/ledger";
import { Button, ConfirmButton, EmptyState, PageHeading, Panel, SignedMoney, Stat, StatusPill } from "@/components/ui/primitives";
import { formatChips, formatMoney, formatRate } from "@/lib/money";
import { formatGameDate, formatTimestamp } from "@/lib/format";
import { buyInHistoryCsv, downloadText, gameSummaryCsv, playerResultsCsv, settlementCsv, slugify } from "@/lib/export";

export function GameRecord({ gameId }: { gameId: string }) {
  const { state, dispatch } = useLedger();
  const { notify } = useToast();
  const router = useRouter();
  const game = state.games.find((g) => g.id === gameId);

  if (!game) {
    return (
      <EmptyState
        title="Game not found"
        body="This game may have been deleted. Your other games are still in history."
        action={<Link href="/history" className="text-sm font-medium text-accent">Back to history</Link>}
      />
    );
  }

  const ledger = computeGameLedger(state, game.id);
  const settlements = state.settlements.filter((s) => s.gameId === game.id);
  const active = settlements.find((s) => s.supersededAt === null) ?? null;
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "Unknown";
  const audit = state.audit.filter((a) => a.gameId === game.id).reverse();
  const exportBase = `${slugify(game.name)}-${game.date}`;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/history" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Game history
      </Link>

      <PageHeading
        eyebrow={`Game #${game.number} · ${formatGameDate(game.date)}${game.isSample ? " · Sample data" : ""}`}
        title={game.name}
        actions={
          <>
            <StatusPill status={ledger.displayStatus} />
            {game.status === "open" ? null : (
              <Button size="sm" onClick={() => { dispatch({ type: "game/select", gameId: game.id }); router.push("/chip-board"); }}>
                <Target className="size-3.5" aria-hidden /> Open to correct
              </Button>
            )}
          </>
        }
      />

      <section aria-label="Result summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Players" value={ledger.totals.playerCount} />
        <Stat label="Money collected" value={formatMoney(ledger.totals.moneyCollectedPaise, game.currency)} />
        <Stat label="Chips issued" value={formatChips(ledger.totals.chipsIssued)} />
        <Stat label="Value per chip" value={ledger.totals.valuePerChipPaise === null ? "—" : formatRate(ledger.totals.valuePerChipPaise, game.currency)} />
      </section>

      <Panel className="p-4 sm:p-5">
        <h2 className="label mb-3">Configuration (fixed for this game)</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><dt className="label">Standard buy-in</dt><dd className="num mt-1">{formatMoney(game.buyInPaise, game.currency)}</dd></div>
          <div><dt className="label">Chips per buy-in</dt><dd className="num mt-1">{formatChips(game.chipsPerBuyIn)}</dd></div>
          <div><dt className="label">Venue</dt><dd className="mt-1">{game.venue || "—"}</dd></div>
          <div><dt className="label">Format</dt><dd className="mt-1">{game.format || "—"}</dd></div>
        </dl>
        {game.notes ? <p className="mt-4 whitespace-pre-wrap rounded-[10px] bg-surface p-3 text-sm">{game.notes}</p> : null}
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Results</h2>
          <span className="text-xs text-muted">Chips reconcile: {ledger.totals.reconciled ? "yes" : "no"}</span>
        </div>
        {ledger.rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">No players were recorded for this game.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="label text-left">
                  <th scope="col" className="px-4 py-3 font-normal sm:px-5">Player</th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">Buy-ins</th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">Invested</th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">Final chips</th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">Chip value</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal sm:px-5">Net</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((row) => (
                  <tr key={row.playerId} className="border-t border-line">
                    <td className="px-4 py-3 sm:px-5"><Link href={`/players/${row.playerId}`} className="font-medium hover:text-accent">{row.name}</Link></td>
                    <td className="num px-3 py-3 text-right">{row.buyInCount}</td>
                    <td className="num px-3 py-3 text-right">{formatMoney(row.investedPaise, game.currency)}</td>
                    <td className="num px-3 py-3 text-right">{row.finalChips === null ? "—" : formatChips(row.finalChips)}</td>
                    <td className="num px-3 py-3 text-right">{row.chipValuePaise === null ? "—" : formatMoney(row.chipValuePaise, game.currency)}</td>
                    <td className="px-4 py-3 text-right sm:px-5"><SignedMoney paise={row.netPaise} currency={game.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="flex flex-col gap-4 p-4 sm:p-5">
        <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Settlement</h2>
        {settlements.length === 0 ? (
          <p className="text-sm text-muted">No settlement was generated for this game.</p>
        ) : (
          settlements.map((s) => (
            <div key={s.id} className={`rounded-[10px] border border-line p-4 ${s.supersededAt ? "bg-surface/50" : ""}`}>
              <p className="label mb-2">
                {s.supersededAt ? `Superseded ${formatTimestamp(s.supersededAt)} · ${s.supersedeReason}` : "Current settlement"}
              </p>
              {s.payments.length === 0 ? (
                <p className="text-sm">No payments needed.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {s.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium">{name(p.fromPlayerId)} → {name(p.toPlayerId)}</span>
                      <span className="num">{formatMoney(p.amountPaise, game.currency)}</span>
                      <span className={p.paid ? "text-profit" : "text-warn"}>
                        {p.paid ? `Paid ${formatTimestamp(p.paidAt)}` : "Unpaid"}
                      </span>
                      {p.upiRef ? <span className="num text-xs text-muted">Ref {p.upiRef}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <h2 className="label mb-3">Buy-in transactions</h2>
        {state.buyIns.filter((b) => b.gameId === game.id).length === 0 ? (
          <p className="text-sm text-muted">No buy-ins recorded.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {state.buyIns
              .filter((b) => b.gameId === game.id)
              .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
              .map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="min-w-[8rem] font-medium">{name(b.playerId)}</span>
                  <span className="num">{formatMoney(b.amountPaise, game.currency)}</span>
                  <span className="num text-muted">{formatChips(b.chips)} chips</span>
                  <span className="text-muted">{b.note}</span>
                  <span className="ml-auto text-xs text-muted">{formatTimestamp(b.createdAt)}{b.updatedAt ? ` · edited ${formatTimestamp(b.updatedAt)}` : ""}</span>
                </li>
              ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <h2 className="label mb-3">Audit trail</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted">No changes logged.</p>
        ) : (
          <ol className="flex max-h-72 flex-col gap-2 overflow-auto text-sm">
            {audit.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <span className="num w-32 shrink-0 text-xs text-muted">{formatTimestamp(entry.at)}</span>
                <span>{entry.message}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3 p-4 sm:p-5">
        <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Exports</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => downloadText(`${exportBase}-summary.csv`, gameSummaryCsv(state, ledger))}>
            <Download className="size-3.5" aria-hidden /> Game summary
          </Button>
          <Button size="sm" onClick={() => downloadText(`${exportBase}-players.csv`, playerResultsCsv(ledger))}>
            <Download className="size-3.5" aria-hidden /> Player results
          </Button>
          <Button size="sm" onClick={() => downloadText(`${exportBase}-buy-ins.csv`, buyInHistoryCsv(state, game.id))}>
            <Download className="size-3.5" aria-hidden /> Buy-in history
          </Button>
          {active ? (
            <Button size="sm" onClick={() => downloadText(`${exportBase}-settlement.csv`, settlementCsv(state, active))}>
              <Download className="size-3.5" aria-hidden /> Settlement transactions
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel className="flex flex-wrap items-center justify-between gap-3 border-loss/30 p-4 sm:p-5">
        <div>
          <p className="text-sm font-medium">Delete this game</p>
          <p className="text-sm text-muted">Removes the game, its buy-ins and payments from this browser. This cannot be undone.</p>
        </div>
        <ConfirmButton
          label="Delete game"
          confirmLabel="Yes, delete permanently"
          onConfirm={() => {
            dispatch({ type: "game/delete", gameId: game.id });
            notify("Game deleted", "info");
            router.push("/history");
          }}
        />
      </Panel>
    </div>
  );
}
