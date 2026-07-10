import { apiNoContent, apiResult, apiUrl, type ApiError } from "@/api/client";

export type AuthProvider = "apple" | "google";

type BackendUser = {
  email?: string;
  id: string;
  provider?: string;
};

type MeResponse = {
  display_name?: string;
  onboarded?: boolean;
  user?: BackendUser;
};

export type BackendSession = {
  user: {
    email?: string;
    id: string;
    user_metadata: {
      full_name?: string;
      name?: string;
      preferred_username?: string;
      provider?: string;
    };
  };
};

type AuthResult = {
  data: {
    session: BackendSession | null;
  };
  error: ApiError | null;
};

export type AuthSubscription = {
  unsubscribe: () => void;
};

export function isAuthApiAvailable(): boolean {
  return true;
}

export async function signInWithOAuthProvider(provider: AuthProvider): Promise<{ error: ApiError | null }> {
  window.location.assign(apiUrl(`/auth/${provider}/start`));
  return { error: null };
}

export function signOutAuthSession(): Promise<{ error: ApiError | null }> {
  return apiNoContent("/auth/logout", { method: "POST" });
}

export async function getAuthSession(): Promise<AuthResult> {
  const result = await apiResult<MeResponse>("/auth/me");
  if (result.error) return { data: { session: null }, error: result.error };
  return { data: { session: sessionFromMe(result.data || null) }, error: null };
}

export function subscribeAuthState(): AuthSubscription {
  return { unsubscribe: () => {} };
}

function sessionFromMe(data: MeResponse | null): BackendSession | null {
  if (!data?.user?.id) return null;
  return {
    user: {
      email: data.user.email,
      id: data.user.id,
      user_metadata: {
        full_name: data.display_name,
        name: data.display_name,
        preferred_username: data.display_name,
        provider: data.user.provider,
      },
    },
  };
}
