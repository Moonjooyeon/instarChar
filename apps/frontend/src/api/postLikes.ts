import { apiJson } from "./client.js";


export type PostLikeTarget = {
  target_shared_character_id: string;
  post_id: string;
};

export type PostLikeItem = PostLikeTarget & {
  available: boolean;
  liked: boolean;
  likes: number;
};

type PostLikesResponse = {
  items: PostLikeItem[];
};

export async function queryPostLikes(likerAccountId: string, targets: PostLikeTarget[]): Promise<PostLikeItem[]> {
  const batches = chunkTargets(targets);
  const responses = await Promise.all(batches.map((batch) => queryPostLikeBatch(likerAccountId, batch)));
  return responses.flatMap((response) => response.items);
}

async function queryPostLikeBatch(likerAccountId: string, targets: PostLikeTarget[]): Promise<PostLikesResponse> {
  const response = await apiJson<PostLikesResponse>("/post-likes/query", {
    method: "POST",
    body: JSON.stringify({ liker_account_id: likerAccountId, targets }),
  });
  return response;
}

export function updatePostLike(likerAccountId: string, target: PostLikeTarget, liked: boolean): Promise<PostLikeItem> {
  return apiJson<PostLikeItem>("/post-likes", {
    method: "PUT",
    body: JSON.stringify({ liker_account_id: likerAccountId, ...target, liked }),
  });
}

function chunkTargets(targets: PostLikeTarget[]): PostLikeTarget[][] {
  const chunks: PostLikeTarget[][] = [];
  for (let index = 0; index < targets.length; index += 100) chunks.push(targets.slice(index, index + 100));
  return chunks;
}
