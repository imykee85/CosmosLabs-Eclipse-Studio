import SettingsView from "@/components/settings/SettingsView";
import { tabFromParam } from "@/lib/settings-tabs";

export default function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = tabFromParam(searchParams.tab);
  // key: arriving from the credits pill while already on Settings switches to the right tab
  return <SettingsView key={tab} initialTab={tab} />;
}
