import { withRejectTimeout } from "@/domain/app/asyncUtils";
import { queryResult, resultWithError, type ApiResult } from "@/api/client";
import { supabase } from "@/supabaseClient";

export type ProfileRow = {
  app_state?: unknown;
  display_name?: string;
  onboarded?: boolean;
};

export function upsertProfile(payload: unknown): Promise<{ error: { message?: string } | null }> {
  if (!supabase) return Promise.resolve({ error: { message: "Profile client is not configured." } });
  return Promise.resolve(supabase.from("alive_profiles").upsert(payload)).then(resultWithError);
}

export async function loadProfileRow(userId: string): Promise<ApiResult<ProfileRow>> {
  if (!supabase) throw new Error("Profile client is not configured.");
  const query = supabase
    .from("alive_profiles")
    .select("display_name,onboarded,app_state")
    .eq("id", userId)
    .maybeSingle();
  const result = await withRejectTimeout(Promise.resolve(query), 5000, "프로필 메타 로드");
  return queryResult<ProfileRow>(result);
}

export function createProfileShell(payload: unknown): Promise<{ error: { message?: string } | null }> {
  return upsertProfile(payload);
}
