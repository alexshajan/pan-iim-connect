import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, EmptyNote, SectionHeading } from "@/components/AppShell";
import { CabCard, CabDisclaimer, ComingSoon } from "@/components/guide/GuideCards";
import { GuideSubHeader } from "@/components/guide/GuideHeader";
import { cabsQuery } from "@/lib/guide-data";

export const Route = createFileRoute("/guide/cabs")({
  head: () => ({
    meta: [
      { title: "Cab contacts in Shillong & Guwahati, Pan-IIM 2026" },
      { name: "description", content: "Community-listed cab drivers for Guwahati–Shillong, campus runs and day trips, with their usual fare asks." },
      { property: "og:title", content: "Cab contacts, Pan-IIM 2026" },
      { property: "og:description", content: "Drivers and their fare asks for airport, campus and day-trip runs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CabsPage,
});

function CabsPage() {
  const cabs = useQuery(cabsQuery);
  const [q, setQ] = useState("");
  const list = (cabs.data ?? []).filter((c) => c.active && (!q || JSON.stringify(c).toLowerCase().includes(q.toLowerCase())));
  return (
    <AppShell hero={<GuideSubHeader eyebrow="Resource" title="Cab contacts" />}>
      <CabDisclaimer />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search route, e.g. Dawki or airport"
        className="mt-4 h-11 w-full rounded-xl bg-card px-4 text-sm shadow-card outline-none"
      />
      <SectionHeading title={`${list.length} drivers`} />
      <div className="space-y-3">
        {cabs.isLoading ? <EmptyNote>Loading…</EmptyNote> : list.length ? list.map((c) => <CabCard key={c.id} cab={c} />) : <EmptyNote>No drivers match.</EmptyNote>}
      </div>
      <Link to="/me" className="mt-4 block text-center text-xs font-semibold text-muted-foreground underline">
        Report a problem with a driver (Me → Help)
      </Link>
      <div className="mt-6">
        <ComingSoon title="Cab pooling" body="Share a ride with delegates landing around the same time. Coming soon." />
      </div>
    </AppShell>
  );
}
