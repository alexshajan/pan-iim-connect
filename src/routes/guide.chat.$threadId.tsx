import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mountain } from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { ArrivalPlanCard, CabCard, CabDisclaimer, ItineraryCard } from "@/components/guide/GuideCards";
import { CoBrand } from "@/components/guide/GuideHeader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PENDING_KEY } from "@/lib/guide-data";

export const Route = createFileRoute("/guide/chat/$threadId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat with the Guide, Pan-IIM 2026" },
      { name: "description", content: "Your private chat with the Pan-IIM travel and Meghalaya assistant." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Pan-IIM Guide chat" },
      { property: "og:description", content: "Travel and trip planning assistant for Pan-IIM 2026." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const { user, loading } = useAuth();
  const history = useQuery({
    queryKey: ["guide", "messages", threadId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guide_messages")
        .select("message")
        .eq("thread_id", threadId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((r) => r.message as unknown as UIMessage);
    },
  });

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-4 pb-2">
        <Link to="/guide" className="tap inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <ArrowLeft className="size-3.5" /> Guide
        </Link>
        <CoBrand />
      </header>
      {loading || (user && history.isLoading) ? (
        <div className="grid flex-1 place-items-center"><Shimmer>Opening your chat…</Shimmer></div>
      ) : !user ? (
        <div className="mx-auto mt-16 max-w-sm px-5 text-center">
          <p className="text-display text-xl">Sign in to chat</p>
          <p className="mt-1 text-sm text-muted-foreground">Your chats are saved to your account.</p>
          <Link to="/auth" className="tap mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Sign in</Link>
        </div>
      ) : history.isError ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">Couldn&apos;t load this chat.</p>
      ) : (
        <ChatWindow key={threadId} threadId={threadId} initial={history.data ?? []} />
      )}
    </div>
  );
}

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const sentPending = useRef(false);
  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initial,
    transport: new DefaultChatTransport({
      api: "/api/guide-chat",
      body: { threadId },
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    onError: (e) => toast.error(e.message || "The Guide couldn't reply. Try again."),
    onFinish: () => void qc.invalidateQueries({ queryKey: ["guide", "threads"] }),
  });
  const busy = status === "submitted" || status === "streaming";
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sentPending.current) return;
    sentPending.current = true;
    const pending = sessionStorage.getItem(PENDING_KEY(threadId));
    if (pending && initial.length === 0) {
      sessionStorage.removeItem(PENDING_KEY(threadId));
      void sendMessage({ text: pending });
    }
  }, [threadId, initial.length, sendMessage]);

  useEffect(() => {
    if (!busy) taRef.current?.focus();
  }, [busy]);

  return (
    <>
      <Conversation className="mx-auto w-full max-w-2xl flex-1">
        <ConversationContent className="px-4">
          {messages.length === 0 ? (
            <div className="mt-10 text-center text-sm text-muted-foreground">Ask about routes, fares or a day out in Meghalaya.</div>
          ) : null}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === "user" ? "bg-primary text-primary-foreground" : "bg-transparent"}>
                {m.role === "assistant" ? (
                  <span className="mb-1 inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-hills">
                    <Mountain className="size-3.5" /> Guide
                  </span>
                ) : null}
                {m.parts.map((part, i) => <Part key={i} part={part} />)}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" ? <Shimmer className="text-sm">Checking routes and places…</Shimmer> : null}
          {error ? <p className="text-xs text-destructive">{error.message}</p> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <PromptInput
          onSubmit={({ text }) => {
            if (!text.trim() || busy) return;
            void sendMessage({ text });
          }}
        >
          <PromptInputTextarea ref={taRef} autoFocus placeholder="Ask the Guide…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

type AnyPart = UIMessage["parts"][number];

function Part({ part }: { part: AnyPart }) {
  if (part.type === "text") return <MessageResponse>{part.text}</MessageResponse>;
  if (!part.type.startsWith("tool-")) return null;
  const p = part as AnyPart & { type: `tool-${string}`; state: string; input?: unknown; output?: unknown; errorText?: string };
  const out = p.state === "output-available" ? (p.output as Record<string, unknown>) : null;
  return (
    <div className="my-1 space-y-2">
      {out ? <ToolCards name={p.type.slice(5)} out={out} /> : null}
      <Tool defaultOpen={false}>
        <ToolHeader type={p.type as never} state={p.state as never} />
        <ToolContent>
          <ToolInput input={p.input} />
          <ToolOutput output={p.output as never} errorText={p.errorText} />
        </ToolContent>
      </Tool>
    </div>
  );
}

function ToolCards({ name, out }: { name: string; out: Record<string, unknown> }) {
  if (name === "planArrival") {
    const plans = (out["plans"] ?? []) as Parameters<typeof ArrivalPlanCard>[0]["plan"][];
    return <div className="space-y-2">{plans.map((p, i) => <ArrivalPlanCard key={p.label} plan={p} highlight={i === 0} />)}</div>;
  }
  if (name === "planItinerary") {
    const its = (out["itineraries"] ?? []) as Parameters<typeof ItineraryCard>[0]["it"][];
    return <div className="space-y-2">{its.map((it) => <ItineraryCard key={it.title} it={it} />)}</div>;
  }
  if (name === "listCabs") {
    const cabs = (out["cabs"] ?? []) as Parameters<typeof CabCard>[0]["cab"][];
    return (
      <div className="space-y-2">
        {cabs.slice(0, 4).map((c) => <CabCard key={c.phone} cab={c} />)}
        <CabDisclaimer />
      </div>
    );
  }
  if (name === "getVenueLocation" && out["found"]) {
    return (
      <a href={String(out["mapsUrl"])} target="_blank" rel="noreferrer" className="tap inline-flex rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground">
        Walk to {String(out["name"])} →
      </a>
    );
  }
  return null;
}
