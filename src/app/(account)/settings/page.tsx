import SettingsView from "@/components/settings/SettingsView";
import { tabFromParam } from "@/lib/settings-tabs";

export default async function SettingsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  const tab = tabFromParam(searchParams.tab);
  // key: arriving from the credits pill while already on Settings switches to the right tab
  return <SettingsView key={tab} initialTab={tab} />;
}
