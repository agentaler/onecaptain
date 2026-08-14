import { describe, it, expect } from "vitest"
import { createCipheriv, createHash, randomBytes } from "node:crypto"
import {
  encrypt,
  decrypt,
  encryptWithKeyring,
  decryptWithKeyring,
  keyIdOf,
  needsRewrap,
  DecryptError,
} from "../../src/utils/crypto"
import { parseKeyring, LEGACY_KEY_ID } from "../../src/utils/keyring"

/**
 * A ciphertext built the way the ORIGINAL code built one, without going through
 * this module. If the v1 reader ever drifts, this fails — where re-encrypting
 * with the module under test would hide the drift by using the same bug twice.
 */
function legacyCiphertext(plaintext: string, secret: string): string {
  const key = createHash("sha256").update(secret).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")
}

describe("v1 compatibility — the existing dataset", () => {
  it("reads a ciphertext produced by the original implementation", () => {
    const stored = legacyCiphertext("sk-live-abc", "the-old-secret")
    const ring = parseKeyring({ ENCRYPTION_KEY: "the-old-secret" })
    expect(decryptWithKeyring(stored, ring)).toBe("sk-live-abc")
  })

  it("still round-trips through the bare-secret API every caller uses", () => {
    expect(decrypt(encrypt("value", "s"), "s")).toBe("value")
  })

  it("treats an unprefixed ciphertext as the legacy key's", () => {
    expect(keyIdOf(legacyCiphertext("x", "s"))).toBe(LEGACY_KEY_ID)
  })

  it("says so when the legacy key is no longer held", () => {
    // Distinct from a wrong-key auth-tag failure: this one is actionable.
    const ring = parseKeyring({ ENCRYPTION_KEYS: "k2:second", ENCRYPTION_KEY_ACTIVE: "k2" })
    expect(() => decryptWithKeyring(legacyCiphertext("x", "old"), ring)).toThrow(DecryptError)
  })
})

describe("v2 — self-describing ciphertext", () => {
  const ring = parseKeyring({ ENCRYPTION_KEYS: "k1:first,k2:second", ENCRYPTION_KEY_ACTIVE: "k2" })

  it("round-trips and names the key that produced it", () => {
    const out = encryptWithKeyring("sk-live-xyz", ring)
    expect(out.startsWith("v2.k2.")).toBe(true)
    expect(keyIdOf(out)).toBe("k2")
    expect(decryptWithKeyring(out, ring)).toBe("sk-live-xyz")
  })

  it("refuses a ciphertext whose key this deployment does not hold", () => {
    const other = parseKeyring({ ENCRYPTION_KEYS: "k9:ninth", ENCRYPTION_KEY_ACTIVE: "k9" })
    const stored = encryptWithKeyring("secret", ring)
    expect(() => decryptWithKeyring(stored, other)).toThrow(DecryptError)
  })

  it("fails the auth tag when a byte is flipped, rather than returning garbage", () => {
    const stored = encryptWithKeyring("secret", ring)
    const [, id, body] = stored.split(".")
    const buf = Buffer.from(body!, "base64")
    buf[buf.length - 1] ^= 0xff
    expect(() => decryptWithKeyring(`v2.${id}.${buf.toString("base64")}`, ring)).toThrow()
  })

  it("uses a fresh salt per ciphertext", () => {
    // Assert on the SALT BYTES, not on the strings differing: the random IV
    // alone makes two outputs differ, so a whole-string comparison passes even
    // with a hard-coded salt. (It did.)
    const saltOf = (stored: string) => Buffer.from(stored.split(".")[2]!, "base64").subarray(0, 16).toString("hex")
    const a = saltOf(encryptWithKeyring("same", ring))
    const b = saltOf(encryptWithKeyring("same", ring))
    expect(a).not.toBe(b)
    expect(a).not.toBe("00".repeat(16))
  })
})

describe("rotation", () => {
  it("keeps old rows readable while new writes move to the new key", () => {
    // The property the whole change exists for.
    const before = parseKeyring({ ENCRYPTION_KEYS: "k1:first", ENCRYPTION_KEY_ACTIVE: "k1" })
    const stored = encryptWithKeyring("sk-live-rotate", before)

    const after = parseKeyring({ ENCRYPTION_KEYS: "k1:first,k2:second", ENCRYPTION_KEY_ACTIVE: "k2" })
    expect(decryptWithKeyring(stored, after)).toBe("sk-live-rotate")

    const rewrapped = encryptWithKeyring(decryptWithKeyring(stored, after), after)
    expect(keyIdOf(rewrapped)).toBe("k2")
    expect(decryptWithKeyring(rewrapped, after)).toBe("sk-live-rotate")
  })

  it("flags a value written under a non-active key, and stops flagging it once rewrapped", () => {
    const ring = parseKeyring({ ENCRYPTION_KEY: "old", ENCRYPTION_KEYS: "k2:new", ENCRYPTION_KEY_ACTIVE: "k2" })
    const legacy = legacyCiphertext("v", "old")
    expect(needsRewrap(legacy, ring)).toBe(true)
    expect(needsRewrap(encryptWithKeyring("v", ring), ring)).toBe(false)
  })

  it("a legacy row still opens after the ring gains a new active key", () => {
    // The realistic first rotation: everything on disk is v1.
    const stored = legacyCiphertext("sk-live-legacy", "old")
    const ring = parseKeyring({ ENCRYPTION_KEY: "old", ENCRYPTION_KEYS: "k2:new", ENCRYPTION_KEY_ACTIVE: "k2" })
    expect(decryptWithKeyring(stored, ring)).toBe("sk-live-legacy")
  })
})
