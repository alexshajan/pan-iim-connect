import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseAtmosphere, pickAtmosphere, type AtmosphereCard } from "@/lib/atmosphere";
import { useShillongNow } from "./useShillongNow";
import { Barometer } from "./Barometer";
import { PineRidge } from "./PineRidge";
import { DayScrubber } from "./DayScrubber";

export const atmosphereQuery = queryOptions({
  queryKey: ["settings", "atmosphere_card"],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data } = await supabase.from("console_settings").select("value").eq("key", "atmosphere_card").maybeSingle();
    return parseAtmosphere(data?.value);
  },
});

export function ShillongNowCard({ now, force }: { now: Date; force?: AtmosphereCard }) {
  const setting = useQuery(atmosphereQuery).data ?? "auto";
  const w = useShillongNow();
  if (w.isError) return null;
  if (!w.data) return <div className="atmo-card skeleton" aria-hidden />;
  const kind = force ?? pickAtmosphere(setting, now);
  if (kind === "barometer") return <Barometer d={w.data} />;
  if (kind === "ridge") return <PineRidge d={w.data} now={now} />;
  return <DayScrubber d={w.data} now={now} />;
}
