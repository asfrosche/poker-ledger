import Link from "next/link";
import { Calculator, Handshake, History, LayoutGrid, Plus, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { PageHeading, Panel } from "@/components/ui/primitives";

const PRIMARY_LINK =
  "inline-flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-medium text-white hover:bg-[#d4572a]";
const SECONDARY_LINK =
  "inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-panel px-4 text-sm font-medium text-ink hover:bg-surface";

const FEATURES: { href: string; title: string; body: string; icon: LucideIcon }[] = [
  {
    href: "/chip-board",
    title: "Chips",
    body: "Add players, record buy-ins and rebuys, and enter each player's final chip count.",
    icon: LayoutGrid,
  },
  {
    href: "/settlement",
    title: "Settle",
    body: "See the fewest payments that clear every balance, then mark each one paid with an optional UPI reference.",
    icon: Handshake,
  },
  {
    href: "/history",
    title: "History",
    body: "Look back at past games, their results and settlements, and export them.",
    icon: History,
  },
  {
    href: "/hand-calculator",
    title: "Calculator",
    body: "Work out Hold'em and Omaha equity for any hands and board, with a starting-hand heatmap.",
    icon: Calculator,
  },
  {
    href: "/settings",
    title: "Settings",
    body: "Set the default currency, buy-in, chip values and blinds used for new games.",
    icon: SettingsIcon,
  },
];

const STEPS = [
  "Create a game with New game. Give it a name, date, buy-in and chip values.",
  "On Chips, add the players and record each buy-in or rebuy.",
  "When the night ends, enter each player's final chip count. The balances update as you go.",
  "Open Settle to see who pays whom. Pay each other directly, then mark each payment done.",
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <PageHeading eyebrow="Private poker nights" title="Poker Ledger" />

      <Panel className="flex flex-col gap-4 p-5 sm:p-6">
        <p className="max-w-prose text-sm sm:text-base">
          Poker Ledger tracks buy-ins and final chip counts for a home game, works out who owes whom, and keeps a record
          of the payments once they are made.
        </p>
        <p className="max-w-prose text-sm text-muted">
          The app never moves money. You pay each other yourselves, then record it here.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/games/new" className={PRIMARY_LINK}>
            <Plus className="size-4" aria-hidden />
            New game
          </Link>
          <Link href="/chip-board" className={SECONDARY_LINK}>
            Open chips
          </Link>
        </div>
      </Panel>

      <section aria-labelledby="features-heading" className="flex flex-col gap-3">
        <h2 id="features-heading" className="label">
          Features
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ href, title, body, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="block h-full rounded-[14px] focus-visible:outline-2 focus-visible:outline-accent">
                <Panel className="flex h-full flex-col gap-2 p-5 transition-colors hover:bg-surface">
                  <span className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-[0.08em]">
                    <Icon className="size-4 text-accent" aria-hidden />
                    {title}
                  </span>
                  <span className="text-sm text-muted">{body}</span>
                </Panel>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="start-heading" className="flex flex-col gap-3">
        <h2 id="start-heading" className="label">
          Getting started
        </h2>
        <Panel className="p-5 sm:p-6">
          <ol className="flex flex-col gap-4">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm sm:text-base">
                <span
                  aria-hidden
                  className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-xs font-semibold"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </section>
    </div>
  );
}
