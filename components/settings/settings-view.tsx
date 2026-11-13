"use client";

import { useState } from "react";
import { Button, ConfirmButton, FieldLabel, PageHeading, Panel } from "@/components/ui/primitives";
import { useLedger } from "@/lib/state/ledger-context";
import { useToast } from "@/components/ui/toast";
import { formatChips, formatMoney, formatRate, parseMoneyToPaise, paiseToInput, SUPPORTED_CURRENCIES } from "@/lib/money";
import { formatTimestamp } from "@/lib/format";

export function SettingsView() {
  const { state, dispatch } = useLedger();
  const { notify } = useToast();
  const s = state.settings;
  const [buyInText, setBuyInText] = useState(paiseToInput(s.defaultBuyInPaise));
  const [chipsText, setChipsText] = useState(String(s.defaultChipsPerBuyIn));
  const [error, setError] = useState<string | undefined>();

  const parsedBuyIn = parseMoneyToPaise(buyInText);
  const parsedChips = Number(chipsText.replace(/,/g, ""));
  const preview = parsedBuyIn && Number.isInteger(parsedChips) && parsedChips > 0 ? parsedBuyIn / parsedChips : null;
  const sampleCount = state.games.filter((g) => g.isSample).length;

  function saveDefaults() {
    if (!parsedBuyIn || parsedBuyIn <= 0) {
      setError("Enter a buy-in greater than zero.");
      return;
    }
    if (!Number.isInteger(parsedChips) || parsedChips <= 0) {
      setError("Chips must be a whole number above zero.");
      return;
    }
    dispatch({
      type: "settings/update",
      patch: { defaultBuyInPaise: parsedBuyIn, defaultChipsPerBuyIn: parsedChips },
    });
    setError(undefined);
    notify("Defaults saved. They apply to new games only.");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Preferences" title="Settings" />

      <Panel className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Defaults for new games</h2>
          <p className="mt-1 text-sm text-muted">
            Existing games keep their own settings. Changing these never alters past results.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="set-currency">Currency</FieldLabel>
            <select id="set-currency" className="field" value={s.defaultCurrency} onChange={(e) => dispatch({ type: "settings/update", patch: { defaultCurrency: e.target.value } })}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="set-buyin">Standard buy-in</FieldLabel>
            <input id="set-buyin" inputMode="decimal" className="field num" value={buyInText} onChange={(e) => { setBuyInText(e.target.value); setError(undefined); }} aria-invalid={!!error} />
          </div>
          <div>
            <FieldLabel htmlFor="set-chips">Chips per buy-in</FieldLabel>
            <input id="set-chips" inputMode="numeric" className="field num" value={chipsText} onChange={(e) => { setChipsText(e.target.value); setError(undefined); }} aria-invalid={!!error} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] bg-surface px-4 py-3 text-sm">
          <span className="label">Chip value</span>
          <span className="num font-semibold">{preview === null ? "—" : `${formatRate(preview, s.defaultCurrency)} per chip`}</span>
        </div>
        {error ? <p role="alert" className="text-xs text-loss">{error}</p> : null}
        <div>
          <Button variant="primary" onClick={saveDefaults}>Save defaults</Button>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Data</h2>
        <p className="text-sm text-muted">
          Everything lives in this browser’s storage. Clearing site data for this app deletes it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmButton
            label={`Clear sample data${sampleCount ? ` (${sampleCount} game${sampleCount === 1 ? "" : "s"})` : ""}`}
            confirmLabel="Yes, clear samples"
            disabled={sampleCount === 0}
            onConfirm={() => {
              dispatch({ type: "data/clear-samples" });
              notify("Sample data cleared");
            }}
          />
          <ConfirmButton
            label="Erase all data"
            confirmLabel="Yes, erase everything"
            onConfirm={() => {
              dispatch({ type: "data/reset" });
              notify("All data erased", "info");
            }}
          />
        </div>
      </Panel>

      <Panel className="flex flex-col gap-3 p-5 sm:p-6">
        <h2 className="font-mono text-sm uppercase tracking-[0.1em]">How the maths works</h2>
        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li>Chip value = money collected ÷ chips issued. With standard buy-ins, this is buy-in ÷ chips per buy-in.</li>
          <li>Final chip value = final chips × chip value, rounded to the paise. Rounding is distributed so the total always matches the money collected.</li>
          <li>Net = final chip value − total invested. Positive means owed money; negative means owes money.</li>
          <li>Settlement pays the fewest transfers possible (greedy matching of largest debtor with largest creditor), in whole paise.</li>
        </ul>
        <p className="text-xs text-muted">Example: {formatMoney(50000)} buys {formatChips(1000)} chips, so each chip is worth {formatRate(50, "INR")}.</p>
      </Panel>

      <Panel className="flex flex-col gap-3 p-5 sm:p-6">
        <h2 className="font-mono text-sm uppercase tracking-[0.1em]">Audit trail</h2>
        {state.audit.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <ol className="flex max-h-80 flex-col gap-2 overflow-auto text-sm">
            {[...state.audit].reverse().slice(0, 200).map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3">
                <span className="num text-xs text-muted">{formatTimestamp(entry.at)}</span>
                <span>{entry.message}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
