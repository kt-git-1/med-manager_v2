export type HistoryCursorPayload = {
  patientId: string;
  from: string;
  to: string;
  lastSeenScheduledAt: string;
  lastSeenId: string;
};

export type HistoryCursorContext = {
  patientId: string;
  from: string;
  to: string;
};

export class InvalidCursorError extends Error {
  code = "INVALID_CURSOR" as const;

  constructor(message = "Invalid cursor") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

export function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function encodeHistoryCursor(args: HistoryCursorPayload): string {
  const payload = JSON.stringify(args);
  return base64UrlEncode(payload);
}

export function decodeAndValidateHistoryCursor(
  cursor: string,
  expectedCtx: HistoryCursorContext
): HistoryCursorPayload {
  try {
    const decoded = base64UrlDecode(cursor);
    const parsed = JSON.parse(decoded) as Partial<HistoryCursorPayload>;

    assertString(parsed.patientId);
    assertString(parsed.from);
    assertString(parsed.to);
    assertString(parsed.lastSeenScheduledAt);
    assertString(parsed.lastSeenId);

    // Security: bind cursor to the requesting context to prevent reuse
    // across patients or date ranges.
    if (parsed.patientId !== expectedCtx.patientId) {
      throw new InvalidCursorError();
    }
    if (parsed.from !== expectedCtx.from || parsed.to !== expectedCtx.to) {
      throw new InvalidCursorError();
    }

    return parsed as HistoryCursorPayload;
  } catch (err) {
    if (err instanceof InvalidCursorError) {
      throw err;
    }
    throw new InvalidCursorError();
  }
}

function assertString(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidCursorError();
  }
}
