import { askMergeEmail } from "@/components/console/MergeEmailDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { CardPreview, downloadQr } from "@/components/console/CardTools";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { db, ROLES, type Person } from "@/lib/registry-data";
import { cn } from "@/lib/utils";
import { findIssues, validateEdit } from "@/lib/people-issues";
import { rangeLabel } from "@/lib/format";

export function PersonEditor({ person, all, onDone }: { person: Person; all: Person[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState(person);
  const [roles, setRoles] = useState<string[]>(person.person_roles?.map((r) => r.role) ?? []);
  const [mergeId, setMergeId] = useState("");
  const [mq, setMq] = useState("");
  const [busy, setBusy] = useState(false);
  // Inline confirm: browser confirm() dialogs are silently blocked inside the preview frame, which made buttons look dead.
  const [ask, setAsk] = useState<{ msg: string; go: () => Promise<void> } | null>(null);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(false); } };
  const set = (k: keyof Person, v: unknown) => setP((x) => ({ ...x, [k]: v }));
  const likely = useMemo(() => {
    const ids = new Set(findIssues(all).filter((i) => i.ids.includes(person.id) && i.kind !== "not_signed_in").flatMap((i) => i.ids));
    ids.delete(person.id);
    return all.filter((o) => ids.has(o.id));
  }, [all, person.id]);

  async function save(confirmed = false) {
    const code = p.delegate_code.trim().toUpperCase();
    const alt = (p.alt_email ?? "").trim().toLowerCase();
    const holder = alt && alt !== person.alt_email?.toLowerCase()
      ? all.find((o) => o.id !== person.id && (o.email.toLowerCase() === alt || (o.alt_email ?? "").toLowerCase() === alt))
      : undefined;
    if (holder) {
      if (!confirmed) { setAsk({ msg: `${alt} already has its own profile (${holder.full_name}, ${holder.delegate_code}). Merge it into ${person.full_name}? They can then sign in with either email.`, go: () => save(true) }); return; }
      const { error } = await db.rpc("merge_people", { _keep: person.id, _drop: holder.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Profiles merged");
      askMergeEmail(person.id);
      qc.invalidateQueries({ queryKey: ["registry"] });
      onDone();
      return;
    }
    const err = validateEdit({ ...p, delegate_code: code }, all);
    if (err) { toast.error(err); return; }
    if (code !== person.delegate_code && !confirmed) { setAsk({ msg: `Change code ${person.delegate_code} → ${code}? Printed cards and QRs with the old code stop working.`, go: () => save(true) }); return; }
    const { error } = await db.from("people").update({
      full_name: p.full_name.trim(), email: p.email.trim().toLowerCase(), alt_email: p.alt_email?.trim().toLowerCase() || null,
      delegate_code: code, phone: p.phone, organization: p.organization, address: p.address, category: p.category,
      notes: p.notes, card_role: p.card_role || null, submission_ref: p.submission_ref || null, consent_networking: p.consent_networking, consent_photo: p.consent_photo,
      consent_whatsapp: p.consent_whatsapp, consent_calls: p.consent_calls,
    }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    const before = person.person_roles?.map((r) => r.role) ?? [];
    const add = roles.filter((r) => !before.includes(r));
    const remove = before.filter((r) => !roles.includes(r));
    if (add.length) { const r = await db.from("person_roles").insert(add.map((role) => ({ person_id: p.id, role }))); if (r.error) { toast.error(r.error.message); return; } }
    if (remove.length) { const r = await db.from("person_roles").delete().eq("person_id", p.id).in("role", remove); if (r.error) { toast.error(r.error.message); return; } }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["registry"] });
    onDone();
  }

  async function merge(confirmed = false) {
    const other = all.find((o) => o.id === mergeId);
    if (!other) return;
    if (!confirmed) { setAsk({ msg: `Merge ${other.full_name} (${other.email}) into ${person.full_name}? Their connections, check-ins and sign-in move here, their email becomes the second email, and the other profile is removed.`, go: () => merge(true) }); return; }
    const { error } = await db.rpc("merge_people", { _keep: person.id, _drop: other.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Profiles merged");
      askMergeEmail(person.id);
    qc.invalidateQueries({ queryKey: ["registry"] });
    onDone();
  }

  async function remove(confirmed = false) {
    if (!confirmed) { setAsk({ msg: `Delete ${p.full_name}? Their card links will stop working.`, go: () => remove(true) }); return; }
    const { error } = await db.from("people").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["registry"] });
    onDone();
  }

  const field = (k: keyof Person, label: string, multiline = false) => (
    <label className="block text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea value={(p[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} rows={2}
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2" />
      ) : (
        <input value={(p[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2" />
      )}
    </label>
  );

  return (
    <div className="space-y-4">
      <SheetHeader>
        <p className="text-xs text-muted-foreground">{p.delegate_code}, {p.email}</p>
        <SheetTitle className="text-display">{p.full_name}</SheetTitle>
        <p className="text-xs text-muted-foreground">{p.user_id ? "Signed in to the app" : "Hasn't signed in yet"}</p>
      </SheetHeader>
      <CardPreview p={p} />
      <PersonPapers personId={person.id} />
      <div className="flex gap-2">
        <button onClick={() => downloadQr(p, "png")} className="tap flex-1 rounded-full border border-border py-2 text-xs font-semibold">QR, PNG</button>
        <button onClick={() => downloadQr(p, "svg")} className="tap flex-1 rounded-full border border-border py-2 text-xs font-semibold">QR, SVG</button>
      </div>
      {field("full_name", "Name")}
      {field("delegate_code", "Identifier code")}
      {field("email", "Main email")}
      {field("alt_email", "Second email (if they signed in with another address)")}
      {field("card_role", "Role on card")}
      {field("submission_ref", "Submission ID")}
      {field("phone", "Phone")}
      <div className="rounded-xl border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground">Merge a duplicate into this profile</p>
        {likely.length > 0 && <p className="mt-1 text-xs">Likely duplicates: {likely.map((o) => o.full_name).join(", ")}</p>}
        {likely.length > 0 && !mergeId && (
          <div className="mt-2 flex flex-wrap gap-1.5">{likely.map((o) => <button key={o.id} type="button" onClick={() => setMergeId(o.id)} className="tap rounded-full border border-border px-2.5 py-1 text-xs">{o.full_name}</button>)}</div>
        )}
        {mergeId ? (() => { const o = all.find((x) => x.id === mergeId); return (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
            <span className="min-w-0"><b>{o?.full_name}</b> <span className="text-muted-foreground">{o?.delegate_code}, {o?.email}{o?.organization ? `, ${o.organization}` : ""}</span></span>
            <span className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setMergeId("")} className="text-muted-foreground underline">Change</button>
              <button type="button" disabled={busy} onClick={() => merge()} className="tap rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground disabled:opacity-50">Merge</button>
            </span>
          </div>
        ); })() : (
          <>
            <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Search name, email, code or institution" className="mt-2 w-full rounded-full border border-border bg-card px-3 py-1.5 text-xs" />
            {mq.trim().length >= 2 && (
              <ul className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-border bg-card text-xs">
                {all.filter((o) => o.id !== person.id && [o.full_name, o.email, o.alt_email, o.delegate_code, o.organization].some((v) => v?.toLowerCase().includes(mq.trim().toLowerCase()))).slice(0, 12).map((o) => (
                  <li key={o.id}><button type="button" onClick={() => { setMergeId(o.id); setMq(""); }} className="w-full px-3 py-2 text-left hover:bg-muted/60"><b>{o.full_name}</b> <span className="text-muted-foreground">{o.delegate_code}, {o.email}{o.organization ? `, ${o.organization}` : ""}</span></button></li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {field("organization", "Institution")}
      {field("category", "Category")}
      {field("address", "Address", true)}
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Roles</p>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => (
            <button key={r} type="button" onClick={() => setRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))}
              className={cn("tap rounded-full border px-3 py-1 text-xs", roles.includes(r) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
              {r.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Consent</p>
        {([["consent_networking", "Show in networking"], ["consent_photo", "Photos"], ["consent_whatsapp", "WhatsApp messages"], ["consent_calls", "Phone calls"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center justify-between text-sm">
            {l}
            <Switch checked={p[k]} onCheckedChange={(v) => set(k, v)} />
          </label>
        ))}
      </div>
      {p.accommodations?.[0] && (
        <p className="text-sm">Room: {p.accommodations[0].residence} {p.accommodations[0].room_no}</p>
      )}
      {field("notes", "Notes", true)}
      <div className="sticky bottom-0 -mx-6 space-y-2 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
      {ask && (
        <div className="rounded-xl border border-primary/40 bg-card px-3 py-2.5 text-sm">
          <p>{ask.msg}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => { const go = ask.go; setAsk(null); void run(go); }} className="tap rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Working…" : "Yes, go ahead"}</button>
            <button type="button" onClick={() => setAsk(null)} className="tap rounded-full border border-border px-4 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}
      <button type="button" disabled={busy} onClick={() => run(() => save())} className="tap w-full disabled:opacity-50 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground">{busy ? "Saving…" : "Save"}</button>
      <button type="button" disabled={busy} onClick={() => remove()} className="tap inline-flex w-full items-center justify-center gap-2 rounded-full border border-destructive/40 py-2 text-sm text-destructive"><Trash2 className="size-4" /> Delete profile</button>
      </div>
    </div>
  );
}

type PP = { id: string; is_presenter: boolean; submissions: { submission_code: string; title: string | null; presentation_mode: string; presenter_name: string | null; authors: { name: string; org?: string | null }[]; sessions: { session_code: string | null; starts_at: string; ends_at: string; room: string | null; mode: string | null } | null } | null };

/** Papers this person is linked to, with session and full author list. */
function PersonPapers({ personId }: { personId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["registry", "person-papers", personId],
    queryFn: async () => {
      const { data } = await db.from("submission_people")
        .select("id, is_presenter, submissions(submission_code, title, presentation_mode, presenter_name, authors, sessions(session_code, starts_at, ends_at, room, mode))")
        .eq("person_id", personId);
      return (data ?? []) as unknown as PP[];
    },
  });
  if (!data.length) return <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">No papers linked</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Papers</p>
      {data.map((l) => { const s = l.submissions; if (!s) return null; return (
        <div key={l.id} className="card-flat rounded-xl px-3 py-2.5 text-sm">
          <p className="text-xs tabular-nums text-muted-foreground">#{s.submission_code}, {s.presentation_mode === "online" ? "Online" : "In person"}{l.is_presenter ? ", presents" : ""}</p>
          <p className="font-medium leading-snug">{s.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.sessions ? `${s.sessions.session_code ?? ""}, ${rangeLabel(s.sessions.starts_at, s.sessions.ends_at)}, ${s.sessions.mode === "online" ? "Online" : s.sessions.room ? `Room ${s.sessions.room}` : "Room TBA"}` : "Not placed in a session"}</p>
          <ol className="mt-1.5 space-y-0.5 text-xs">
            {(s.authors ?? []).map((a, i) => (
              <li key={i} className={cn(a.name === s.presenter_name && "font-semibold text-primary")}>{i + 1}. {a.name}{a.org ? <span className="text-muted-foreground">, {a.org}</span> : null}{a.name === s.presenter_name ? " (presenting)" : ""}</li>
            ))}
          </ol>
        </div>
      ); })}
    </div>
  );
}
