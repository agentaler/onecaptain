/**
 * Proof that a service-to-service request came from us.
 *
 * The wake worker has to ask the web worker to run a cloud agent turn, because
 * the message funnel only executes inside the Next/OpenNext runtime. The web
 * worker therefore needs to know the caller is really the wake worker: that
 * route sits on the public app like any other, so without a check anyone could
 * POST to it and make someone's agents speak.
 *
 * This deliberately introduces NO new configuration. The first version used a
 * hand-set `INTERNAL_RUN_SECRET` that an operator had to place identically on
 * two workers, which is the wrong shape for a multi-tenant SaaS: per-deployment
 * manual ops, no owner, and it failed *silently* when missed — automatic replies
 * simply never happened and nothing said why.
 *
 * Instead the proof is derived from `ENCRYPTION_KEY`, which both workers already
 * require. That choice is what removes the new failure mode rather than merely
 * relocating it: if `ENCRYPTION_KEY` is missing or mismatched, stored provider
 * keys already cannot be decrypted, so cloud agents are already broken for a
 * reason the operator must fix anyway. There is no state in which signing works
 * and the rest of the feature does not, or vice versa.
 *
 * The signature covers the agent, the channel and a timestamp, so a captured
 * signature cannot be replayed after the window nor redirected at a different
 * agent or channel.
 */

/** How long a signature stays valid. Long enough for a queue hop, short enough to bound replay. */
export const INTERNAL_SIGNATURE_TTL_MS = 60_000;

export interface InternalRunClaims {
  botUserId: string;
  channelId: string;
  issuedAtMs: number;
}

/**
 * The exact bytes signed.
 *
 * Length-prefixed, NOT delimiter-joined. A delimiter is only unambiguous if it
 * cannot occur inside a field, and these fields come off a request body — so
 * that assumption does not hold. Joining on a separator lets
 * `{bot:"a", channel:"b\nc"}` and `{bot:"a\nb", channel:"c"}` produce identical
 * bytes, meaning one signature would authenticate two different requests. The
 * first draft of this file had exactly that bug and a test caught it.
 *
 * Prefixing each field with its length is collision-free for any content.
 */
function canonicalClaims(claims: InternalRunClaims): string {
  const parts = [
    "onecaptain.internal.agent-run.v1",
    claims.botUserId,
    claims.channelId,
    String(claims.issuedAtMs),
  ];
  return parts.map((part) => `${part.length}:${part}`).join("");
}

async function hmac(secret: string, message: string): Promise<string> {
  // WebCrypto rather than node:crypto — this module runs in workerd on both
  // sides, and importing node:crypto would drag it into bundles that cannot
  // take it.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sign a run request. Returns the header value the web route expects. */
export async function signInternalRun(
  secret: string,
  claims: InternalRunClaims,
): Promise<string> {
  return `${claims.issuedAtMs}.${await hmac(secret, canonicalClaims(claims))}`;
}

export type InternalRunVerdict =
  | { ok: true }
  /**
   * Deliberately one opaque reason for every rejection. Telling a caller
   * *which* part failed — bad signature vs. expired vs. malformed — hands an
   * attacker a probing oracle for no operational benefit; the logs on our side
   * have the detail.
   */
  | { ok: false; reason: "rejected" };

/**
 * Recompute and compare. `nowMs` is injected so the window is testable without
 * faking the clock globally.
 */
export async function verifyInternalRun(
  secret: string | undefined,
  presented: string | null | undefined,
  claims: Omit<InternalRunClaims, "issuedAtMs">,
  nowMs: number,
): Promise<InternalRunVerdict> {
  // Fail closed. An absent secret matching an absent header would turn this
  // into an open door on any deploy that had not been configured — the exact
  // failure this design exists to prevent.
  if (!secret || !presented) return { ok: false, reason: "rejected" };

  const separator = presented.indexOf(".");
  if (separator <= 0) return { ok: false, reason: "rejected" };

  const issuedAtMs = Number(presented.slice(0, separator));
  const offered = presented.slice(separator + 1);
  if (!Number.isFinite(issuedAtMs)) return { ok: false, reason: "rejected" };

  // Reject the future as well as the past: a clock-skewed or forged-ahead
  // timestamp would otherwise extend the replay window indefinitely.
  const age = nowMs - issuedAtMs;
  if (age > INTERNAL_SIGNATURE_TTL_MS || age < -INTERNAL_SIGNATURE_TTL_MS) {
    return { ok: false, reason: "rejected" };
  }

  const expected = await hmac(secret, canonicalClaims({ ...claims, issuedAtMs }));
  return constantTimeEquals(offered, expected) ? { ok: true } : { ok: false, reason: "rejected" };
}

/**
 * Length is not secret here (both sides produce a fixed-width hex digest), but
 * the comparison must still not exit early on the first differing byte.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
