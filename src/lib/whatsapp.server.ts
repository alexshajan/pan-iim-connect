// Server-only WhatsApp plumbing: gateway calls and webhook event processing.
import { nextStatus, toWaId } from "./whatsapp";

export const WA_GATEWAY = "https://connector-gateway.lovable.dev/whatsapp";

export async function wa(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const lk = process.env["LOVABLE_API_KEY"], wk = process.env["WHATSAPP_API_KEY"];
  if (!lk) throw new Error("LOVABLE_API_KEY is not configured");
  if (!wk) throw new Error("WHATSAPP_API_KEY is not configured");
  const headers: Record<string, string> = { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": wk, ...init.headers };
  const req: RequestInit = { method: init.method ?? "GET", headers };
  if (init.body) { headers["Content-Type"] = "application/json"; req.body = JSON.stringify(init.body); }
  const res = await fetch(`${WA_GATEWAY}${path}`, req);
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) throw new Error(`WhatsApp request failed [${res.status}]: ${json?.error?.message ?? text.slice(0, 400)}`);
  return json;
}

type Db = any;

async function personFor(db: Db, waId: string): Promise<string | null> {
  const tail = waId.slice(-10);
  const { data } = await db.from("people").select("id, phone").ilike("phone", `%${tail.slice(0, 5)}%${tail.slice(5)}%`).limit(5);
  const hit = (data ?? []).find((p: any) => toWaId(p.phone) === waId);
  return hit?.id ?? null;
}

const tsOf = (s: unknown) => (s ? new Date(Number(s) * 1000).toISOString() : null);

function textOf(m: any): { kind: string; body: string | null; media: string | null } {
  const t = m.type ?? "text";
  if (t === "text") return { kind: t, body: m.text?.body ?? null, media: null };
  if (t === "button") return { kind: t, body: m.button?.text ?? null, media: null };
  if (t === "interactive") return { kind: t, body: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null, media: null };
  if (t === "location") return { kind: t, body: `Location: ${m.location?.latitude}, ${m.location?.longitude}`, media: null };
  const media = m[t]?.id ?? null;
  return { kind: t, body: m[t]?.caption ?? m[t]?.filename ?? null, media };
}

/** Process one stored delivery. Returns false when it must wait (status before its outbound row). */
export async function processEvent(db: Db, row: { id: string; event: string; payload: any; received_at: string }): Promise<boolean> {
  const value = row.payload?.entry?.[0]?.changes?.[0]?.value ?? {};
  if (row.event === "whatsapp.message") {
    for (const m of value.messages ?? []) {
      const waId = String(m.from);
      const { kind, body, media } = textOf(m);
      const { error } = await db.from("whatsapp_messages").upsert({
        wamid: m.id, direction: "in", wa_id: waId, person_id: await personFor(db, waId), kind, body, media_id: media,
        status: "received", provider_ts: tsOf(m.timestamp),
      }, { onConflict: "wamid", ignoreDuplicates: true });
      if (error) throw error;
    }
    return true;
  }
  if (row.event === "whatsapp.status") {
    for (const s of value.statuses ?? []) {
      const { data: cur, error } = await db.from("whatsapp_messages").select("id, status, sent_at, delivered_at, read_at, failed_at").eq("wamid", s.id).maybeSingle();
      if (error) throw error;
      if (!cur) {
        // Callback beat the sender's write; retry later, give up after a day.
        if (Date.now() - new Date(row.received_at).getTime() > 864e5) return true;
        return false;
      }
      const at = tsOf(s.timestamp);
      const col = `${s.status}_at` as const;
      const patch: Record<string, unknown> = { status: nextStatus(cur.status, s.status) };
      if (["sent", "delivered", "read", "failed"].includes(s.status) && !cur[col]) patch[col] = at;
      if (s.errors?.length) patch["error"] = s.errors;
      const { error: uErr } = await db.from("whatsapp_messages").update(patch).eq("id", cur.id);
      if (uErr) throw uErr;
    }
    return true;
  }
  return true; // template_status, account_update and others stay stored for the console.
}

/** Retry a few unfinished deliveries, oldest-attempted first so none starve. */
export async function drainPending(db: Db, limit = 15) {
  const { data } = await db.from("whatsapp_webhook_events").select("id, event, payload, received_at, attempts")
    .is("processed_at", null).order("attempts").order("received_at").limit(limit);
  for (const r of data ?? []) await runOne(db, r);
}

export async function runOne(db: Db, r: { id: string; event: string; payload: any; received_at: string; attempts?: number }) {
  try {
    const done = await processEvent(db, r);
    await db.from("whatsapp_webhook_events").update(done ? { processed_at: new Date().toISOString(), processing_error: null, attempts: (r.attempts ?? 0) + 1 } : { attempts: (r.attempts ?? 0) + 1 }).eq("id", r.id);
    return true;
  } catch (e) {
    await db.from("whatsapp_webhook_events").update({ processing_error: String((e as Error).message).slice(0, 500), attempts: (r.attempts ?? 0) + 1 }).eq("id", r.id);
    return false;
  }
}
