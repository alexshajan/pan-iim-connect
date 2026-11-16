/** Which inboxes tend to hold sign-in mail for a few minutes. Pure, tested. */
export type MailDelay = { kind: "institute" | "government" | "webmail-slow"; minutes: string } | null;

const SLOW_WEBMAIL = ["yahoo.com", "yahoo.co.in", "ymail.com", "rediffmail.com", "outlook.com", "hotmail.com", "live.com", "aol.com"];

export function mailDelay(email: string): MailDelay {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return null;
  const d = email.trim().toLowerCase().slice(at + 1);
  if (!d.includes(".")) return null;
  if (/(^|\.)(gov\.in|nic\.in|gov|mil)$/.test(d) || /\.gov\.[a-z]{2}$/.test(d)) return { kind: "government", minutes: "2 to 10" };
  if (/(^|\.)(ac\.in|edu|ac\.uk)$/.test(d) || /\.(edu|ac)\.[a-z]{2}$/.test(d) || /(^|\.)iim[a-z]*\.(ac\.in|in)$/.test(d)) return { kind: "institute", minutes: "2 to 5" };
  if (SLOW_WEBMAIL.includes(d)) return { kind: "webmail-slow", minutes: "1" };
  return null;
}
