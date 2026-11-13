// Data lives in this browser (localStorage), so navigation is not server-validated.
export const instant = false;

import { PlayerHistoryView } from "@/components/players/player-history-view";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerHistoryView playerId={id} />;
}
