// The size-based estimate of a recording's length in seconds, used for the price shown before a recording is transcribed. A compressed file is rarely above 128 kbit/s,
// so size x 8 / 128,000 is an over-estimate; the server uses the same rule for the credit hold and settles on the real length. Pure: safe for the browser.
export const estimateSeconds = (bytes: number) => Math.max(1, Math.ceil((Math.max(0, bytes) * 8) / 128_000));
