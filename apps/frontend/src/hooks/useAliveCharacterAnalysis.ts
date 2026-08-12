import { createGenerateRequestKey, postGenerateContent } from "@/api/generate";
import { analysisFallbackProfile } from "@/domain/app/analysisFallback";
import { fieldText, normalizeHandle } from "@/domain/app/textUtils";
import { type AppStep } from "@/domain/app/aliveCore";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type JsonRecord = Record<string, unknown>;

type CharacterDraft = {
  corrections?: unknown[];
  directions?: string;
  lorebook?: unknown[];
  tone?: string;
  [key: string]: unknown;
};

type CharacterAnalysisOptions = {
  cleanApiFailureMessage: (error: unknown, fallback?: string) => string;
  dump: string;
  rpLog: string;
  setChar: SetState<CharacterDraft>;
  setLoading: (value: boolean) => void;
  setParseError: (value: string) => void;
  setParseFailed: (value: boolean) => void;
  setParsing: (value: boolean) => void;
  setStep: (value: AppStep) => void;
};

export function useAliveCharacterAnalysis({
  cleanApiFailureMessage,
  dump,
  rpLog,
  setChar,
  setLoading,
  setParseError,
  setParseFailed,
  setParsing,
  setStep,
}: CharacterAnalysisOptions): {
  parseDump: () => Promise<void>;
} {
  async function parseDump(): Promise<void> {
    const textRaw = characterAnalysisInput(dump, rpLog);
    if (!textRaw) return;
    setParsing(true);
    setLoading(true);
    setParseFailed(false);
    setParseError("");
    try {
      const raw = await postGenerateContent({
        flow: "character_analysis",
        idempotency_key: createGenerateRequestKey("character-analysis"),
        max_tokens: 2048,
        system: "",
        messages: [{ role: "user", content: textRaw }],
      }, "캐릭터 분석 API", {
        cache: "no-store",
        headers: { "X-ALIVE-Flow": "character-analysis-v2" },
      });
      const obj = parseJsonRecord(extractJsonObject(raw));
      if (!obj.name) throw new Error("이름 필드가 없습니다.");
      setChar((prev) => characterFromAnalysis(prev, obj));
      setStep("confirm");
    } catch (e) {
      console.error("분석 중 에러:", e);
      setChar((prev) => characterFromFallback(prev, dump, rpLog));
      setParseError(cleanApiFailureMessage(e, "AI 응답이 잠깐 비었어. 다시 분석해줘."));
      setParseFailed(true);
      setStep("confirm");
    } finally {
      setLoading(false);
      setParsing(false);
    }
  }
  return { parseDump };
}

function characterAnalysisInput(dump: string, rpLog: string): string {
  return [
    dump.trim() ? `[캐릭터 설명]\n${dump.trim()}` : "",
    rpLog.trim() ? `[역극/대사 로그]\n${rpLog.trim()}` : "",
  ].filter(Boolean).join("\n\n");
}

function extractJsonObject(rawText: unknown): string {
  const raw = String(rawText || "");
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  return first !== -1 && last !== -1 && last > first ? raw.slice(first, last + 1) : raw;
}

function parseJsonRecord(rawText: string): JsonRecord {
  const parsed = JSON.parse(rawText) as unknown;
  return parsed && typeof parsed === "object" ? parsed as JsonRecord : {};
}

function characterFromAnalysis(prev: CharacterDraft, obj: JsonRecord): CharacterDraft {
  return {
    ...prev,
    name: fieldText(obj.name),
    handle: normalizeHandle(obj.handle || obj.id || obj.username || obj.account_id, obj.name),
    age: fieldText(obj.age),
    tone: prev.tone || "calm",
    persona: fieldText(obj.persona) || "성격 요약 없음",
    world: fieldText(obj.world),
    speech: fieldText(obj.speech),
    catchphrase: fieldText(obj.catchphrase),
    surface: fieldText(obj.surface),
    inner: fieldText(obj.inner),
    situational: fieldText(obj.situational),
    triggers: fieldText(obj.triggers),
    interests: fieldText(obj.interests),
    relations: fieldText(obj.relations),
    warmth: warmthValue(obj.warmth),
    corrections: prev.corrections || [],
    directions: prev.directions || "",
    lorebook: prev.lorebook || [],
  };
}

function characterFromFallback(prev: CharacterDraft, dump: string, rpLog: string): CharacterDraft {
  const fallback = analysisFallbackProfile(dump, rpLog, fallbackHandleSuffix());
  return { ...prev, ...fallback, tone: prev.tone || "calm", surface: fallback.persona, corrections: prev.corrections || [], directions: prev.directions || "", lorebook: prev.lorebook || [] };
}

function fallbackHandleSuffix(): string {
  return `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
}

function warmthValue(value: unknown): string {
  return typeof value === "string" && ["slow", "normal", "fast"].includes(value) ? value : "normal";
}
