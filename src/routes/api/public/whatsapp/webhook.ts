import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const delivery = request.headers.get("X-Lovable-Delivery");
        const event = request.headers.get("X-Lovable-Event");
        const secret = process.env["WHATSAPP_API_KEY"];
        if (!secret) return new Response("not configured", { status: 500 });
        let payload: unknown;
        try {
          ({ payload } = await verifyWebhookRequest({ req: request, secret, maxBodyBytes: 4 * 1024 * 1024 }));
        } catch {
          return new Response("invalid signature", { status: 401 });
        }
        if (!delivery || !event) return new Response("missing headers", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runOne, drainPending } = await import("@/lib/whatsapp.server");
        const db = supabaseAdmin as any;
        const { error: insErr } = await db.from("whatsapp_webhook_events").upsert({ delivery_id: delivery, event, payload }, { onConflict: "delivery_id", ignoreDuplicates: true });
        if (insErr) return new Response("store failed", { status: 500 });
        const { data: row, error } = await db.from("whatsapp_webhook_events").select("id, event, payload, received_at, attempts, processed_at").eq("delivery_id", delivery).single();
        if (error || !row) return new Response("store failed", { status: 500 });
        if (!row.processed_at) {
          const ok = await runOne(db, row);
          if (!ok) return new Response("processing failed", { status: 500 });
        }
        await drainPending(db, 10).catch(() => undefined);
        return new Response("ok");
      },
    },
  },
});
