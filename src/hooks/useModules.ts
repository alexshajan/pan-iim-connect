import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_ON, parseModules, PHASE_1, type ModuleFlags } from "@/lib/modules";

export const modulesQuery = queryOptions({
  queryKey: ["settings", "modules"],
  queryFn: async (): Promise<ModuleFlags> => {
    const { data } = await supabase.from("console_settings").select("value").eq("key", "modules").maybeSingle();
    return parseModules(data?.value);
  },
  staleTime: 5 * 60_000,
});

/** Local dev only: VITE_ALL_MODULES=1 opens every section without touching the shared setting. */
const DEV_ALL_ON = import.meta.env.DEV && import.meta.env["VITE_ALL_MODULES"] === "1";

export function useModules(): ModuleFlags {
  const flags = useQuery(modulesQuery).data ?? PHASE_1;
  return DEV_ALL_ON ? ALL_ON : flags;
}
