const STORAGE_KEY = "browser-notification-enabled";
const EVENTS_KEY = "browser-notification-events";

export const NOTIFICATION_EVENTS = ["completed", "failed"] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  completed: "Task Completed",
  failed: "Task Failed",
};

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setNotificationEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function getNotificationEvents(): NotificationEvent[] {
  if (typeof window === "undefined") return [...NOTIFICATION_EVENTS];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) return JSON.parse(raw) as NotificationEvent[];
  } catch {}
  return [...NOTIFICATION_EVENTS];
}

export function setNotificationEvents(events: NotificationEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendTaskNotification(
  status: string,
  agentName?: string,
  body?: string,
): void {
  if (typeof window === "undefined") return;
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;
  if (!getNotificationEnabled()) return;

  const events = getNotificationEvents();
  if (!events.includes(status as NotificationEvent)) return;

  const label = NOTIFICATION_EVENT_LABELS[status as NotificationEvent] ?? `Task ${status}`;
  const title = agentName ? `${agentName} — ${label}` : label;
  new Notification(title, {
    body: body ?? "",
    icon: "/onecaptain.svg",
  });
}
