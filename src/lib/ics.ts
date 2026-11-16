// Pure iCalendar builder for "My plan" (tested). No I/O.

export type IcsEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location?: string | null | undefined;
  description?: string | null | undefined;
  url?: string | undefined;
};

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 text escaping. */
export const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds lines longer than 75 octets (approximated by characters). */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? " " : "") + line.slice(i, i + 73));
  return parts.join("\r\n");
}

export function buildIcs(events: IcsEvent[], opts: { name?: string; now?: Date } = {}): string {
  const dtstamp = stamp((opts.now ?? new Date()).toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pan-IIM WMC 2026//My plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(opts.name ?? "Pan-IIM WMC 2026, My plan")}`,
    "X-WR-TIMEZONE:Asia/Kolkata",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@paniim.planos.in`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(e.starts_at)}`,
      `DTEND:${stamp(e.ends_at)}`,
      `SUMMARY:${escapeIcs(e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT15M", `DESCRIPTION:${escapeIcs(e.title)}`, "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** One-tap "add this event" link for Google Calendar. */
export function googleEventUrl(e: IcsEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.starts_at)}/${stamp(e.ends_at)}`,
    ctz: "Asia/Kolkata",
  });
  if (e.location) p.set("location", e.location);
  if (e.description || e.url) p.set("details", [e.description, e.url].filter(Boolean).join("\n\n"));
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** One-tap "add this event" link for Outlook on the web. */
export function outlookEventUrl(e: IcsEvent): string {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(e.starts_at).toISOString(),
    enddt: new Date(e.ends_at).toISOString(),
  });
  if (e.location) p.set("location", e.location);
  if (e.url) p.set("body", e.url);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

/** Subscription links that keep a calendar app in sync with the feed. */
export function subscribeLinks(feedUrl: string) {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  return {
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    apple: webcal,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent("Pan-IIM WMC 2026")}`,
  };
}
