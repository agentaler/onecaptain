import { describe, expect, it } from "vitest";
import {
  signInternalRun,
  verifyInternalRun,
  INTERNAL_SIGNATURE_TTL_MS,
} from "../../src/community/internal-auth";

const SECRET = "encryption-key-shared-by-both-workers";
const NOW = 1_786_600_000_000;
const claims = { botUserId: "bot_1", channelId: "ch_1" };

describe("internal run signature", () => {
  it("accepts a fresh signature for the claims it was made for", async () => {
    const sig = await signInternalRun(SECRET, { ...claims, issuedAtMs: NOW });
    expect(await verifyInternalRun(SECRET, sig, claims, NOW)).toEqual({ ok: true });
  });

  it("refuses a signature older than the window", async () => {
    const sig = await signInternalRun(SECRET, { ...claims, issuedAtMs: NOW });
    const verdict = await verifyInternalRun(
      SECRET,
      sig,
      claims,
      NOW + INTERNAL_SIGNATURE_TTL_MS + 1,
    );
    expect(verdict.ok).toBe(false);
  });

  it("refuses a signature from the future", async () => {
    // A forged-ahead or clock-skewed timestamp would otherwise extend the
    // replay window indefinitely.
    const sig = await signInternalRun(SECRET, {
      ...claims,
      issuedAtMs: NOW + INTERNAL_SIGNATURE_TTL_MS * 5,
    });
    expect((await verifyInternalRun(SECRET, sig, claims, NOW)).ok).toBe(false);
  });

  it("cannot be redirected at a different agent", async () => {
    // The whole point of signing the claims: capturing a legitimate call must
    // not let someone run a DIFFERENT agent.
    const sig = await signInternalRun(SECRET, { ...claims, issuedAtMs: NOW });
    const verdict = await verifyInternalRun(
      SECRET,
      sig,
      { botUserId: "bot_2", channelId: "ch_1" },
      NOW,
    );
    expect(verdict.ok).toBe(false);
  });

  it("cannot be redirected at a different channel", async () => {
    const sig = await signInternalRun(SECRET, { ...claims, issuedAtMs: NOW });
    const verdict = await verifyInternalRun(
      SECRET,
      sig,
      { botUserId: "bot_1", channelId: "ch_2" },
      NOW,
    );
    expect(verdict.ok).toBe(false);
  });

  it("does not confuse claims that differ only in where a separator falls", async () => {
    // `{bot:"a", channel:"b|c"}` and `{bot:"a|b", channel:"c"}` must not sign
    // to the same bytes — a classic canonicalisation collision.
    const a = await signInternalRun(SECRET, {
      botUserId: "a",
      channelId: "b\nc",
      issuedAtMs: NOW,
    });
    const verdict = await verifyInternalRun(
      SECRET,
      a,
      { botUserId: "a\nb", channelId: "c" },
      NOW,
    );
    expect(verdict.ok).toBe(false);
  });

  it("refuses a signature made with a different secret", async () => {
    const sig = await signInternalRun("some-other-key", { ...claims, issuedAtMs: NOW });
    expect((await verifyInternalRun(SECRET, sig, claims, NOW)).ok).toBe(false);
  });

  it("fails closed when the secret is absent", async () => {
    // An absent secret matching an absent header would be an open door on any
    // deploy that had not been configured. This is the case the whole design
    // exists to prevent, so it is asserted directly.
    expect((await verifyInternalRun(undefined, "anything", claims, NOW)).ok).toBe(false);
    expect((await verifyInternalRun(undefined, undefined, claims, NOW)).ok).toBe(false);
    expect((await verifyInternalRun("", "", claims, NOW)).ok).toBe(false);
  });

  it("refuses a missing or malformed header rather than throwing", async () => {
    for (const bad of [null, undefined, "", "no-separator", ".abc", "notanumber.abc"]) {
      expect((await verifyInternalRun(SECRET, bad, claims, NOW)).ok).toBe(false);
    }
  });

  it("gives one opaque reason, so it cannot be used as a probing oracle", async () => {
    const stale = await signInternalRun(SECRET, { ...claims, issuedAtMs: NOW - 999_999 });
    const wrongKey = await signInternalRun("other", { ...claims, issuedAtMs: NOW });

    const verdicts = [
      await verifyInternalRun(SECRET, stale, claims, NOW),
      await verifyInternalRun(SECRET, wrongKey, claims, NOW),
      await verifyInternalRun(SECRET, "garbage", claims, NOW),
    ];
    for (const v of verdicts) expect(v).toEqual({ ok: false, reason: "rejected" });
  });

  it("needs no configuration beyond the key both workers already require", async () => {
    // The regression that matters for the operator: signing and verifying use
    // ONLY ENCRYPTION_KEY. If this ever needs a second value, that is the bug
    // this change was made to remove.
    const sig = await signInternalRun(SECRET, { ...claims, issuedAtMs: NOW });
    expect(await verifyInternalRun(SECRET, sig, claims, NOW)).toEqual({ ok: true });
  });
});
