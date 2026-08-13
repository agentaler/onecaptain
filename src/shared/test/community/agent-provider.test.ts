import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createNodeClient, createNodeDb, applyMigrations } from "../../src/db/node";
import type { Database } from "../../src/db";
import { workspace } from "../../src/db/schema";
import { upsertCredential } from "../../src/db/queries/provider-credential";
import { encrypt } from "../../src/utils/crypto";
import { resolveAgentProvider } from "../../src/community/agent-provider";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../web/migrations");
const SECRET = "test-encryption-secret";

let db: Database;
let wsId: string;
let otherWsId: string;

const noBotKey = { providerKind: null, providerApiUrl: null, providerApiKeyEnc: null };

beforeAll(async () => {
  const client = createNodeClient(":memory:");
  await applyMigrations(client, MIGRATIONS_DIR);
  db = createNodeDb(client);

  const [ws] = await db.insert(workspace).values({ name: "Acme", slug: "acme" }).returning();
  wsId = ws.id;
  const [other] = await db.insert(workspace).values({ name: "Rival", slug: "rival" }).returning();
  otherWsId = other.id;

  await upsertCredential(db, {
    workspaceId: wsId,
    kind: "anthropic",
    apiKeyEnc: encrypt("sk-ant-workspace", SECRET),
    last4: "pace",
  });
});

describe("resolveAgentProvider", () => {
  it("prefers the agent's own key over the workspace one", async () => {
    // An agent pinned to a provider must keep using it after the workspace
    // adds a different key — otherwise adding a workspace key silently
    // repoints every already-configured agent.
    const result = await resolveAgentProvider(
      db,
      {
        workspaceId: wsId,
        providerKind: "openai",
        providerApiUrl: null,
        providerApiKeyEnc: encrypt("sk-oai-bot", SECRET),
      },
      { ENCRYPTION_KEY: SECRET },
    );

    expect(result).toMatchObject({ state: "ready", source: "bot", kind: "openai", billable: false });
    expect(result.state === "ready" && result.config).toEqual({
      kind: "cloud",
      providerId: "openai",
      apiKey: "sk-oai-bot",
      apiUrl: undefined,
    });
  });

  it("falls back to the workspace key when the agent has none", async () => {
    const result = await resolveAgentProvider(
      db,
      { workspaceId: wsId, ...noBotKey },
      { ENCRYPTION_KEY: SECRET },
    );
    expect(result).toMatchObject({ state: "ready", source: "workspace", kind: "anthropic", billable: false });
    expect(result.state === "ready" && result.config).toMatchObject({ apiKey: "sk-ant-workspace" });
  });

  it("never reaches another workspace's credential", async () => {
    // Scope-first: the lookup is keyed on this agent's workspace, so the
    // neighbouring key is not merely filtered out afterwards — it is never read.
    const result = await resolveAgentProvider(
      db,
      { workspaceId: otherWsId, ...noBotKey },
      { ENCRYPTION_KEY: SECRET },
    );
    expect(result.state).toBe("no_credential");
  });

  it("has no workspace fallback for an agent with no workspace", async () => {
    const result = await resolveAgentProvider(
      db,
      { workspaceId: null, ...noBotKey },
      { ENCRYPTION_KEY: SECRET },
    );
    expect(result.state).toBe("no_credential");
  });

  it("marks a platform-key call billable and a user-key call not", async () => {
    const platform = await resolveAgentProvider(
      db,
      { workspaceId: otherWsId, ...noBotKey },
      {
        ENCRYPTION_KEY: SECRET,
        PLATFORM_PROVIDER_KIND: "anthropic",
        PLATFORM_PROVIDER_API_KEY: "sk-ant-platform",
      },
    );
    expect(platform).toMatchObject({ state: "ready", source: "platform", billable: true });

    const workspaceKey = await resolveAgentProvider(
      db,
      { workspaceId: wsId, ...noBotKey },
      {
        ENCRYPTION_KEY: SECRET,
        PLATFORM_PROVIDER_KIND: "anthropic",
        PLATFORM_PROVIDER_API_KEY: "sk-ant-platform",
      },
    );
    // The workspace's own key wins, and crucially it stays non-billable —
    // metered for the user's own visibility, never invoiced.
    expect(workspaceKey).toMatchObject({ source: "workspace", billable: false });
  });

  it("reports no credential rather than throwing when nothing is configured", async () => {
    const result = await resolveAgentProvider(db, { workspaceId: otherWsId, ...noBotKey }, {});
    expect(result.state).toBe("no_credential");
  });

  it("falls through to the workspace key when the agent's stored key cannot be decrypted", async () => {
    // A corrupt or wrong-secret key must not take the agent down while a
    // usable workspace key exists.
    const result = await resolveAgentProvider(
      db,
      {
        workspaceId: wsId,
        providerKind: "anthropic",
        providerApiUrl: null,
        providerApiKeyEnc: "not-valid-ciphertext",
      },
      { ENCRYPTION_KEY: SECRET },
    );
    expect(result).toMatchObject({ state: "ready", source: "workspace" });
  });

  it("cannot use any stored key without the decryption secret", async () => {
    const result = await resolveAgentProvider(db, { workspaceId: wsId, ...noBotKey }, {});
    expect(result.state).toBe("no_credential");
  });
});
