import { createFileRoute, redirect } from "@tanstack/react-router";

// Updates live in the bell sheet now; old links land on Home with the sheet open.
export const Route = createFileRoute("/updates")({
  beforeLoad: () => {
    if (typeof window !== "undefined") void import("@/components/NotificationCenter").then((m) => m.openUpdates());
    throw redirect({ to: "/" });
  },
});
