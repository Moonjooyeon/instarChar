import { postGenerateContent } from "@/api/generate";
import { fieldText, normalizeHandle } from "@/domain/app/textUtils";
import { MODEL_CHAT } from "@/domain/app/aliveCore";

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
  setStep: (value: string) => void;
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
        flow: "character-analysis-v2",
        model: MODEL_CHAT,
        max_tokens: 2048,
        system: characterAnalysisSystemPrompt(),
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

function characterAnalysisSystemPrompt(): string {
  return `TASK_ID: character-analysis-v2
다음 텍스트는 사용자의 "오너 페르소나"나 "내 페르소나"가 아니라, SNS 계정으로 깨울 "캐릭터" 설정이다.
절대 사용자/오너/페르소나 생성용으로 해석하지 마라. 결과는 반드시 캐릭터 프로필 JSON 하나여야 한다.
아래 항목을 갖춘 JSON 객체로만 답해. 절대 마크다운 백틱(\`\`\`)을 쓰지 마라.
    {
      "target_type": "character",
      "name": "캐릭터 이름",
      "handle": "아이디 1개만. @ 없이, 공백/쉼표/여러 후보 없이",
      "age": "나이 또는 한 줄 설정. 알 수 없으면 빈 문자열",
      "persona": "캐릭터의 성격/정체성 요약",
      "world": "세계관/배경. 알 수 없으면 빈 문자열",
      "speech": "말투, 어미, 자주 쓰는 표현",
      "catchphrase": "캐치프레이즈나 명대사. 없으면 빈 문자열",
      "surface": "겉모습/첫인상",
      "inner": "겉과 다른 속마음/숨은 면",
      "situational": "상황별 반응",
      "triggers": "무너지거나 발끈하는 점",
      "interests": "좋아하는 것/관심사",
      "relations": "관계망. 예: 이름 — 관계, 이름 — 관계. 없으면 빈 문자열",
      "warmth": "slow | normal | fast 중 하나"
    }`;
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

function warmthValue(value: unknown): string {
  return typeof value === "string" && ["slow", "normal", "fast"].includes(value) ? value : "normal";
}
