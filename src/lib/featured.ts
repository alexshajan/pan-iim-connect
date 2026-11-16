/**
 * Keynotes and panels keep their guest names and topic in free text
 * (title "Keynote II", summary "Prof. V. Kumar, Professor, Brock University").
 * This turns that text into a headline, a topic and a list of guests.
 * Pure so the calendar card, drawer and full page always agree.
 */
export type Guest = { name: string; role: string | null };
export type Featured = {
  kind: "keynote" | "panel";
  label: string; // "Keynote II", "Corporate Panel I"
  topic: string | null;
  guests: Guest[];
  headline: string; // what the card leads with
};

const HONOURS = /^(padma\s+(shri|shree|bhushan|vibhushan))$/i;
const PERSON = /^(prof|dr|shri|smt|ms|mr|mrs|padma)\b/i;

const tidy = (s: string) => s.replace(/[()]/g, (c, i, all) => (c === ")" && !all.slice(0, i).includes("(") ? "" : c)).replace(/\s+/g, " ").trim();

export function parseGuests(text: string): Guest[] {
  const parts = tidy(text).split(",").map((p) => p.trim()).filter(Boolean);
  // Merge a lone honour ("Padma Shri") into the following name.
  const merged: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (HONOURS.test(parts[i]!) && parts[i + 1]) { merged.push(`${parts[i]} ${parts[i + 1]}`); i++; }
    else merged.push(parts[i]!);
  }
  // Every part that looks like a person starts a guest; the rest is their role.
  if (merged.length > 1 && merged.every((p) => PERSON.test(p))) return merged.map((name) => ({ name, role: null }));
  const [name, ...rest] = merged;
  return name ? [{ name, role: rest.join(", ") || null }] : [];
}

export function featuredOf(s: { title: string; summary: string | null; session_type: string }): Featured | null {
  if (s.session_type !== "keynote" && s.session_type !== "panel") return null;
  const summary = s.summary?.trim() || null;
  const [label, ...after] = s.title.split(":");
  const titleTopic = after.join(":").trim() || null;
  if (s.session_type === "keynote") {
    const guests = summary ? parseGuests(summary) : [];
    return { kind: "keynote", label: label!.trim(), topic: titleTopic, guests, headline: guests[0]?.name ?? "Speaker to be announced" };
  }
  // Panels: a summary that is a list of people is the line-up; otherwise it is the topic.
  const summaryIsPeople = !!summary && parseGuests(summary).length > 1;
  const topic = titleTopic ?? (summaryIsPeople ? null : summary);
  const guests = summaryIsPeople ? parseGuests(summary!) : [];
  return { kind: "panel", label: label!.trim(), topic, guests, headline: topic ?? label!.trim() };
}

/** URL-safe key for a guest, ignoring honours and titles so "Prof. V. Kumar" → "v-kumar". */
export const guestSlug = (name: string) =>
  name.replace(/\b(padma\s+(shri|shree|bhushan|vibhushan)|prof|dr|shri|smt|ms|mr|mrs)\b\.?/gi, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export type Appearance = { sessionId: string; label: string; kind: Featured["kind"]; topic: string | null; starts_at: string; ends_at: string };
export type GuestProfile = Guest & { slug: string; honour: string | null; appearances: Appearance[] };

/** Every keynote/panel guest across the programme, merged by slug. */
export function guestsOf(sessions: { id: string; title: string; summary: string | null; session_type: string; starts_at: string; ends_at: string }[]): GuestProfile[] {
  const map = new Map<string, GuestProfile>();
  for (const s of [...sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const f = featuredOf(s);
    if (!f) continue;
    for (const g of f.guests) {
      const slug = guestSlug(g.name);
      if (!slug) continue;
      const cur = map.get(slug) ?? { ...g, slug, honour: /padma\s+\w+/i.exec(g.name)?.[0] ?? null, appearances: [] };
      if (!cur.role && g.role) cur.role = g.role;
      cur.appearances.push({ sessionId: s.id, label: f.label, kind: f.kind, topic: f.topic, starts_at: s.starts_at, ends_at: s.ends_at });
      map.set(slug, cur);
    }
  }
  return [...map.values()];
}
