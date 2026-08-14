import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto"
import { LEGACY_KEY_ID, keyForId, type Keyring } from "./keyring"

const ALG = "aes-256-gcm"
const IV_LEN = 12
const TAG_LEN = 16
const SALT_LEN = 16
const KEY_LEN = 32

/**
 * Ciphertext format.
 *
 * v1 (legacy, no prefix): base64(iv | tag | ciphertext), key = SHA-256(secret).
 * v2: "v2.<keyId>.<base64(salt | iv | tag | ciphertext)>", key = HKDF-SHA256(secret, salt).
 *
 * v2 exists to make the key ROTATABLE: the id travels with the ciphertext, so a
 * deployment holding several keys knows which one opens a given row, and new
 * writes can move to a new key while old rows still decrypt. v1 had no such
 * marker, which is why changing ENCRYPTION_KEY used to be a flag day.
 *
 * v1 is preserved exactly — the same unsalted derivation and the same layout —
 * because every credential already stored is in that format. Reading it is not
 * a compatibility nicety, it is the whole existing dataset.
 */
const V2_PREFIX = "v2"
const HKDF_INFO = "onecaptain:field-encryption:v2"

function deriveKeyV1(secret: string): Buffer {
  return createHash("sha256").update(secret).digest()
}

function deriveKeyV2(secret: string, salt: Buffer): Buffer {
  // Salted per ciphertext, so two rows holding the same plaintext under the same
  // key do not derive the same key material.
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), salt, HKDF_INFO, KEY_LEN))
}

/** Encrypt under a bare secret — v1 format. The signature every existing caller uses. */
export function encrypt(plaintext: string, secret: string): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALG, deriveKeyV1(secret), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")
}

/** Decrypt a bare-secret v1 ciphertext. */
export function decrypt(encrypted: string, secret: string): string {
  const buf = Buffer.from(encrypted, "base64")
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALG, deriveKeyV1(secret), iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final("utf8")
}

export class DecryptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DecryptError"
  }
}

/** Encrypt under the keyring's ACTIVE key, tagging the output with its id. */
export function encryptWithKeyring(plaintext: string, keyring: Keyring): string {
  const secret = keyForId(keyring, keyring.activeId)
  // parseKeyring guarantees this; if it ever fails, writing an unreadable row is
  // far worse than throwing.
  if (!secret) throw new DecryptError(`active key ${keyring.activeId} missing from keyring`)

  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALG, deriveKeyV2(secret, salt), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const body = Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]).toString("base64")
  return `${V2_PREFIX}.${keyring.activeId}.${body}`
}

/** Which key id produced this ciphertext. Unprefixed ciphertext is the legacy key's. */
export function keyIdOf(stored: string): string {
  const parts = stored.split(".")
  if (parts.length === 3 && parts[0] === V2_PREFIX) return parts[1]!
  return LEGACY_KEY_ID
}

/** True when this value was written under an older key and should be re-encrypted. */
export function needsRewrap(stored: string, keyring: Keyring): boolean {
  return keyIdOf(stored) !== keyring.activeId
}

/**
 * Decrypt against the keyring, in whichever format the value was written.
 *
 * Throws DecryptError when this deployment does not hold the named key — a
 * distinct, actionable failure ("we are missing key k1") rather than the generic
 * auth-tag failure that a wrong key would otherwise produce.
 */
export function decryptWithKeyring(stored: string, keyring: Keyring): string {
  const parts = stored.split(".")
  const isV2 = parts.length === 3 && parts[0] === V2_PREFIX

  if (!isV2) {
    const secret = keyForId(keyring, LEGACY_KEY_ID)
    if (!secret) {
      throw new DecryptError(`ciphertext needs the legacy key ${LEGACY_KEY_ID}, which is not in the keyring`)
    }
    return decrypt(stored, secret)
  }

  const keyId = parts[1]!
  const secret = keyForId(keyring, keyId)
  if (!secret) {
    throw new DecryptError(`ciphertext needs key ${keyId}, which is not in the keyring`)
  }

  const buf = Buffer.from(parts[2]!, "base64")
  const salt = buf.subarray(0, SALT_LEN)
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
  const ciphertext = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALG, deriveKeyV2(secret, salt), iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final("utf8")
}
