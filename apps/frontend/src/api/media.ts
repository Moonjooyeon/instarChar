import { apiJson, apiUrl } from "./client";

export type MediaPurpose = "profile_avatar" | "profile_header" | "gallery" | "feed_post" | "dm_attachment";

type UploadIntent = {
  asset_id: string;
  upload_fields: Record<string, string>;
  upload_url: string;
};

type UploadComplete = {
  reference: string;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadImage(file: File, purpose: MediaPurpose, sourceAccountId = ""): Promise<string> {
  validateImage(file);
  const sha256 = await fileSha256(file);
  const intent = await createIntent(file, purpose, sourceAccountId, sha256);
  await uploadToStorage(intent, file);
  return completeUpload(intent.asset_id);
}

export function mediaUrl(value: unknown, threadKey = ""): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const assetId = assetIdFromReference(value);
  const contentUrl = assetId ? apiUrl(`/media/${assetId}/content`) : "";
  return threadKey && contentUrl ? `${contentUrl}?thread_key=${encodeURIComponent(threadKey)}` : contentUrl || value;
}

function validateImage(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("JPG, PNG, WebP 이미지만 올릴 수 있어요.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("이미지는 10MB 이하만 올릴 수 있어요.");
}

async function createIntent(file: File, purpose: MediaPurpose, sourceAccountId: string, sha256: string): Promise<UploadIntent> {
  return apiJson<UploadIntent>("/media/upload-intents", {
    method: "POST",
    body: JSON.stringify({ purpose, content_type: file.type, byte_size: file.size, sha256, source_account_id: sourceAccountId }),
  });
}

async function uploadToStorage(intent: UploadIntent, file: File): Promise<void> {
  const form = new FormData();
  Object.entries(intent.upload_fields).forEach(([name, value]) => form.append(name, value));
  form.append("file", file);
  const response = await fetch(intent.upload_url, { method: "POST", body: form });
  if (!response.ok) throw new Error("이미지 업로드에 실패했어요.");
}

async function completeUpload(assetId: string): Promise<string> {
  const result = await apiJson<UploadComplete>(`/media/${assetId}/complete`, { method: "POST" });
  return result.reference;
}

async function fileSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assetIdFromReference(value: string): string {
  const match = /^asset:([0-9a-f-]{36})$/i.exec(value);
  return match ? match[1] : "";
}
