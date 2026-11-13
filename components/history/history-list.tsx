"use client";

import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { useLedger } from "@/lib/state/ledger-context";
import { computeGameLedger } from "@/lib/calculations/ledger";
import { EmptyState, PageHeading, Panel, StatusPill, Button } from "@/components/ui/primitives";
import { formatChips, formatMoney } from "@/lib/money";
import { formatGameDate } from "@/lib/format";
import { useRouter } from "next/navigation";

export function HistoryList() {
  const { state } = useLedger();
  const router = useRouter();
  const games = [...state.games].sort((a, b) => (a.date === b.date ? b.number - a.number : a.date < b.date ? 1 : -1));

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Archive"
        title="Game history"
        actions={
          <Button variant="primary" onClick={() => router.push("/games/new")}>
            <Plus className="size-4" aria-hidden /> New game
          </Button>
        }
      />

      {games.length === 0 ? (
        <EmptyState title="No games yet" body="Every game you run is kept here with its buy-ins, results and payments." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => {
            const ledger = computeGameLedger(state, game.id);
            return (
              <li key={game.id}>
                <Link
                  href={`/history/${game.id}`}
                  className="panel group flex h-full flex-col gap-4 p-5 transition-colors hover:border-accent/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="label">Game #{game.number}{game.isSample ? " · Sample" : ""}</p>
                      <h2 className="mt-1 truncate text-base font-semibold">{game.name}</h2>
                      <p className="text-sm text-muted">{formatGameDate(game.date)}</p>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" aria-hidden />
                  </div>
                  <dl className="grid grid-cols-3 gap-3">
                    <div><dt className="label">Players</dt><dd className="num mt-1">{ledger.totals.playerCount}</dd></div>
                    <div><dt className="label">Collected</dt><dd className="num mt-1">{formatMoney(ledger.totals.moneyCollectedPaise, game.currency)}</dd></div>
                    <div><dt className="label">Chips</dt><dd className="num mt-1">{formatChips(ledger.totals.chipsIssued)}</dd></div>
                  </dl>
                  <div className="mt-auto">
                    <StatusPill status={ledger.displayStatus} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Panel className="p-4 text-xs text-muted sm:p-5">
        Open a game to read its full record. Historical records are read-only by default. Corrections need an explicit unlock with a reason, and every change is logged.
      </Panel>
    </div>
  );
}
