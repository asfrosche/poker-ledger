"use client";

import { useState, type FormEvent } from "react";
import { FieldError, FieldLabel, Button } from "@/components/ui/primitives";
import { formatRate, formatMoney, SUPPORTED_CURRENCIES, paiseToInput, parseMoneyToPaise } from "@/lib/money";
import { validateGameConfig, type GameConfigFormInput } from "@/lib/validation/schemas";
import type { Game } from "@/types";

export interface GameConfigValues {
  name: string;
  date: string;
  currency: string;
  buyInPaise: number;
  chipsPerBuyIn: number;
  venue: string;
  format: string;
  notes: string;
}

interface Props {
  initial: GameConfigValues | Pick<Game, keyof GameConfigValues>;
  submitLabel: string;
  onSubmit: (values: GameConfigValues) => void;
  onCancel?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

/** Shared game configuration form for creating and editing a game. */
export function GameConfigForm({ initial, submitLabel, onSubmit, onCancel, disabled, compact }: Props) {
  const [form, setForm] = useState<GameConfigFormInput>({
    name: initial.name,
    date: initial.date,
    currency: initial.currency as GameConfigFormInput["currency"],
    buyInText: paiseToInput(initial.buyInPaise),
    chipsText: String(initial.chipsPerBuyIn),
    venue: initial.venue,
    format: initial.format,
    notes: initial.notes,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const previewPaise = parseMoneyToPaise(form.buyInText);
  const previewChips = Number(form.chipsText.replace(/,/g, ""));
  const chipValue =
    previewPaise && Number.isInteger(previewChips) && previewChips > 0
      ? previewPaise / previewChips
      : null;

  const set = (key: keyof GameConfigFormInput) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateGameConfig(form);
    setErrors(result.errors);
    if (result.data) {
      onSubmit({
        name: result.data.name,
        date: result.data.date,
        currency: result.data.currency,
        buyInPaise: result.data.buyInPaise,
        chipsPerBuyIn: result.data.chipsPerBuyIn,
        venue: result.data.venue,
        format: result.data.format,
        notes: result.data.notes,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2" aria-label="Game configuration">
      <div className="sm:col-span-2">
        <FieldLabel htmlFor="gc-name">Game name</FieldLabel>
        <input
          id="gc-name"
          className="field"
          value={form.name}
          onChange={set("name")}
          disabled={disabled}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "gc-name-err" : undefined}
          autoComplete="off"
        />
        <FieldError id="gc-name-err" message={errors.name} />
      </div>

      <div>
        <FieldLabel htmlFor="gc-date">Date</FieldLabel>
        <input id="gc-date" type="date" className="field num" value={form.date} onChange={set("date")} disabled={disabled} aria-invalid={!!errors.date} />
        <FieldError message={errors.date} />
      </div>

      <div>
        <FieldLabel htmlFor="gc-currency">Currency</FieldLabel>
        <select id="gc-currency" className="field" value={form.currency} onChange={set("currency")} disabled={disabled}>
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <FieldError message={errors.currency} />
      </div>

      <div>
        <FieldLabel htmlFor="gc-buyin">Standard buy-in</FieldLabel>
        <input
          id="gc-buyin"
          inputMode="decimal"
          className="field num"
          value={form.buyInText}
          onChange={set("buyInText")}
          disabled={disabled}
          aria-invalid={!!errors.buyInText}
          placeholder="500"
        />
        <FieldError message={errors.buyInText} />
      </div>

      <div>
        <FieldLabel htmlFor="gc-chips">Chips per buy-in</FieldLabel>
        <input
          id="gc-chips"
          inputMode="numeric"
          className="field num"
          value={form.chipsText}
          onChange={set("chipsText")}
          disabled={disabled}
          aria-invalid={!!errors.chipsText}
          placeholder="1000"
        />
        <FieldError message={errors.chipsText} />
      </div>

      <div className="sm:col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] bg-surface px-4 py-3 text-sm">
        <span className="label">Chip value</span>
        <span className="num font-semibold">
          {chipValue === null ? "—" : `${formatRate(chipValue, form.currency)} per chip`}
        </span>
        <span className="text-muted">
          {previewPaise && Number.isInteger(previewChips) && previewChips > 0
            ? `${formatMoney(previewPaise, form.currency)} buys ${previewChips.toLocaleString("en-US")} chips`
            : "Buy-in ÷ chips issued"}
        </span>
      </div>

      {!compact ? (
        <>
          <div>
            <FieldLabel htmlFor="gc-venue">Venue</FieldLabel>
            <input id="gc-venue" className="field" value={form.venue} onChange={set("venue")} disabled={disabled} placeholder="Optional" />
            <FieldError message={errors.venue} />
          </div>
          <div>
            <FieldLabel htmlFor="gc-format">Format</FieldLabel>
            <input id="gc-format" className="field" value={form.format} onChange={set("format")} disabled={disabled} placeholder="e.g. No-limit Hold'em" />
            <FieldError message={errors.format} />
          </div>
        </>
      ) : null}

      <div className="sm:col-span-2">
        <FieldLabel htmlFor="gc-notes">Notes</FieldLabel>
        <textarea id="gc-notes" className="field min-h-20" rows={3} value={form.notes} onChange={set("notes")} disabled={disabled} placeholder="House rules, blinds, anything worth remembering" />
        <FieldError message={errors.notes} />
      </div>

      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={disabled}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
