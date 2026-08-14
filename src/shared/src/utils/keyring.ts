/**
 * The set of encryption keys this deployment can decrypt with, and which one it
 * encrypts with.
 *
 * There used to be exactly one `ENCRYPTION_KEY`, and no ciphertext recorded
 * which key produced it. That made the key unrotatable: changing it would make
 * every stored provider key and mailbox password undecryptable at once, with no
 * incremental path. A keyring plus a key id inside each ciphertext is what turns
 * rotation into an ordinary operation.
 *
 * Config:
 *   ENCRYPTION_KEY         legacy single key. Still honored, as key id "v1".
 *   ENCRYPTION_KEYS        "id:secret,id:secret" — every key we can decrypt with.
 *   ENCRYPTION_KEY_ACTIVE  which id new writes use. Defaults to "v1".
 *
 * A deployment that sets only ENCRYPTION_KEY is unchanged: it gets a one-entry
 * keyring whose active id is "v1", writing the same v1 format it always did.
 */

/** The legacy key's id. Ciphertext with no version prefix is assumed to be its. */
export const LEGACY_KEY_ID = "v1"

const KEY_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/

export type Keyring = {
  /** id → secret, for decryption. Always contains `activeId`. */
  keys: ReadonlyMap<string, string>
  /** The id new ciphertext is written under. */
  activeId: string
}

export class KeyringError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KeyringError"
  }
}

export type KeyringEnv = {
  ENCRYPTION_KEY?: string
  ENCRYPTION_KEYS?: string
  ENCRYPTION_KEY_ACTIVE?: string
}

/**
 * Build the keyring from env, or throw.
 *
 * Throws rather than returning a partial keyring: a deployment whose key config
 * is wrong cannot decrypt tenant secrets, and finding that out at the first
 * decrypt — inside a request, one row at a time — is strictly worse than failing
 * where the misconfiguration is.
 *
 * Never put a secret in a thrown message; these reach logs.
 */
export function parseKeyring(env: KeyringEnv): Keyring {
  const keys = new Map<string, string>()

  const legacy = env.ENCRYPTION_KEY?.trim()
  if (legacy) keys.set(LEGACY_KEY_ID, legacy)

  const raw = env.ENCRYPTION_KEYS?.trim()
  if (raw) {
    for (const entry of raw.split(",")) {
      const trimmed = entry.trim()
      if (!trimmed) continue
      // Split on the FIRST colon only — a secret may itself contain colons.
      const idx = trimmed.indexOf(":")
      if (idx <= 0) {
        throw new KeyringError("ENCRYPTION_KEYS entries must be formatted id:secret")
      }
      const id = trimmed.slice(0, idx)
      const secret = trimmed.slice(idx + 1)
      if (!KEY_ID_RE.test(id)) {
        throw new KeyringError(
          `ENCRYPTION_KEYS key id ${JSON.stringify(id)} must match ${KEY_ID_RE.source}`,
        )
      }
      if (!secret) {
        throw new KeyringError(`ENCRYPTION_KEYS entry ${id} has an empty secret`)
      }
      // A duplicate id silently overriding its twin would make which key is used
      // depend on ordering, so refuse it.
      if (keys.has(id) && keys.get(id) !== secret) {
        throw new KeyringError(`ENCRYPTION_KEYS defines ${id} twice with different secrets`)
      }
      keys.set(id, secret)
    }
  }

  if (keys.size === 0) {
    throw new KeyringError("no encryption key configured — set ENCRYPTION_KEY or ENCRYPTION_KEYS")
  }

  const activeId = env.ENCRYPTION_KEY_ACTIVE?.trim() || LEGACY_KEY_ID
  if (!keys.has(activeId)) {
    // Encrypting under a key we cannot name is how you write rows nothing can
    // read. Refuse rather than fall back to some other key.
    throw new KeyringError(
      `ENCRYPTION_KEY_ACTIVE is ${activeId}, which is not in the keyring (have: ${[...keys.keys()].join(", ")})`,
    )
  }

  return { keys, activeId }
}

/** The secret for `id`, or undefined if this deployment does not hold that key. */
export function keyForId(keyring: Keyring, id: string): string | undefined {
  return keyring.keys.get(id)
}

/**
 * A description of the keyring safe to return from /api/health: ids only, never
 * secrets, never lengths.
 */
export function describeKeyring(env: KeyringEnv): { ok: boolean; activeId?: string; keyIds?: string[]; error?: string } {
  try {
    const ring = parseKeyring(env)
    return { ok: true, activeId: ring.activeId, keyIds: [...ring.keys.keys()] }
  } catch (err) {
    return { ok: false, error: err instanceof KeyringError ? err.message : "keyring unavailable" }
  }
}
