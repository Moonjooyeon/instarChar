import { API_LIMIT_MESSAGE } from "../domain/app/aliveCore.js";
import { notifyCreditBalanceUpdated } from "./credits.js";
import { apiUrl } from "./client.js";

type JsonRecord = Record<string, unknown>;

export type GenerateTextBlock = {
  type: "text";
  text: string;
};

export type GenerateImageBlock = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export type GenerateMessage = {
  role: "user" | "assistant";
  content: string | Array<GenerateTextBlock | GenerateImageBlock>;
};

export type GenerateRequest = {
  flow: string;
  idempotency_key?: string;
  max_tokens: number;
  media_thread_key?: string;
  messages: GenerateMessage[];
  model: string;
  system: string;
};

type GenerateOptions = {
  cache?: RequestCache;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export async function postGenerate(body: GenerateRequest, options: GenerateOptions = {}): Promise<Response> {
  const requestBody = { ...body, idempotency_key: body.idempotency_key || crypto.randomUUID() };
  return fetch(apiUrl("/ai/generate"), {
    method: "POST",
    credentials: "include",
    cache: options.cache,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    signal: options.signal,
    body: JSON.stringify(requestBody),
  });
}

export async function postGenerateContent(body: GenerateRequest, label: string, options: GenerateOptions = {}): Promise<string> {
  const content = await readApiContent(await postGenerate(body, options), label);
  notifyCreditBalanceUpdated();
  return content;
}

export async function readApiJson(res: Response, label: string): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) throw new Error(`${label} 응답이 비어 있습니다. HTTP ${res.status}. 로컬 개발 서버에서 /api/ai/generate 연결이 끊겼을 수 있습니다.`);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${label}가 JSON이 아닌 응답을 보냈습니다. HTTP ${res.status}. 응답 앞부분: ${text.slice(0, 120)}`);
  }
}

export function apiErrorText(data: unknown): string {
  const record = asRecord(data);
  const error = stringValue(record.error);
  if (error === "DAILY_LIMIT_EXCEEDED" || error === "MONTHLY_COST_LIMIT_EXCEEDED") return API_LIMIT_MESSAGE;
  if (error === "EMPTY_RESPONSE") return "AI 응답이 잠깐 비었어. 같은 말을 다시 보내줘.";
  if (error === "CREDIT_INSUFFICIENT") return "무료 에너지가 모두 소진됐어. 크레딧을 사용하면 계속 이어갈 수 있어.";
  if (error === "REQUEST_ALREADY_PROCESSED") return "이미 처리된 요청이야. 새 메시지로 다시 시도해줘.";
  if (error === "CONTEXT_TOO_LONG") return "대화가 많이 길어졌어. 새 대화에서 이어가줘.";
  return stringValue(record.message)
    || nestedErrorMessage(record.detail)
    || finishReasonText(record)
    || errorStatusText(record, error)
    || JSON.stringify(data || {});
}

export function apiContentText(data: unknown): string {
  const content = asRecord(data).content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => textBlockContent(item)).join("").trim();
}

export function cleanApiFailureMessage(error: unknown, fallback = "응답이 잠깐 끊겼어. 다시 시도해줘."): string {
  const record = asRecord(error);
  const name = stringValue(record.name);
  const message = name === "AbortError" ? "응답 시간이 길어져서 중단됐어. 다시 시도해줘." : stringValue(record.message);
  if (!message) return fallback;
  if (/Gemini|finishReason|EMPTY_RESPONSE|API_ERROR|SERVER_CRASH|응답에 텍스트|빈 응답/i.test(message)) return fallback;
  return message;
}

export async function readApiContent(res: Response, label: string): Promise<string> {
  const data = await readApiJson(res, label);
  if (!res.ok || asRecord(data).error) throw new Error(apiErrorText(data));
  const text = apiContentText(data);
  if (!text) throw new Error(`${label} 응답에 텍스트가 없습니다.`);
  return text;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nestedErrorMessage(value: unknown): string {
  const error = asRecord(asRecord(value).error);
  return stringValue(error.message);
}

function finishReasonText(record: JsonRecord): string {
  const finishReason = stringValue(record.finishReason);
  if (!finishReason) return "";
  return `${stringValue(record.error) || "API_ERROR"}: ${finishReason}`;
}

function errorStatusText(record: JsonRecord, error: string): string {
  if (!error) return "";
  const status = record.status == null ? "" : ` (${String(record.status)})`;
  return `${error}${status}`;
}

function textBlockContent(value: unknown): string {
  const record = asRecord(value);
  return record.type === "text" ? stringValue(record.text) : "";
}
