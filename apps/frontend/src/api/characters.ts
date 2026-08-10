import { apiErrorMessage, apiFetch } from "./client.js";
import { notifyCreditBalanceUpdated } from "./credits.js";
import { normalizeHandle } from "../domain/app/textUtils.js";

export type CharacterHandleAvailability = {
  available: boolean;
  handle: string;
};

export type CharacterWrite = {
  character: Record<string, unknown>;
  following: unknown[];
  gallery: unknown[];
  handle: string;
  name: string;
};

export type CharacterWriteResponse = CharacterWrite & {
  source_account_id: string;
};

export class CharacterApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "CharacterApiError";
    this.status = status;
    this.code = code;
  }
}

export async function getCharacterHandleAvailability(handle: string, excludeSourceAccountId = ""): Promise<CharacterHandleAvailability> {
  const query = new URLSearchParams({ handle: normalizeHandle(handle) });
  if (excludeSourceAccountId) query.set("exclude_source_account_id", excludeSourceAccountId);
  return characterRequest<CharacterHandleAvailability>(`/characters/handle-availability?${query}`);
}

export async function saveCharacter(sourceAccountId: string, payload: CharacterWrite): Promise<CharacterWriteResponse> {
  const path = `/characters/${encodeURIComponent(sourceAccountId)}`;
  const result = await characterRequest<CharacterWriteResponse>(path, jsonOptions("PUT", payload));
  notifyCreditBalanceUpdated();
  return result;
}

async function characterRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const data = await responseJson(response);
  if (!response.ok) throw characterApiError(response.status, data);
  return data as T;
}

async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text.trim() ? JSON.parse(text) as unknown : null;
}

function characterApiError(status: number, data: unknown): CharacterApiError {
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const message = apiErrorMessage(record) || "캐릭터 저장에 실패했습니다.";
  return new CharacterApiError(message, status, String(record.error || ""));
}

function jsonOptions(method: string, body: object): RequestInit {
  return { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } };
}
