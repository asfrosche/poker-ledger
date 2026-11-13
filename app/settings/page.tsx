// Data lives in this browser (localStorage), so navigation is not server-validated.
export const instant = false;

import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return <SettingsView />;
}
