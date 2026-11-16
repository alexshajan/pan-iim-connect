import { createFileRoute, redirect } from "@tanstack/react-router";

// The map now lives inside the richer Campus screen (places + mess + services).
// Keep /map working for anyone who bookmarked or shared it.
export const Route = createFileRoute("/map")({
  beforeLoad: () => {
    throw redirect({ to: "/campus", replace: true });
  },
});
