import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyNote, SectionHeading } from "@/components/AppShell";
import {
  announcementsQuery,
  helpRequestsQuery,
  participantsQuery,
  sessionsQuery,
} from "@/lib/conference";
import { rangeLabel, dayLabel } from "@/lib/format";
import { campusServicesQuery, messMealsQuery } from "@/lib/campus";
import { useAuth, useIsOrganizer } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Organizer Console, 11th Pan-IIM WMC 2026" },
      {
        name: "description",
        content:
          "Internal console for Pan-IIM 2026 organizers: schedule status, roster import, announcements and help desk queue.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Organizer Console, Pan-IIM 2026" },
      { property: "og:description", content: "Internal organizer tools." },
    ],
  }),
  component: AdminPage,
});

const TABS = ["Schedule", "Dining", "Roster", "Announce", "Help desk"] as const;

function AdminPage() {
  const { user, loading } = useAuth();
  const isOrganizer = useIsOrganizer(user?.id ?? null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Schedule");

  if (loading) {
    return (
      <AppShell title="Organizer console">
        <EmptyNote>Checking access…</EmptyNote>
      </AppShell>
    );
  }

  if (!user || !isOrganizer) {
    return (
      <AppShell eyebrow="Restricted" title="Organizer console">
        <div className="card-surface px-5 py-5">
          <p className="text-sm text-muted-foreground">
            This area is limited to the organizing team.
          </p>
          <Link
            to="/auth"
            className="tap mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Pan-IIM 2026 operations" title="Organizer console">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "tap shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium",
              tab === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Schedule" || tab === "Announce" ? (
          <Link to={tab === "Schedule" ? "/console/schedule" : "/console/alerts"} className="card-surface tap mb-4 block px-5 py-4 text-sm">
            <b>Moved to the console.</b> {tab === "Schedule" ? "The new schedule board" : "The new alerts screen"} replaces this tab, open it here.
          </Link>
        ) : null}
        {tab === "Schedule" ? <ScheduleAdmin /> : null}
        {tab === "Dining" ? <DiningAdmin /> : null}
        {tab === "Roster" ? <RosterAdmin /> : null}
        {tab === "Announce" ? <AnnounceAdmin /> : null}
        {tab === "Help desk" ? <HelpDeskAdmin /> : null}
      </div>
    </AppShell>
  );
}

function ScheduleAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(sessionsQuery);

  async function setStatus(id: string, status: string) {
    const note =
      status === "on_time"
        ? null
        : window.prompt("Note for guests (optional)", status === "moved" ? "New room: " : "");
    const { error } = await supabase
      .from("sessions")
      .update({ status, status_note: note || null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["sessions"] });
    toast.success("Schedule updated. Guests see this immediately.");
  }

  if (isLoading) return <EmptyNote>Loading schedule…</EmptyNote>;

  return (
    <div className="space-y-3">
      {(data ?? []).map((s) => (
        <div key={s.id} className="card-surface px-5 py-4">
          <p className="text-xs text-muted-foreground tabular-nums">
            {dayLabel(s.starts_at)}, {rangeLabel(s.starts_at, s.ends_at)} , {" "}
            {s.venues?.short_name ?? s.venues?.name ?? "Venue TBD"}
          </p>
          <h3 className="text-display mt-1 text-[1rem] leading-snug">{s.title}</h3>
          {s.status_note ? (
            <p className="mt-1 text-xs text-muted-foreground">{s.status_note}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {["on_time", "delayed", "moved", "cancelled"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatus(s.id, st)}
                className={cn(
                  "tap rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
                  s.status === st
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RosterAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery(participantsQuery);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);

  async function importCsv() {
    const rows = csv
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(",").map((c) => c.trim()))
      .filter((c) => c[0]);
    if (!rows.length) { toast.error("Nothing to import."); return; }
    setBusy(true);
    const { error } = await supabase.from("participants").upsert(
      rows.map((c) => ({
        email: c[0]!,
        full_name: c[1] || c[0]!,
        affiliation: c[2] || null,
        role: c[3] || "delegate",
        residence: c[4] || null,
        room_no: c[5] || null,
      })),
      { onConflict: "email" },
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCsv("");
    await qc.invalidateQueries({ queryKey: ["participants"] });
    toast.success(`${rows.length} participants imported.`);
  }

  return (
    <div className="space-y-4">
      <div className="card-surface px-5 py-4">
        <h3 className="text-display text-[1rem]">Import roster</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste CSV with header row: email, full_name, affiliation, role, residence, room_no
        </p>
        <textarea
          rows={5}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
          placeholder="email,full_name,affiliation,role,residence,room_no"
        />
        <button
          type="button"
          disabled={busy}
          onClick={importCsv}
          className="tap mt-2 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>

      <SectionHeading title={`Roster (${data?.length ?? 0})`} />
      <div className="space-y-2">
        {(data ?? []).map((p) => (
          <div key={p.id} className="card-surface px-5 py-3">
            <p className="text-sm font-medium">{p.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {p.email}, {p.role}
              {p.residence ? `, ${p.residence}${p.room_no ? ` ${p.room_no}` : ""}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnnounceAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery(announcementsQuery);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("announcements")
      .insert({ title, body, urgent, audience: "all" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setTitle("");
    setBody("");
    setUrgent(false);
    await qc.invalidateQueries({ queryKey: ["announcements"] });
    toast.success("Published to all guests.");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={publish} className="card-surface px-5 py-4">
        <h3 className="text-display text-[1rem]">New announcement</h3>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Headline"
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
        <textarea
          required
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What guests need to know"
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
            className="h-4 w-4"
          />
          Mark as urgent
        </label>
        <button
          type="submit"
          disabled={busy}
          className="tap mt-3 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Publishing…" : "Publish"}
        </button>
      </form>

      <SectionHeading title="Published" />
      <div className="space-y-2">
        {(data ?? []).map((a) => (
          <div key={a.id} className="card-surface px-5 py-3">
            <p className="text-sm font-medium">{a.title}</p>
            <p className="text-xs text-muted-foreground">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HelpDeskAdmin() {
  const { data, isLoading } = useQuery(helpRequestsQuery);
  if (isLoading) return <EmptyNote>Loading queue…</EmptyNote>;
  const rows = (data ?? []) as Array<{
    id: string;
    category: string;
    message: string;
    status?: string;
    created_at: string;
  }>;
  if (!rows.length) return <EmptyNote>No open requests.</EmptyNote>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="card-surface px-5 py-3">
          <p className="text-[0.68rem] font-semibold text-muted-foreground">
            {r.category}
          </p>
          <p className="mt-1 text-sm">{r.message}</p>
        </div>
      ))}
    </div>
  );
}

function DiningAdmin() {
  const qc = useQueryClient();
  const meals = useQuery(messMealsQuery);
  const services = useQuery(campusServicesQuery);

  async function patchMeal(
    id: string,
    patch: { highlight?: string; note?: string | null; status?: string },
  ) {
    const { error } = await supabase.from("mess_meals").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["mess_meals"] });
    toast.success("Menu updated. Guests see this immediately.");
  }

  async function editHighlight(id: string, current: string) {
    const next = window.prompt("Highlight dish shown to guests", current);
    if (next == null || next.trim() === current) return;
    await patchMeal(id, { highlight: next.trim() });
  }

  async function editNote(id: string, current: string | null) {
    const next = window.prompt("Note for guests (leave blank to clear)", current ?? "");
    if (next == null) return;
    await patchMeal(id, { note: next.trim() || null });
  }

  async function toggleFeatured(id: string, featured: boolean) {
    const { error } = await supabase
      .from("campus_services")
      .update({ featured: !featured })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["campus_services"] });
    toast.success(featured ? "Removed from the home screen." : "Pinned to the home screen.");
  }

  if (meals.isLoading) return <EmptyNote>Loading dining…</EmptyNote>;

  return (
    <div className="space-y-4">
      <SectionHeading title="Mess menu" className="mt-2" />
      <div className="space-y-3">
        {(meals.data ?? []).map((m) => (
          <div key={m.id} className="card-surface px-5 py-4">
            <p className="text-xs text-muted-foreground tabular-nums">
              {dayLabel(m.starts_at)}, {rangeLabel(m.starts_at, m.ends_at)}
              {m.location_name ? `, ${m.location_name}` : ""}
            </p>
            <h3 className="text-display mt-1 text-[1rem] leading-snug">
              {m.meal}, {m.highlight}
            </h3>
            {m.note ? <p className="mt-1 text-xs text-muted-foreground">{m.note}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => editHighlight(m.id, m.highlight)}
                className="tap rounded-full border border-border px-3 py-1.5 text-xs font-medium"
              >
                Edit dish
              </button>
              <button
                type="button"
                onClick={() => editNote(m.id, m.note)}
                className="tap rounded-full border border-border px-3 py-1.5 text-xs font-medium"
              >
                Edit note
              </button>
              {["scheduled", "delayed", "cancelled"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => patchMeal(m.id, { status: st })}
                  className={cn(
                    "tap rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
                    m.status === st
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <SectionHeading title="Campus services" />
      <div className="space-y-2">
        {(services.data ?? []).map((s) => (
          <div key={s.id} className="card-surface flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.category}
                {s.hours ? `, ${s.hours}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleFeatured(s.id, s.featured)}
              className={cn(
                "tap shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                s.featured
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {s.featured ? "On home" : "Pin to home"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
