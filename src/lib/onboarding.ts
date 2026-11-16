/** Pure onboarding rules (tested in onboarding.test.ts). */

export type PassKind = "delegate" | "visitor";

/** Where a freshly signed-in user should land. */
export function nextRoute(onboardedAt: string | null | undefined): "/me" | "/onboarding" {
  return onboardedAt ? "/me" : "/onboarding";
}

/** A pass is a visitor pass when the person has no conference role other than "visitor". */
export function passKind(roles: string[]): PassKind {
  return roles.some((r) => r !== "visitor") ? "delegate" : "visitor";
}

export type Claim = { status: string; created_at: string };

/** Status of the most recent role claim, or null when none was made. */
export function claimStatus(claims: Claim[]): "pending" | "approved" | "rejected" | null {
  if (!claims.length) return null;
  const last = [...claims].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]!;
  return last.status === "open" ? "pending" : (last.status as "approved" | "rejected");
}

export const PASSWORD_MIN = 8;
// Email codes are 6 digits; accept up to 8 so a longer server code never locks anyone out.
export const isCode = (v: string) => /^\d{6,8}$/.test(v.trim());
