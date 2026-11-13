"use client";

import { useRouter } from "next/navigation";
import { GameConfigForm } from "@/components/games/game-config-form";
import { PageHeading, Panel } from "@/components/ui/primitives";
import { useLedger } from "@/lib/state/ledger-context";
import { useToast } from "@/components/ui/toast";
import { todayIsoDate } from "@/lib/format";

export function NewGameForm() {
  const { state, dispatch } = useLedger();
  const { notify } = useToast();
  const router = useRouter();
  const s = state.settings;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Start a new night"
        title="New game"
      />
      <Panel className="p-5 sm:p-6">
        <p className="mb-6 max-w-prose text-sm text-muted">
          Each game keeps its own buy-in and chip settings. Changing defaults later never touches past games.
        </p>
        <GameConfigForm
          initial={{
            name: "Friday Poker Night",
            date: todayIsoDate(),
            currency: s.defaultCurrency,
            buyInPaise: s.defaultBuyInPaise,
            chipsPerBuyIn: s.defaultChipsPerBuyIn,
            venue: "",
            format: s.defaultFormat,
            notes: "",
          }}
          submitLabel="Create game"
          onCancel={() => router.back()}
          onSubmit={(values) => {
            dispatch({ type: "game/create", ...values });
            notify(`${values.name} created. Add the players to begin.`);
            router.push("/chip-board");
          }}
        />
      </Panel>
    </div>
  );
}
