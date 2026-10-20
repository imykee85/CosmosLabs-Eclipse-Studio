import { safeText } from "../safe-text";
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

// What people are told when a model fails (owner 2026-10-19: every message is Eclipse's own; no maker, service, status code or raw provider text).
// The provider's own words stay in `detail`, which goes to the server logs and the owner's job pages only.
export const SAY = {
  notReady: "This model is not available right now. Please choose another model.",
  timeout: "This render took too long and was stopped. Please try again.",
  unreachable: "This model could not be reached. Please try again in a moment.",
  busy: "This model is busy right now. Please try again in a moment.",
  safety: "This image was blocked by the model's safety filter. Try different words or another model.",
  safetyPictures: "This image was blocked by the model's safety filter. It checks your pictures as well as your words, so try different pictures, fewer pictures, or another model.",
  failed: "This model could not make the image. Please try again or choose another model.",
  noPicture: "The model did not return a picture. Please try again, or reword the prompt.",
} as const;

// A provider's refusal or failure, with a sentence a person can read (`message`) and the provider's own words for the logs and for us (`detail`).
export class ProviderError extends Error {
  readonly userMessage: string;
  // `fallback`: a failure of the direct route itself (provider unreachable, refused our key, rate limit, timeout), not of the request: the render may be tried on Higgsfield instead.
  constructor(userMessage: string, readonly detail?: string, readonly fallback = false) { super(userMessage); this.userMessage = safeText(userMessage, 400); } // `detail` is for the logs only; the user-facing sentence is cleaned
}
