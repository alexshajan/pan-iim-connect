import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BedDouble, Mail, MapPin, MessageCircle, Navigation, Phone, Search, ExternalLink } from "lucide-react";
import { AppShell, EmptyNote } from "@/components/AppShell";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  HOTELS, filterHotels, fromRate, roomCount, inr, telHref, waHref, mailHref, mapsHref, listingHref,
  type Hotel, type HotelFilter, type HotelSort,
} from "@/lib/hotels";

export const Route = createFileRoute("/stays")({
  head: () => ({
    meta: [
      { title: "Book a stay near IIM Shillong, Pan-IIM 2026" },
      { name: "description", content: "21 partner hotels and guest houses near IIM Shillong with rates, distance from campus, and one-tap call, WhatsApp and email." },
      { property: "og:title", content: "Partner stays, 11th Pan-IIM WMC" },
      { property: "og:description", content: "Institute partner hotels near IIM Shillong with rates and direct contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaysPage,
});

const FILTERS: { k: HotelFilter; label: string }[] = [
  { k: "all", label: "All" },
  { k: "near", label: "Near campus" },
  { k: "budget", label: "Under ₹2,500" },
  { k: "family", label: "Triple & family" },
];

function StaysPage() {
  const [f, setF] = useState<HotelFilter>("all");
  const [sort, setSort] = useState<HotelSort>("distance");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Hotel | null>(null);
  const list = useMemo(() => filterHotels(HOTELS, f, q, sort), [f, q, sort]);

  return (
    <AppShell eyebrow="Stay" title="Book a hotel" wide>
      <p className="text-sm text-muted-foreground">
        Partner stays shared by IIM Shillong. Book directly with the hotel; mention the conference. Distances are from campus.
      </p>

      <div className="sticky top-0 z-20 -mx-5 mt-4 bg-background/90 px-5 py-2 backdrop-blur">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-card px-3 shadow-card">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hotel or area, e.g. Rynjah"
            className="h-full flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {FILTERS.map((x) => (
            <button key={x.k} onClick={() => setF(x.k)}
              className={cn("press shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                f === x.k ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
              {x.label}
            </button>
          ))}
          <button onClick={() => setSort(sort === "distance" ? "price" : "distance")}
            className="press ml-auto shrink-0 rounded-full px-2 py-1.5 text-xs font-semibold text-primary">
            Sort: {sort === "distance" ? "Nearest" : "Cheapest"}
          </button>
        </div>
      </div>

      <p className="mt-3 mb-2 text-[0.7rem] font-semibold text-muted-foreground">
        {list.length} {list.length === 1 ? "stay" : "stays"}
      </p>
      <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {list.length ? list.map((h, i) => <HotelRow key={h.id} h={h} i={i} onOpen={() => setOpen(h)} />) : <EmptyNote>No stays match. Try another filter.</EmptyNote>}
      </ul>

      <p className="mt-6 text-center text-[0.7rem] text-muted-foreground">
        Rates per night as quoted to the institute and may change. The institute does not handle bookings or payments.
      </p>

      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent className="max-h-[88vh]">{open ? <HotelDetail h={open} /> : null}</DrawerContent>
      </Drawer>
    </AppShell>
  );
}

function Thumb({ h, className }: { h: Hotel; className?: string }) {
  if (h.photo) return <img src={h.photo} alt={h.name} loading="lazy" className={cn("object-cover", className)} />;
  const init = h.name.replace(/^(The|Hotel)\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className={cn("grid place-items-center bg-secondary text-secondary-foreground", className)} aria-hidden>
      <span className="text-display text-lg">{init}</span>
    </div>
  );
}

function HotelRow({ h, i, onOpen }: { h: Hotel; i: number; onOpen: () => void }) {
  const p = fromRate(h);
  const phone = h.phones[0] ?? "";
  return (
    <li className="rise card-surface overflow-hidden" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
      <button onClick={onOpen} className="press flex w-full items-stretch gap-3 p-2.5 text-left">
        <Thumb h={h} className="h-24 w-24 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <p className="line-clamp-2 text-[0.98rem] font-semibold leading-snug">{h.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" /> <span className="truncate">{h.area}, {h.kmLabel} to campus</span>
          </p>
          <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
            <p className="leading-none">
              {p ? <><span className="text-display text-lg tabular-nums">{inr(p)}</span><span className="text-[0.7rem] text-muted-foreground"> /night</span></> : <span className="text-xs font-medium text-muted-foreground">Rates on request</span>}
            </p>
            {h.links?.length ? <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-semibold text-secondary-foreground">Book online</span> : null}
          </div>
        </div>
      </button>
      <div className="grid grid-cols-2 border-t border-border text-xs font-semibold">
        <a href={telHref(phone)} className="press flex items-center justify-center gap-1.5 py-2.5 text-primary"><Phone className="size-3.5" /> Call</a>
        <a href={waHref(phone, h.name)} target="_blank" rel="noreferrer" className="press flex items-center justify-center gap-1.5 border-l border-border py-2.5 text-primary"><MessageCircle className="size-3.5" /> WhatsApp</a>
      </div>
    </li>
  );
}

function HotelDetail({ h }: { h: Hotel }) {
  const total = roomCount(h);
  return (
    <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {h.photo ? <img src={h.photo} alt={h.name} className="mt-2 aspect-[16/10] w-full rounded-2xl object-cover" /> : null}
      {h.photo && h.photoSource ? <a href={h.photoSource.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-right text-[11px] text-muted-foreground underline-offset-2 hover:underline">Photo: {h.photoSource.label}</a> : null}
      <DrawerTitle className="text-display mt-4 text-2xl leading-tight">{h.name}</DrawerTitle>
      <DrawerDescription className="mt-1 text-sm text-muted-foreground">{h.address}, {h.kmLabel} from campus</DrawerDescription>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Action href={telHref((h.phones[0] ?? ""))} icon={Phone} label="Call" primary />
        <Action href={waHref(h.phones[0] ?? "", h.name)} icon={MessageCircle} label="WhatsApp" external />
        {h.email ? <Action href={mailHref(h.email, h.name)} icon={Mail} label="Email" /> : <Action href={telHref(h.phones[1] ?? (h.phones[0] ?? ""))} icon={Phone} label="Alt call" />}
        <Action href={mapsHref(h)} icon={Navigation} label="Directions" external />
      </div>

      <p className="mt-5 mb-2 flex items-center justify-between text-[0.7rem] font-semibold text-muted-foreground">
        <span>Rooms</span>{total ? <span>{total} held</span> : null}
      </p>
      <ul className="divide-y divide-border rounded-2xl bg-card shadow-card">
        {h.rooms.map((r) => (
          <li key={r.type} className="flex items-center gap-3 px-4 py-3">
            <BedDouble className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.type}</p>
              {r.count ? <p className="text-[0.7rem] text-muted-foreground">{r.count} rooms</p> : null}
            </div>
            <p className="text-right text-sm font-semibold tabular-nums">{r.rate ? `₹${r.rate}` : r.from ? inr(r.from) : "Ask"}</p>
          </li>
        ))}
      </ul>

      {h.note ? <p className="mt-3 text-xs text-muted-foreground">{h.note}</p> : null}

      <div className="mt-4 space-y-1 text-sm">
        {h.phones.map((p) => <a key={p} href={telHref(p)} className="block font-medium tabular-nums text-primary">+91 {p.replace(/(\d{5})(\d{5})/, "$1 $2")}</a>)}
        {h.email ? <a href={`mailto:${h.email}`} className="block break-all text-muted-foreground">{h.email}</a> : null}
      </div>

      <p className="mt-5 mb-2 text-xs font-semibold text-muted-foreground">Book online</p>
      <div className="flex flex-wrap gap-2">
        {h.links?.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground">
            {l.label} <ExternalLink className="size-3" />
          </a>
        ))}
        {h.listings.filter((s) => !h.links?.some((l) => l.label.includes(s) || (s === "Official site" && l.label === "Official site"))).map((s) => (
          <a key={s} href={listingHref(h, s)} target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1 rounded-full bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground">
            Find on {s} <ExternalLink className="size-3" />
          </a>
        ))}
        {!h.links?.length && !h.listings.length ? <p className="text-xs text-muted-foreground">Not listed online, call or WhatsApp to book.</p> : null}
      </div>
    </div>
  );
}

function Action({ href, icon: Icon, label, primary, external }: { href: string; icon: typeof Phone; label: string; primary?: boolean; external?: boolean }) {
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={cn("press flex flex-col items-center gap-1 rounded-2xl py-3 text-[0.7rem] font-semibold",
        primary ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
      <Icon className="size-5" />{label}
    </a>
  );
}
