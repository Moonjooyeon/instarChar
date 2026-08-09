import { apiFetch, apiErrorMessage } from "./client.js";
import { notifyCreditBalanceUpdated } from "./credits.js";

export type CharacterPostsState = {
  auto_post_enabled: boolean;
  auto_post_failure_count: number;
  auto_post_interval_seconds: number;
  last_auto_post_at: string | null;
  last_auto_post_error: string;
  next_auto_post_at: string | null;
  posts: Record<string, unknown>[];
  revision: number;
};

export type GeneratedCharacterPost = {
  post: Record<string, unknown>;
  state: CharacterPostsState;
};

export type CharacterPostComment = {
  byUser: boolean;
  handle: string;
  name: string;
  replyTo: string;
  text: string;
};

export class CharacterPostsApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "CharacterPostsApiError";
    this.status = status;
    this.code = code;
  }
}

export async function getCharacterPosts(sourceAccountId: string): Promise<CharacterPostsState> {
  return postsRequest<CharacterPostsState>(postsPath(sourceAccountId));
}

export async function saveCharacterPosts(sourceAccountId: string, posts: Record<string, unknown>[], revision: number): Promise<CharacterPostsState> {
  return postsRequest<CharacterPostsState>(postsPath(sourceAccountId), jsonOptions("PUT", { posts, revision }));
}

export async function updateCharacterAutoPost(sourceAccountId: string, enabled: boolean, intervalSeconds: number): Promise<CharacterPostsState> {
  const path = `/characters/${encodeURIComponent(sourceAccountId)}/auto-post`;
  return postsRequest<CharacterPostsState>(path, jsonOptions("PATCH", { enabled, interval_seconds: intervalSeconds }));
}

export async function generateCharacterPost(sourceAccountId: string, mood: string, idempotencyKey: string): Promise<GeneratedCharacterPost> {
  const path = `${postsPath(sourceAccountId)}/generate`;
  const result = await postsRequest<GeneratedCharacterPost>(path, jsonOptions("POST", { idempotency_key: idempotencyKey, mood }));
  notifyCreditBalanceUpdated();
  return result;
}

export async function createCharacterPostComment(characterId: string, postId: string, commenterAccountId: string, comment: Omit<CharacterPostComment, "byUser">): Promise<CharacterPostComment[]> {
  const path = `/characters/public/${encodeURIComponent(characterId)}/posts/${encodeURIComponent(postId)}/comments`;
  const body = { commenter_account_id: commenterAccountId, handle: comment.handle, name: comment.name, reply_to: comment.replyTo, text: comment.text };
  const response = await postsRequest<{ comments?: CharacterPostComment[] }>(path, jsonOptions("POST", body));
  return Array.isArray(response.comments) ? response.comments : [];
}

function postsPath(sourceAccountId: string): string {
  return `/characters/${encodeURIComponent(sourceAccountId)}/posts`;
}

function jsonOptions(method: string, body: object): RequestInit {
  return { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } };
}

async function postsRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const data = await responseJson(response);
  if (!response.ok) throw postsApiError(response.status, data);
  return data as T;
}

async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text.trim() ? JSON.parse(text) as unknown : null;
}

function postsApiError(status: number, data: unknown): CharacterPostsApiError {
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const message = apiErrorMessage(record) || "게시글 요청에 실패했습니다.";
  return new CharacterPostsApiError(message, status, String(record.error || ""));
}
