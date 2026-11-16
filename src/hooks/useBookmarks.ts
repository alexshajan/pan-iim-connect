import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bookmarksQuery } from "@/lib/conference";

const LOCAL_KEY = "paniim.starred";

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function useBookmarks(userId: string | null) {
  const qc = useQueryClient();
  const remote = useQuery(bookmarksQuery(userId));
  const local = useQuery({
    queryKey: ["bookmarks", "local"],
    enabled: !userId,
    queryFn: async () => readLocal(),
  });

  const starred = userId ? (remote.data ?? []) : (local.data ?? []);

  const toggle = useMutation({
    mutationFn: async (sessionId: string) => {
      const on = starred.includes(sessionId);
      if (!userId) {
        const next = on ? starred.filter((id) => id !== sessionId) : [...starred, sessionId];
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        return next;
      }
      if (on) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("session_id", sessionId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ session_id: sessionId, user_id: userId });
        if (error) throw error;
      }
      return null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { starred, toggle: (id: string) => toggle.mutate(id) };
}
