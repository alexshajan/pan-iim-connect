import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session as AuthSession, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Shared across every component so pages don't each wait for the session.
let cached: AuthSession | null | undefined;
const listeners = new Set<(s: AuthSession | null) => void>();
let started = false;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_e, next) => {
    cached = next;
    listeners.forEach((l) => l(next));
  });
  supabase.auth.getSession().then(({ data }) => {
    cached = data.session;
    listeners.forEach((l) => l(data.session));
  });
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    start();
    const l = (s: AuthSession | null) => {
      setSession(s);
      setLoading(false);
    };
    listeners.add(l);
    if (cached !== undefined) l(cached);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, email: user?.email ?? null, loading };
}

export function useIsOrganizer(userId: string | null) {
  const q = useQuery({
    queryKey: ["my-roles", userId],
    enabled: !!userId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      const roles = (data ?? []).map((r: { role: string }) => r.role);
      return roles.includes("admin") || roles.includes("editor");
    },
  });
  if (!userId) return false;
  return q.data ?? null;
}
