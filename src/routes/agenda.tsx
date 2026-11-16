import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old address kept working: /agenda now lives at /calendar. */
export const Route = createFileRoute("/agenda")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/calendar", search: search as never, replace: true });
  },
});
