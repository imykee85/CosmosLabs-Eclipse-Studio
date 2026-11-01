// Client-safe constants. Change TERMS_VERSION when the Terms of Use or Privacy Policy change in a way people must accept again:
// everyone is then asked once more, and the old acceptance stays on record under the old version.
export const TERMS_VERSION = "2026-11-01";
export const TERMS_FLAG = "eclipse-terms-accepted"; // sessionStorage: set by the sign-up checkbox, read by the accept page
// Only accounts created on or after this moment (start of 2026-11-01, UTC) must accept the terms; accounts made before it are left alone.
export const TERMS_REQUIRED_FROM = new Date("2026-11-01T00:00:00Z");
