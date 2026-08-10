import { describe, it, expect } from "vitest";
import { groupByDay } from "./calendar-agenda";
import type { CalendarEvent } from "@onecaptain/shared";

function mkEvent(over: Partial<CalendarEvent> & { scheduled_at: string }): CalendarEvent {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    agent_id: over.agent_id ?? "ag_1",
    workspace_id: over.workspace_id ?? "ws_1",
    title: over.title ?? "test",
    repeat_interval: over.repeat_interval ?? null,
    repeat_stop_at: over.repeat_stop_at ?? null,
    last_triggered_at: over.last_triggered_at ?? null,
    created_at: over.created_at ?? "2026-04-01T00:00:00Z",
    updated_at: over.updated_at ?? "2026-04-01T00:00:00Z",
    ...over,
  };
}

describe("groupByDay", () => {
  it("returns an empty array for no events", () => {
    expect(groupByDay([])).toEqual([]);
  });

  it("groups events falling on the same local day", () => {
    const events = [
      mkEvent({ id: "e1", scheduled_at: "2026-04-17T09:00:00.000Z" }),
      mkEvent({ id: "e2", scheduled_at: "2026-04-17T15:30:00.000Z" }),
      mkEvent({ id: "e3", scheduled_at: "2026-04-18T09:00:00.000Z" }),
    ];
    const g = groupByDay(events);
    expect(g).toHaveLength(2);
    expect(g[0]!.items.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(g[1]!.items.map((e) => e.id)).toEqual(["e3"]);
  });

  it("orders groups chronologically", () => {
    const events = [
      mkEvent({ id: "late", scheduled_at: "2026-04-20T09:00:00.000Z" }),
      mkEvent({ id: "early", scheduled_at: "2026-04-17T09:00:00.000Z" }),
      mkEvent({ id: "mid", scheduled_at: "2026-04-18T09:00:00.000Z" }),
    ];
    const g = groupByDay(events);
    const dates = g.map((x) => x.day.getDate());
    expect(dates).toEqual([17, 18, 20]);
  });

  it("sorts items within a group by time", () => {
    const events = [
      mkEvent({ id: "pm", scheduled_at: "2026-04-17T15:30:00.000Z" }),
      mkEvent({ id: "am", scheduled_at: "2026-04-17T09:00:00.000Z" }),
      mkEvent({ id: "noon", scheduled_at: "2026-04-17T12:00:00.000Z" }),
    ];
    const g = groupByDay(events);
    expect(g).toHaveLength(1);
    expect(g[0]!.items.map((e) => e.id)).toEqual(["am", "noon", "pm"]);
  });

  it("omits days that have no events", () => {
    const events = [
      mkEvent({ id: "e1", scheduled_at: "2026-04-17T09:00:00.000Z" }),
      mkEvent({ id: "e2", scheduled_at: "2026-04-20T09:00:00.000Z" }),
    ];
    const g = groupByDay(events);
    expect(g).toHaveLength(2);
    expect(g.map((x) => x.day.getDate())).toEqual([17, 20]);
  });
});
