import { apiNoContent, apiResult, type ApiError } from "./client.js";

export type QueryResult = {
  data?: Record<string, unknown>[] | null;
  error?: ApiError | null;
};

export type SettledQueryResult = PromiseSettledResult<QueryResult>;

export type StructuredProfileState = {
  characters?: Record<string, unknown>[];
  dm_threads?: Record<string, unknown>[];
  personas?: Record<string, unknown>[];
  shared_dm_threads?: Record<string, unknown>[];
};

type StructuredRows = {
  characterRows: Record<string, unknown>[];
  ownerDmRows: Record<string, unknown>[];
  personaRows: Record<string, unknown>[];
  sharedDmRows: Record<string, unknown>[];
};

export async function deleteStructuredCharacterData(_ownerId: string, targetId: string): Promise<SettledQueryResult[]> {
  const result = await apiNoContent(`/characters/${encodeURIComponent(targetId)}`, { method: "DELETE" });
  return [fulfilled(result)];
}

export async function syncStructuredRows(rows: StructuredRows): Promise<SettledQueryResult[]> {
  const result = await apiNoContent("/profile/structured-state", {
    method: "POST",
    body: JSON.stringify({
      characters: rows.characterRows,
      personas: rows.personaRows,
      dm_threads: rows.ownerDmRows,
      shared_dm_threads: rows.sharedDmRows,
    }),
  });
  return [fulfilled(result)];
}

export async function loadStructuredRows(_ownerId: string, initialState?: StructuredProfileState): Promise<SettledQueryResult[]> {
  if (initialState) return structuredRows(initialState);
  const result = await apiResult<StructuredProfileState>("/profile/state");
  if (result.error) return [errorResult(result.error), errorResult(result.error), errorResult(result.error), errorResult(result.error), errorResult(result.error)];
  return structuredRows(result.data || {});
}

function structuredRows(data: StructuredProfileState): SettledQueryResult[] {
  return [
    fulfilled(rowsResult(data.characters)),
    fulfilled(rowsResult(data.characters)),
    fulfilled(rowsResult(data.personas)),
    fulfilled(rowsResult(data.dm_threads)),
    fulfilled(rowsResult(data.shared_dm_threads)),
  ];
}

function rowsResult(rows: unknown): QueryResult {
  return { data: Array.isArray(rows) ? rows as Record<string, unknown>[] : [], error: null };
}

function errorResult(error: ApiError): PromiseFulfilledResult<QueryResult> {
  return fulfilled({ data: null, error });
}

function fulfilled(value: QueryResult | { error: ApiError | null }): PromiseFulfilledResult<QueryResult> {
  return { status: "fulfilled", value: "data" in value ? value : { data: null, error: value.error } };
}
