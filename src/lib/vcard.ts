export type ContactLike = {
  full_name: string;
  organization?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  note?: string | null;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function toVCard(c: ContactLike): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(c.full_name)}`];
  if (c.organization) lines.push(`ORG:${esc(c.organization)}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${c.email}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone}`);
  if (c.linkedin_url) lines.push(`URL:${c.linkedin_url}`);
  lines.push(`NOTE:${esc(["Met at 11th Pan-IIM WMC 2026", c.note].filter(Boolean).join(", "))}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export const toVCards = (cs: ContactLike[]) => cs.map(toVCard).join("\r\n");
