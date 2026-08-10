import type { CalendarEvent } from "@onecaptain/shared";

export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getWeekLabel(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${start.getDate()}, ${startYear}\u2013${endMonth} ${end.getDate()}, ${endYear}`;
  }
  if (startMonth !== endMonth) {
    return `${startMonth} ${start.getDate()}\u2013${endMonth} ${end.getDate()}, ${endYear}`;
  }
  return `${startMonth} ${start.getDate()}\u2013${end.getDate()}, ${startYear}`;
}

export function getLocalFractionalHour(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

export interface LayoutEvent {
  event: CalendarEvent;
  columnIndex: number;
  columnCount: number;
}

export function computeEventLayout(events: CalendarEvent[]): LayoutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  const OVERLAP_THRESHOLD_MS = 30 * 60 * 1000;

  const groups: CalendarEvent[][] = [];
  let currentGroup: CalendarEvent[] = [sorted[0]!];
  let groupEnd = new Date(sorted[0]!.scheduled_at).getTime() + OVERLAP_THRESHOLD_MS;

  for (let i = 1; i < sorted.length; i++) {
    const evTime = new Date(sorted[i]!.scheduled_at).getTime();
    if (evTime < groupEnd) {
      currentGroup.push(sorted[i]!);
      const newEnd = evTime + OVERLAP_THRESHOLD_MS;
      if (newEnd > groupEnd) groupEnd = newEnd;
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]!];
      groupEnd = evTime + OVERLAP_THRESHOLD_MS;
    }
  }
  groups.push(currentGroup);

  const result: LayoutEvent[] = [];
  for (const group of groups) {
    const count = group.length;
    for (let idx = 0; idx < group.length; idx++) {
      result.push({
        event: group[idx]!,
        columnIndex: idx,
        columnCount: count,
      });
    }
  }

  return result;
}

export function weekRangeIso(anchor: Date): { from: string; to: string } {
  const start = getWeekStart(anchor);
  const end = getWeekEnd(anchor);
  return { from: start.toISOString(), to: end.toISOString() };
}
