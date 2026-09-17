/**
 * Turn any thrown value into a short, user-facing sentence.
 *
 * The API client throws `ApiError` with the backend's `detail` string, which is
 * often accurate but technical ("Could not identify required column(s)
 * ['invoice_number']", "Unexpected GSP response shape…") or references
 * implementation detail we never want a user to see (GSP, sandbox, localhost,
 * stack traces). This maps the ones worth rephrasing and otherwise falls back
 * to a provided default rather than leaking raw text.
 */

interface FriendlyOptions {
  /** Shown when nothing more specific matches. */
  fallback?: string;
}

/** Substrings that mean "don't surface this raw" — if a message contains one and
 *  isn't otherwise mapped, we use the fallback instead of the raw text. */
const TECHNICAL_MARKERS = [
  "localhost",
  "127.0.0.1",
  "gsp",
  "sandbox",
  "traceback",
  "sqlalchemy",
  "asyncpg",
  "psycopg",
  "exception",
  "null value",
  "constraint",
  "envelope",
  "docdata",
  "http://",
  "https://",
  "0.0.0.0",
];

/** Ordered rules: first whose `test` matches wins. `test` runs on the lowercased message. */
const RULES: { test: (m: string) => boolean; message: string }[] = [
  {
    test: (m) => m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"),
    message: "Can't reach the server right now. Check your connection and try again.",
  },
  {
    test: (m) => m.includes("not authenticated") || m.includes("401"),
    message: "Your session has expired. Please sign in again.",
  },
  {
    test: (m) => m.includes("required column") || m.includes("could not identify"),
    message:
      "We couldn't read this file — some expected columns are missing. Check that it's a Tally or GSTR-2B export and try again.",
  },
  {
    test: (m) => m.includes("no data rows") || m.includes("no rows with an invoice"),
    message: "This file doesn't contain any invoice rows we can read.",
  },
  {
    test: (m) => m.includes("could not parse") || m.includes("must be one of") || m.includes("unsupported"),
    message: "That file format isn't supported. Please upload an Excel (.xlsx) or CSV file.",
  },
  {
    test: (m) => m.includes("provide a ledger") || m.includes("at least one"),
    message: "Add at least one file — a purchase register, GSTR-2B, or both.",
  },
  {
    test: (m) => m.includes("gstr-2b") && (m.includes("fetch") || m.includes("unavailable") || m.includes("shape")),
    message: "We couldn't fetch GSTR-2B from the GST portal just now. Try again in a moment.",
  },
  {
    test: (m) => m.includes("not found"),
    message: "We couldn't find what you were looking for. It may have been removed.",
  },
];

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

/**
 * @param err     the thrown value (Error, ApiError, string, unknown)
 * @param options optional `fallback` sentence
 */
export function friendlyError(err: unknown, options?: FriendlyOptions): string {
  const fallback = options?.fallback ?? "Something went wrong. Please try again.";
  const raw = extractMessage(err).trim();
  if (!raw) return fallback;

  const lowered = raw.toLowerCase();

  for (const rule of RULES) {
    if (rule.test(lowered)) return rule.message;
  }

  // Unmapped but contains implementation detail → don't leak it.
  if (TECHNICAL_MARKERS.some((marker) => lowered.includes(marker))) {
    return fallback;
  }

  // A short, clean, human-looking message can pass through as-is.
  if (raw.length <= 140 && !raw.includes("{") && !raw.includes("\n")) {
    return raw;
  }

  return fallback;
}
