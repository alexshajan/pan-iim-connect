import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MessMeal = {
  id: string;
  meal: string;
  starts_at: string;
  ends_at: string;
  venue_id: string | null;
  location_name: string | null;
  highlight: string;
  items: string[];
  tags: string[];
  note: string | null;
  status: string;
  sort_order: number;
};

export type CampusService = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  action_label: string | null;
  action_url: string | null;
  phone: string | null;
  hours: string | null;
  venue_id: string | null;
  lat: number | null;
  lng: number | null;
  featured: boolean;
  sort_order: number;
};

export const messMealsQuery = queryOptions({
  queryKey: ["mess_meals"],
  queryFn: async (): Promise<MessMeal[]> => {
    const { data, error } = await supabase
      .from("mess_meals")
      .select("*")
      .order("starts_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MessMeal[];
  },
});

export const campusServicesQuery = queryOptions({
  queryKey: ["campus_services"],
  queryFn: async (): Promise<CampusService[]> => {
    const { data, error } = await supabase
      .from("campus_services")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CampusService[];
  },
});

/** The meal currently being served, else the next one that opens. */
export function currentOrNextMeal(meals: MessMeal[], now = new Date()) {
  const t = now.getTime();
  const open = meals.find(
    (m) =>
      m.status !== "cancelled" &&
      t >= new Date(m.starts_at).getTime() &&
      t <= new Date(m.ends_at).getTime(),
  );
  if (open) return { meal: open, serving: true as const };
  const next = meals.find((m) => m.status !== "cancelled" && new Date(m.starts_at).getTime() > t);
  return next ? { meal: next, serving: false as const } : null;
}

export const MEAL_ORDER = ["Breakfast", "Lunch", "Snacks", "Dinner"];

export const SERVICE_CATEGORIES = [
  { key: "all", label: "Everything" },
  { key: "food", label: "Food" },
  { key: "help", label: "Help" },
  { key: "medical", label: "Medical" },
  { key: "transport", label: "Transport" },
  { key: "utility", label: "Utilities" },
  { key: "wellness", label: "Wellness" },
  { key: "money", label: "Money" },
];
