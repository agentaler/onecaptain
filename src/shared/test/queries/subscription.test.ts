import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createNodeClient, createNodeDb, applyMigrations } from "../../src/db/node";
import type { Database } from "../../src/db";
import { getSubscription, syncSubscription } from "../../src/db/queries/subscription";
import { workspace } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../web/migrations");

let db: Database;
let wsId: string;

beforeAll(async () => {
  const client = createNodeClient(":memory:");
  await applyMigrations(client, MIGRATIONS_DIR);
  db = createNodeDb(client);
  const [ws] = await db
    .insert(workspace)
    .values({ name: "Billing Co", slug: "billing-co" })
    .returning();
  wsId = ws.id;
}, 120_000);

async function planOf(id: string): Promise<string> {
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, id));
  return ws.plan;
}

describe("syncSubscription", () => {
  it("creates the row and flips workspace.plan on subscription.created", async () => {
    await syncSubscription(db, {
      workspaceId: wsId,
      polarSubscriptionId: "polar_sub_1",
      polarCustomerId: "polar_cus_1",
      productId: "prod_pro_monthly",
      plan: "pro",
      status: "active",
      currentPeriodEnd: "2026-09-11T00:00:00.000Z",
    });
    const sub = await getSubscription(db, wsId);
    expect(sub?.status).toBe("active");
    expect(sub?.plan).toBe("pro");
    expect(await planOf(wsId)).toBe("pro");
  });

  it("is idempotent — replaying the same event changes nothing material", async () => {
    await syncSubscription(db, {
      workspaceId: wsId,
      polarSubscriptionId: "polar_sub_1",
      polarCustomerId: "polar_cus_1",
      productId: "prod_pro_monthly",
      plan: "pro",
      status: "active",
      currentPeriodEnd: "2026-09-11T00:00:00.000Z",
    });
    const sub = await getSubscription(db, wsId);
    expect(sub?.plan).toBe("pro");
    expect(sub?.status).toBe("active");
    expect(await planOf(wsId)).toBe("pro");
  });

  it("updates in place on subscription.updated (still one row per workspace)", async () => {
    await syncSubscription(db, {
      workspaceId: wsId,
      polarSubscriptionId: "polar_sub_1",
      productId: "prod_pro_yearly",
      plan: "pro",
      status: "active",
      currentPeriodEnd: "2027-08-11T00:00:00.000Z",
      cancelAtPeriodEnd: true,
    });
    const sub = await getSubscription(db, wsId);
    expect(sub?.productId).toBe("prod_pro_yearly");
    expect(sub?.cancelAtPeriodEnd).toBe(true);
  });

  it("drops the workspace back to free on revocation", async () => {
    await syncSubscription(db, {
      workspaceId: wsId,
      polarSubscriptionId: "polar_sub_1",
      plan: "free",
      status: "revoked",
    });
    const sub = await getSubscription(db, wsId);
    expect(sub?.status).toBe("revoked");
    expect(await planOf(wsId)).toBe("free");
  });

  it("ignores non-active events for a superseded subscription generation", async () => {
    // New subscription activates…
    await syncSubscription(db, {
      workspaceId: wsId,
      polarSubscriptionId: "polar_sub_2",
      productId: "prod_pro_monthly",
      plan: "pro",
      status: "active",
    });
    // …then a late-arriving cancellation for the OLD subscription must not
    // clobber the live one.
    await syncSubscription(db, {
      workspaceId: wsId,
      polarSubscriptionId: "polar_sub_1",
      plan: "free",
      status: "canceled",
    });
    const sub = await getSubscription(db, wsId);
    expect(sub?.polarSubscriptionId).toBe("polar_sub_2");
    expect(sub?.status).toBe("active");
    expect(await planOf(wsId)).toBe("pro");
  });
});
