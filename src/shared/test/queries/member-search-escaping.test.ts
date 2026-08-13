import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createNodeClient, createNodeDb, applyMigrations } from "../../src/db/node";
import type { Database } from "../../src/db";
import { searchMembers } from "../../src/db/queries/community/member";
import { user } from "../../src/db/schema";
import { communityServer, communityServerMember } from "../../src/db/community-schema";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../web/migrations");
const SERVER_ID = "srv_escape";

let db: Database;

beforeAll(async () => {
  const client = createNodeClient(":memory:");
  await applyMigrations(client, MIGRATIONS_DIR);
  db = createNodeDb(client);

  const [owner] = await db
    .insert(user)
    .values({ id: "u_owner", email: "owner@example.com", name: "Owner" })
    .returning();
  await db
    .insert(communityServer)
    .values({ id: SERVER_ID, name: "Escape Test", ownerId: owner.id });

  // Names chosen to exercise every LIKE metacharacter plus a plain control.
  const members = [
    { id: "u_pct", name: "50% off" },
    { id: "u_under", name: "snake_case" },
    { id: "u_slash", name: "back\\slash" },
    { id: "u_plain", name: "Plain Jane" },
  ];
  for (const m of members) {
    await db.insert(user).values({ id: m.id, email: `${m.id}@example.com`, name: m.name });
    await db.insert(communityServerMember).values({ serverId: SERVER_ID, userId: m.id });
  }
});

async function names(q: string): Promise<string[]> {
  const rows = await searchMembers(db, SERVER_ID, q);
  return rows.map((r) => (r as { userName: string | null }).userName ?? "").sort();
}

describe("searchMembers LIKE escaping", () => {
  it("treats % in the query as a literal, not a match-everything wildcard", async () => {
    // Without an ESCAPE clause the escaped pattern was inert: this search
    // returned nothing, while an unescaped one would have matched every member.
    expect(await names("50%")).toEqual(["50% off"]);
  });

  it("treats _ in the query as a literal, not a single-character wildcard", async () => {
    expect(await names("snake_")).toEqual(["snake_case"]);
    // "snakeXcase" would match if _ were still a wildcard — nothing else does.
    expect(await names("snake_c")).toEqual(["snake_case"]);
  });

  it("matches a literal backslash", async () => {
    expect(await names("back\\")).toEqual(["back\\slash"]);
  });

  it("still does prefix matching for ordinary queries", async () => {
    expect(await names("Plain")).toEqual(["Plain Jane"]);
    expect(await names("Nobody")).toEqual([]);
  });

  it("a bare % does not leak the whole member list", async () => {
    expect(await names("%")).toEqual([]);
  });
});
