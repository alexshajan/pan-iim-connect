// Pure rules for which alerts a person sees and when.
export type AlertRow = {
  id: string;
  title: string;
  body: string;
  audience: string; // all | presenters | chairs | volunteers | session
  kind?: string | null; // info | schedule | urgent | logistics
  urgent: boolean;
  published_at: string;
  ends_at?: string | null;
  withdrawn_at?: string | null;
  session_id?: string | null;
};

export type Viewer = { presenter?: boolean; chair?: boolean; volunteer?: boolean; sessionIds?: string[] };

export const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "presenters", label: "Presenters" },
  { value: "chairs", label: "Track chairs" },
  { value: "volunteers", label: "Volunteers" },
  { value: "session", label: "People in one session" },
] as const;

export const KINDS = [
  { value: "info", label: "Info" },
  { value: "schedule", label: "Schedule change" },
  { value: "urgent", label: "Urgent / weather" },
  { value: "logistics", label: "Food & logistics" },
] as const;

export function isActive(a: AlertRow, now: Date) {
  if (a.withdrawn_at) return false;
  if (new Date(a.published_at).getTime() > now.getTime()) return false;
  if (a.ends_at && new Date(a.ends_at).getTime() <= now.getTime()) return false;
  return true;
}

export function visibleTo(a: AlertRow, v: Viewer) {
  switch (a.audience) {
    case "all": return true;
    case "presenters": return !!v.presenter;
    case "chairs": return !!v.chair;
    case "volunteers": return !!v.volunteer;
    case "session": return !!a.session_id && (v.sessionIds ?? []).includes(a.session_id);
    default: return true;
  }
}

export const alertsFor = (list: AlertRow[], v: Viewer, now = new Date()) => list.filter((a) => isActive(a, now) && visibleTo(a, v));

export function alertStatus(a: AlertRow, now = new Date()): "withdrawn" | "scheduled" | "ended" | "live" {
  if (a.withdrawn_at) return "withdrawn";
  if (new Date(a.published_at) > now) return "scheduled";
  if (a.ends_at && new Date(a.ends_at) <= now) return "ended";
  return "live";
}
