import type { FeedPost, FollowedCharacter } from "@/domain/feed/feedUtils";
import { apiJson } from "./client.js";

export type FeedKind = "timeline" | "recommendations";

export type FeedPage = {
  hasMore: boolean;
  nextCursor: string;
  posts: FeedPost[];
};

type FeedPageResponse = {
  has_more?: boolean;
  items?: FeedPageItem[];
  next_cursor?: string;
};

type FeedPageItem = {
  author_character_id?: string;
  author_handle?: string;
  author_name?: string;
  author_owner_id?: string;
  author_shared_id?: string;
  post_id?: string;
  post?: Record<string, unknown>;
  recommendation_reason?: "interest" | "recent";
};

export async function getFeedPage(sourceAccountId: string, kind: FeedKind, cursor = "", signal?: AbortSignal): Promise<FeedPage> {
  const response = await apiJson<FeedPageResponse>("/feed", { query: { source_account_id: sourceAccountId, kind, cursor: cursor || undefined, limit: 20 }, signal });
  return { hasMore: Boolean(response.has_more), nextCursor: response.next_cursor || "", posts: (response.items || []).map((item) => feedPostFromItem(item, kind)) };
}

function feedPostFromItem(item: FeedPageItem, kind: FeedKind): FeedPost {
  const originalPostId = String(item.post_id || item.post?.id || "");
  const sourceId = item.author_shared_id || item.author_character_id || "unknown";
  const recommendedCharacter: FollowedCharacter = { id: `shared_${sourceId}`, characterId: item.author_character_id || "", sharedId: item.author_shared_id || "", ownerId: item.author_owner_id || "", name: item.author_name || "", handle: item.author_handle || "", recommendationReason: item.recommendation_reason || "recent" };
  return { ...item.post, id: `${kind}:${sourceId}:${originalPostId}`, originalPostId, importedFromFollow: kind === "timeline", importedFromRecommendation: kind === "recommendations", author: item.author_name || "", authorHandle: item.author_handle || item.author_name || "", authorAvatarImg: stringValue(item.post?.avatarImg), authorCharacterId: item.author_character_id || "", authorOwnerId: item.author_owner_id || "", authorSharedId: item.author_shared_id || "", recommendationReason: item.recommendation_reason || "recent", recommendedCharacter };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
