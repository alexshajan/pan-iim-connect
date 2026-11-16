import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, isStepCount, streamText, tool, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id.server";
import {
  bookingLinks,
  guidePhase,
  LAST_SAFE_GUWAHATI_DEPARTURE,
  DARK_BY,
  planArrival,
  planItineraries,
  type Place,
  type TravelLeg,
} from "@/lib/guide";
import { LANDMARKS } from "@/lib/landmarks";

const MODEL = "openai/gpt-6-astra";

function instructions(now: Date) {
  const phase = guidePhase(now);
  return `You are "Kong", the Guide assistant of the 11th Pan-IIM WMC at IIM Shillong (27–29 November 2026), in partnership with Meghalaya Tourism.
Today (India time) is ${now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full" })}. Current focus: ${phase === "arrival" ? "helping guests travel to Shillong" : "helping guests explore Shillong and Meghalaya (and plan departures)"}.

Rules:
- Every fare, duration, place, fee and driver must come from a tool result. Never invent prices, places, phone numbers or timings. If tools return nothing, say we don't have verified info yet and suggest the help desk.
- Fares are indicative ranges collected by organizers, not live prices. For flights/trains, point to the booking links returned by tools.
- Road safety: leave Guwahati for Shillong by ${LAST_SAFE_GUWAHATI_DEPARTURE}; it gets dark by about 5 pm. Day trips must be back by ${DARK_BY}.
- Cab drivers are listed as a community resource; the institute does not take responsibility for them. Always say so when sharing contacts.
- Ask at most one short follow-up question when key input is missing (origin city, date, group size). Otherwise call tools straight away.
- Keep replies short and warm. The app shows tool results as cards, so summarise and recommend rather than repeating every number.`;
}

function dbFor(token: string) {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/guide-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Sign in to chat." }, { status: 401 });
        const db = dbFor(token);
        const { data: userData, error: userErr } = await db.auth.getUser(token);
        if (userErr || !userData.user) return Response.json({ error: "Sign in to chat." }, { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as { messages?: UIMessage[]; threadId?: string };
        const messages = body.messages ?? [];
        const threadId = body.threadId;
        if (!threadId || !messages.length) return Response.json({ error: "Bad request" }, { status: 400 });
        const { data: thread } = await db.from("guide_threads").select("id,title").eq("id", threadId).maybeSingle();
        if (!thread) return Response.json({ error: "Chat not found" }, { status: 404 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "Assistant is not configured." }, { status: 500 });

        // Save the newest user message now so it survives a failed reply.
        const last = messages[messages.length - 1]!;
        if (last.role === "user") {
          const { error } = await db
            .from("guide_messages")
            .upsert({ thread_id: threadId, user_id: userId, message_id: last.id, message: last as never }, { onConflict: "thread_id,message_id" });
          if (error) console.error("guide user message save failed", error);
          if (thread.title === "New chat") {
            const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
            await db.from("guide_threads").update({ title: text.slice(0, 60) || "New chat", updated_at: new Date().toISOString() }).eq("id", threadId);
          }
        }

        const now = new Date();
        const tools = {
          planArrival: tool({
            description: "Build ranked door-to-campus travel plans (cheapest, fastest, balanced) from a guest's origin city.",
            inputSchema: z.object({
              from: z.string().describe("Origin city, e.g. Delhi"),
              modes: z.array(z.enum(["air", "train"])).nullable(),
              budget: z.number().nullable().describe("Total budget per person in INR"),
              date: z.string().nullable().describe("Travel date YYYY-MM-DD"),
            }),
            execute: async ({ from, modes, budget, date }) => {
              const { data } = await db.from("travel_legs").select("*");
              const plans = planArrival({ from, modes: modes ?? undefined, budget }, (data ?? []) as TravelLeg[]);
              return {
                from,
                date,
                plans: plans.map((p) => ({ ...p, legs: p.legs.map((l) => ({ ...l, links: bookingLinks(l, date ?? undefined) })) })),
                originKnown: plans.some((p) => p.legs[0]?.kind === "main"),
              };
            },
          }),
          planItinerary: tool({
            description: "Plan feasible sightseeing itineraries in Shillong / Meghalaya from the vetted places catalogue.",
            inputSchema: z.object({
              start: z.string().describe("Start time HH:MM, 24h"),
              end: z.string().describe("Latest return time HH:MM, 24h"),
              groupSize: z.number(),
              tags: z.array(z.enum(["nature", "culture", "food", "shopping", "adventure"])).nullable(),
              maxEffort: z.enum(["easy", "moderate", "hard"]).nullable(),
              area: z.enum(["shillong", "beyond", "any"]).nullable(),
              budgetPerPerson: z.number().nullable(),
            }),
            execute: async (input) => {
              const { data } = await db.from("tourism_places").select("*");
              const itineraries = planItineraries(
                { ...input, tags: input.tags ?? undefined, maxEffort: input.maxEffort ?? undefined, area: input.area ?? "any" },
                (data ?? []) as Place[],
              );
              return { itineraries };
            },
          }),
          searchPlaces: tool({
            description: "Look up places in the vetted Meghalaya catalogue by name or tag.",
            inputSchema: z.object({ query: z.string() }),
            execute: async ({ query }) => {
              const { data } = await db.from("tourism_places").select("name,area,region,summary,tags,effort,drive_min,visit_min,opens,closes,entry_fee,notes,closed");
              const q = query.toLowerCase();
              return { places: (data ?? []).filter((p) => `${p.name} ${p.region} ${p.tags.join(" ")} ${p.summary}`.toLowerCase().includes(q)).slice(0, 6) };
            },
          }),
          listCabs: tool({
            description: "List community cab driver contacts and their fare asks, optionally filtered by route words.",
            inputSchema: z.object({ route: z.string().nullable() }),
            execute: async ({ route }) => {
              const { data } = await db.from("cab_drivers").select("name,phone,whatsapp,vehicle,seats,languages,routes,notes").eq("active", true);
              const q = route?.toLowerCase();
              const cabs = (data ?? []).filter((c) => !q || JSON.stringify(c.routes).toLowerCase().includes(q.split(" ")[0] ?? ""));
              return { cabs: cabs.length ? cabs : (data ?? []), disclaimer: "Community-listed drivers. Not endorsed by IIM Shillong; agree fares before the ride." };
            },
          }),
          getVenueLocation: tool({
            description: "Get the map location and directions link for a campus building (e.g. Admin Block, Mess, Hostel 2).",
            inputSchema: z.object({ name: z.string() }),
            execute: async ({ name }) => {
              const q = name.toLowerCase();
              const hit = LANDMARKS.find((l) => l.name.toLowerCase().includes(q) || l.inside?.some((i) => i.toLowerCase().includes(q)));
              if (!hit) return { found: false };
              return { found: true, name: hit.name, lat: hit.lat, lng: hit.lng, mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${hit.lat},${hit.lng}&travelmode=walking`, appPath: `/campus?venue=${hit.id}` };
            },
          }),
          getWeather: tool({
            description: "Shillong daily weather forecast (next up to 16 days).",
            inputSchema: z.object({}),
            execute: async () => {
              try {
                const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=25.57&longitude=91.88&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset&timezone=Asia%2FKolkata&forecast_days=16");
                if (!r.ok) return { error: "Forecast unavailable right now." };
                const j = (await r.json()) as { daily: Record<string, unknown[]> };
                const d = j.daily;
                return {
                  days: (d["time"] ?? []).map((t, i) => ({ date: t, max: d["temperature_2m_max"]?.[i], min: d["temperature_2m_min"]?.[i], rain: d["precipitation_probability_max"]?.[i], sunset: String(d["sunset"]?.[i] ?? "").slice(11) })),
                  note: "Late November in Shillong is usually 8–20°C, dry and sunny; evenings are cold.",
                };
              } catch {
                return { error: "Forecast unavailable right now." };
              }
            },
          }),
        };

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: provider.responses(MODEL),
          instructions: instructions(now),
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: isStepCount(50),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return withLovableAiGatewayRunIdHeader(
          result.toUIMessageStreamResponse({
            originalMessages: messages,
            sendReasoning: true,
            onError: (e) => {
              console.error("guide chat error", e);
              const status = (e as { statusCode?: number })?.statusCode;
              if (status === 429) return "The assistant is busy right now. Try again in a minute.";
              if (status === 402) return "The assistant is out of credits. Please tell the organizers.";
              return "Something went wrong. Please try again.";
            },
            onFinish: async ({ responseMessage }) => {
              const { error } = await db.from("guide_messages").upsert(
                { thread_id: threadId, user_id: userId, message_id: responseMessage.id, message: responseMessage as never },
                { onConflict: "thread_id,message_id" },
              );
              if (error) console.error("guide assistant message save failed", error);
              await db.from("guide_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
            },
          }),
          runIdFetch,
        );
      },
    },
  },
});
