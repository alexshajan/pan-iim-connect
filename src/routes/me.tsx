import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProfileLinks } from "@/components/me/ProfileLinks";
import type { ProfileLink } from "@/lib/profile-links";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Bell, BedDouble, CalendarDays, ChevronRight, KeyRound, LogOut, MapPin, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { AppShell, EmptyNote, SectionHeading } from "@/components/AppShell";
import { SessionCard } from "@/components/SessionCard";
import { ChangePassword, NotificationSettings } from "@/components/me/AccountSettings";
import { MetPeople } from "@/components/me/MetPeople";
import { useModules } from "@/hooks/useModules";
import { sessionsQuery } from "@/lib/conference";
import { useAuth, useIsOrganizer } from "@/hooks/useAuth";
import { useBookmarks } from "@/hooks/useBookmarks";
import { supabase } from "@/integrations/supabase/client";
import { myPersonQuery } from "@/lib/registry-data";
import { longDay, rangeLabel } from "@/lib/format";
import { directionsUrl, venuePoint } from "@/lib/maps";
import { passKind } from "@/lib/onboarding";
import { ClaimRole } from "./onboarding";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "Me, 11th Pan-IIM WMC 2026" },
      { name: "description", content: "Your digital delegate pass, paper slots, people you've met and residence." },
      { property: "og:title", content: "My Conference, Pan-IIM 2026" },
      { property: "og:description", content: "Your pass, papers, contacts and help desk in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MePage,
});

function MePage() {
  const now = new Date();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, email, loading } = useAuth();
  const mods = useModules();
  const isOrganizer = useIsOrganizer(user?.id ?? null);
  const { starred, toggle } = useBookmarks(user?.id ?? null);
  const sessions = useQuery(sessionsQuery);
  const registry = useQuery({ ...myPersonQuery(user?.id ?? null), retry: false });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (!loading && !user)
    return (
      <AppShell eyebrow="Your pass" title="My conference">
        <div className="pass px-6 py-7 text-center">
          <h2 className="text-display text-xl">Sign in to open your pass</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the email you registered with. Your pass, papers, room and contacts are linked to it.
          </p>
          <Link to="/auth" className="tap btn-sheen mt-5 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
            Sign in
          </Link>
        </div>
      </AppShell>
    );

  const p = registry.data?.person;
  const subs = registry.data?.subs ?? [];
  const all = sessions.data ?? [];
  const mine = all.filter((s) => starred.includes(s.id));
  const roles = [...(p?.person_roles ?? []).map((r) => r.role), ...subs.map((s) => s.role)];

  const initials = (p?.full_name ?? email ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const kind = passKind(roles);
  const roleLabel = kind === "visitor" ? "Visitor" : roles.includes("presenter") ? "Presenter" : roles[0] ? roles[0].replace(/_/g, " ") : "Delegate";

  return (
    <AppShell eyebrow="Profile" title="Me">
      {/* Identity, who I am, at a glance */}
      {registry.isLoading ? (
        <div className="skeleton h-[124px] rounded-[var(--radius)]" />
      ) : (
        <section className="card-surface flex items-center gap-4 px-5 py-5">
          <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground shadow-[var(--shadow-emboss)]">{initials}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-display truncate text-[1.25rem] leading-tight">{p?.full_name ?? "Guest"}</h2>
            {p?.organization ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.organization}</p> : null}
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
            {p ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="chip capitalize">{roleLabel}</span>
                <Link to="/" className="chip tabular-nums">{p.delegate_code} pass</Link>
              </div>
            ) : null}
          </div>
        </section>
      )}
      {p && kind === "visitor" ? <div className="mt-3"><ClaimRole /></div> : null}
      {registry.isLoading || p ? null : (
        <div className="card-surface mt-3 px-5 py-5">
          <h2 className="text-display text-lg">We couldn't find your registration yet</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {email} isn't in the delegate list. If you registered with another email, sign in with that one, or ask the help desk below.
          </p>
          <Link to="/onboarding" className="tap btn-sheen mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Get a visitor pass</Link>
        </div>
      )}

      {/* My presentation, the most time-critical thing a presenter needs */}
      {subs.length ? (
        <>
          <SectionHeading title={subs.length > 1 ? `My presentations, ${subs.length}` : "My presentation"} />
          <div className="space-y-3">
            {subs.map((s, i) => {
              const sess = all.find((x) => x.id === s.submissions?.session_id);
              const v = sess?.venues;
              return (
                <div key={i} className="pass overflow-hidden">
                  <div className="px-5 py-4">
                    <p className="text-xs tabular-nums tracking-[0.08em] text-muted-foreground">
                      #{s.submissions?.submission_code}
                      {s.submissions?.track ? `, ${s.submissions.track}` : ""}
                    </p>
                    <p className="text-display mt-1 text-[1.02rem] leading-snug">{s.submissions?.title ?? "Paper title awaited"}</p>
                  </div>
                  <div className="seam" />
                  <div className="flex items-center gap-3 bg-secondary/60 px-5 py-3">
                    {sess ? (
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-semibold">{longDay(sess.starts_at)}, {rangeLabel(sess.starts_at, sess.ends_at)}</p>
                        <p className="truncate text-muted-foreground">{v?.name ?? "Venue awaited"}</p>
                      </div>
                    ) : (
                      <p className="flex-1 text-xs font-semibold text-muted-foreground">Slot awaited</p>
                    )}
                    {(() => { const pt = v ? venuePoint(v) : null; return pt ? (
                      <a href={directionsUrl(pt.lat, pt.lng, pt.label)} target="_blank" rel="noreferrer" aria-label="Directions" className="tap grid size-9 place-items-center rounded-full bg-card text-primary">
                        <MapPin className="h-4 w-4" />
                      </a>
                    ) : null; })()}
                    {sess ? (
                      <Link to="/session/$sessionId" params={{ sessionId: sess.id }} className="tap rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground">
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* Conference, things I come back to */}
      <SectionHeading title="My conference" />
      <div className="group-list">
        <Row icon={CalendarDays} label="My plan" value={mine.length ? `${mine.length} saved` : "Empty"}>
          {mine.length ? (
            <div className="space-y-2.5">
              {mine.map((s) => <SessionCard key={s.id} session={s} now={now} starred onToggleStar={toggle} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Star sessions on the <Link to="/calendar" className="font-semibold text-primary">Calendar</Link> to plan your days.</p>
          )}
        </Row>
        {p?.accommodations?.[0] ? (
          <Row icon={BedDouble} label="Stay" value={`${p.accommodations[0].residence}${p.accommodations[0].room_no ? `, ${p.accommodations[0].room_no}` : ""}`} />
        ) : null}
        {mods.network ? (
          <Row icon={Users} label="People I've met">
            <MetPeople linked={!!p} />
          </Row>
        ) : null}
        {mods.network ? <RowLink icon={Users} label="Network" to="/network" /> : null}
      </div>

      {/* Settings, infrequent, grouped and folded */}
      <SectionHeading title="Settings" />
      <div className="group-list">
        {user ? (
          <Row icon={Bell} label="Notifications">
            <NotificationSettings userId={user.id} />
          </Row>
        ) : null}
        {p ? (
          <Row icon={UserRound} label="Profile & keywords">
            <div className="space-y-3">
              {mods.network ? <DirectoryToggle on={p.directory_opt_in ?? false} linkedin={p.linkedin_url ?? ""} /> : null}
              <ProfileLinks initial={(p as { profile_links?: ProfileLink[] }).profile_links ?? []} name={p.full_name ?? ""} />
              <ProfileFields keywords={(p as { keywords?: string[] }).keywords ?? []} bio={(p as { bio?: string | null }).bio ?? ""} />
            </div>
          </Row>
        ) : null}
        {user ? (
          <Row icon={KeyRound} label="Password">
            <ChangePassword />
          </Row>
        ) : null}
      </div>

      <SectionHeading title="Help desk" />
      {isOrganizer ? <div className="group-list mt-3"><RowLink icon={ShieldCheck} label="Organizer console" to="/console" /></div> : null}

      {user ? (
        <button type="button" onClick={signOut} className="tap mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-card px-5 text-sm font-semibold text-destructive shadow-[var(--shadow-card)]">
          <LogOut className="h-4 w-4" strokeWidth={2} /> Sign out
        </button>
      ) : null}
    </AppShell>
  );
}

type IconT = typeof Bell;

/** Grouped-list row that unfolds in place (native settings pattern, keyboard + screen-reader friendly via <details>). */
function Row({ icon: Icon, label, value, children }: { icon: IconT; label: string; value?: string; children?: ReactNode }) {
  const head = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary/10 text-primary"><Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} /></span>
      <span className="min-w-0 flex-1 text-[0.95rem] font-medium">{label}</span>
      {value ? <span className="max-w-[45%] truncate text-sm text-muted-foreground">{value}</span> : null}
    </>
  );
  if (!children) return <div className="group-row">{head}</div>;
  return (
    <details className="group-disclosure">
      <summary className="group-row">
        {head}
        <ChevronRight aria-hidden className="group-chev h-4 w-4 shrink-0 text-muted-foreground" />
      </summary>
      <div className="group-panel">{children}</div>
    </details>
  );
}

function RowLink({ icon: Icon, label, to }: { icon: IconT; label: string; to: "/network" | "/console" }) {
  return (
    <Link to={to} className="group-row">
      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary/10 text-primary"><Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} /></span>
      <span className="min-w-0 flex-1 text-[0.95rem] font-medium">{label}</span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function DirectoryToggle({ on: initial, linkedin: initialLi }: { on: boolean; linkedin: string }) {
  const qc = useQueryClient();
  const [on, setOn] = useState(initial);
  const [li, setLi] = useState(initialLi);
  async function save(next: boolean, url = li) {
    setOn(next);
    const { error } = await supabase.rpc("set_my_directory", { _on: next, _linkedin: url });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["registry", "me"] });
  }
  return (
    <div className="card-surface px-5 py-4">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold">List me in the directory</span>
          <span className="block text-xs text-muted-foreground">Others see your name, institution, papers and profile links.</span>
        </span>
        <input type="checkbox" checked={on} onChange={(e) => save(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" />
      </label>
      <input
        value={li}
        onChange={(e) => setLi(e.target.value)}
        onBlur={() => li !== initialLi && save(on, li)}
        placeholder="Your LinkedIn profile link"
        className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function ProfileFields({ keywords: initialKw, bio: initialBio }: { keywords: string[]; bio: string }) {
  const qc = useQueryClient();
  const [kw, setKw] = useState(initialKw);
  const [draft, setDraft] = useState("");
  const [bio, setBio] = useState(initialBio);
  async function save(nextKw = kw, nextBio = bio) {
    const { error } = await supabase.rpc("set_my_profile", { _keywords: nextKw, _bio: nextBio });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["registry", "me"] });
  }
  function add() {
    const k = draft.trim().toLowerCase();
    setDraft("");
    if (!k || kw.includes(k) || kw.length >= 8) return;
    const next = [...kw, k];
    setKw(next);
    save(next);
  }
  return (
    <div className="card-surface px-5 py-4">
      <span className="block text-sm font-semibold">Research keywords ({kw.length}/8)</span>
      <span className="block text-xs text-muted-foreground">Used to suggest people with shared interests.</span>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {kw.map((k) => (
          <button key={k} type="button" onClick={() => { const n = kw.filter((x) => x !== k); setKw(n); save(n); }} className="kw-stamp items-center gap-1">
            {k} <X className="h-3 w-3" />
          </button>
        ))}
      </div>
      {kw.length < 8 ? (
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} onBlur={add} placeholder="e.g. esg, behavioural finance, press Enter" className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
      ) : null}
      <input value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} onBlur={() => bio !== initialBio && save(kw, bio)} placeholder="One-line bio (160 characters)" className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}

