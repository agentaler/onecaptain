import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { agentUsageEvent, workspaceProviderCredential } from "../schema";
import type { Database } from "../index";

/**
 * Workspace-level cloud LLM credentials and the usage ledger they produce.
 *
 * Two rules this module exists to enforce, so no caller can get them wrong:
 *
 * 1. A stored key leaves here ONLY through `getCredentialSecret`, which every
 *    caller must treat as decrypt-and-use. Everything a route can return to a
 *    browser goes through `listCredentials`, which projects `last4` and never
 *    selects the ciphertext column at all.
 * 2. Every read is scoped by workspaceId in its WHERE clause — never fetched
 *    and then checked — so a caller cannot accidentally read another tenant's
 *    key or usage.
 */

export type ProviderCredentialInput = {
  workspaceId: string;
  kind: string;
  apiUrl?: string | null;
  /** Ciphertext. Callers encrypt before calling; this module never sees plaintext. */
  apiKeyEnc: string;
  /** Last 4 characters of the PLAINTEXT key, for display only. */
  last4: string;
  createdBy?: string | null;
};

/** Safe projection — the ciphertext column is not selected. */
export async function listCredentials(db: Database, workspaceId: string) {
  return db
    .select({
      id: workspaceProviderCredential.id,
      kind: workspaceProviderCredential.kind,
      apiUrl: workspaceProviderCredential.apiUrl,
      last4: workspaceProviderCredential.last4,
      createdAt: workspaceProviderCredential.createdAt,
      updatedAt: workspaceProviderCredential.updatedAt,
    })
    .from(workspaceProviderCredential)
    .where(eq(workspaceProviderCredential.workspaceId, workspaceId))
    .orderBy(workspaceProviderCredential.kind);
}

/**
 * The one path that yields ciphertext. Named so a reviewer can grep for every
 * place a key is decrypted, and so returning this from a route reads as the
 * mistake it would be.
 */
export async function getCredentialSecret(db: Database, workspaceId: string, kind: string) {
  const rows = await db
    .select({
      kind: workspaceProviderCredential.kind,
      apiUrl: workspaceProviderCredential.apiUrl,
      apiKeyEnc: workspaceProviderCredential.apiKeyEnc,
    })
    .from(workspaceProviderCredential)
    .where(
      and(
        eq(workspaceProviderCredential.workspaceId, workspaceId),
        eq(workspaceProviderCredential.kind, kind),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Set-or-replace, keyed by (workspace, kind). Re-submitting a provider swaps
 * the key in place rather than leaving two rows a user cannot tell apart —
 * the unique index makes that the only possible outcome.
 */
export async function upsertCredential(db: Database, input: ProviderCredentialInput) {
  const now = new Date().toISOString();
  await db
    .insert(workspaceProviderCredential)
    .values({
      workspaceId: input.workspaceId,
      kind: input.kind,
      apiUrl: input.apiUrl ?? null,
      apiKeyEnc: input.apiKeyEnc,
      last4: input.last4,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [workspaceProviderCredential.workspaceId, workspaceProviderCredential.kind],
      set: {
        apiUrl: input.apiUrl ?? null,
        apiKeyEnc: input.apiKeyEnc,
        last4: input.last4,
        updatedAt: now,
      },
    });
}

export async function deleteCredential(db: Database, workspaceId: string, kind: string) {
  await db
    .delete(workspaceProviderCredential)
    .where(
      and(
        eq(workspaceProviderCredential.workspaceId, workspaceId),
        eq(workspaceProviderCredential.kind, kind),
      ),
    );
}

export type UsageEventInput = {
  workspaceId: string;
  agentUserId?: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  /** false for a call paid by the workspace's own key — metered, never invoiced. */
  billable: boolean;
};

/** Append one call to the ledger. The ledger is never updated, only appended. */
export async function recordUsage(db: Database, event: UsageEventInput) {
  await db.insert(agentUsageEvent).values({
    workspaceId: event.workspaceId,
    agentUserId: event.agentUserId ?? null,
    provider: event.provider,
    model: event.model,
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    costMicros: event.costMicros,
    billable: event.billable,
  });
}

/**
 * The billing rollup: what this workspace owes for a period, and what it spent
 * on its own key. `billableCostMicros` is the only figure an invoice may use;
 * `costMicros` is the total including BYO-key calls, for display.
 *
 * `to` is exclusive so adjacent periods can't double-count an event landing
 * exactly on the boundary.
 */
export async function summarizeUsage(
  db: Database,
  workspaceId: string,
  from: string,
  to: string,
) {
  const rows = await db
    .select({
      inputTokens: sql<number>`coalesce(sum(${agentUsageEvent.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${agentUsageEvent.outputTokens}), 0)`,
      costMicros: sql<number>`coalesce(sum(${agentUsageEvent.costMicros}), 0)`,
      billableCostMicros: sql<number>`coalesce(sum(case when ${agentUsageEvent.billable} then ${agentUsageEvent.costMicros} else 0 end), 0)`,
      calls: sql<number>`count(*)`,
    })
    .from(agentUsageEvent)
    .where(
      and(
        eq(agentUsageEvent.workspaceId, workspaceId),
        gte(agentUsageEvent.createdAt, from),
        lt(agentUsageEvent.createdAt, to),
      ),
    );
  return rows[0] ?? {
    inputTokens: 0,
    outputTokens: 0,
    costMicros: 0,
    billableCostMicros: 0,
    calls: 0,
  };
}

export async function listRecentUsage(db: Database, workspaceId: string, limit = 50) {
  return db
    .select()
    .from(agentUsageEvent)
    .where(eq(agentUsageEvent.workspaceId, workspaceId))
    .orderBy(desc(agentUsageEvent.createdAt))
    .limit(limit);
}
