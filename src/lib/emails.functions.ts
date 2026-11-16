import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PREVIEWABLE = ["welcome-pass", "missing-info", "conference-update", "app-nudge", "presentation-slot"] as const;
type Previewable = (typeof PREVIEWABLE)[number];
/** Only one-to-one, record-specific emails can be sent from the app itself. */
const SENDABLE = ["welcome-pass", "missing-info", "presentation-slot"] as const;
type Sendable = (typeof SENDABLE)[number];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

async function assertOrganizer(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_organizer", { _user_id: userId });
  if (!data) throw new Error("Only organizers can use emails.");
}

const IST = "Asia/Kolkata";
function whenLabel(start: string, end: string) {
  const d = new Date(start);
  const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST });
  const t = (x: string) => new Date(x).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST }).replace(/\s?([ap])m/i, (_, a) => ` ${a.toUpperCase()}M`);
  return `${day}, ${t(start)}–${t(end)}`;
}

/** Each paper this person presents, with its slot in plain words. */
async function slotPapers(supabase: any, personId: string) {
  const { data } = await supabase
    .from("submission_people")
    .select("submissions(submission_code, title, presentation_mode, sessions(title, area, starts_at, ends_at, room, mode, venues(name)))")
    .eq("person_id", personId);
  return ((data ?? []) as any[])
    .map((r) => r.submissions)
    .filter((s) => s?.sessions)
    .map((s) => {
      const ss = s.sessions;
      const online = (s.presentation_mode ?? ss.mode) === "online";
      return {
        code: String(s.submission_code),
        title: s.title ?? "Your paper",
        session: ss.area || ss.title,
        when: whenLabel(ss.starts_at, ss.ends_at),
        where: online ? "Online, link by email" : [ss.room ? `Room ${ss.room}` : null, ss.venues?.name].filter(Boolean).join(", ") || "Venue to be announced",
        online,
        _start: ss.starts_at as string,
      };
    })
    .sort((a, b) => a._start.localeCompare(b._start))
    .map(({ _start, ...p }) => p);
}

export const previewEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { template: string; data?: Record<string, unknown>; personId?: string | undefined }) => {
    if (!PREVIEWABLE.includes(i.template as Previewable)) throw new Error("Unknown template");
    const d = (i.data ?? {}) as { [k: string]: unknown };
    return {
      template: i.template as Previewable,
      personId: typeof i.personId === "string" && /^[0-9a-f-]{36}$/i.test(i.personId) ? i.personId : undefined,
      data: {
        name: str(d["name"], 120), code: str(d["code"], 40), role: str(d["role"], 60), title: str(d["title"], 160),
        body: str(d["body"], 4000), ctaLabel: str(d["ctaLabel"], 40), ctaUrl: str(d["ctaUrl"], 400),
        deadline: str(d["deadline"], 60), session: str(d["session"], 160),
        missing: Array.isArray(d["missing"]) ? d["missing"].filter((m) => typeof m === "string").slice(0, 8) : undefined,
      } as Record<string, unknown>,
    };
  })
  .handler(async ({ data, context }) => {
    await assertOrganizer(context.supabase, context.userId);
    if (data.template === "presentation-slot" && data.personId) {
      const papers = await slotPapers(context.supabase, data.personId);
      if (papers.length) data.data["papers"] = papers;
    }
    const React = await import("react");
    const { render } = await import("@react-email/render");
    const { TEMPLATES } = await import("@/lib/email-templates/registry");
    const t = TEMPLATES[data.template]!;
    const props = data.template === "presentation-slot" && !data.data["papers"] ? { ...t.previewData, ...data.data, papers: t.previewData?.["papers"] } : data.data;
    const html = await render(React.createElement(t.component, props));
    const subject = typeof t.subject === "function" ? t.subject(props) : t.subject;
    return { html, subject };
  });

export const sendPersonEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { personId: string; template: string; deadline?: string | undefined }) => {
    if (!SENDABLE.includes(i.template as Sendable)) throw new Error("This email can't be sent from the app");
    if (!/^[0-9a-f-]{36}$/i.test(i.personId)) throw new Error("Bad person");
    return { personId: i.personId, template: i.template as Sendable, deadline: str(i.deadline, 60) };
  })
  .handler(async ({ data, context }) => {
    await assertOrganizer(context.supabase, context.userId);
    const { data: person, error } = await (context.supabase as any)
      .from("people")
      .select("id, full_name, email, email_missing, phone, organization, delegate_code, is_placeholder")
      .eq("id", data.personId)
      .maybeSingle();
    if (error || !person) return { ok: false as const, message: "Person not found" };
    if (person.is_placeholder || person.email_missing) return { ok: false as const, message: "No usable email on file" };
    const missing = [!person.phone ? "Phone number" : null, !person.organization ? "Institution" : null].filter(Boolean) as string[];
    if (data.template === "missing-info" && !missing.length) return { ok: false as const, message: "Nothing is missing for this person" };
    const papers = data.template === "presentation-slot" ? await slotPapers(context.supabase, person.id) : [];
    if (data.template === "presentation-slot" && !papers.length) return { ok: false as const, message: "No assigned slot for this person" };

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const slotKey = papers.map((p) => `${p.code}@${p.when}`).join("|");
      const r = await sendTemplateEmail(data.template, person.email, {
        templateData: { name: person.full_name, code: person.delegate_code, missing, deadline: data.deadline, papers },
        // Slot emails re-send only when the slot itself changes.
        idempotencyKey: data.template === "presentation-slot"
          ? `presentation-slot-${person.id}-${slotKey}`.slice(0, 250)
          : `${data.template}-${person.id}-${new Date().toISOString().slice(0, 10)}`,
      });
      if (!r.sent) return { ok: false as const, message: "This address has unsubscribed or bounced" };
      return { ok: true as const, message: `Sent to ${person.email}` };
    } catch (e: any) {
      if (e?.code === "domain_not_verified") return { ok: false as const, message: "Sender domain is still verifying" };
      if (e?.status === 429) return { ok: false as const, message: "Sending too fast, try again in a minute" };
      return { ok: false as const, message: e?.message ?? "Send failed" };
    }
  });

/** Emails the organizer POCs that a volunteer alert is waiting. Caller must own the pending request. */
export const notifyAlertApprovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { requestId: string; origin: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(i.requestId)) throw new Error("Bad request");
    const origin = /^https:\/\/[a-z0-9.-]+$/i.test(i.origin) ? i.origin : "https://paniim.planos.in";
    return { requestId: i.requestId, origin };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: req } = await sb.from("alert_requests").select("id,title,body,status,requested_by").eq("id", data.requestId).maybeSingle();
    if (!req || req.requested_by !== context.userId || req.status !== "pending") return { sent: 0 };
    const { data: setting } = await sb.from("console_settings").select("value").eq("key", "alert_pocs").maybeSingle();
    const pocs = ((setting?.value as string[] | null) ?? []).filter((e) => typeof e === "string" && e.includes("@")).slice(0, 10);
    if (!pocs.length) return { sent: 0 };
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    let sent = 0;
    for (const to of pocs) {
      try {
        const r = await sendTemplateEmail("conference-update", to, {
          templateData: {
            title: `Alert waiting for approval: ${String(req.title).slice(0, 120)}`,
            body: String(req.body).slice(0, 1000),
            ctaLabel: "Review alert",
            ctaUrl: `${data.origin}/console/alerts?review=${req.id}`,
          },
          idempotencyKey: `alert-approval-${req.id}-${to}`,
        });
        if (r.sent) sent++;
      } catch (e) {
        console.error("approval email failed", e);
      }
    }
    return { sent };
  });

/** Loads what the "account linked" email shows for one merged person. */
async function linkedData(supabase: any, personId: string) {
  const { data: p } = await supabase.from("people").select("id, full_name, email, alt_email, delegate_code, is_placeholder").eq("id", personId).maybeSingle();
  if (!p || p.is_placeholder) return null;
  const { data: links } = await supabase.from("submission_people").select("submissions(submission_code, title)").eq("person_id", personId);
  const papers = ((links ?? []) as any[]).map((l) => l.submissions).filter(Boolean).map((s) => ({ code: String(s.submission_code), title: s.title ?? "Your paper" }));
  return { person: p, papers };
}

const validId = (i: { personId: string }) => {
  if (!/^[0-9a-f-]{36}$/i.test(i?.personId)) throw new Error("Bad person");
  return { personId: i.personId };
};

/** Preview of the after-merge email, for the organizer to approve. */
export const previewLinkedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validId)
  .handler(async ({ data, context }) => {
    await assertOrganizer(context.supabase, context.userId);
    const d = await linkedData(context.supabase, data.personId);
    if (!d) return { ok: false as const, message: "Person not found" };
    const recipients = [d.person.email, d.person.alt_email].filter((e: string | null) => e && e.includes("@")) as string[];
    const React = await import("react");
    const { render } = await import("@react-email/render");
    const { TEMPLATES } = await import("@/lib/email-templates/registry");
    const t = TEMPLATES["account-linked"]!;
    const props = { name: d.person.full_name, code: d.person.delegate_code, primaryEmail: d.person.email, addedEmail: d.person.alt_email, recipient: recipients[1] ?? recipients[0], papers: d.papers };
    const html = await render(React.createElement(t.component, props));
    return { ok: true as const, html, subject: t.subject as string, recipients, name: d.person.full_name as string };
  });

/** Sends the after-merge email separately to the registered and the added address. */
export const sendLinkedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validId)
  .handler(async ({ data, context }) => {
    await assertOrganizer(context.supabase, context.userId);
    const d = await linkedData(context.supabase, data.personId);
    if (!d) return { ok: false as const, message: "Person not found" };
    const recipients = [d.person.email, d.person.alt_email].filter((e: string | null) => e && e.includes("@")) as string[];
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const sent: string[] = [];
    const failed: string[] = [];
    for (const to of recipients) {
      try {
        const r = await sendTemplateEmail("account-linked", to, {
          templateData: { name: d.person.full_name, code: d.person.delegate_code, primaryEmail: d.person.email, addedEmail: d.person.alt_email, recipient: to, papers: d.papers },
          idempotencyKey: `account-linked-${d.person.id}-${d.person.alt_email}-${to}`.slice(0, 250),
        });
        (r.sent ? sent : failed).push(to);
      } catch (e: any) {
        console.error("account-linked send failed", e);
        failed.push(to);
      }
    }
    if (!sent.length) return { ok: false as const, message: "Couldn't send. The sender domain may still be verifying." };
    return { ok: true as const, message: `Sent to ${sent.join(" and ")}${failed.length ? `, not to ${failed.join(", ")}` : ""}` };
  });
