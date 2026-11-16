import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseModules, PHASE_1, type ModuleFlags } from "@/lib/modules";

export const modulesQuery = queryOptions({
  queryKey: ["settings", "modules"],
  queryFn: async (): Promise<ModuleFlags> => {
    const { data } = await supabase.from("console_settings").select("value").eq("key", "modules").maybeSingle();
    return parseModules(data?.value);
  },
  staleTime: 5 * 60_000,
});

export function useModules(): ModuleFlags {
  return useQuery(modulesQuery).data ?? PHASE_1;
}
