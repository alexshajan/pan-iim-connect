import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/network/papers")({
  beforeLoad: () => {
    throw redirect({ to: "/papers", search: { q: "", track: "", mode: "" }, replace: true });
  },
});
