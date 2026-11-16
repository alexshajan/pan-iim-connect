import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ParsedRow } from "@/lib/schedule-import";

type Input = { fileName: string; mediaType: string; base64?: string; text?: string };

const SCHEMA_HINT = `Conference days are 2026-11-27, 2026-11-28, 2026-11-29 (India time). Return every session in the timetable.`;

export const parseTimetable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    if (!d || typeof d.fileName !== "string") throw new Error("Missing file");
    if (!d.base64 && !d.text) throw new Error("Empty file");
    if ((d.base64?.length ?? 0) > 14_000_000) throw new Error("File is too large (max ~10 MB)");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ rows: ParsedRow[]; error?: string }> => {
    const { data: org } = await context.supabase.rpc("is_organizer", { _user_id: context.userId });
    if (!org) return { rows: [], error: "Only organizers can import timetables." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { rows: [], error: "AI is not configured." };

    const [{ createOpenAI }, { streamText, Output, NoObjectGeneratedError }, { z }, runId] = await Promise.all([
      import("@ai-sdk/openai"), import("ai"), import("zod"), import("@/lib/ai/run-id.server"),
    ]);
    const schema = z.object({
      sessions: z.array(z.object({
        date: z.string().describe("YYYY-MM-DD"),
        start: z.string().describe("HH:MM 24h"),
        end: z.string().describe("HH:MM 24h"),
        venue: z.string().nullable(),
        track: z.string().nullable(),
        title: z.string(),
        chair: z.string().nullable(),
        papers: z.array(z.object({ title: z.string(), authors: z.string().nullable(), code: z.string().nullable() })),
      })),
    });
    const fetcher = runId.createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: fetcher.fetch,
    });
    const filePart = data.base64
      ? data.mediaType === "application/pdf"
        ? { type: "file" as const, filename: data.fileName, data: data.base64, mediaType: "application/pdf" }
        : { type: "image" as const, image: new URL(`data:${data.mediaType};base64,${data.base64}`) }
      : { type: "text" as const, text: `Timetable (${data.fileName}):\n${data.text!.slice(0, 120_000)}` };

    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: `You extract conference timetables into structured sessions. Copy titles, names and room labels exactly as written. Use null when a field is absent. Paper codes look like PAN-101 or similar IDs. ${SCHEMA_HINT}`,
        messages: [{ role: "user", content: [{ type: "text", text: "Extract every session from this timetable." }, filePart] }],
        output: Output.object({ schema }),
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      const out = await result.output;
      return { rows: out.sessions };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) return { rows: [], error: "Couldn't read a timetable from that file." };
      const status = (e as { statusCode?: number }).statusCode;
      console.error("timetable parse failed", e);
      if (status === 429) return { rows: [], error: "The AI is busy. Try again in a minute." };
      if (status === 402) return { rows: [], error: "AI credits have run out." };
      return { rows: [], error: "Reading the file failed. Try again or use a clearer file." };
    }
  });
