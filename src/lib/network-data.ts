import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DirPerson } from "@/lib/network";

export const directoryPeopleQuery = queryOptions({
  queryKey: ["network", "directory"],
  queryFn: async (): Promise<DirPerson[]> => {
    const { data, error } = await supabase.rpc("directory_people");
    if (error) throw error;
    return (data ?? []) as unknown as DirPerson[];
  },
});

type Mark = { id: string; target_person_id: string | null; submission_id: string | null; people?: { delegate_code: string } | null };

/** Bookmarked people (by delegate code) and papers (by submission id) for the signed-in user. */
export function useNetworkMarks(userId: string | null) {
  const qc = useQueryClient();
  const key = ["network", "marks", userId];
  const q = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_bookmarks")
        .select("id, target_person_id, submission_id, people:target_person_id(delegate_code)");
      if (error) throw error;
      return (data ?? []) as unknown as Mark[];
    },
  });
  const rows = q.data ?? [];
  const people = rows.map((r) => r.people?.delegate_code).filter(Boolean) as string[];
  const papers = rows.map((r) => r.submission_id).filter(Boolean) as string[];

  const m = useMutation({
    mutationFn: async (arg: { code?: string; submissionId?: string }) => {
      if (!userId) throw new Error("Sign in to bookmark");
      if (arg.submissionId) {
        const ex = rows.find((r) => r.submission_id === arg.submissionId);
        if (ex) return void (await supabase.from("person_bookmarks").delete().eq("id", ex.id));
        const { error } = await supabase.from("person_bookmarks").insert({ owner_user_id: userId, submission_id: arg.submissionId });
        if (error) throw error;
        return;
      }
      const ex = rows.find((r) => r.people?.delegate_code === arg.code);
      if (ex) return void (await supabase.from("person_bookmarks").delete().eq("id", ex.id));
      const { data: pid, error: e1 } = await supabase.rpc("person_id_for_code", { _code: arg.code! });
      if (e1 || !pid) throw e1 ?? new Error("Not found");
      const { error } = await supabase.from("person_bookmarks").insert({ owner_user_id: userId, target_person_id: pid as string });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  return { people, papers, toggle: m.mutateAsync };
}

import type { Wave } from "@/lib/network-social";

export const wavesQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["network", "waves", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Wave[]> => {
      const { data, error } = await supabase.rpc("my_waves");
      if (error) throw error;
      return (data ?? []) as Wave[];
    },
  });

export async function sendWave(code: string): Promise<{ mutual: boolean }> {
  const { data, error } = await supabase.rpc("send_wave", { _code: code });
  if (error) throw error;
  return data as { mutual: boolean };
}
