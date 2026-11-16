export type HelpStatus = "open" | "in_progress" | "resolved";

export const HELP_CATEGORIES: { value: string; label: string; hint: string }[] = [
  { value: "general", label: "Question", hint: "Anything about the event" },
  { value: "registration", label: "My details", hint: "Name, email, paper or slot looks wrong" },
  { value: "av", label: "Presentation", hint: "Slides, projector, mic, online link" },
  { value: "accommodation", label: "Stay", hint: "Room, check-in, hostel" },
  { value: "transport", label: "Transport", hint: "Pickup, cab, shuttle" },
  { value: "lost", label: "Lost & found", hint: "Lost or found something" },
  { value: "medical", label: "Medical", hint: "Feeling unwell or injured" },
];

export function categoryLabel(v: string) {
  return HELP_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

/** Medical requests are always urgent. */
export function isUrgent(r: { urgent?: boolean | null; category: string }) {
  return !!r.urgent || r.category === "medical";
}

export function statusLabel(s: string) {
  return s === "resolved" ? "Sorted" : s === "in_progress" ? "Someone's on it" : "Waiting";
}

/** Queue order: urgent first, then oldest waiting first; resolved last, newest first. */
export function sortQueue<T extends { status: string; created_at: string; urgent?: boolean | null; category: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ra = a.status === "resolved" ? 1 : 0, rb = b.status === "resolved" ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (ra) return b.created_at.localeCompare(a.created_at);
    const ua = isUrgent(a) ? 0 : 1, ub = isUrgent(b) ? 0 : 1;
    if (ua !== ub) return ua - ub;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function waitedFor(from: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(from).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d`;
}
