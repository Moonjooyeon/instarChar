import { apiNoContent, type ApiError } from "./client.js";

export function deleteDmThreadRow(key: string, _ownerId: string): Promise<{ error: ApiError | null }> {
  return apiNoContent(dmThreadPath(key), {
    method: "DELETE",
    query: { thread_key: key },
  });
}

function dmThreadPath(key: string): string {
  return key.startsWith("dm::") ? "/shared-dm-threads" : "/dm-threads";
}
