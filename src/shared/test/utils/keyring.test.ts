import { describe, it, expect } from "vitest"
import { parseKeyring, describeKeyring, keyForId, KeyringError, LEGACY_KEY_ID } from "../../src/utils/keyring"

describe("parseKeyring", () => {
  it("treats a lone ENCRYPTION_KEY as the legacy v1 key", () => {
    // The whole point of the compatibility path: a deployment that has never
    // heard of a keyring keeps working, and keeps writing v1.
    const ring = parseKeyring({ ENCRYPTION_KEY: "legacy-secret" })
    expect(ring.activeId).toBe(LEGACY_KEY_ID)
    expect(keyForId(ring, LEGACY_KEY_ID)).toBe("legacy-secret")
  })

  it("parses id:secret entries and keeps the legacy key alongside them", () => {
    const ring = parseKeyring({
      ENCRYPTION_KEY: "old",
      ENCRYPTION_KEYS: "k2:second,k3:third",
      ENCRYPTION_KEY_ACTIVE: "k3",
    })
    expect(ring.activeId).toBe("k3")
    expect(keyForId(ring, LEGACY_KEY_ID)).toBe("old")
    expect(keyForId(ring, "k2")).toBe("second")
    expect(keyForId(ring, "k3")).toBe("third")
  })

  it("keeps a secret that itself contains colons", () => {
    // Splitting on every colon would silently truncate a base64/URL-ish secret
    // to its first segment, and the corruption would only show up as a failed
    // decrypt much later.
    const ring = parseKeyring({ ENCRYPTION_KEYS: "k1:aa:bb::cc", ENCRYPTION_KEY_ACTIVE: "k1" })
    expect(keyForId(ring, "k1")).toBe("aa:bb::cc")
  })

  it("refuses an active id that is not in the ring", () => {
    // This is the dangerous misconfiguration: encrypting under a key nothing
    // holds writes rows that can never be read back.
    expect(() =>
      parseKeyring({ ENCRYPTION_KEY: "old", ENCRYPTION_KEY_ACTIVE: "k9" }),
    ).toThrow(KeyringError)
  })

  it("refuses a duplicate id with conflicting secrets", () => {
    expect(() => parseKeyring({ ENCRYPTION_KEYS: "k1:a,k1:b", ENCRYPTION_KEY_ACTIVE: "k1" })).toThrow(
      KeyringError,
    )
  })

  it("accepts a duplicate id that agrees with itself", () => {
    const ring = parseKeyring({ ENCRYPTION_KEYS: "k1:a,k1:a", ENCRYPTION_KEY_ACTIVE: "k1" })
    expect(keyForId(ring, "k1")).toBe("a")
  })

  it.each([
    ["malformed entry", { ENCRYPTION_KEYS: "no-colon-here" }],
    ["empty secret", { ENCRYPTION_KEYS: "k1:" }],
    ["empty id", { ENCRYPTION_KEYS: ":secret" }],
    ["id with illegal characters", { ENCRYPTION_KEYS: "bad id:secret" }],
    ["nothing configured at all", {}],
  ])("fails closed on %s", (_label, env) => {
    expect(() => parseKeyring(env)).toThrow(KeyringError)
  })

  it("never puts a secret in the error message", () => {
    // These messages reach logs.
    let message = ""
    try {
      parseKeyring({ ENCRYPTION_KEYS: "k1:hunter2", ENCRYPTION_KEY_ACTIVE: "missing" })
    } catch (err) {
      message = String(err)
    }
    expect(message).not.toContain("hunter2")
    expect(message).toContain("missing")
  })
})

describe("describeKeyring", () => {
  it("reports ids without ever reporting a secret", () => {
    const out = describeKeyring({ ENCRYPTION_KEY: "s3cret", ENCRYPTION_KEYS: "k2:other", ENCRYPTION_KEY_ACTIVE: "k2" })
    expect(out).toEqual({ ok: true, activeId: "k2", keyIds: [LEGACY_KEY_ID, "k2"] })
    expect(JSON.stringify(out)).not.toContain("s3cret")
    expect(JSON.stringify(out)).not.toContain("other")
  })

  it("reports a broken keyring instead of throwing", () => {
    // /api/health must answer even when the config is wrong — that is the case
    // it exists to surface.
    const out = describeKeyring({ ENCRYPTION_KEY: "a", ENCRYPTION_KEY_ACTIVE: "nope" })
    expect(out.ok).toBe(false)
    expect(out.error).toContain("nope")
  })
})
