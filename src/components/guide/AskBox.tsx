import { useNavigate } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { createThread } from "@/lib/guide-data";

/** Typewriter cycling through suggestions, like a live placeholder. */
function useTypewriter(input: string[]) {
  const [text, setText] = useState("");
  const key = input.join("\n");
  useEffect(() => {
    const lines = key ? key.split("\n") : [];
    if (!lines.length) return;
    let line = 0;
    let i = 0;
    let dir = 1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const cur = lines[line % lines.length]!;
      i += dir;
      setText(cur.slice(0, i));
      let wait = dir > 0 ? 38 : 16;
      if (dir > 0 && i >= cur.length) (dir = -1), (wait = 2200);
      else if (dir < 0 && i <= 0) (dir = 1), (line += 1), (wait = 350);
      timer = setTimeout(tick, wait);
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [key]);
  return text;
}

export function AskBox({ suggestions }: { suggestions: string[] }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const ghost = useTypewriter(suggestions);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    if (!user) {
      toast("Sign in to chat with the Guide", { action: { label: "Sign in", onClick: () => navigate({ to: "/auth" }) } });
      return;
    }
    setBusy(true);
    try {
      const id = await createThread(user.id, q);
      navigate({ to: "/guide/chat/$threadId", params: { threadId: id } });
    } catch {
      toast.error("Couldn't start a chat. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(value);
        }}
        className="relative rounded-[1.4rem] bg-card p-2 shadow-lift"
      >
        <label htmlFor="guide-ask" className="sr-only">Ask the Guide</label>
        <textarea
          id="guide-ask"
          ref={ref}
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(value);
            }
          }}
          className="block w-full resize-none bg-transparent px-3 pt-2 pr-12 text-[0.95rem] leading-snug outline-none"
        />
        {!value ? (
          <span aria-hidden className="pointer-events-none absolute top-4 left-5 right-14 text-[0.95rem] leading-snug text-muted-foreground">
            {ghost}
            <span className="ml-px inline-block h-[1.05em] w-px translate-y-[0.15em] animate-pulse bg-hills" />
          </span>
        ) : null}
        <button
          type="submit"
          disabled={busy || loading}
          aria-label="Ask"
          className="press absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        {suggestions.slice(0, 4).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void ask(s)}
            className="tap shrink-0 rounded-full bg-surface-muted px-3.5 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
