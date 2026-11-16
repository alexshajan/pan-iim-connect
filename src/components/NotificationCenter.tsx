import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Drawer as Vaul } from "vaul";
import { AlertTriangle, Bell, X } from "lucide-react";
import { announcementsQuery, type Announcement } from "@/lib/conference";
import { relativeToNow } from "@/lib/format";
import { cn } from "@/lib/utils";

const READ_KEY = "paniim.updates.readAt";

// Tiny shared store so the bell, the Home box and old /updates links all open the same sheet.
let open = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
export const openUpdates = () => { open = true; emit(); };
const setOpen = (v: boolean) => { open = v; emit(); };
const useOpen = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => open, () => false);

function readAt() {
  if (typeof window === "undefined") return Number.MAX_SAFE_INTEGER;
  return Number(localStorage.getItem(READ_KEY) ?? 0);
}

/** Notices published after the person last opened the sheet. */
export function useUnread() {
  const q = useQuery(announcementsQuery);
  const [mark, setMark] = useState(Number.MAX_SAFE_INTEGER);
  const isOpen = useOpen();
  useEffect(() => { setMark(readAt()); }, [isOpen]);
  const list = q.data ?? [];
  const unread = list.filter((a) => new Date(a.published_at).getTime() > mark);
  return { all: list, unread };
}

export function UpdatesBell() {
  const { unread } = useUnread();
  return (
    <button
      type="button"
      onClick={openUpdates}
      aria-label={unread.length ? `Updates, ${unread.length} new` : "Updates"}
      className="press relative grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"
    >
      <Bell className="h-4 w-4" />
      {unread.length ? (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-[1.05rem] place-items-center rounded-full bg-warn px-1 text-[0.6rem] font-bold leading-[1.05rem] text-warn-foreground tabular-nums">
          {unread.length > 9 ? "9+" : unread.length}
        </span>
      ) : null}
    </button>
  );
}

/** One sheet for every organizer notice. Mounted once in the root. */
export function UpdatesSheet() {
  const isOpen = useOpen();
  const { all } = useUnread();
  const [mark] = useState(() => readAt());
  useEffect(() => {
    if (isOpen) localStorage.setItem(READ_KEY, String(Date.now()));
  }, [isOpen]);
  const now = new Date();
  return (
    <Vaul.Root open={isOpen} onOpenChange={setOpen}>
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <Vaul.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-2xl flex-col rounded-t-[var(--radius-pass)] bg-background pb-[env(safe-area-inset-bottom)] outline-none"
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <Vaul.Title className="text-display text-xl">Updates</Vaul.Title>
            <Vaul.Close aria-label="Close" className="press grid size-8 place-items-center rounded-full bg-secondary"><X className="h-4 w-4" /></Vaul.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-6">
            {all.length ? (
              <ul className="space-y-2">
                {all.map((a) => <Notice key={a.id} a={a} now={now} fresh={new Date(a.published_at).getTime() > mark} />)}
              </ul>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Nothing from the organizers yet. New notices appear here and on Home.</p>
            )}
          </div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}

function Notice({ a, now, fresh }: { a: Announcement; now: Date; fresh: boolean }) {
  return (
    <li className={cn("card-flat px-4 py-3.5", a.urgent && "bg-warn/20")}>
      <div className="flex items-start gap-2">
        {a.urgent ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-foreground" /> : fresh ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="New" /> : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{a.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{relativeToNow(a.published_at, now)}</p>
        </div>
      </div>
    </li>
  );
}
