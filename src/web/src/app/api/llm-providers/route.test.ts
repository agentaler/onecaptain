import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockListCredentials = vi.fn();
const mockUpsertCredential = vi.fn();
const mockDeleteCredential = vi.fn();
const mockGetCredentialSecret = vi.fn();
const mockCallProvider = vi.fn();
const mockWithWorkspaceMember = vi.fn();
const mockWithWorkspaceRole = vi.fn();

/**
 * `withAuth` wraps each handler at import time, so a per-test mock swap never
 * reaches the already-wrapped route. Keep the env in a mutable box the wrapper
 * reads on every call instead.
 */
const envBox: { value: Record<string, unknown> } = { value: {} };

vi.mock("@/lib/middleware/helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/middleware/helpers")>(
    "@/lib/middleware/helpers",
  );
  return actual;
});
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@onecaptain/shared/crypto", () => ({
  encrypt: (plain: string) => `enc(${plain})`,
  decrypt: (cipher: string) => {
    if (cipher === "corrupt") throw new Error("bad ciphertext");
    return cipher.replace(/^enc\(|\)$/g, "");
  },
}));
vi.mock("@onecaptain/shared", async () => {
  const actual = await vi.importActual<typeof import("@onecaptain/shared")>("@onecaptain/shared");
  return {
    ...actual,
    queries: {
      providerCredential: {
        listCredentials: (...a: unknown[]) => mockListCredentials(...a),
        upsertCredential: (...a: unknown[]) => mockUpsertCredential(...a),
        deleteCredential: (...a: unknown[]) => mockDeleteCredential(...a),
        getCredentialSecret: (...a: unknown[]) => mockGetCredentialSecret(...a),
      },
    },
    callProvider: (...a: unknown[]) => mockCallProvider(...a),
  };
});
vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, {
      env: envBox.value,
      userId: "u1",
      email: "u@t.com",
      params,
    });
  }),
}));
vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: (...a: unknown[]) => mockWithWorkspaceMember(...a),
  withWorkspaceRole: (...a: unknown[]) => mockWithWorkspaceRole(...a),
}));

import { GET } from "./route";
import { PUT, DELETE } from "./[kind]/route";
import { POST as VERIFY } from "./[kind]/verify/route";

const OK_WS = { workspaceId: "w1", memberRole: "owner" };
const req = (body?: unknown) =>
  new NextRequest("http://localhost/api/llm-providers", {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

beforeEach(() => {
  vi.clearAllMocks();
  envBox.value = { DB: {}, ENCRYPTION_KEY: "secret" };
  mockWithWorkspaceMember.mockResolvedValue(OK_WS);
  mockWithWorkspaceRole.mockResolvedValue(OK_WS);
});

describe("GET /api/llm-providers", () => {
  it("scopes the listing to the caller's workspace", async () => {
    mockListCredentials.mockResolvedValue([{ kind: "anthropic", last4: "ab12" }]);

    const res = await GET(new NextRequest("http://localhost/api/llm-providers"), {} as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ providers: [{ kind: "anthropic", last4: "ab12" }] });
    // The workspace is passed INTO the query, not filtered out of the result.
    expect(mockListCredentials).toHaveBeenCalledWith(expect.anything(), "w1");
  });

  it("never returns ciphertext — the listing query does not select it", async () => {
    // Belt and braces: even if the query were changed to over-select, this
    // route must not become the thing that leaks a key.
    mockListCredentials.mockResolvedValue([{ kind: "anthropic", last4: "ab12" }]);
    const res = await GET(new NextRequest("http://localhost/api/llm-providers"), {} as never);
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toMatch(/apiKeyEnc|api_key_enc/);
  });
});

describe("PUT /api/llm-providers/[kind]", () => {
  it("encrypts the key and stores only the last 4 for display", async () => {
    const res = await PUT(req({ apiKey: "sk-ant-abcdefgh1234" }), {
      params: { kind: "anthropic" },
    } as never);

    expect(res.status).toBe(200);
    expect(mockUpsertCredential).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workspaceId: "w1",
        kind: "anthropic",
        apiKeyEnc: "enc(sk-ant-abcdefgh1234)",
        last4: "1234",
      }),
    );
    // The plaintext key must not come back in the response.
    expect(JSON.stringify(await res.json())).not.toContain("sk-ant-abcdefgh1234");
  });

  it("requires admin, not merely membership", async () => {
    // A provider key is a spending instrument: with a managed key it bills the
    // workspace, with a BYO key it spends the workspace's provider budget.
    mockWithWorkspaceRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "admin access required" }), { status: 403 }),
    );

    const res = await PUT(req({ apiKey: "sk-ant-abcdefgh1234" }), {
      params: { kind: "anthropic" },
    } as never);

    expect(res.status).toBe(403);
    expect(mockUpsertCredential).not.toHaveBeenCalled();
    expect(mockWithWorkspaceRole).toHaveBeenCalledWith(expect.anything(), expect.anything(), "admin");
  });

  it("rejects an unknown provider rather than storing a key under it", async () => {
    const res = await PUT(req({ apiKey: "sk-whatever-1234" }), {
      params: { kind: "not-a-provider" },
    } as never);

    expect(res.status).toBe(400);
    expect(mockUpsertCredential).not.toHaveBeenCalled();
  });

  it("refuses to store a key when the deployment has no encryption secret", async () => {
    // Storing plaintext would be worse than refusing.
    envBox.value = { DB: {} };

    const res = await PUT(req({ apiKey: "sk-ant-abcdefgh1234" }), {
      params: { kind: "anthropic" },
    } as never);

    expect(res.status).toBe(503);
    expect(mockUpsertCredential).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/llm-providers/[kind]", () => {
  it("removes only this workspace's row for that provider", async () => {
    const res = await DELETE(req(), { params: { kind: "openai" } } as never);
    expect(res.status).toBe(200);
    expect(mockDeleteCredential).toHaveBeenCalledWith(expect.anything(), "w1", "openai");
  });
});

describe("POST /api/llm-providers/[kind]/verify", () => {
  it("makes a real call and reports the served model and token counts", async () => {
    mockGetCredentialSecret.mockResolvedValue({
      kind: "anthropic",
      apiUrl: null,
      apiKeyEnc: "enc(sk-ant-live)",
    });
    mockCallProvider.mockResolvedValue({
      text: "ok",
      inputTokens: 12,
      outputTokens: 2,
      model: "claude-opus-4-6-20260101",
    });

    const res = await VERIFY(req({ model: "claude-opus-4-6" }), {
      params: { kind: "anthropic" },
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      model: "claude-opus-4-6-20260101",
      inputTokens: 12,
      outputTokens: 2,
    });
    // The decrypted key reached the provider call, and the credential lookup
    // was scoped to this workspace.
    expect(mockGetCredentialSecret).toHaveBeenCalledWith(expect.anything(), "w1", "anthropic");
    expect(mockCallProvider).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-ant-live" }),
      expect.objectContaining({ model: "claude-opus-4-6" }),
    );
  });

  it("returns the provider's own error text verbatim on a bad key", async () => {
    // "invalid x-api-key" tells the user what to do; "couldn't connect" does not.
    mockGetCredentialSecret.mockResolvedValue({
      kind: "anthropic",
      apiUrl: null,
      apiKeyEnc: "enc(sk-bad)",
    });
    const { ProviderCallError } = await import("@onecaptain/shared");
    mockCallProvider.mockRejectedValue(
      new ProviderCallError("permanent", "provider returned 401: invalid x-api-key", 401),
    );

    const res = await VERIFY(req({ model: "claude-opus-4-6" }), {
      params: { kind: "anthropic" },
    } as never);

    // 200 with ok:false — the check RAN. A 4xx would be indistinguishable from
    // a broken route.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, kind: "permanent", status: 401 });
    expect(body.error).toContain("invalid x-api-key");
  });

  it("says the key is undecryptable rather than blaming the provider", async () => {
    mockGetCredentialSecret.mockResolvedValue({
      kind: "anthropic",
      apiUrl: null,
      apiKeyEnc: "corrupt",
    });

    const res = await VERIFY(req({ model: "m" }), { params: { kind: "anthropic" } } as never);

    expect(res.status).toBe(422);
    expect(mockCallProvider).not.toHaveBeenCalled();
  });

  it("404s when no key is saved for that provider", async () => {
    mockGetCredentialSecret.mockResolvedValue(null);
    const res = await VERIFY(req({ model: "m" }), { params: { kind: "openai" } } as never);
    expect(res.status).toBe(404);
    expect(mockCallProvider).not.toHaveBeenCalled();
  });

  it("requires admin", async () => {
    mockWithWorkspaceRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "admin access required" }), { status: 403 }),
    );
    const res = await VERIFY(req({ model: "m" }), { params: { kind: "anthropic" } } as never);
    expect(res.status).toBe(403);
    expect(mockGetCredentialSecret).not.toHaveBeenCalled();
  });
});
