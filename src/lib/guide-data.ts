import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Place, TravelLeg } from "./guide";

export type CabRoute = { route: string; fare: number };
export type Cab = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  vehicle: string | null;
  seats: number;
  languages: string[];
  routes: CabRoute[];
  notes: string | null;
  active: boolean;
  is_placeholder: boolean;
};
export type GuidePrompt = { id: string; text: string; module: string; active: boolean; sort_order: number };

export const legsQuery = queryOptions({
  queryKey: ["guide", "legs"],
  queryFn: async () => {
    const { data, error } = await supabase.from("travel_legs").select("*").order("sort_order");
    if (error) throw error;
    return data as (TravelLeg & { is_placeholder: boolean; sort_order: number })[];
  },
});

export const placesQuery = queryOptions({
  queryKey: ["guide", "places"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tourism_places").select("*").order("sort_order");
    if (error) throw error;
    return data as (Place & { is_placeholder: boolean; sort_order: number })[];
  },
});

export const cabsQuery = queryOptions({
  queryKey: ["guide", "cabs"],
  queryFn: async () => {
    const { data, error } = await supabase.from("cab_drivers").select("*").order("name");
    if (error) throw error;
    return data as unknown as Cab[];
  },
});

export const promptsQuery = queryOptions({
  queryKey: ["guide", "prompts"],
  queryFn: async () => {
    const { data, error } = await supabase.from("guide_prompts").select("*").order("sort_order");
    if (error) throw error;
    return data as GuidePrompt[];
  },
});

export const threadsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["guide", "threads", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guide_threads")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

export const PENDING_KEY = (id: string) => `guide-pending-${id}`;

/** Create a chat thread for the signed-in user; returns its id. */
export async function createThread(userId: string, firstMessage?: string) {
  const { data, error } = await supabase.from("guide_threads").insert({ user_id: userId }).select("id").single();
  if (error) throw error;
  if (firstMessage && typeof window !== "undefined") sessionStorage.setItem(PENDING_KEY(data.id), firstMessage);
  return data.id;
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const range = (a: number, b: number) => (a === b ? inr(a) : `${inr(a)}–${inr(b).slice(1)}`);
export const hrs = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);
export const MODE_LABEL: Record<string, string> = {
  air: "Flight", train: "Train", cab: "Private cab", shared_taxi: "Shared taxi", bus: "Bus", helicopter: "Helicopter",
};
