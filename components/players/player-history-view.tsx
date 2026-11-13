"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLedger } from "@/lib/state/ledger-context";
import { computePlayerHistory } from "@/lib/calculations/player-history";
import { EmptyState, PageHeading, Panel, SignedMoney, Stat, StatusPill } from "@/components/ui/primitives";
import { formatChips, formatMoney } from "@/lib/money";
import { formatGameDate, formatTimestamp } from "@/lib/format";

export function PlayerHistoryView({ playerId }: { playerId: string }) {
  const { state } = useLedger();
  const history = computePlayerHistory(state, playerId);

  if (!history) {
    return (
      <EmptyState
        title="Player not found"
        body="This profile no longer exists."
        action={<Link href="/chip-board" className="text-sm font-medium text-accent">Back to chip board</Link>}
      />
    );
  }

  const currency = state.games.find((g) => g.id === history.records[0]?.game.id)?.currency ?? state.settings.defaultCurrency;
  const pending = history.gamesPlayed - history.completedGames;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/history" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Game history
      </Link>
      <PageHeading eyebrow="Player profile" title={history.player.name} />

      <section aria-label="Lifetime totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Games played" value={history.gamesPlayed} hint={pending > 0 ? `${pending} not yet reconciled` : undefined} />
        <Stat label="Total buy-ins" value={`${history.buyInCount}`} hint={`${formatMoney(history.totalInvestedPaise, currency)} invested`} />
        <Stat
          label="Net profit / loss"
          value={<SignedMoney paise={history.netProfitPaise} currency={currency} />}
          hint="Money won or lost, completed games only"
        />
        <Stat
          label="Total chip value"
          value={formatMoney(history.totalChipValuePaise, currency)}
          hint="Value of chips cashed out. Not profit."
        />
      </section>

      <Panel className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="label">Payments made (settled)</p>
          <p className="num mt-1 text-lg">{formatMoney(history.paymentsMadePaise, currency)}</p>
        </div>
        <div>
          <p className="label">Payments received (settled)</p>
          <p className="num mt-1 text-lg">{formatMoney(history.paymentsReceivedPaise, currency)}</p>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Games</h2>
        </div>
        {history.records.length === 0 ? (
          <p className="p-5 text-sm text-muted">No games yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="label text-left">
                  <th scope="col" className="px-4 py-3 font-normal sm:px-5">Game</th>
                  <th scope="col" className="px-3 py-3 font-normal">Status</th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">Invested</th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">Final chips</th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">Chip value</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal sm:px-5">Net</th>
                </tr>
              </thead>
              <tbody>
                {history.records.map((r) => (
                  <tr key={r.game.id} className="border-t border-line">
                    <td className="px-4 py-3 sm:px-5">
                      <Link href={`/history/${r.game.id}`} className="font-medium hover:text-accent">{r.game.name}</Link>
                      <div className="text-xs text-muted">{formatGameDate(r.game.date)}</div>
                    </td>
                    <td className="px-3 py-3"><StatusPill status={r.displayStatus} /></td>
                    <td className="num px-3 py-3 text-right">{formatMoney(r.investedPaise, r.game.currency)}</td>
                    <td className="num px-3 py-3 text-right">{r.finalChips === null ? "—" : formatChips(r.finalChips)}</td>
                    <td className="num px-3 py-3 text-right">{r.chipValuePaise === null ? "—" : formatMoney(r.chipValuePaise, r.game.currency)}</td>
                    <td className="px-4 py-3 text-right sm:px-5"><SignedMoney paise={r.netPaise} currency={r.game.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <h2 className="label mb-3">Payments</h2>
        {history.payments.length === 0 ? (
          <p className="text-sm text-muted">No settlement payments involve this player.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {history.payments.map((p, i) => (
              <li key={`${p.gameName}-${i}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className={p.direction === "made" ? "text-loss" : "text-profit"}>{p.direction === "made" ? "Paid" : "Received"}</span>
                <span className="font-medium">{p.counterpartyName}</span>
                <span className="num">{formatMoney(p.amountPaise, currency)}</span>
                <span className="text-muted">{p.gameName}</span>
                <span className="ml-auto text-xs text-muted">{p.paid ? formatTimestamp(p.paidAt) : "Outstanding"}{p.upiRef ? ` · ${p.upiRef}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
