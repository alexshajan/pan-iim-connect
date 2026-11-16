import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Network, 11th Pan-IIM WMC 2026" },
      { name: "description", content: "Find researchers by topic, track and institute, bookmark papers and plan who to meet at IIM Shillong." },
      { property: "og:title", content: "The Common Room, Pan-IIM 2026 Network" },
      { property: "og:description", content: "An academic directory of consenting delegates, presenters and chairs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NetworkLayout,
});

function NetworkLayout() {
  const { user, loading } = useAuth();
  const mods = useModules();
  return (
    <AppShell eyebrow="The Common Room" title="Network">
      {mods.network ? <nav className="card-flat sticky top-2 z-20 mb-4 grid grid-cols-3 gap-1 p-1 backdrop-blur">
        {(
          [
            ["/network", "For you"],
            ["/network/people", "People"],
            ["/network/met", "Met"],
          ] as const
        ).map(([to, label]) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/network" }}
            className="tap rounded-full py-2 text-center text-xs font-semibold text-muted-foreground transition-colors data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
          >
            {label}
          </Link>
        ))}
      </nav> : null}
      {!user && !loading ? (
        <div className="index-card px-5 py-6">
          <p className="text-display text-lg">Sign in to enter the Common Room</p>
          <p className="mt-1 text-sm text-muted-foreground">Only signed-in delegates can browse profiles, and only people who chose to be listed appear.</p>
          <Link to="/auth" className="tap mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link>
        </div>
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}
