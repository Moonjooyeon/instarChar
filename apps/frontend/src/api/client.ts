type QueryValue = boolean | number | string | null | undefined;

type ApiQuery = Record<string, QueryValue | QueryValue[]>;

type ApiRequestOptions = RequestInit & {
  query?: ApiQuery;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env?.VITE_API_BASE_URL || "/api");
const TOSS_SESSION_TOKEN_KEY = "alive_toss_session";

export const hasBackendApiConfig = true;

export function hasRemoteApiClient(): boolean {
  return true;
}

export type ApiError = {
  message?: string;
};

export type ApiResult<T> = {
  data?: T | null;
  error?: ApiError | null;
};

export function apiUrl(path: string, query?: ApiQuery): string {
  const nextPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${nextPath}`;
  const search = queryString(query);
  return search ? `${url}?${search}` : url;
}

export function apiFetch(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { query, ...requestOptions } = options;
  return fetch(apiUrl(path, query), {
    ...requestOptions,
    credentials: requestOptions.credentials || "include",
    headers: authorizedHeaders(requestOptions.headers),
  });
}

export function setTossSessionToken(token: string): void {
  if (!isAppsInTossRuntime()) return;
  localStorage.setItem(TOSS_SESSION_TOKEN_KEY, token);
}

export function clearTossSessionToken(): void {
  localStorage.removeItem(TOSS_SESSION_TOKEN_KEY);
}

export async function apiJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await apiFetch(path, jsonRequestOptions(options));
  const result = await responseResult<T>(response);
  if (result.error) throw new Error(result.error.message || "API request failed.");
  return result.data as T;
}

export async function apiResult<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const response = await apiFetch(path, jsonRequestOptions(options));
  return responseResult<T>(response);
}

export async function apiNoContent(path: string, options: ApiRequestOptions = {}): Promise<{ error: ApiError | null }> {
  const result = await apiResult<unknown>(path, options);
  return { error: result.error || null };
}

export function apiErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const detail = detailMessage((error as { detail?: unknown }).detail);
  if (detail) return detail;
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

async function responseResult<T>(response: Response): Promise<ApiResult<T>> {
  const data = await responseData<T>(response);
  if (response.ok) return { data, error: null };
  return { data: null, error: { message: responseErrorMessage(data, response) } };
}

async function responseData<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
}

function responseErrorMessage(data: unknown, response: Response): string {
  return apiErrorMessage(data) || `API request failed. HTTP ${response.status}.`;
}

function jsonRequestOptions(options: ApiRequestOptions): ApiRequestOptions {
  if (!options.body) return options;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return { ...options, headers };
}

function authorizedHeaders(headers?: HeadersInit): Headers {
  const next = new Headers(headers);
  const token = tossSessionToken();
  if (token) next.set("Authorization", `Bearer ${token}`);
  return next;
}

function tossSessionToken(): string {
  if (!isAppsInTossRuntime()) return "";
  return localStorage.getItem(TOSS_SESSION_TOKEN_KEY) || "";
}

function isAppsInTossRuntime(): boolean {
  return import.meta.env?.VITE_ALIVE_RUNTIME === "apps-in-toss";
}

function queryString(query?: ApiQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => appendQueryValue(params, key, value));
  return params.toString();
}

function appendQueryValue(params: URLSearchParams, key: string, value: QueryValue | QueryValue[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(params, key, item));
    return;
  }
  if (value == null) return;
  params.append(key, String(value));
}

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(detailMessage).filter(Boolean).join(", ");
  if (!detail || typeof detail !== "object") return "";
  const message = (detail as { message?: unknown; msg?: unknown }).message || (detail as { msg?: unknown }).msg;
  return typeof message === "string" ? message : "";
}

export function normalizeApiBaseUrl(value: string): string {
  const baseUrl = value.replace(/\/+$/, "") || "/api";
  if (!isAbsoluteUrl(baseUrl)) return baseUrl;
  const url = new URL(baseUrl);
  if (url.pathname && url.pathname !== "/") return baseUrl;
  return `${baseUrl}/api`;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
