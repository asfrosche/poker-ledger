"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Copy, Download, Lock, Archive, Unlock } from "lucide-react";
import { clsx } from "clsx";
import { useLedger } from "@/lib/state/ledger-context";
import { useToast } from "@/components/ui/toast";
import { Button, ConfirmButton, EmptyState, FieldError, FieldLabel, PageHeading, Panel, SignedMoney, Stat } from "@/components/ui/primitives";
import { checkSettlementEligibility, type GameLedger } from "@/lib/calculations/ledger";
import { computeTransfers, type Transfer } from "@/lib/calculations/settlement";
import { applyAdjustment, computeAdjustment, isRoundingDifference } from "@/lib/calculations/adjustment";
import { formatChips, formatMoney } from "@/lib/money";
import { formatTimestamp } from "@/lib/format";
import { downloadText, buyInHistoryCsv, gameSummaryCsv, playerResultsCsv, settlementCsv, slugify, whatsappSummary } from "@/lib/export";
import { paymentDetailsSchema, unlockReasonSchema } from "@/lib/validation/schemas";
import type { Game, LedgerState, Settlement, SettlementPayment } from "@/types";

export function SettlementView() {
  const { state, selectedGame, selectedLedger } = useLedger();
  if (!selectedGame || !selectedLedger) {
    return (
      <EmptyState
        title="No game selected"
        body="Create or pick a game first, then come back here to settle it."
        action={<Link href="/games/new" className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-white">Create a game</Link>}
      />
    );
  }
  return <SettlementContent key={selectedGame.id} state={state} game={selectedGame} ledger={selectedLedger} />;
}

function SettlementContent({ state, game, ledger }: { state: LedgerState; game: Game; ledger: GameLedger }) {
  const { dispatch } = useLedger();
  const { notify } = useToast();
  const active = state.settlements.find((s) => s.gameId === game.id && s.supersededAt === null) ?? null;
  const superseded = state.settlements.filter((s) => s.gameId === game.id && s.supersededAt !== null);
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "Unknown";
  const chipDifference = ledger.totals.chipDifference;
  const chipsMismatch = !active && chipDifference !== 0 && ledger.rawBalances !== null;
  const raw = ledger.rawBalances;
  // Nobody loses more money: the winners absorb any chip difference.
  const plan = chipsMismatch && raw ? computeAdjustment(raw, "winners") : null;
  const smallMiscount = chipsMismatch && isRoundingDifference(chipDifference);
  const eligibility = checkSettlementEligibility(state, game.id);

  // Balances the payments would be built from, before anything is saved.
  let previewBalances: { playerId: string; netPaise: number }[] | null = null;
  if (!active && raw) {
    if (chipDifference === 0) previewBalances = ledger.balances;
    else if (plan?.ok) previewBalances = applyAdjustment(raw, plan.adjustment);
  }
  const previewTransfers: Transfer[] | null =
    previewBalances && previewBalances.reduce((s, b) => s + b.netPaise, 0) === 0
      ? computeTransfers(previewBalances)
      : null;
  const shownNet = new Map((previewBalances ?? raw ?? []).map((b) => [b.playerId, b.netPaise]));
  const residualPaise = ledger.residualPaise ?? 0;

  const owe = ledger.rows.filter((r) => (r.netPaise ?? 0) < 0);
  const owed = ledger.rows.filter((r) => (r.netPaise ?? 0) > 0);
  const transfers: Transfer[] = active
    ? active.payments.map((p) => ({ fromPlayerId: p.fromPlayerId, toPlayerId: p.toPlayerId, amountPaise: p.amountPaise }))
    : previewTransfers ?? [];
  const transferCount = active ? active.payments.length : (previewTransfers?.length ?? null);

  const paidCount = active ? active.payments.filter((p) => p.paid).length : 0;
  const totalCount = active ? active.payments.length : 0;

  function generate() {
    dispatch({ type: "settlement/generate", gameId: game.id });
    notify("Settlement generated. Payment history is now saved.");
  }

  async function copySummary() {
    const text = whatsappSummary(state, ledger, transfers);
    try {
      await navigator.clipboard.writeText(text);
      notify("Summary copied. Paste it into WhatsApp.");
    } catch {
      notify("Could not access the clipboard. Select the text below and copy it manually.", "error");
    }
  }

  const exportBase = `${slugify(game.name)}-${game.date}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow={`Game #${game.number} · Settlement`}
        title="Settlement"
      />

      <section aria-label="Settlement summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Total invested" value={formatMoney(ledger.totals.moneyCollectedPaise, game.currency)} />
        <Stat
          label="Total chip value"
          value={ledger.totals.reconciled ? formatMoney(ledger.totals.allocatedChipValuePaise, game.currency) : "—"}
          hint={ledger.totals.reconciled ? "Equals money in, because chips balance" : "Available once chips reconcile"}
        />
        <Stat label="Owe money" value={owe.length} tone={owe.length ? "loss" : "default"} hint={owe.map((r) => r.name).join(", ") || "Nobody"} />
        <Stat
          label="Owed money"
          value={owed.length}
          tone={owed.length ? "profit" : "default"}
          hint={owed.map((r) => r.name).join(", ") || "Nobody"}
        />
      </section>

      {active ? (
        <Panel className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Payment progress</h2>
            <span className="num text-sm">
              {paidCount} of {totalCount} payment{totalCount === 1 ? "" : "s"} completed
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={totalCount} aria-valuenow={paidCount} aria-label="Payments completed">
            <div className="h-full rounded-full bg-profit transition-[width] duration-300" style={{ width: `${totalCount ? (paidCount / totalCount) * 100 : 100}%` }} />
          </div>
          {game.status === "settled" ? (
            <p className="flex items-center gap-2 text-sm text-profit">
              <CheckCircle2 className="size-4" aria-hidden /> Every payment is recorded. The game is settled{game.settledAt ? ` (${formatTimestamp(game.settledAt)})` : ""}.
            </p>
          ) : null}
        </Panel>
      ) : null}

      {!active ? (
        <Panel className="flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Generate settlement</h2>
            <p className="mt-1 text-sm text-muted">
              Creates the fewest possible payments and saves them. They stay the same when you reopen this page.
            </p>
          </div>
          {smallMiscount ? (
            <div className="rounded-[10px] bg-warn-soft p-3 text-sm text-warn">
              Chips are off by {formatChips(Math.abs(chipDifference))} {Math.abs(chipDifference) === 1 ? "chip" : "chips"}, within the rounding allowance. The winners absorb the difference when you generate the settlement, so nobody pays more.
            </div>
          ) : null}
          {chipsMismatch && !smallMiscount ? (
            <div className="rounded-[10px] border border-line p-4">
              <p className="text-sm font-medium">Chips do not add up</p>
              <p className="mt-1 text-sm text-muted">
                {formatChips(Math.abs(chipDifference))} chips {chipDifference > 0 ? "are unaccounted for" : "were over-counted"}, worth {formatMoney(Math.abs(residualPaise), game.currency)} at this game&apos;s rate. The winners absorb the difference, so nobody pays more. Nothing is saved until you generate the settlement.
              </p>
            </div>
          ) : null}
          {eligibility.ok ? null : (
            <div className="rounded-[10px] bg-warn-soft p-3 text-sm text-warn">{eligibility.reason}</div>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {ledger.rows.map((row) => (
              <li key={row.playerId} className="flex items-center justify-between rounded-[10px] bg-surface px-4 py-3">
                <span className="font-medium">{row.name}</span>
                <SignedMoney paise={shownNet.get(row.playerId) ?? row.netPaise} currency={game.currency} />
              </li>
            ))}
          </ul>
          <div>
            <Button variant="primary" size="lg" disabled={!eligibility.ok || game.status !== "open"} onClick={generate}>
              Generate settlement
              {transferCount !== null ? ` · ${transferCount} transfer${transferCount === 1 ? "" : "s"}` : ""}
            </Button>
          </div>
        </Panel>
      ) : null}

      {active?.snapshot.adjustment ? (
        <Panel className="flex flex-col gap-3 p-4 sm:p-5">
          <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Chip difference settled</h2>
          <p className="text-sm text-muted">
            Chips did not add up by {formatMoney(Math.abs(active.snapshot.adjustment.residualPaise), game.currency)}.{" "}
            {active.snapshot.adjustment.method === "winners" ? "Winners absorbed it in proportion to their profit." : "It was split evenly across everyone."}
          </p>
          <ul className="grid gap-1 text-sm">
            {active.snapshot.adjustment.lines
              .filter((l) => l.adjustmentPaise !== 0)
              .map((l) => (
                <li key={l.playerId} className="flex items-center justify-between">
                  <span>{name(l.playerId)}</span>
                  <span className="num">{formatMoney(l.adjustmentPaise, game.currency, { signed: true })}</span>
                </li>
              ))}
          </ul>
        </Panel>
      ) : null}

      {active ? (
        <section aria-label="Payments" className="grid gap-4 md:grid-cols-2">
          {active.payments.length === 0 ? (
            <Panel className="p-6 md:col-span-2">
              <p className="text-sm">Everyone is square. No payments are needed.</p>
            </Panel>
          ) : null}
          {active.payments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              fromName={name(payment.fromPlayerId)}
              toName={name(payment.toPlayerId)}
              currency={game.currency}
              locked={game.status === "archived"}
              onSet={(paid, upiRef, note) =>
                dispatch({ type: "payment/set", settlementId: active.id, paymentId: payment.id, paid, upiRef, note })
              }
            />
          ))}
        </section>
      ) : null}

      {active && game.status !== "archived" && game.status === "settled" ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="text-sm font-medium">Ready to close this night?</p>
            <p className="text-sm text-muted">Archiving makes the game read-only in history. You can still unlock it later with a reason.</p>
          </div>
          <ConfirmButton
            label={<><Archive className="size-3.5" aria-hidden /> Archive game</>}
            confirmLabel="Yes, archive"
            onConfirm={() => {
              dispatch({ type: "game/archive", gameId: game.id });
              notify("Game archived");
            }}
          />
        </Panel>
      ) : null}

      {transfers.length > 0 || active ? (
        <Panel className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-sm uppercase tracking-[0.1em]">WhatsApp summary</h2>
            <Button size="sm" onClick={copySummary}>
              <Copy className="size-3.5" aria-hidden /> Copy
            </Button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[10px] bg-surface p-4 font-mono text-xs leading-relaxed" tabIndex={0} aria-label="Settlement text">
            {whatsappSummary(state, ledger, transfers)}
          </pre>
        </Panel>
      ) : null}

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

      <UnlockPanel game={game} active={active} />

      {superseded.length > 0 ? <SupersededList settlements={superseded} state={state} /> : null}
    </div>
  );
}

function PaymentCard({
  payment,
  fromName,
  toName,
  currency,
  locked,
  onSet,
}: {
  payment: SettlementPayment;
  fromName: string;
  toName: string;
  currency: string;
  locked: boolean;
  onSet: (paid: boolean, upiRef: string, note: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [upiRef, setUpiRef] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function markPaid(event: FormEvent) {
    event.preventDefault();
    const parsed = paymentDetailsSchema.safeParse({ upiRef, note });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    onSet(true, parsed.data.upiRef, parsed.data.note);
    setConfirming(false);
    setErrors({});
  }

  return (
    <article
      className={clsx(
        "panel flex flex-col gap-4 p-5 transition-colors",
        payment.paid && "border-profit/40 bg-profit-soft/40",
      )}
      aria-label={`${fromName} pays ${toName} ${formatMoney(payment.amountPaise, currency)}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.08em]">
          <span>{fromName}</span>
          <ArrowRight className="size-3.5 text-muted" aria-hidden />
          <span>{toName}</span>
        </p>
        <span className={clsx("rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em]", payment.paid ? "bg-profit text-white" : "bg-surface text-muted")}>
          {payment.paid ? "Paid" : "Pending"}
        </span>
      </div>
      <p className="num text-3xl font-semibold tracking-tight">{formatMoney(payment.amountPaise, currency)}</p>
      <p className="text-sm text-muted">
        {fromName} pays {toName} {formatMoney(payment.amountPaise, currency)}.
      </p>

      {payment.paid ? (
        <div className="flex flex-col gap-3 border-t border-line pt-4 text-sm">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div><dt className="label">Paid at</dt><dd className="mt-1 text-sm">{formatTimestamp(payment.paidAt)}</dd></div>
            <div><dt className="label">UPI reference</dt><dd className="num mt-1 text-sm">{payment.upiRef || "—"}</dd></div>
          </dl>
          {payment.note ? <p className="text-muted">{payment.note}</p> : null}
          {!locked ? (
            <div>
              <ConfirmButton label="Revert to unpaid" confirmLabel="Yes, revert" onConfirm={() => onSet(false, "", "")} />
            </div>
          ) : null}
        </div>
      ) : locked ? null : confirming ? (
        <form onSubmit={markPaid} noValidate className="flex flex-col gap-3 border-t border-line pt-4">
          <div>
            <FieldLabel htmlFor={`upi-${payment.id}`}>UPI reference (optional)</FieldLabel>
            <input id={`upi-${payment.id}`} className="field num" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} placeholder="e.g. 412938475612" aria-invalid={!!errors.upiRef} />
            <FieldError message={errors.upiRef} />
          </div>
          <div>
            <FieldLabel htmlFor={`pnote-${payment.id}`}>Note (optional)</FieldLabel>
            <input id={`pnote-${payment.id}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paid in cash, etc." aria-invalid={!!errors.note} />
            <FieldError message={errors.note} />
          </div>
          <p className="text-xs text-muted">Recording this only logs a payment you made outside the app. Poker Ledger does not move money.</p>
          <div className="flex gap-2">
            <Button type="submit" variant="primary">Confirm paid</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setConfirming(true)}>Mark as paid</Button>
        </div>
      )}
    </article>
  );
}

function UnlockPanel({ game, active }: { game: Game; active: Settlement | null }) {
  const { dispatch } = useLedger();
  const { notify } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  if (game.status === "open") return null;

  const parsed = unlockReasonSchema.safeParse(reason);
  const paidAny = active?.payments.some((p) => p.paid) ?? false;

  return (
    <Panel className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <div>
          <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Correct this game</h2>
          <p className="text-sm text-muted">
            Unlocking reopens buy-ins and chip counts. The current settlement is kept in history as superseded{paidAny ? ", including payments already marked paid" : ""}, and you will need to generate it again.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <input
            aria-label="Reason for correction"
            className="field"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(undefined); }}
            placeholder="Why is the correction needed?"
            aria-invalid={!!error}
          />
          <FieldError message={error} />
        </div>
        <ConfirmButton
          label={<><Unlock className="size-3.5" aria-hidden /> Unlock</>}
          confirmLabel="Yes, unlock"
          onConfirm={() => {
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message);
              return;
            }
            dispatch({ type: "game/unlock", gameId: game.id, reason: parsed.data });
            setReason("");
            notify("Game unlocked. Make your corrections, then generate the settlement again.", "info");
          }}
        />
      </div>
    </Panel>
  );
}

function SupersededList({ settlements, state }: { settlements: Settlement[]; state: LedgerState }) {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "Unknown";
  return (
    <Panel className="flex flex-col gap-3 p-4 sm:p-5">
      <h2 className="label">Earlier settlements (kept for audit)</h2>
      {settlements.map((s) => (
        <details key={s.id} className="rounded-[10px] border border-line bg-surface/50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Superseded {formatTimestamp(s.supersededAt)} · {s.payments.length} transfer{s.payments.length === 1 ? "" : "s"}
          </summary>
          <p className="mt-2 text-muted">Reason: {s.supersedeReason}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {s.payments.map((p) => (
              <li key={p.id} className="num">
                {name(p.fromPlayerId)} → {name(p.toPlayerId)} · {formatMoney(p.amountPaise)} · {p.paid ? `paid ${formatTimestamp(p.paidAt)}` : "unpaid"}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </Panel>
  );
}

