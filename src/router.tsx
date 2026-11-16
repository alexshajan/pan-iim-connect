import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageSkeleton } from "@/components/PageSkeleton";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Conference data changes rarely; show cached data instantly, refresh in background.
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Let React Query own freshness; route preloads reuse cached data instead of refetching.
    defaultPreloadStaleTime: 0,
    defaultPreloadDelay: 30,
    defaultPendingMs: 600,
    defaultPendingMinMs: 250,
    defaultPendingComponent: PageSkeleton,
  });

  return router;
};
