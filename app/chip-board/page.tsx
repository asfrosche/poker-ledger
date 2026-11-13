// Data lives in this browser (localStorage), so navigation is not server-validated.
export const instant = false;

import { ChipBoard } from "@/components/games/chip-board";

export default function ChipBoardPage() {
  return <ChipBoard />;
}
