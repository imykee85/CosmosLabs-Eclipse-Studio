// BytePlus ModelArk (Seedream): a stub. The official pages could not be read, so there are no confirmed field names. Every Seedream model stays
// out of the registry until the owner pastes docs.byteplus.com (ModelArk): "Image generation API", "Base URL and authentication" and "Obtain and
// configure an API key", and the provider is filled in from them. Key when it exists: ARK_API_KEY.
import { ProviderError, type SyncImageProvider } from "./types";

export const byteplus: SyncImageProvider = {
  async generate() {
    throw new ProviderError("Seedream is not connected yet.", "BytePlus request fields are not verified; see src/lib/providers/byteplus.ts");
  },
};
