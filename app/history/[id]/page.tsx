// Data lives in this browser (localStorage), so navigation is not server-validated.
export const instant = false;

import { GameRecord } from "@/components/history/game-record";

export default async function GameHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GameRecord gameId={id} />;
}
