// Single source of truth for which console screens each role can open.
export type ConsoleRole = "admin" | "editor" | "desk_volunteer" | "room_volunteer" | "help_volunteer" | "volunteer";

export type Screen =
  | "overview" | "people" | "submissions" | "imports" | "review"
  | "checkin" | "decks" | "help"
  | "events" | "schedule" | "alerts" | "guide" | "placeholders"
  | "team" | "activity" | "settings" | "cards" | "data" | "emails" | "institutions" | "slotter" | "whatsapp";

const ALL: Screen[] = [
  "overview", "people", "submissions", "imports", "review", "checkin", "decks", "help",
  "events", "schedule", "alerts", "guide", "placeholders", "team", "activity", "settings", "cards", "data", "emails", "institutions", "slotter", "whatsapp",
];

const BY_ROLE: Record<ConsoleRole, Screen[]> = {
  admin: ALL,
  editor: ALL.filter((s) => s !== "team"),
  desk_volunteer: ["overview", "checkin", "people", "schedule", "alerts"],
  room_volunteer: ["decks", "schedule", "alerts"],
  help_volunteer: ["help", "people", "alerts"],
  volunteer: ["help", "people", "alerts"],
};

export const ROLE_LABELS: Record<ConsoleRole, string> = {
  admin: "Admin",
  editor: "Editor",
  desk_volunteer: "Desk volunteer",
  room_volunteer: "Room volunteer",
  help_volunteer: "Help volunteer",
  volunteer: "Volunteer (legacy)",
};

export const ASSIGNABLE: ConsoleRole[] = ["admin", "editor", "desk_volunteer", "room_volunteer", "help_volunteer"];

export function allowedScreens(roles: string[]): Set<Screen> {
  const out = new Set<Screen>();
  for (const r of roles) for (const s of BY_ROLE[r as ConsoleRole] ?? []) out.add(s);
  return out;
}

export const canEditRegistry = (roles: string[]) => roles.includes("admin") || roles.includes("editor");

const PATH_SCREEN: Record<string, Screen> = {
  "": "overview", people: "people", submissions: "submissions", imports: "imports", review: "review",
  checkin: "checkin", decks: "decks", help: "help", schedule: "schedule", alerts: "alerts", guide: "guide", placeholders: "placeholders",
  team: "team", activity: "activity", settings: "settings", cards: "cards", data: "data", emails: "emails", institutions: "institutions", slotter: "slotter", whatsapp: "whatsapp",
};

export function screenForPath(pathname: string): Screen | null {
  const seg = pathname.replace(/^\/console\/?/, "").split("/")[0] ?? "";
  return PATH_SCREEN[seg] ?? null;
}

/** First screen a role should land on when opening /console. */
export function homeScreen(roles: string[]): Screen | null {
  const a = allowedScreens(roles);
  for (const s of ["overview", "checkin", "decks", "help"] as Screen[]) if (a.has(s)) return s;
  return null;
}

/** Volunteers draft alerts; only organizers publish them directly. */
export const alertsNeedApproval = (roles: string[]) => !canEditRegistry(roles);
