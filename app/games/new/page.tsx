// Data lives in this browser (localStorage), so navigation is not server-validated.
export const instant = false;

import { NewGameForm } from "@/components/games/new-game-form";

export default function NewGamePage() {
  return <NewGameForm />;
}
