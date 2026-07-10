import type { AuthChangeEvent, Provider, Session } from "@supabase/supabase-js";
import { supabase } from "@/supabaseClient";
import { type ApiError } from "@/api/client";

type AuthData = {
  session?: unknown;
};

type AuthResult = {
  data: AuthData;
  error: ApiError | null;
};

type AuthSubscription = {
  unsubscribe: () => void;
};

declare global {
  interface Window {
    __aliveOAuthExchanges?: Record<string, Promise<{ error?: ApiError | null }>>;
  }
}

export function isAuthApiAvailable(): boolean {
  return Boolean(supabase);
}

export function signUpWithEmail(email: string, password: string, redirectUrl: string): Promise<AuthResult> {
  if (!supabase) return Promise.resolve(unavailableAuthResult());
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectUrl, data: { display_name: email.split("@")[0] } },
  }) as Promise<AuthResult>;
}

export function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return Promise.resolve(unavailableAuthResult());
  return supabase.auth.signInWithPassword({ email, password }) as Promise<AuthResult>;
}

export function signInWithMagicLink(email: string, redirectUrl: string): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve(unavailableErrorResult());
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl, shouldCreateUser: true, data: { display_name: email.split("@")[0] } },
  }) as Promise<{ error: ApiError | null }>;
}

export function sendPasswordResetEmail(email: string, redirectUrl: string): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve(unavailableErrorResult());
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl }) as Promise<{ error: ApiError | null }>;
}

export function signInWithOAuthProvider(provider: Provider, redirectUrl: string): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve(unavailableErrorResult());
  return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl } }) as Promise<{ error: ApiError | null }>;
}

export function updateCurrentUserPassword(password: string): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve(unavailableErrorResult());
  return supabase.auth.updateUser({ password }) as Promise<{ error: ApiError | null }>;
}

export function signOutAuthSession(): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve({ error: null });
  return supabase.auth.signOut() as Promise<{ error: ApiError | null }>;
}

export async function getAuthSession(): Promise<{ data: { session: Session | null }; error: ApiError | null }> {
  if (!supabase) return { data: { session: null }, error: null };
  return supabase.auth.getSession() as Promise<{ data: { session: Session | null }; error: ApiError | null }>;
}

export async function setHashAuthSession(accessToken: string, refreshToken: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
}

export async function exchangeOAuthCodeForSession(oauthCode: string): Promise<void> {
  if (!supabase) return;
  window.__aliveOAuthExchanges ||= {};
  window.__aliveOAuthExchanges[oauthCode] ||= supabase.auth.exchangeCodeForSession(oauthCode);
  const { error } = await window.__aliveOAuthExchanges[oauthCode];
  if (error) throw error;
}

export function subscribeAuthState(handler: (event: AuthChangeEvent, session: Session | null) => void): AuthSubscription {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange(handler);
  return data.subscription;
}

function unavailableAuthResult(): AuthResult {
  return { data: {}, error: { message: "Auth client is not configured." } };
}

function unavailableErrorResult(): { error: ApiError } {
  return { error: { message: "Auth client is not configured." } };
}
