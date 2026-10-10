export const SETTINGS_TABS = ["Profile", "Billing", "Team", "API/MCP"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

// /settings?tab=billing opens that tab (the credits pill links there); anything unknown opens Profile.
export const tabFromParam = (v?: string): SettingsTab => SETTINGS_TABS.find((t) => t.toLowerCase().split("/")[0] === v?.toLowerCase()) ?? "Profile";
