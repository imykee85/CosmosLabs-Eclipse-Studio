// The small surface the app needs from an image provider, so another one can be added later.
export type SubmitResult = { requestId: string; statusUrl: string };
export type ProviderStatus =
  | { state: "pending" }
  | { state: "completed"; imageUrl: string }
  | { state: "failed"; reason: string; detail?: string };

export interface ImageProvider {
  submit(endpoint: string, body: Record<string, unknown>, idempotencyKey: string): Promise<SubmitResult>;
  status(statusUrl: string): Promise<ProviderStatus>;
  cancel(requestId: string): Promise<void>;
}

// Providers that answer in the SAME call (Google and OpenAI return the finished picture in the reply, base64 encoded; they have no job to poll).
// Their render runs inside the request that starts it, so there is no submit/status/cancel pair: `generate` is all of it.
// BytePlus sizes: target pixels per tier, the allowed total pixel range, and sizes read from the page that win over the computed ones (tier, then ratio).
export type SizeRule = { px: Record<string, number>; min: number; max: number; table?: Record<string, Record<string, string>> };
export type ReferenceImage = { bytes: Uint8Array; contentType: string };
export type SyncGenerateInput = {
  apiModel: string;            // the provider's own model id
  prompt: string;
  aspectRatio?: string;
  resolution?: string;         // our tier ("1k", "2k", "4k"); each provider maps it to its own size field
  references: ReferenceImage[];
  sizing?: "custom16" | "fixed3"; // OpenAI only: free WIDTHxHEIGHT (gpt-image-2 family) or one of the three fixed sizes
  sizeRule?: SizeRule; // BytePlus: target pixels per tier and the allowed total pixel range
  outputPng?: boolean;         // BytePlus: ask for PNG (only some models take output_format)
  user?: string;               // an opaque id for the person (never their real id)
  signal?: AbortSignal;
};
export type SyncGenerateResult = { bytes: Uint8Array; contentType: string; usage?: unknown };
export interface SyncImageProvider {
  generate(input: SyncGenerateInput): Promise<SyncGenerateResult>;
}

// A provider's refusal or failure, with a sentence a person can read (`message`) and the provider's own words for the logs and for us (`detail`).
export class ProviderError extends Error {
  constructor(readonly userMessage: string, readonly detail?: string) { super(userMessage); }
}
