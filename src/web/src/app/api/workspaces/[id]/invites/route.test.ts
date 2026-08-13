import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockListActiveInvites = vi.fn();
const mockCreateInvite = vi.fn();
const mockGetWorkspace = vi.fn();
const mockSendEmail = vi.fn(async () => {});

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@onecaptain/shared", async () => {
  const real = await vi.importActual<typeof import("@onecaptain/shared")>("@onecaptain/shared");
  return {
    ...real,
    queries: {
      workspaceInvite: {
        listActiveInvites: (...args: unknown[]) => mockListActiveInvites(...args),
        createInvite: (...args: unknown[]) => mockCreateInvite(...args),
      },
      workspace: {
        getWorkspace: (...args: unknown[]) => mockGetWorkspace(...args),
      },
    },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  }),
}));

vi.mock("@/lib/middleware/helpers", async () =>
  await vi.importActual<typeof import("@/lib/middleware/helpers")>("@/lib/middleware/helpers")
);

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceOwner: vi.fn(async () => ({ workspaceId: "w1", memberRole: "owner" })),
  withWorkspaceRole: vi.fn(async () => ({ workspaceId: "w1", memberRole: "owner" })),
}));

vi.mock("@/lib/api/responses", async () =>
  await vi.importActual<typeof import("@/lib/api/responses")>("@/lib/api/responses")
);

vi.mock("@/lib/send-email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { GET, POST } from "./route";

const sampleInvite = {
  id: "inv1",
  token: "tok-abc",
  createdBy: "u1",
  usedBy: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: "2024-01-01T00:00:00Z",
};

describe("GET /api/workspaces/[id]/invites", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns list of active invites", async () => {
    mockListActiveInvites.mockResolvedValue([sampleInvite]);

    const req = new NextRequest("http://localhost/api/workspaces/w1/invites", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "w1" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("inv1");
    expect(body[0].token).toBe("tok-abc");
    expect(mockListActiveInvites).toHaveBeenCalledWith({}, "w1");
  });

  it("returns empty array when no active invites", async () => {
    mockListActiveInvites.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/workspaces/w1/invites", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "w1" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe("POST /api/workspaces/[id]/invites", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new invite and returns 201", async () => {
    mockCreateInvite.mockResolvedValue(sampleInvite);

    const req = new NextRequest("http://localhost/api/workspaces/w1/invites", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "w1" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("inv1");
    expect(body.token).toBe("tok-abc");
    expect(mockCreateInvite).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId: "w1", createdBy: "u1" })
    );
  });
});

describe("POST /api/workspaces/[id]/invites — email + role", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an admin-role email invite and delivers the link", async () => {
    mockCreateInvite.mockResolvedValue({ ...sampleInvite, email: "new@example.com", role: "admin" });
    mockGetWorkspace.mockResolvedValue({ id: "w1", name: "Acme", slug: "acme" });

    const req = new NextRequest("http://localhost/api/workspaces/w1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "New@Example.com", role: "admin" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "w1" }) } as never);
    expect(res.status).toBe(201);
    expect(mockCreateInvite).toHaveBeenCalledWith({}, expect.objectContaining({
      email: "new@example.com",
      role: "admin",
    }));
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [, mail] = mockSendEmail.mock.calls[0] as [unknown, { to: string; actionUrl: string }];
    expect(mail.to).toBe("new@example.com");
    expect(mail.actionUrl).toContain(`/invite/${sampleInvite.token}`);
  });

  it("rejects an owner-role invite", async () => {
    const req = new NextRequest("http://localhost/api/workspaces/w1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "x@example.com", role: "owner" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "w1" }) } as never);
    expect(res.status).toBe(400);
    expect(mockCreateInvite).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const req = new NextRequest("http://localhost/api/workspaces/w1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "w1" }) } as never);
    expect(res.status).toBe(400);
    expect(mockCreateInvite).not.toHaveBeenCalled();
  });

  it("bare POST still creates a shareable member link without email delivery", async () => {
    mockCreateInvite.mockResolvedValue(sampleInvite);
    const req = new NextRequest("http://localhost/api/workspaces/w1/invites", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "w1" }) } as never);
    expect(res.status).toBe(201);
    expect(mockCreateInvite).toHaveBeenCalledWith({}, expect.objectContaining({
      email: null,
      role: "member",
    }));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
