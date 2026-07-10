import { hasSupabaseConfig, supabase } from "@/supabaseClient";

export const hasRemoteApiConfig = hasSupabaseConfig;

export function hasRemoteApiClient(): boolean {
  return Boolean(supabase);
}

export type ApiError = {
  message?: string;
};

export type ApiResult<T> = {
  data?: T | null;
  error?: ApiError | null;
};

export function apiErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

export function resultWithError(value: unknown): { error: ApiError | null } {
  if (!value || typeof value !== "object") return { error: null };
  const error = (value as { error?: unknown }).error;
  if (!error) return { error: null };
  return { error: { message: apiErrorMessage(error) } };
}

export function queryResult<T>(value: unknown): ApiResult<T> {
  if (!value || typeof value !== "object") return { data: null, error: null };
  const data = (value as { data?: unknown }).data as T | null | undefined;
  const error = (value as { error?: unknown }).error;
  return { data, error: error ? { message: apiErrorMessage(error) } : null };
}
