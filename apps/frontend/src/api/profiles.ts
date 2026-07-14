import { apiNoContent, apiResult, type ApiResult } from "./client.js";

export type ProfileRow = {
  app_state?: unknown;
  display_name?: string;
  onboarded?: boolean;
};

type ProfilePayload = Record<string, unknown> & {
  app_state?: unknown;
  display_name?: string;
  onboarded?: boolean;
};

export function upsertProfile(payload: unknown): Promise<{ error: { message?: string } | null }> {
  const profile = profilePayload(payload);
  if (profile.onboarded && profile.app_state == null) {
    return apiNoContent("/profile/onboarding", {
      method: "POST",
      body: JSON.stringify({ display_name: profile.display_name || "" }),
    });
  }
  return apiNoContent("/profile/state", {
    method: "PUT",
    body: JSON.stringify({
      display_name: profile.display_name || "",
      onboarded: Boolean(profile.onboarded),
      app_state: recordValue(profile.app_state),
    }),
  });
}

export function loadProfileRow(_userId: string): Promise<ApiResult<ProfileRow>> {
  return apiResult<ProfileRow>("/profile/state");
}

export function createProfileShell(payload: unknown): Promise<{ error: { message?: string } | null }> {
  return upsertProfile(payload);
}

function profilePayload(value: unknown): ProfilePayload {
  return value && typeof value === "object" ? value as ProfilePayload : {};
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
