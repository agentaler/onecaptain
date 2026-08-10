import { describe, it, expect } from "vitest";
import {
  getWeekStart,
  getWeekEnd,
  getWeekLabel,
  getLocalFractionalHour,
  computeEventLayout,
  weekRangeIso,
} from "./calendar-week-utils";
import type { CalendarEvent } from "@onecaptain/shared";

function makeEvent(scheduled_at: string, id = "ev_1"): CalendarEvent {
  return {
    id,
    workspace_id: "ws_1",
    agent_id: "ag_1",
    title: "Test",
    description: null,
    scheduled_at,
    repeat_interval: null,
    repeat_stop_date: null,
    occurrence_at: scheduled_at,
    created_at: scheduled_at,
    updated_at: scheduled_at,
  } as CalendarEvent;
}

describe("getWeekStart", () => {
  it("returns Sunday for any input date (Thu Apr 23 → Sun Apr 19)", () => {
    const result = getWeekStart(new Date(2026, 3, 23));
    expect(result.getDay()).toBe(0);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(19);
  });

  it("returns the same day if already Sunday", () => {
    const sunday = new Date(2026, 3, 19);
    const result = getWeekStart(sunday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(19);
  });

  it("handles month boundaries (Wed Apr 1 → Sun Mar 29)", () => {
    const result = getWeekStart(new Date(2026, 3, 1));
    expect(result.getDay()).toBe(0);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(29);
  });

  it("handles year boundaries (Thu Jan 1, 2026 → Sunday Dec 28, 2025)", () => {
    const result = getWeekStart(new Date(2026, 0, 1));
    expect(result.getDay()).toBe(0);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11); // December
    expect(result.getDate()).toBe(28);
  });

  it("sets time to 00:00:00.000", () => {
    const result = getWeekStart(new Date(2026, 3, 23, 15, 30, 45));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

describe("getWeekEnd", () => {
  it("returns Saturday 23:59:59.999 for any input", () => {
    const result = getWeekEnd(new Date(2026, 3, 23));
    expect(result.getDay()).toBe(6); // Saturday
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });

  it("handles month boundaries", () => {
    // Week containing Mar 30, 2026 (Sunday): ends Apr 4 (Saturday)
    const result = getWeekEnd(new Date(2026, 2, 30));
    expect(result.getDay()).toBe(6);
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(4);
  });
});

describe("getWeekLabel", () => {
  it("formats same-month weeks", () => {
    const start = new Date(2026, 3, 20); // Apr 20
    const end = new Date(2026, 3, 26); // Apr 26
    expect(getWeekLabel(start, end)).toBe("Apr 20\u201326, 2026");
  });

  it("formats cross-month weeks", () => {
    const start = new Date(2026, 2, 30); // Mar 30
    const end = new Date(2026, 3, 5); // Apr 5
    expect(getWeekLabel(start, end)).toBe("Mar 30\u2013Apr 5, 2026");
  });

  it("formats cross-year weeks", () => {
    const start = new Date(2025, 11, 28); // Dec 28, 2025
    const end = new Date(2026, 0, 3); // Jan 3, 2026
    expect(getWeekLabel(start, end)).toBe("Dec 28, 2025\u2013Jan 3, 2026");
  });
});

describe("getLocalFractionalHour", () => {
  it("returns correct fractional hour for full hour", () => {
    const d = new Date(2026, 3, 20, 10, 0, 0);
    expect(getLocalFractionalHour(d.toISOString())).toBe(10);
  });

  it("returns correct fractional hour for half-hour", () => {
    const d = new Date(2026, 3, 20, 10, 30, 0);
    expect(getLocalFractionalHour(d.toISOString())).toBe(10.5);
  });

  it("returns correct fractional hour for midnight", () => {
    const d = new Date(2026, 3, 20, 0, 0, 0);
    expect(getLocalFractionalHour(d.toISOString())).toBe(0);
  });

  it("returns correct fractional hour for 23:45", () => {
    const d = new Date(2026, 3, 20, 23, 45, 0);
    expect(getLocalFractionalHour(d.toISOString())).toBe(23.75);
  });
});

describe("computeEventLayout", () => {
  it("returns empty array for empty input", () => {
    expect(computeEventLayout([])).toEqual([]);
  });

  it("single event gets columnIndex=0, columnCount=1", () => {
    const events = [makeEvent("2026-04-20T10:00:00.000Z")];
    const result = computeEventLayout(events);
    expect(result).toHaveLength(1);
    expect(result[0]!.columnIndex).toBe(0);
    expect(result[0]!.columnCount).toBe(1);
  });

  it("non-overlapping events each get columnCount=1", () => {
    const events = [
      makeEvent("2026-04-20T10:00:00.000Z", "ev_1"),
      makeEvent("2026-04-20T14:00:00.000Z", "ev_2"),
    ];
    const result = computeEventLayout(events);
    expect(result).toHaveLength(2);
    expect(result[0]!.columnCount).toBe(1);
    expect(result[1]!.columnCount).toBe(1);
  });

  it("2 overlapping events get columnCount=2, indices 0 and 1", () => {
    const events = [
      makeEvent("2026-04-20T10:00:00.000Z", "ev_1"),
      makeEvent("2026-04-20T10:15:00.000Z", "ev_2"),
    ];
    const result = computeEventLayout(events);
    expect(result).toHaveLength(2);
    expect(result[0]!.columnCount).toBe(2);
    expect(result[1]!.columnCount).toBe(2);
    expect(result[0]!.columnIndex).toBe(0);
    expect(result[1]!.columnIndex).toBe(1);
  });

  it("3 events where only 2 overlap: correct grouping", () => {
    const events = [
      makeEvent("2026-04-20T10:00:00.000Z", "ev_1"),
      makeEvent("2026-04-20T10:15:00.000Z", "ev_2"),
      makeEvent("2026-04-20T14:00:00.000Z", "ev_3"),
    ];
    const result = computeEventLayout(events);
    expect(result).toHaveLength(3);
    // First two overlap
    const group1 = result.filter((r) => r.event.id === "ev_1" || r.event.id === "ev_2");
    expect(group1[0]!.columnCount).toBe(2);
    expect(group1[1]!.columnCount).toBe(2);
    // Third is separate
    const group2 = result.find((r) => r.event.id === "ev_3")!;
    expect(group2.columnCount).toBe(1);
    expect(group2.columnIndex).toBe(0);
  });
});

describe("weekRangeIso", () => {
  it("returns correct ISO range for a given Sunday anchor", () => {
    const anchor = new Date(2026, 3, 19); // Sunday Apr 19
    const { from, to } = weekRangeIso(anchor);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    expect(fromDate.getDay()).toBe(0); // Sunday
    expect(toDate.getDay()).toBe(6); // Saturday
    expect(toDate.getHours()).toBe(23);
    expect(toDate.getMinutes()).toBe(59);
  });

  it("handles month/year boundaries", () => {
    // Thursday Jan 1, 2026 → week starts Dec 28, 2025
    const anchor = new Date(2026, 0, 1);
    const { from, to } = weekRangeIso(anchor);
    const fromDate = new Date(from);
    expect(fromDate.getFullYear()).toBe(2025);
    expect(fromDate.getMonth()).toBe(11);
    expect(fromDate.getDate()).toBe(28);
    const toDate = new Date(to);
    expect(toDate.getFullYear()).toBe(2026);
    expect(toDate.getMonth()).toBe(0);
    expect(toDate.getDate()).toBe(3);
  });
});
