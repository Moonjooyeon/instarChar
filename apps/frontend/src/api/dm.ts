import { resultWithError, type ApiError } from "@/api/client";
import { supabase } from "@/supabaseClient";

export function deleteDmThreadRow(key: string, ownerId: string): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve({ error: { message: "DM client is not configured." } });
  const table = key.startsWith("dm::") ? "alive_shared_dm_threads" : "alive_dm_threads";
  let query = supabase.from(table).delete().eq("thread_key", key);
  if (table === "alive_dm_threads") query = query.eq("owner_id", ownerId);
  return Promise.resolve(query).then(resultWithError);
}
