"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Handshake, History, LayoutGrid, Plus, Settings as SettingsIcon } from "lucide-react";
import { clsx } from "clsx";
import { useLedger } from "@/lib/state/ledger-context";
import { StatusPill } from "@/components/ui/primitives";

const NAV = [
  { href: "/chip-board", label: "Chips", icon: LayoutGrid },
  { href: "/settlement", label: "Settle", icon: Handshake },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, dispatch, selectedGame, selectedLedger } = useLedger();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <Link href="/chip-board" className="shrink-0 font-mono text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm">
            <span className="mr-2 inline-block size-2 rounded-sm bg-accent align-middle" aria-hidden />
            Poker Ledger
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <label className="sr-only" htmlFor="game-switcher">
              Current game
            </label>
            <select
              id="game-switcher"
              className="field h-9 min-w-0 max-w-[11rem] truncate py-1 font-mono text-xs sm:max-w-xs"
              value={selectedGame?.id ?? ""}
              onChange={(event) => {
                if (event.target.value) dispatch({ type: "game/select", gameId: event.target.value });
              }}
              disabled={state.games.length === 0}
            >
              {state.games.length === 0 ? <option value="">No games yet</option> : null}
              {[...state.games]
                .sort((a, b) => b.number - a.number)
                .map((game) => (
                  <option key={game.id} value={game.id}>
                    #{game.number} · {game.name}
                  </option>
                ))}
            </select>
            {selectedLedger ? <span className="hidden sm:inline-flex"><StatusPill status={selectedLedger.displayStatus} /></span> : null}
            <button
              type="button"
              onClick={() => router.push("/games/new")}
              aria-label="New game"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-line bg-panel px-2.5 text-xs font-medium hover:bg-surface"
            >
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">New game</span>
            </button>
          </div>
        </div>

        {selectedLedger ? (
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-1.5 sm:hidden">
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              {selectedGame?.isSample ? "Sample game" : "Game"} · {selectedLedger.totals.playerCount} players
            </span>
            <StatusPill status={selectedLedger.displayStatus} />
          </div>
        ) : null}

      </header>

        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:static sm:border-t-0 sm:bg-transparent sm:backdrop-blur-none sm:pb-0">
          <ul className="mx-auto grid max-w-6xl grid-cols-4 gap-1 px-2 sm:flex sm:px-6 sm:pb-3 sm:gap-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[10px] text-[11px] font-medium transition-colors sm:min-h-0 sm:flex-row sm:gap-2 sm:px-4 sm:py-2 sm:text-sm",
                      active ? "text-ink sm:bg-panel sm:shadow-[inset_0_-2px_0_var(--accent)]" : "text-muted hover:text-ink",
                      active && "text-accent sm:text-ink",
                    )}
                  >
                    <Icon className="size-5 sm:size-4" aria-hidden />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-3 sm:px-6 sm:pb-10 sm:pt-8">{children}</main>

      <footer className="mx-auto hidden w-full max-w-6xl px-6 pb-8 sm:block">
        <p className="font-mono text-[11px] text-muted">
          Data is saved in this browser. The app never moves money; payments are recorded after you complete them yourself.
        </p>
      </footer>
    </div>
  );
}
