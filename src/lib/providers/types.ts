// The small surface the app needs from an image provider, so another one can be added later.
export type SubmitResult = { requestId: string; statusUrl: string };
export type ProviderStatus =
  | { state: "pending" }
  | { state: "completed"; imageUrl: string }
  | { state: "failed"; reason: string };

export interface ImageProvider {
  submit(endpoint: string, body: Record<string, unknown>, idempotencyKey: string): Promise<SubmitResult>;
  status(statusUrl: string): Promise<ProviderStatus>;
  cancel(requestId: string): Promise<void>;
}
