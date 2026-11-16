import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fillParam, MERGE_FIELDS, templateName, toWaId, type MergeField } from "./whatsapp";

async function organizer(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_organizer", { _user_id: userId });
  if (!data) throw new Error("Only organizers can use WhatsApp Studio.");
}
const lib = () => import("./whatsapp.server");
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;

export const waHealth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await organizer(context.supabase, context.userId);
  const { wa } = await lib();
  const [phone, tpl] = await Promise.allSettled([
    wa("/phone_number?fields=display_phone_number,verified_name,quality_rating,name_status,messaging_limit_tier,platform_type"),
    wa("/message_templates?fields=name,status,language,category,components,rejected_reason&limit=100"),
  ]);
  return {
    phone: phone.status === "fulfilled" ? phone.value : null,
    phoneError: phone.status === "rejected" ? String(phone.reason?.message ?? phone.reason) : null,
    templates: tpl.status === "fulfilled" ? ((tpl.value?.data ?? []) as any[]) : [],
    templateError: tpl.status === "rejected" ? String(tpl.reason?.message ?? tpl.reason) : null,
  };
});

export const waCreateTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; category: string; language: string; header?: string; body: string; footer?: string; samples: string[]; url?: { text: string; url: string } | undefined }) => {
    if (!d.body?.trim() || d.body.length > 1024) throw new Error("Body is required (max 1024 characters).");
    if (!["UTILITY", "MARKETING"].includes(d.category)) throw new Error("Pick Utility or Marketing.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await organizer(context.supabase, context.userId);
    const components: any[] = [];
    if (data.header?.trim()) components.push({ type: "HEADER", format: "TEXT", text: data.header.trim().slice(0, 60) });
    const body: any = { type: "BODY", text: data.body.trim() };
    if (data.samples.length) body.example = { body_text: [data.samples] };
    components.push(body);
    if (data.footer?.trim()) components.push({ type: "FOOTER", text: data.footer.trim().slice(0, 60) });
    if (data.url?.url) components.push({ type: "BUTTONS", buttons: [{ type: "URL", text: data.url.text.slice(0, 25) || "Open", url: data.url.url }] });
    const { wa } = await lib();
    return wa("/message_templates", { method: "POST", body: { name: templateName(data.name), language: data.language, category: data.category, components } });
  });

export const waDeleteTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => ({ name: templateName(d.name) }))
  .handler(async ({ data, context }) => {
    await organizer(context.supabase, context.userId);
    const { wa } = await lib();
    return wa(`/message_templates?name=${encodeURIComponent(data.name)}`, { method: "DELETE" });
  });

async function logOut(db: any, row: Record<string, unknown>, res: Promise<any>) {
  try {
    const r = await res;
    const wamid = r?.messages?.[0]?.id ?? null;
    await db.from("whatsapp_messages").insert({ ...row, wamid, status: "accepted" });
    if (wamid) {
      // Reconcile receipts that arrived before this row existed.
      const { drainPending } = await lib();
      await drainPending(db, 5).catch(() => undefined);
    }
    return true;
  } catch (e) {
    await db.from("whatsapp_messages").insert({ ...row, status: "failed", failed_at: new Date().toISOString(), error: { message: String((e as Error).message).slice(0, 500) } });
    return false;
  }
}

export const waReply = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { waId: string; text: string }) => {
    const waId = toWaId(d.waId);
    if (!waId) throw new Error("Invalid number.");
    if (!d.text?.trim() || d.text.length > 4096) throw new Error("Write a message (max 4096 characters).");
    return { waId, text: d.text.trim() };
  })
  .handler(async ({ data, context }) => {
    await organizer(context.supabase, context.userId);
    const db = await admin();
    const { data: last } = await db.from("whatsapp_messages").select("created_at, person_id").eq("wa_id", data.waId).eq("direction", "in").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last || Date.now() - new Date(last.created_at).getTime() > 864e5) throw new Error("The 24-hour reply window is closed. Send an approved template instead.");
    const { wa } = await lib();
    const ok = await logOut(db, { direction: "out", wa_id: data.waId, person_id: last.person_id, kind: "text", body: data.text, sent_by: context.userId },
      wa("/messages", { method: "POST", body: { messaging_product: "whatsapp", to: data.waId, type: "text", text: { body: data.text } } }));
    if (!ok) throw new Error("WhatsApp didn't accept the message. See the thread for the reason.");
    return { ok };
  });

type Mapping = { field: MergeField; custom: string };
export const waBroadcast = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { personIds: string[]; template: string; language: string; body: string; mapping: Mapping[]; audience: Record<string, unknown> }) => {
    if (!Array.isArray(d.personIds) || !d.personIds.length) throw new Error("No recipients.");
    if (d.personIds.length > 1500) throw new Error("Up to 1,500 recipients per send.");
    if (!d.mapping.every((m) => (MERGE_FIELDS as readonly string[]).includes(m.field))) throw new Error("Bad variable mapping.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await organizer(context.supabase, context.userId);
    const db = await admin();
    const people: any[] = [];
    for (let i = 0; i < data.personIds.length; i += 300) {
      const { data: rows, error } = await db.from("people").select("id, full_name, delegate_code, organization, phone, consent_whatsapp, is_placeholder").in("id", data.personIds.slice(i, i + 300));
      if (error) throw error;
      people.push(...(rows ?? []));
    }
    // Consent is enforced here, not just in the browser.
    const targets = people.filter((p) => p.consent_whatsapp && !p.is_placeholder && toWaId(p.phone));
    const { data: b, error: bErr } = await db.from("whatsapp_broadcasts").insert({ template_name: data.template, language: data.language, audience: data.audience, params: data.mapping, total: targets.length, created_by: context.userId }).select("id").single();
    if (bErr) throw bErr;
    const { wa } = await lib();
    let accepted = 0, failed = 0;
    for (let i = 0; i < targets.length; i += 8) {
      const res = await Promise.all(targets.slice(i, i + 8).map((p) => {
        const params = data.mapping.map((m) => ({ type: "text", text: fillParam(m.field, m.custom, p).slice(0, 1000) }));
        const to = toWaId(p.phone)!;
        const body = params.reduce((s, x, k) => s.replaceAll(`{{${k + 1}}}`, x.text), data.body);
        return logOut(db, { direction: "out", wa_id: to, person_id: p.id, kind: "template", template_name: data.template, body, broadcast_id: b.id, sent_by: context.userId },
          wa("/messages", { method: "POST", body: { messaging_product: "whatsapp", to, type: "template", template: { name: data.template, language: { code: data.language }, components: params.length ? [{ type: "body", parameters: params }] : [] } } }));
      }));
      for (const ok of res) ok ? accepted++ : failed++;
    }
    await db.from("whatsapp_broadcasts").update({ accepted, failed }).eq("id", b.id);
    return { id: b.id, total: targets.length, skipped: people.length - targets.length, accepted, failed };
  });
