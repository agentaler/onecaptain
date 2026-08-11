import { describe, expect, it } from "vitest";
import { isRetryablePgError, withPgRetry, readOrStalePg } from "../src/db/pg/resilience";

function pgError(code: string, message = "db error"): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

describe("isRetryablePgError", () => {
  it("retries transient pg codes", () => {
    for (const code of ["08006", "40001", "40P01", "57P03", "53300"]) {
      expect(isRetryablePgError(pgError(code))).toBe(true);
    }
  });

  it("does not retry constraint or syntax errors", () => {
    expect(isRetryablePgError(pgError("23505", "duplicate key value"))).toBe(false);
    expect(isRetryablePgError(pgError("42601", "syntax error"))).toBe(false);
    expect(isRetryablePgError(new Error("null value in column"))).toBe(false);
  });

  it("retries socket-shaped messages without a code", () => {
    expect(isRetryablePgError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isRetryablePgError(new Error("connect ECONNREFUSED 10.0.0.1:5432"))).toBe(true);
  });
});

describe("withPgRetry", () => {
  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const result = await withPgRetry(async () => {
      calls++;
      if (calls < 3) throw pgError("40001", "serialization failure");
      return "ok";
    }, { baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("fails fast on non-retryable errors", async () => {
    let calls = 0;
    await expect(withPgRetry(async () => {
      calls++;
      throw pgError("23505", "duplicate key value");
    }, { baseDelayMs: 1 })).rejects.toThrow("duplicate key");
    expect(calls).toBe(1);
  });
});

describe("readOrStalePg", () => {
  it("launders exhausted transient failures into stale fallback", async () => {
    const { value, stale } = await readOrStalePg(
      async () => { throw pgError("08006", "connection failure"); },
      { rows: [] },
      { attempts: 1, baseDelayMs: 1 },
    );
    expect(stale).toBe(true);
    expect(value).toEqual({ rows: [] });
  });

  it("rethrows non-retryable failures instead of hiding them", async () => {
    await expect(readOrStalePg(
      async () => { throw pgError("23505", "duplicate key value"); },
      { rows: [] },
      { attempts: 1, baseDelayMs: 1 },
    )).rejects.toThrow("duplicate key");
  });
});
