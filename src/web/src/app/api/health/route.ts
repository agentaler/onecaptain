import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Liveness, plus which required configuration is actually present.
 *
 * Missing config currently fails four different ways across the codebase — a
 * 500, a thrown error, a silent degrade, and one unguarded `TypeError` — so a
 * mis-provisioned deployment is a mystery rather than a report. That is
 * tolerable for a single install and not for a multi-tenant SaaS, where the
 * person who deploys is not the person who notices agents have gone quiet.
 *
 * Reports NAMES and present/absent ONLY. Never a value, never a prefix, never a
 * length — this endpoint is unauthenticated, and "how long is your encryption
 * key" is not a question a stranger should get answered.
 */
const REQUIRED = [
  // Sessions cannot be issued or validated without it.
  "BETTER_AUTH_SECRET",
  // Origin checks derive from it; a wrong value rejects legitimate sign-ins.
  "BETTER_AUTH_URL",
  // Decrypts stored provider keys AND signs the internal agent-run call, so
  // without it cloud agents neither authenticate nor run.
  "ENCRYPTION_KEY",
] as const;

export async function GET() {
  let env: Record<string, unknown> = {};
  try {
    env = getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {
    // Outside a Workers context (a plain node test run) there is nothing to
    // report on. Liveness is still liveness.
    return NextResponse.json({ status: "ok" });
  }

  const missing = REQUIRED.filter((name) => {
    const value = env[name];
    return typeof value !== "string" || value.length === 0;
  });

  return NextResponse.json({
    // `status` stays "ok" — the process IS serving. A config gap is a
    // deployment problem to surface, not a reason to fail a liveness probe and
    // have an orchestrator restart a healthy container in a loop.
    status: "ok",
    config: missing.length === 0 ? "complete" : "incomplete",
    ...(missing.length > 0 ? { missing } : {}),
  });
}
