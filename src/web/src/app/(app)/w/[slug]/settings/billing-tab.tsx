"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";

type BillingInfo = {
  plan: string;
  role: string;
  billingConfigured: boolean;
  limits: { maxAgents: number; maxMembers: number };
  plans: {
    plan: string;
    label: string;
    description: string;
    limits: { maxAgents: number; maxMembers: number };
    hasProducts: boolean;
  }[];
  subscription: {
    status: string;
    plan: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

function limitLabel(n: number): string {
  return Number.isFinite(n) && n < 1_000_000 ? String(n) : "Unlimited";
}

export function BillingTab() {
  const { workspaceId } = useWorkspace();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/billing`);
      if (!res.ok) throw new Error(`billing info failed (${res.status})`);
      setInfo(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load billing — retry");
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdmin = info?.role === "owner" || info?.role === "admin";

  async function handleUpgrade() {
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `checkout failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start checkout");
      setBusy(false);
    }
  }

  async function handlePortal() {
    setBusy(true);
    try {
      await authClient.customer.portal();
    } catch {
      toast.error("Couldn't open the billing portal");
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  const renewal = info.subscription?.currentPeriodEnd
    ? new Date(info.subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Current plan</h2>
          <Badge variant="secondary" className="capitalize">{info.plan}</Badge>
          {info.subscription && info.subscription.status !== "active" && (
            <Badge variant="outline" className="capitalize">{info.subscription.status}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {limitLabel(info.limits.maxAgents)} agents · {limitLabel(info.limits.maxMembers)} seats
          {renewal && (
            <>
              {" · "}
              {info.subscription?.cancelAtPeriodEnd ? "ends" : "renews"} {renewal}
            </>
          )}
        </p>
        {!info.billingConfigured && (
          <p className="text-sm text-muted-foreground">
            Billing isn&rsquo;t configured on this deployment — plans are managed by the operator
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {info.plans.map((p) => {
          const isCurrent = p.plan === info.plan;
          return (
            <div
              key={p.plan}
              className="rounded-lg border border-border p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p.label}</h3>
                {isCurrent && <Badge variant="secondary">Current</Badge>}
              </div>
              <p className="text-sm text-muted-foreground flex-1">{p.description}</p>
              <p className="text-sm">
                {limitLabel(p.limits.maxAgents)} agents · {limitLabel(p.limits.maxMembers)} seats
              </p>
              {!isCurrent && p.plan === "pro" && isAdmin && info.billingConfigured && p.hasProducts && (
                <Button onClick={handleUpgrade} disabled={busy}>
                  {busy ? "Redirecting…" : "Upgrade to Pro"}
                </Button>
              )}
              {!isCurrent && p.plan === "pro" && !isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Ask a workspace owner or admin to upgrade
                </p>
              )}
            </div>
          );
        })}
      </section>

      {info.subscription && isAdmin && info.billingConfigured && (
        <section>
          <Button variant="outline" onClick={handlePortal} disabled={busy}>
            Manage billing
          </Button>
        </section>
      )}
    </div>
  );
}
