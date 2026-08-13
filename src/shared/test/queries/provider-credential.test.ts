import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createNodeClient, createNodeDb, applyMigrations } from "../../src/db/node";
import type { Database } from "../../src/db";
import {
  deleteCredential,
  getCredentialSecret,
  listCredentials,
  listRecentUsage,
  recordUsage,
  summarizeUsage,
  upsertCredential,
} from "../../src/db/queries/provider-credential";
import { workspace } from "../../src/db/schema";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../web/migrations");

let db: Database;
let wsId: string;
let otherWsId: string;

beforeAll(async () => {
  const client = createNodeClient(":memory:");
  await applyMigrations(client, MIGRATIONS_DIR);
  db = createNodeDb(client);
  const [ws] = await db
    .insert(workspace)
    .values({ name: "Cloud Co", slug: "cloud-co" })
    .returning();
  wsId = ws.id;
  const [other] = await db
    .insert(workspace)
    .values({ name: "Rival Co", slug: "rival-co" })
    .returning();
  otherWsId = other.id;
}, 120_000);

describe("workspace provider credentials", () => {
  it("stores a key and never returns the ciphertext from the listing", async () => {
    await upsertCredential(db, {
      workspaceId: wsId,
      kind: "openrouter",
      apiKeyEnc: "ciphertext-openrouter",
      last4: "cd12",
    });
    const rows = await listCredentials(db, wsId);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("openrouter");
    expect(rows[0].last4).toBe("cd12");
    // The whole point of the projection: no column here can carry the key.
    expect(JSON.stringify(rows)).not.toContain("ciphertext-openrouter");
  });

  it("yields the ciphertext only through getCredentialSecret", async () => {
    const secret = await getCredentialSecret(db, wsId, "openrouter");
    expect(secret?.apiKeyEnc).toBe("ciphertext-openrouter");
  });

  it("replaces the key in place when the same provider is set again", async () => {
    await upsertCredential(db, {
      workspaceId: wsId,
      kind: "openrouter",
      apiKeyEnc: "ciphertext-rotated",
      last4: "ef34",
    });
    const rows = await listCredentials(db, wsId);
    expect(rows).toHaveLength(1);
    expect(rows[0].last4).toBe("ef34");
    const secret = await getCredentialSecret(db, wsId, "openrouter");
    expect(secret?.apiKeyEnc).toBe("ciphertext-rotated");
  });

  it("keeps different providers side by side", async () => {
    await upsertCredential(db, {
      workspaceId: wsId,
      kind: "anthropic",
      apiKeyEnc: "ciphertext-anthropic",
      last4: "ab99",
    });
    const kinds = (await listCredentials(db, wsId)).map((r) => r.kind);
    expect(kinds).toEqual(["anthropic", "openrouter"]);
  });

  it("never leaks another workspace's credential", async () => {
    await upsertCredential(db, {
      workspaceId: otherWsId,
      kind: "openai",
      apiKeyEnc: "ciphertext-rival",
      last4: "zz00",
    });
    expect(await listCredentials(db, wsId)).toHaveLength(2);
    expect(await getCredentialSecret(db, wsId, "openai")).toBeNull();
  });

  it("deletes only the named provider", async () => {
    await deleteCredential(db, wsId, "anthropic");
    expect((await listCredentials(db, wsId)).map((r) => r.kind)).toEqual(["openrouter"]);
  });
});

describe("usage ledger", () => {
  const JAN = "2026-01-15T00:00:00.000Z";
  const FEB = "2026-02-15T00:00:00.000Z";

  beforeAll(async () => {
    await db.insert((await import("../../src/db/schema")).agentUsageEvent).values([
      { workspaceId: wsId, provider: "openrouter", model: "m", inputTokens: 100, outputTokens: 50, costMicros: 1500, billable: true, createdAt: JAN },
      { workspaceId: wsId, provider: "openrouter", model: "m", inputTokens: 200, outputTokens: 80, costMicros: 2500, billable: true, createdAt: JAN },
      // Paid by the workspace's own key — metered, must never be invoiced.
      { workspaceId: wsId, provider: "anthropic", model: "m", inputTokens: 10, outputTokens: 5, costMicros: 9999, billable: false, createdAt: JAN },
      // Next period, and another tenant: neither may reach this rollup.
      { workspaceId: wsId, provider: "openrouter", model: "m", inputTokens: 1, outputTokens: 1, costMicros: 7777, billable: true, createdAt: FEB },
      { workspaceId: otherWsId, provider: "openrouter", model: "m", inputTokens: 1, outputTokens: 1, costMicros: 8888, billable: true, createdAt: JAN },
    ]);
  });

  it("sums a period for one workspace only", async () => {
    const s = await summarizeUsage(db, wsId, "2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z");
    expect(s.calls).toBe(3);
    expect(s.inputTokens).toBe(310);
    expect(s.outputTokens).toBe(135);
  });

  it("bills only the billable calls, but reports total spend", async () => {
    const s = await summarizeUsage(db, wsId, "2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z");
    expect(s.billableCostMicros).toBe(4000);
    expect(s.costMicros).toBe(13999);
  });

  it("treats the period end as exclusive so adjacent periods cannot double-count", async () => {
    const jan = await summarizeUsage(db, wsId, "2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z");
    const feb = await summarizeUsage(db, wsId, "2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z");
    expect(jan.calls + feb.calls).toBe(4);
    expect(feb.billableCostMicros).toBe(7777);
  });

  it("returns zeros rather than undefined for an empty period", async () => {
    const s = await summarizeUsage(db, wsId, "2030-01-01T00:00:00.000Z", "2030-02-01T00:00:00.000Z");
    expect(s).toMatchObject({ calls: 0, costMicros: 0, billableCostMicros: 0 });
  });

  it("appends through recordUsage and lists newest first", async () => {
    await recordUsage(db, {
      workspaceId: wsId,
      provider: "openai",
      model: "gpt-x",
      inputTokens: 7,
      outputTokens: 3,
      costMicros: 42,
      billable: true,
    });
    const recent = await listRecentUsage(db, wsId, 1);
    expect(recent[0].provider).toBe("openai");
    expect(recent[0].costMicros).toBe(42);
  });

  it("scopes recent usage to the workspace", async () => {
    const rows = await listRecentUsage(db, otherWsId, 50);
    expect(rows).toHaveLength(1);
    expect(rows[0].costMicros).toBe(8888);
  });
});
