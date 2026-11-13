// Data lives in this browser (localStorage), so navigation is not server-validated.
export const instant = false;

import { HistoryList } from "@/components/history/history-list";

export default function HistoryPage() {
  return <HistoryList />;
}
