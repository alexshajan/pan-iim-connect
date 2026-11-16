import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, CloudSun, Map as MapIcon, MessageSquare, Phone, MessageCircle, Plane, Car } from "lucide-react";
import { AppShell, EmptyNote, SectionHeading } from "@/components/AppShell";
import { AskBox } from "@/components/guide/AskBox";
import { CoBrand } from "@/components/guide/GuideHeader";
import { useAuth } from "@/hooks/useAuth";
import { allContentQuery, type ContentBlock } from "@/lib/conference";
import { guidePhase } from "@/lib/guide";
import { promptsQuery, threadsQuery } from "@/lib/guide-data";
import { cn } from "@/lib/utils";
import guideMeghalaya from "@/assets/guide-meghalaya.jpg";

export const Route = createFileRoute("/guide/")({
  head: () => ({
    meta: [
      { title: "Guide, Getting to Shillong & Exploring Meghalaya | Pan-IIM 2026" },
      {
        name: "description",
        content:
          "Ask the Pan-IIM Guide how to reach IIM Shillong, what it costs, and how to spend a free afternoon in Meghalaya. In partnership with Meghalaya Tourism.",
      },
      { property: "og:title", content: "Pan-IIM Guide, Arrival & Meghalaya" },
      { property: "og:description", content: "Travel plans to campus, day trips in Meghalaya, and trusted contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuideHub,
});

const FALLBACK = [
  "Cheapest way from Delhi to campus on 26 Nov?",
  "Plan a half-day in Shillong for 3 of us after 2pm",
  "Easy waterfall trip on 30 Nov, ₹2,000 each",
];

function GuideHub() {
  const phase = guidePhase(new Date());
  const prompts = useQuery(promptsQuery);
  const { user } = useAuth();
  const threads = useQuery(threadsQuery(user?.id ?? null));
  const chats = (threads.data ?? []).filter((t) => t.title !== "New chat");
  const all = (prompts.data ?? []).filter((p) => p.active);
  const ordered = [
    ...all.filter((p) => p.module === phase),
    ...all.filter((p) => p.module === "any"),
    ...all.filter((p) => p.module !== phase && p.module !== "any"),
  ].map((p) => p.text);
  const suggestions = ordered.length ? ordered : FALLBACK;

  const hero = (
    <header className="relative overflow-hidden">
      <img src={guideMeghalaya} alt="" width={1280} height={800} className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      <div className="relative mx-auto max-w-2xl px-5 pt-6 pb-2">
        <CoBrand />
        <p className="mt-8 text-[0.68rem] font-semibold text-hills">
          {phase === "arrival" ? "Getting here, Exploring after" : "Explore Meghalaya"}
        </p>
        <h1 className="text-display mt-1 text-[2.3rem] leading-[1.02]">
          Ask the <span className="rounded-full bg-hills px-3 text-hills-foreground">Guide</span>
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Routes, fares, day trips and who to call, planned from information our team has checked.
        </p>
        <div className="mt-5">
          <AskBox suggestions={suggestions} />
        </div>
      </div>
    </header>
  );

  const arrival = { to: "/guide/arrival", title: "Plan my arrival", body: "Door-to-campus plans with fares", icon: Plane } as const;
  const explore = { to: "/guide/explore", title: "Plan a trip", body: "Itineraries for your free time", icon: MapIcon } as const;
  const [primary, secondary] = phase === "arrival" ? [arrival, explore] : [explore, arrival];

  return (
    <AppShell hero={hero}>
      <div className="grid grid-cols-2 gap-3">
        <Link to={primary.to} className="press col-span-2 flex items-center gap-4 rounded-[var(--radius-pass)] bg-primary px-5 py-4 text-primary-foreground shadow-card">
          <primary.icon className="size-6" />
          <div>
            <p className="text-display text-lg leading-tight">{primary.title}</p>
            <p className="text-xs opacity-80">{primary.body}</p>
          </div>
        </Link>
        {phase === "tourism" ? (
          <Link to="/guide/arrival" className="press flex flex-col gap-2 rounded-[var(--radius-pass)] bg-card px-4 py-3.5 shadow-card">
            <Archive className="size-5 text-muted-foreground" />
            <span className="text-sm font-semibold leading-tight">Arrival archive</span>
            <span className="text-[0.7rem] text-muted-foreground">Plan your departure</span>
          </Link>
        ) : (
          <Tile to={secondary.to} title={secondary.title} body={secondary.body} icon={secondary.icon} />
        )}
        <Tile to="/guide/cabs" title="Cab contacts" body="Drivers & fare asks" icon={Car} />
        <Link to="/stays" className="press col-span-2 flex items-center gap-3 rounded-[var(--radius-pass)] bg-card px-4 py-3.5 shadow-card">
          <span className="text-display text-lg">Book a hotel</span>
          <span className="ml-auto text-[0.7rem] text-muted-foreground">21 partner stays, from ₹849</span>
        </Link>
      </div>

      {user ? (
        <>
          <SectionHeading title="Your chats" />
          {chats.length ? (
            <ul className="space-y-2">
              {chats.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link to="/guide/chat/$threadId" params={{ threadId: t.id }} className="tap flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-card">
                    <MessageSquare className="size-4 shrink-0 text-hills" />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                      {new Date(t.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>Ask something above to start your first chat.</EmptyNote>
          )}
        </>
      ) : null}

      <SectionHeading title="Handy info" action={<CloudSun className="size-4 text-muted-foreground" />} />
      <HandyInfo />
    </AppShell>
  );
}

function Tile({ to, title, body, icon: Icon }: { to: "/guide/arrival" | "/guide/explore" | "/guide/cabs"; title: string; body: string; icon: typeof Plane }) {
  return (
    <Link to={to} className="press flex flex-col gap-2 rounded-[var(--radius-pass)] bg-card px-4 py-3.5 shadow-card">
      <Icon className="size-5 text-hills" />
      <span className="text-sm font-semibold leading-tight">{title}</span>
      <span className="text-[0.7rem] text-muted-foreground">{body}</span>
    </Link>
  );
}

const TABS = [
  { key: "campus", label: "On campus" },
  { key: "city", label: "Meghalaya" },
  { key: "travel", label: "Travel notes" },
  { key: "contact", label: "Contacts" },
  { key: "faq", label: "FAQ" },
];

function HandyInfo() {
  const [tab, setTab] = useState("campus");
  const content = useQuery(allContentQuery);
  const blocks = (content.data ?? []).filter((b) => b.category === tab);
  return (
    <div>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "tap shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap",
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {content.isLoading ? <EmptyNote>Loading…</EmptyNote> : blocks.length ? blocks.map((b) => <Block key={b.id} block={b} />) : <EmptyNote>Nothing here yet.</EmptyNote>}
      </div>
    </div>
  );
}

function Block({ block }: { block: ContentBlock }) {
  const meta = block.meta ?? {};
  return (
    <div className="card-surface px-5 py-4">
      <h3 className="text-display text-[1.02rem] leading-snug">{block.title}</h3>
      {block.subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{block.subtitle}</p> : null}
      {block.body ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{block.body}</p> : null}
      {meta["phone"] ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${meta["phone"].replace(/\s/g, "")}`} className="tap inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground">
            <Phone className="h-3.5 w-3.5" /> {meta["phone"]}
          </a>
          {meta["whatsapp"] ? (
            <a href={`https://wa.me/${meta["whatsapp"].replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
