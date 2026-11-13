"use client";

import Link from "next/link";
import { Fragment, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, Lock, Plus, Settings2, Unlock } from "lucide-react";
import { clsx } from "clsx";
import { useLedger } from "@/lib/state/ledger-context";
import { useToast } from "@/components/ui/toast";
import { Button, ConfirmButton, EmptyState, FieldError, FieldLabel, Panel, PageHeading, SignedMoney, Stat } from "@/components/ui/primitives";
import { GameConfigForm } from "@/components/games/game-config-form";
import { BuyInPanel } from "@/components/games/buy-in-panel";
import { QuickBuyIns } from "@/components/games/quick-buy-ins";
import { FinalChipsInput } from "@/components/games/final-chips-input";
import { formatChips, formatMoney, formatRate } from "@/lib/money";
import { formatGameDate } from "@/lib/format";
import { isRoundingDifference } from "@/lib/calculations/adjustment";
import { playerNameSchema } from "@/lib/validation/schemas";
import type { GameLedger } from "@/lib/calculations/ledger";
import type { Game, LedgerState } from "@/types";

export function ChipBoard() {
  const { state, selectedGame, selectedLedger } = useLedger();

  if (!selectedGame || !selectedLedger) {
    return (
      <EmptyState
        title="No game selected"
        body="Create a game to start recording buy-ins, chip counts and settlements."
        action={<Link href="/games/new" className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-white">Create a game</Link>}
      />
    );
  }

  return <ChipBoardView key={selectedGame.id} state={state} game={selectedGame} ledger={selectedLedger} />;
}

function ChipBoardView({ state, game, ledger }: { state: LedgerState; game: Game; ledger: GameLedger }) {
  const { dispatch } = useLedger();
  const { notify } = useToast();
  const editable = game.status === "open";
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState<string | undefined>();
  const totals = ledger.totals;

  const rows = ledger.rows;

  function unlock() {
    const result = unlockReason.trim().length >= 3;
    if (!result) {
      setUnlockError("Explain the correction (at least 3 characters). It is recorded in the audit trail.");
      return;
    }
    dispatch({ type: "game/unlock", gameId: game.id, reason: unlockReason });
    setUnlockReason("");
    setUnlockError(undefined);
    notify("Game unlocked for correction. The previous settlement is kept in history.", "info");
  }

  const discrepancy = describeDiscrepancy(ledger);

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      <PageHeading
        eyebrow={`Game #${game.number} · ${formatGameDate(game.date)}${game.isSample ? " · Sample" : ""}`}
        title={game.name}
        actions={
          <>
            <Button size="sm" onClick={() => setSetupOpen((v) => !v)} aria-expanded={setupOpen}>
              <Settings2 className="size-4" aria-hidden />
              Game setup
            </Button>
          </>
        }
      />

      {!editable ? (
        <Panel className="flex flex-col gap-4 border-warn/40 bg-warn-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <div>
              <p className="text-sm font-medium">This game is {game.status === "archived" ? "archived" : game.status === "settled" ? "settled" : "in settlement"} and locked.</p>
              <p className="text-sm text-muted">Chip counts and buy-ins are read-only. Unlock only to correct a genuine mistake.</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-80">
            <FieldLabel htmlFor="unlock-reason">Reason for correction</FieldLabel>
            <input id="unlock-reason" className="field" value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} placeholder="e.g. Sam's final count was entered wrong" aria-invalid={!!unlockError} />
            <FieldError message={unlockError} />
            <div>
              <ConfirmButton label={<><Unlock className="size-3.5" aria-hidden /> Unlock for correction</>} confirmLabel="Yes, unlock" onConfirm={unlock} />
            </div>
          </div>
        </Panel>
      ) : null}

      {setupOpen ? (
        <Panel className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Game setup</h2>
            <span className="text-xs text-muted">{editable ? "Changes apply to this game only" : "Locked while settling or settled"}</span>
          </div>
          <GameConfigForm
            initial={game}
            submitLabel="Save game setup"
            disabled={!editable}
            onSubmit={(values) => {
              dispatch({ type: "game/update", gameId: game.id, patch: values });
              notify("Game setup saved");
              setSetupOpen(false);
            }}
            onCancel={() => setSetupOpen(false)}
          />
        </Panel>
      ) : null}

      <section aria-label="Board summary" className="panel flex items-center justify-between gap-3 px-4 py-2 sm:hidden">
        <div className="min-w-0">
          <p className="label">Pot</p>
          <p className="num truncate text-lg font-semibold">{formatMoney(totals.moneyCollectedPaise, game.currency)}</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="label">Chips</p>
          <p className="num truncate text-lg font-semibold">{formatChips(totals.chipsIssued)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="label">Per chip</p>
          <p className="num truncate text-lg font-semibold">{totals.valuePerChipPaise === null ? "—" : formatRate(totals.valuePerChipPaise, game.currency)}</p>
        </div>
      </section>

      <section aria-label="Board statistics" className="hidden gap-3 sm:grid sm:grid-cols-5 sm:gap-4">
        <Stat align="center" label="Players" value={totals.playerCount} />
        <Stat align="center" label="Total buy-ins" value={totals.buyInCount} />
        <Stat align="center" label="Money collected" value={formatMoney(totals.moneyCollectedPaise, game.currency)} />
        <Stat align="center" label="Chips issued" value={formatChips(totals.chipsIssued)} />
        <Stat
          align="center"
          label="Value per chip"
          value={totals.valuePerChipPaise === null ? "—" : formatRate(totals.valuePerChipPaise, game.currency)}
          hint={`${formatMoney(game.buyInPaise, game.currency)} ÷ ${formatChips(game.chipsPerBuyIn)} standard`}
        />
      </section>

      <Reconciliation ledger={ledger} currency={game.currency} discrepancy={discrepancy} />

      <AddPlayer state={state} game={game} ledger={ledger} editable={editable} />

      {rows.length === 0 ? (
        <EmptyState title="No players yet" body="Add the people sitting at the table. Each one gets a buy-in button and a chip count box." />
      ) : (
        <>
          {/* Desktop table */}
          <Panel className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-surface/60 text-left">
                  <tr className="label">
                    <th scope="col" className="px-4 py-3 font-normal">Player</th>
                    <th scope="col" className="px-3 py-3 text-right font-normal">Buy-ins</th>
                    <th scope="col" className="px-3 py-3 text-right font-normal">Invested</th>
                    <th scope="col" className="px-3 py-3 font-normal">Final chips</th>
                    <th scope="col" className="px-3 py-3 text-right font-normal">Chip value</th>
                    <th scope="col" className="px-3 py-3 text-right font-normal">Profit / loss</th>
                    <th scope="col" className="px-4 py-3 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Fragment key={row.playerId}>
                      <tr className="border-t border-line">
                        <td className="px-4 py-3">
                          <Link href={`/players/${row.playerId}`} className="font-medium hover:text-accent">{row.name}</Link>
                        </td>
                        <td className="num px-3 py-3 text-right">{row.buyInCount}</td>
                        <td className="num px-3 py-3 text-right">{formatMoney(row.investedPaise, game.currency)}</td>
                        <td className="px-3 py-3">
                          <FinalChipsInput
                            label={`Final chips for ${row.name}`}
                            value={row.finalChips}
                            disabled={!editable}
                            onCommit={(chips) => dispatch({ type: "final/set", gameId: game.id, playerId: row.playerId, chips })}
                            className="w-32"
                          />
                        </td>
                        <td className="num px-3 py-3 text-right">{row.chipValuePaise === null ? <span className="text-muted">—</span> : formatMoney(row.chipValuePaise, game.currency)}</td>
                        <td className="px-3 py-3 text-right"><SignedMoney paise={row.netPaise} currency={game.currency} /></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <QuickBuyIns game={game} playerId={row.playerId} playerName={row.name} editable={editable} />
                            <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === row.playerId ? null : row.playerId)} aria-expanded={expandedId === row.playerId} aria-label={`Buy-in history for ${row.name}`}>
                              <ChevronDown className={clsx("size-4 transition-transform", expandedId === row.playerId && "rotate-180")} aria-hidden />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.playerId ? (
                        <tr className="border-t border-line bg-surface/40">
                          <td colSpan={7} className="px-4 py-4">
                            <BuyInPanel state={state} game={game} row={row} editable={editable} onRemove={() => setExpandedId(null)} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-1.5 md:hidden">
            {rows.map((row) => (
              <li key={row.playerId}>
                <Panel className="flex flex-col gap-3 p-3.5">
                  <div className="flex items-center gap-2">
                    <Link href={`/players/${row.playerId}`} className="min-w-0 flex-1 truncate text-[15px] font-semibold hover:text-accent">{row.name}</Link>
                    <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === row.playerId ? null : row.playerId)} aria-expanded={expandedId === row.playerId} aria-label={`Buy-in history for ${row.name}`}>
                      History
                    </Button>
                    <SignedMoney paise={row.netPaise} currency={game.currency} className="shrink-0 text-sm font-semibold" />
                  </div>
                  <p className="flex justify-between gap-2 text-xs">
                    <span><span className="label">Buy-ins </span><span className="num">{row.buyInCount}</span></span>
                    <span><span className="label">Invested </span><span className="num">{formatMoney(row.investedPaise, game.currency)}</span></span>
                    <span><span className="label">Chip value </span><span className="num">{row.chipValuePaise === null ? "—" : formatMoney(row.chipValuePaise, game.currency)}</span></span>
                  </p>
                  <div className="flex items-center gap-2">
                    <FinalChipsInput
                      label={`Final chips for ${row.name}`}
                      value={row.finalChips}
                      disabled={!editable}
                      onCommit={(chips) => dispatch({ type: "final/set", gameId: game.id, playerId: row.playerId, chips })}
                      size="lg"
                      className="w-20 shrink-0"
                    />
                    <QuickBuyIns game={game} playerId={row.playerId} playerName={row.name} editable={editable} size="lg" />
                  </div>
                  {expandedId === row.playerId ? (
                    <BuyInPanel state={state} game={game} row={row} editable={editable} onRemove={() => setExpandedId(null)} />
                  ) : null}
                </Panel>
              </li>
            ))}
          </ul>
        </>
      )}

      {rows.length > 0 ? (
        <p className="text-xs text-muted">
          Net = final chip value − total invested. Positive means the player is owed money; negative means they owe.
        </p>
      ) : null}
    </div>
  );
}

function describeDiscrepancy(ledger: GameLedger): string | null {
  const t = ledger.totals;
  if (!t.hasBuyIns) return null;
  if (t.missingFinalCount === 0 && isRoundingDifference(t.chipDifference)) {
    const n = Math.abs(t.chipDifference);
    return `${formatChips(n)} ${n === 1 ? "chip" : "chips"} ${t.chipDifference > 0 ? "unaccounted for" : "over-counted"}. That is within the rounding allowance, so you can settle now and the winners will absorb it. Re-check the stacks if you have a moment.`;
  }
  if (t.missingFinalCount > 0 && t.chipDifference === 0) {
    return `${t.missingFinalCount} player${t.missingFinalCount === 1 ? " still needs" : "s still need"} a final chip count.`;
  }
  if (t.chipDifference > 0) {
    return `${formatChips(t.chipDifference)} chips were issued but not accounted for in final counts${t.missingFinalCount ? `, and ${t.missingFinalCount} final count${t.missingFinalCount === 1 ? " is" : "s are"} still missing` : ""}. Check for a miscounted stack or a buy-in you have not finished entering.`;
  }
  if (t.chipDifference < 0) {
    return `Final counts total ${formatChips(-t.chipDifference)} more chips than were issued. Re-check the stacks, or a buy-in may be missing.`;
  }
  return null;
}

function Reconciliation({ ledger, currency, discrepancy }: { ledger: GameLedger; currency: string; discrepancy: string | null }) {
  const t = ledger.totals;
  const small = t.hasBuyIns && t.missingFinalCount === 0 && isRoundingDifference(t.chipDifference);
  const status = !t.hasBuyIns
    ? { label: "No buy-ins yet", tone: "text-muted", bg: "bg-surface" }
    : t.reconciled
      ? { label: "Balanced", tone: "text-profit", bg: "bg-profit-soft" }
      : small
        ? { label: "Rounding", tone: "text-warn", bg: "bg-warn-soft" }
        : { label: "Not balanced", tone: "text-loss", bg: "bg-loss-soft" };

  const compactLine = !t.hasBuyIns
    ? "Add buy-ins to start counting"
    : t.reconciled
      ? `All ${formatChips(t.chipsIssued)} chips accounted for`
      : [
          t.chipDifference > 0 ? `${formatChips(t.chipDifference)} chips unaccounted for` : null,
          t.chipDifference < 0 ? `${formatChips(-t.chipDifference)} chips over-counted` : null,
          t.missingFinalCount > 0 ? `${t.missingFinalCount} count${t.missingFinalCount === 1 ? "" : "s"} to enter` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <>
      <Panel className="flex items-center gap-2.5 px-3 py-2 sm:hidden max-md:order-last" aria-live="polite">
        <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em]", status.bg, status.tone)}>
          {status.label}
        </span>
        <p className={clsx("text-sm leading-snug", t.reconciled || !t.hasBuyIns ? "text-muted" : small ? "font-medium text-warn" : "font-medium text-loss")}>{compactLine}</p>
      </Panel>
      {discrepancy ? <p className={clsx("px-1 text-xs sm:hidden max-md:order-last", small ? "text-warn" : "text-loss")}>{discrepancy}</p> : null}
      <Panel className="hidden p-4 sm:block sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Chip reconciliation</h2>
        <span className={clsx("rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em]", status.bg, status.tone)}>
          {status.label}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><dt className="label">Total chips issued</dt><dd className="num mt-1 text-lg">{formatChips(t.chipsIssued)}</dd></div>
        <div><dt className="label">Total final chips</dt><dd className="num mt-1 text-lg">{formatChips(t.finalChipsTotal)}</dd></div>
        <div>
          <dt className="label">Difference</dt>
          <dd className={clsx("num mt-1 text-lg", t.chipDifference === 0 ? "text-ink" : "text-loss")}>
            {t.chipDifference > 0 ? "+" : ""}{formatChips(t.chipDifference)}
          </dd>
        </div>
        <div><dt className="label">Money in pot</dt><dd className="num mt-1 text-lg">{formatMoney(t.moneyCollectedPaise, currency)}</dd></div>
      </dl>
      {discrepancy ? (
        small ? (
          <div role="status" className="mt-4 flex items-start gap-3 rounded-[10px] border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">Off by a few chips. </span>
              {discrepancy}
            </p>
          </div>
        ) : (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-[10px] border border-loss/30 bg-loss-soft p-3 text-sm text-loss">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">Chips do not balance. </span>
              {discrepancy} You can still settle: the winners absorb the difference on the Settle page, so nobody pays more.
            </p>
          </div>
        )
      ) : null}
      </Panel>
    </>
  );
}

function AddPlayer({ state, game, ledger, editable }: { state: LedgerState; game: Game; ledger: GameLedger; editable: boolean }) {
  const { dispatch } = useLedger();
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();

  const inGame = new Set(ledger.rows.map((r) => r.name.toLowerCase()));
  const roster = state.players.filter((p) => !inGame.has(p.name.toLowerCase()));

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = playerNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a name");
      return;
    }
    if (inGame.has(parsed.data.toLowerCase())) {
      setError(`${parsed.data} is already in this game.`);
      return;
    }
    dispatch({ type: "gameplayer/add", gameId: game.id, playerName: parsed.data });
    notify(`${parsed.data} added`);
    setName("");
    setError(undefined);
  }

  return (
    <Panel className="p-3 sm:p-5 max-md:order-last">
      <form onSubmit={submit} className="flex items-end gap-2 sm:flex-row sm:items-start" noValidate>
        <div className="flex-1">
          <FieldLabel htmlFor="add-player">Add player</FieldLabel>
          <input
            id="add-player"
            list="roster"
            className="field"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(undefined); }}
            placeholder="Player name"
            disabled={!editable}
            aria-invalid={!!error}
            aria-describedby={error ? "add-player-err" : undefined}
            autoComplete="off"
          />
          <datalist id="roster">
            {roster.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <FieldError id="add-player-err" message={error} />
        </div>
        <div className="sm:pt-[1.625rem]">
          <Button type="submit" variant="primary" disabled={!editable} className="sm:w-auto">
            <Plus className="size-4" aria-hidden /> Add player
          </Button>
        </div>
      </form>
    </Panel>
  );
}
