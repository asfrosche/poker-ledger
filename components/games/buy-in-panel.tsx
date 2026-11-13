"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { useLedger } from "@/lib/state/ledger-context";
import { useToast } from "@/components/ui/toast";
import { Button, ConfirmButton, FieldError, FieldLabel } from "@/components/ui/primitives";
import { previewBuyIn, resolveChipBuyIn } from "@/lib/calculations/buy-in";
import { formatChips, formatMoney } from "@/lib/money";
import { formatTimestamp } from "@/lib/format";
import type { PlayerRow } from "@/lib/calculations/ledger";
import type { Game, LedgerState } from "@/types";

interface Props {
  state: LedgerState;
  game: Game;
  row: PlayerRow;
  editable: boolean;
  onRemove?: () => void;
}

/** Every buy-in for one player, with inline edit/delete and a chips-only custom buy-in. */
export function BuyInPanel({ state, game, row, editable }: Props) {
  const { dispatch } = useLedger();
  const { notify } = useToast();
  const buyIns = state.buyIns
    .filter((b) => b.gameId === game.id && b.playerId === row.playerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="label">Buy-in history · {row.name}</h3>
        {buyIns.length === 0 ? (
          <p className="text-sm text-muted">No buy-ins yet. Use Buy-in above or add chips below.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[10px] border border-line bg-panel">
            {buyIns.map((buyIn, index) => (
              <BuyInItem
                key={buyIn.id}
                index={index + 1}
                label={buyIn.note || (index === 0 ? "Initial buy-in" : "Rebuy")}
                rawNote={buyIn.note}
                chips={buyIn.chips}
                amountPaise={buyIn.amountPaise}
                createdAt={buyIn.createdAt}
                updatedAt={buyIn.updatedAt}
                game={game}
                editable={editable}
                onSave={(chips, note) => {
                  const resolved = resolveChipBuyIn(String(chips), game);
                  if ("error" in resolved) return resolved.error;
                  dispatch({ type: "buyin/update", buyInId: buyIn.id, amountPaise: resolved.amountPaise, chips: resolved.chips, note });
                  notify("Buy-in updated");
                  return null;
                }}
                onDelete={() => {
                  dispatch({ type: "buyin/delete", buyInId: buyIn.id });
                  notify("Buy-in removed");
                }}
              />
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          {buyIns.length} buy-in{buyIns.length === 1 ? "" : "s"} · {formatMoney(row.investedPaise, game.currency)} · {formatChips(row.chipsIssued)} chips
        </p>
      </div>

      {editable ? <CustomBuyIn game={game} row={row} /> : null}
    </div>
  );
}

function BuyInItem({
  index,
  label,
  rawNote,
  chips,
  amountPaise,
  createdAt,
  updatedAt,
  game,
  editable,
  onSave,
  onDelete,
}: {
  index: number;
  label: string;
  rawNote: string;
  chips: number;
  amountPaise: number;
  createdAt: string;
  updatedAt: string | null;
  game: Game;
  editable: boolean;
  onSave: (chips: number, note: string) => string | null;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [chipsText, setChipsText] = useState(String(chips));
  const [note, setNote] = useState(rawNote);
  const [error, setError] = useState<string | undefined>();

  function save(event: FormEvent) {
    event.preventDefault();
    const resolved = resolveChipBuyIn(chipsText, game);
    if ("error" in resolved) {
      setError(resolved.error);
      return;
    }
    const failure = onSave(resolved.chips, note.trim());
    if (failure) {
      setError(failure);
      return;
    }
    setEditing(false);
    setError(undefined);
  }

  if (editing) {
    const preview = previewBuyIn(chipsText, game);
    return (
      <li className="p-3">
        <form onSubmit={save} noValidate className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div>
            <FieldLabel htmlFor={`edit-chips-${index}-${createdAt}`}>Chips bought {preview ? <span className="num normal-case tracking-normal text-ink">{preview}</span> : null}</FieldLabel>
            <input id={`edit-chips-${index}-${createdAt}`} inputMode="numeric" className="field num" value={chipsText} onChange={(e) => setChipsText(e.target.value)} aria-invalid={!!error} />
            <FieldError message={error} />
          </div>
          <div>
            <FieldLabel htmlFor={`edit-note-${index}-${createdAt}`}>Note</FieldLabel>
            <input id={`edit-note-${index}-${createdAt}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary">Save</Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setError(undefined); }}>Cancel</Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 text-sm">
      <span className="num w-6 text-muted">#{index}</span>
      <span className="num font-medium">{formatChips(chips)} chips</span>
      <span className="num text-muted">{formatMoney(amountPaise, game.currency)}</span>
      <span className="min-w-0 flex-1 truncate text-muted">
        {label}
        <span className="ml-2 text-xs">{formatTimestamp(createdAt)}</span>
        {updatedAt ? <span className="ml-2 text-xs">· edited {formatTimestamp(updatedAt)}</span> : null}
      </span>
      {editable ? (
        <span className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit buy-in ${index}`}>
            <Pencil className="size-3.5" aria-hidden /> Edit
          </Button>
          <ConfirmButton label="Remove" confirmLabel="Remove buy-in" onConfirm={onDelete} />
        </span>
      ) : null}
    </li>
  );
}

function CustomBuyIn({ game, row }: { game: Game; row: PlayerRow }) {
  const { dispatch } = useLedger();
  const { notify } = useToast();
  const [chipsText, setChipsText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const preview = previewBuyIn(chipsText, game);

  function submit(event: FormEvent) {
    event.preventDefault();
    const resolved = resolveChipBuyIn(chipsText, game);
    if ("error" in resolved) {
      setError(resolved.error);
      return;
    }
    dispatch({
      type: "buyin/add",
      gameId: game.id,
      playerId: row.playerId,
      amountPaise: resolved.amountPaise,
      chips: resolved.chips,
      note: note.trim(),
    });
    notify(`${formatChips(resolved.chips)} chips added for ${row.name}`);
    setChipsText("");
    setNote("");
    setError(undefined);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end" aria-label={`Add chips for ${row.name}`}>
      <div className="sm:col-span-3">
        <h4 className="label">Add chips</h4>
        <p className="text-xs text-muted">Type the chips bought. The money is worked out from the game&apos;s rate.</p>
      </div>
      <div>
        <FieldLabel htmlFor={`custom-chips-${row.playerId}`}>
          Chips bought {preview ? <span className="num normal-case tracking-normal text-ink">{preview}</span> : null}
        </FieldLabel>
        <input
          id={`custom-chips-${row.playerId}`}
          inputMode="numeric"
          className="field num"
          value={chipsText}
          onChange={(e) => { setChipsText(e.target.value); setError(undefined); }}
          placeholder="e.g. 1000"
          aria-invalid={!!error}
        />
        <FieldError message={error} />
      </div>
      <div>
        <FieldLabel htmlFor={`custom-note-${row.playerId}`}>Note</FieldLabel>
        <input id={`custom-note-${row.playerId}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={200} />
      </div>
      <Button type="submit" variant="secondary">Add chips</Button>
    </form>
  );
}
