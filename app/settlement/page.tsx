// Data lives in this browser (localStorage), so navigation is not server-validated.
export const instant = false;

import { SettlementView } from "@/components/settlement/settlement-view";

export default function SettlementPage() {
  return <SettlementView />;
}
