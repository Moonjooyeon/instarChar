import { apiNoContent, apiResult, type ApiResult } from "./client.js";

export type ReportTargetType = "character" | "post" | "comment" | "dm_message" | "ai_content" | "user";
export type ReportReason = "sexual" | "harassment" | "hate" | "violence" | "self_harm" | "illegal" | "impersonation" | "privacy" | "copyright" | "spam" | "other";

export type ReportTarget = {
  targetType: ReportTargetType;
  targetOwnerId?: string;
  targetReference: string;
  snapshot: Record<string, unknown>;
  label: string;
};

type ConsentResponse = {
  accepted: boolean;
  terms_version: string;
};

type BlocksResponse = {
  user_ids: string[];
};

type ReportResponse = {
  id: string;
  status: string;
};

export function getSafetyConsent(): Promise<ApiResult<ConsentResponse>> {
  return apiResult<ConsentResponse>("/safety/consent");
}

export function acceptSafetyTerms(): Promise<ApiResult<ConsentResponse>> {
  return apiResult<ConsentResponse>("/safety/consent", { method: "PUT" });
}

export function getBlockedUsers(): Promise<ApiResult<BlocksResponse>> {
  return apiResult<BlocksResponse>("/safety/blocks");
}

export function blockSafetyUser(userId: string): Promise<{ error: import("./client.js").ApiError | null }> {
  return apiNoContent(`/safety/blocks/${encodeURIComponent(userId)}`, { method: "PUT" });
}

export function unblockSafetyUser(userId: string): Promise<{ error: import("./client.js").ApiError | null }> {
  return apiNoContent(`/safety/blocks/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export function createSafetyReport(target: ReportTarget, reason: ReportReason, detail: string): Promise<ApiResult<ReportResponse>> {
  return apiResult<ReportResponse>("/safety/reports", {
    method: "POST",
    body: JSON.stringify({
      target_type: target.targetType,
      target_owner_id: target.targetOwnerId || null,
      target_reference: target.targetReference,
      reason,
      detail,
      snapshot: target.snapshot,
    }),
  });
}
