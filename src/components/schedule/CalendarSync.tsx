import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { AppleCalendarLogo, GoogleCalendarLogo, OutlookLogo } from "@/components/brand/CalendarLogos";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { subscribeLinks } from "@/lib/ics";

async function getFeed(userId: string): Promise<string> {
  const db = supabase as any;
  const { data } = await db.from("calendar_feeds").select("token").eq("user_id", userId).maybeSingle();
  if (data?.token) return data.token;
  const ins = await db.from("calendar_feeds").insert({ user_id: userId }).select("token").single();
  if (ins.error) throw ins.error;
  return ins.data.token;
}

/** "Sync to my calendar": a private subscription link that keeps Google/Apple/Outlook updated. */
export function CalendarSync({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const feed = useQuery({ queryKey: ["cal-feed", userId], enabled: !!userId && open, queryFn: () => getFeed(userId!), staleTime: Infinity });
  const url = feed.data && typeof window !== "undefined" ? `${window.location.origin}/api/public/cal/${feed.data}` : null;
  const links = url ? subscribeLinks(url) : null;

  async function reset() {
    if (!userId) return;
    await (supabase as any).from("calendar_feeds").delete().eq("user_id", userId);
    qc.removeQueries({ queryKey: ["cal-feed", userId] });
    feed.refetch();
    toast.success("New link made", { description: "The old link stops updating." });
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button type="button" className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold">
          <GoogleCalendarLogo className="h-4 w-4" /> Add to Calendar
        </button>
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-lg px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <DrawerTitle className="text-display mt-3 text-xl">Put My plan in your calendar</DrawerTitle>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your presentation, starred sessions and the common programme. It stays in sync: star something here and it appears there within the hour.
        </p>
        {!userId ? (
          <p className="mt-5 text-sm">Sign in first so we know which plan to send.</p>
        ) : feed.isError ? (
          <p className="mt-5 text-sm text-destructive">Couldn't make your link. Try again.</p>
        ) : !links ? (
          <p className="mt-5 text-sm text-muted-foreground">Making your private link…</p>
        ) : (
          <>
            <div className="mt-5 grid gap-2">
              <a href={links.google} target="_blank" rel="noreferrer" className="press flex min-h-12 items-center justify-between rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                <span className="flex items-center gap-2.5"><GoogleCalendarLogo className="h-5 w-5" /> Google Calendar</span> <span className="text-xs opacity-75">Opens Google</span>
              </a>
              <a href={links.apple} className="press flex min-h-12 items-center justify-between rounded-lg border border-border bg-card px-4 text-sm font-semibold">
                <span className="flex items-center gap-2.5"><AppleCalendarLogo className="h-5 w-5" /> Apple Calendar</span> <span className="text-xs text-muted-foreground">iPhone, Mac</span>
              </a>
              <a href={links.outlook} target="_blank" rel="noreferrer" className="press flex min-h-12 items-center justify-between rounded-lg border border-border bg-card px-4 text-sm font-semibold">
                <span className="flex items-center gap-2.5"><OutlookLogo className="h-5 w-5" /> Outlook</span> <span className="text-xs text-muted-foreground">Web</span>
              </a>
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(url!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="press mt-3 flex w-full items-center gap-2 rounded-lg bg-secondary px-4 py-3 text-left text-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="min-w-0 flex-1 truncate">{copied ? "Link copied" : "Copy link for another app"}</span>
            </button>
            <p className="mt-3 text-[0.7rem] text-muted-foreground">
              Anyone with this link can see your plan, not your contact details.{" "}
              <button type="button" onClick={reset} className="font-semibold text-primary underline-offset-2 hover:underline">Make a new link</button>
            </p>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
