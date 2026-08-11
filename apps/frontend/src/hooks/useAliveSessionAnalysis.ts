import { createGenerateRequestKey, postGenerateContent } from "@/api/generate";
import { MODEL_UTIL } from "@/domain/app/aliveCore";

type JsonRecord = Record<string, unknown>;

type SessionLine = {
  text?: string;
  who?: string;
};

type SessionFlags = {
  aIsOwner: boolean;
  aMem: boolean;
  aPersona: boolean;
  bIsOwner: boolean;
  bMem: boolean;
  bPersona: boolean;
};

type SessionAnalysisOptions = {
  bumpAffinity: (from: string, to: string, delta: number, log: string[]) => void;
  bumpRoomAffinity: (roomKey: string, from: string, to: string, delta: number) => void;
  cleanMemItems: (items: unknown[]) => unknown[];
  isPersonaName: (name: string) => boolean;
  saveMemories: (ownerName: string, peerName: string, items: unknown[], roomKey: string) => void;
};

export function useAliveSessionAnalysis({
  bumpAffinity,
  bumpRoomAffinity,
  cleanMemItems,
  isPersonaName,
  saveMemories,
}: SessionAnalysisOptions): {
  judgeSession: (aName: string, bName: string, lines: SessionLine[]) => Promise<void>;
  processSession: (aName: string, bName: string, lines: SessionLine[], memOnly?: boolean, roomKey?: string) => Promise<void>;
} {
  const OWNER = "나";
  async function judgeSession(aName: string, bName: string, lines: SessionLine[]): Promise<void> {
    const log = sessionLog(lines, 2);
    if (!log) return;
    const transcript = transcriptFromLog(log, 12);
    const judgeOne = async (from: string, to: string): Promise<void> => {
      const delta = await judgeAffinityDelta(from, to, transcript);
      if (delta !== 0) bumpAffinity(from, to, delta, log.map((item) => `${item.who}: ${item.text}`));
    };
    if (aName === OWNER || bName === OWNER) {
      await judgeOne(aName === OWNER ? bName : aName, OWNER);
      return;
    }
    const aPersona = isPersonaName(aName);
    const bPersona = isPersonaName(bName);
    if (aPersona && !bPersona) { await judgeOne(bName, aName); return; }
    if (bPersona && !aPersona) { await judgeOne(aName, bName); return; }
    await judgeOne(aName, bName);
    await judgeOne(bName, aName);
  }
  async function processSession(aName: string, bName: string, lines: SessionLine[], memOnly = false, roomKey = ""): Promise<void> {
    const log = sessionLog(lines, 3);
    if (!log) return;
    const flags = sessionFlags(aName, bName, isPersonaName);
    try {
      const obj = await analyzeSessionSummary(aName, bName, transcriptFromLog(log, 16));
      applySessionAffinity({ bName, bumpAffinity, bumpRoomAffinity, flags, log, memOnly, obj, roomKey, aName });
      if (flags.aMem) saveMemories(aName, bName, cleanMemItems(arrayValue(obj.mem_a)), roomKey);
      if (flags.bMem) saveMemories(bName, aName, cleanMemItems(arrayValue(obj.mem_b)), roomKey);
    } catch (e) {
      console.error("기억 통합 요약 실패:", e);
    }
  }
  return { judgeSession, processSession };
}

function sessionLog(lines: SessionLine[], minimum: number): SessionLine[] | null {
  const log = (lines || []).filter((message) => message.text && message.text.length > 1);
  return log.length < minimum ? null : log;
}

function transcriptFromLog(log: SessionLine[], limit: number): string {
  return log.slice(-limit).map((message) => `${message.who}: ${message.text}`).join("\n");
}

async function judgeAffinityDelta(from: string, to: string, transcript: string): Promise<number> {
  const sys = `아래는 "${from}"와(과) "${to}"의 대화다. 이 대화를 거치며 "${from}"가 "${to}"에게 느끼는 호감·친밀감이 어떻게 변했는지 "${from}" 입장에서만 판정하라.
- ${from}가 ${to}에게 더 끌렸으면 +, 실망·서먹·거리감이 들었으면 -.
- 한쪽만 좋아하는 짝사랑 상황도 그대로 반영하라(상대 반응이 시큰둥하면 낮게).
- 보통의 어색함·삐침은 작게(-1~-4). 하지만 ${to}가 ${from}에게 바람·불륜·배신·심한 모욕·일부러 상처주기 같은 과한 행동을 했다면 크게 떨어뜨려라(-12 ~ -30). 그런 게 없으면 작은 범위로.
- 숫자 하나만 출력. -30 ~ +8 범위 정수. 설명·기호 금지. 예: 5 또는 -20`;
  try {
    const idempotencyKey = createGenerateRequestKey("session-affinity");
    const raw = (await postGenerateContent({ flow: "assist_session", idempotency_key: idempotencyKey, model: MODEL_UTIL, max_tokens: 10, system: sys, messages: [{ role: "user", content: transcript }] }, "호감도 판정 API")).trim();
    const match = raw.match(/-?\d+/);
    return match ? Math.max(-30, Math.min(8, parseInt(match[0], 10))) : 0;
  } catch (e) {
    return 0;
  }
}

function sessionFlags(aName: string, bName: string, isPersonaName: (name: string) => boolean): SessionFlags {
  const OWNER = "나";
  const aPersona = isPersonaName(aName);
  const bPersona = isPersonaName(bName);
  const aIsOwner = aName === OWNER;
  const bIsOwner = bName === OWNER;
  return { aIsOwner, aMem: !aPersona && !aIsOwner, aPersona, bIsOwner, bMem: !bPersona && !bIsOwner, bPersona };
}

async function analyzeSessionSummary(aName: string, bName: string, transcript: string): Promise<JsonRecord> {
  const sys = `아래는 "${aName}"와(과) "${bName}"의 DM 대화다. 이 대화를 분석해 JSON으로만 답하라. 설명·코드블록 없이 JSON 객체 하나만.

판정할 것:
1. 호감도 변화 (각 방향, 이 대화로 상대에게 더 끌렸으면 +, 실망·거리감이면 -):
   - 보통의 어색함·삐침은 작게(-1~-4). 바람·불륜·배신·심한 모욕·일부러 상처주기 같은 과한 행동엔 크게(-12~-30). 좋았으면 +1~+8.
  - 짝사랑이면 한쪽만 높게, 상대는 시큰둥하게.
2. 각자가 "장기기억으로 남길 사건/감정 변화"만 고른다.
   - 감정 변화는 반드시 기억할 수 있다. 단, "왜 그렇게 느꼈는지 원인"까지 함께 들어가야 한다.
   - 저장 기준은 중요도 3~5급: 감정 변화와 그 원인, 명확한 약속/합의, 관계가 바뀐 사건, 새로 밝혀진 핵심 설정·금기·트라우마, 앞으로 지켜야 할 호칭/경계, 큰 갈등·화해·고백·거절.
   - 사소한 잡담, 단순 인사, 한 번 웃은 것, 같은 말 반복, 취향 추측, 순간적인 감탄만 있는 내용은 저장하지 말고 빈 배열로 둔다.
   - 자기 입장에서 직접 보고 들은 것만, 상대 속마음은 금지. 각자 최대 1개, 한 문장.
   - 약속·사건·날짜처럼 둘 다 겪은 객관적 사실은 양쪽 기억(mem_a, mem_b)에서 내용이 어긋나면 안 된다.

출력 형식(반드시 이 형태의 유효한 JSON으로 작성할 것):
{"aff_a_to_b": 0, "aff_b_to_a": 0, "mem_a": [{"content":"감정 변화와 원인 또는 기억할 사건","importance":3}], "mem_b": []}
기억할 게 없으면 빈 배열.`;
  const idempotencyKey = createGenerateRequestKey("session-summary");
  const raw = await postGenerateContent({ flow: "assist_session", idempotency_key: idempotencyKey, model: MODEL_UTIL, max_tokens: 2048, system: sys, messages: [{ role: "user", content: transcript }] }, "기억 통합 API");
  return parseJsonRecord(extractJsonObject(raw));
}

function extractJsonObject(rawText: unknown): string {
  const raw = String(rawText || "").trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  return first !== -1 && last !== -1 && last > first ? raw.slice(first, last + 1) : raw;
}

function parseJsonRecord(rawText: string): JsonRecord {
  const parsed = JSON.parse(rawText) as unknown;
  return parsed && typeof parsed === "object" ? parsed as JsonRecord : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function applySessionAffinity(options: {
  aName: string;
  bName: string;
  bumpAffinity: SessionAnalysisOptions["bumpAffinity"];
  bumpRoomAffinity: SessionAnalysisOptions["bumpRoomAffinity"];
  flags: SessionFlags;
  log: SessionLine[];
  memOnly: boolean;
  obj: JsonRecord;
  roomKey: string;
}): void {
  const { aName, bName, bumpAffinity, bumpRoomAffinity, flags, log, memOnly, obj, roomKey } = options;
  if (memOnly) return;
  const npcRoom = roomKey?.startsWith("local::");
  const applyAff = npcRoom ? (from, to, val) => applyRoomAffinityDelta(bumpRoomAffinity, roomKey, from, to, val) : (from, to, val) => applyAffinityDelta(bumpAffinity, from, to, val, log);
  if (flags.aIsOwner || flags.bIsOwner) {
    const characterName = flags.aIsOwner ? bName : aName;
    applyAff(characterName, "나", flags.aIsOwner ? obj.aff_b_to_a : obj.aff_a_to_b);
    return;
  }
  if (flags.aPersona && !flags.bPersona) {
    applyAff(bName, aName, obj.aff_b_to_a);
    return;
  }
  if (flags.bPersona && !flags.aPersona) {
    applyAff(aName, bName, obj.aff_a_to_b);
    return;
  }
  applyAff(aName, bName, obj.aff_a_to_b);
  applyAff(bName, aName, obj.aff_b_to_a);
}

function applyAffinityDelta(bumpAffinity: SessionAnalysisOptions["bumpAffinity"], from: string, to: string, value: unknown, log: SessionLine[]): void {
  const delta = normalizedDelta(value);
  if (delta !== 0) bumpAffinity(from, to, delta, log.map((item) => `${item.who}: ${item.text}`));
}

function applyRoomAffinityDelta(bumpRoomAffinity: SessionAnalysisOptions["bumpRoomAffinity"], roomKey: string, from: string, to: string, value: unknown): void {
  const delta = normalizedDelta(value);
  if (delta !== 0) bumpRoomAffinity(roomKey, from, to, delta);
}

function normalizedDelta(value: unknown): number {
  return Math.max(-30, Math.min(8, parseInt(String(value), 10) || 0));
}
