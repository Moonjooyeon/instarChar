export const MODEL_DIRECT = "claude-sonnet-4-6";
export const MODEL_AUTO = "claude-haiku-4-5-20251001";
export const MODEL_CHAT = MODEL_DIRECT;
export const MODEL_UTIL = "claude-haiku-4-5-20251001";
export const BUILD_MARK = typeof __ALIVE_BUILD__ !== "undefined" ? __ALIVE_BUILD__ : "local";
export const LOCAL_STATE_KEY = "alive_app_state_v1";
export const API_LIMIT_MESSAGE = "오늘 한정된 API는 다 사용했어요! 다음에 만나요.";

export const RENDERABLE_STEPS = new Set(["home", "dump", "confirm", "feed", "discover", "dmlist", "dm"]);
export const STEP_TO_PATH = {
  home: "/app",
  dump: "/app/new",
  confirm: "/app/confirm",
  feed: "/app/feed",
  discover: "/app/discover",
  dmlist: "/app/dm",
  dm: "/app/dm/thread",
};
export const PATH_TO_STEP = {
  "/app": "home",
  "/app/": "home",
  "/app/new": "dump",
  "/app/confirm": "confirm",
  "/app/feed": "feed",
  "/app/discover": "discover",
  "/app/dm": "dmlist",
  "/app/dm/thread": "dm",
};

export function normalizeSavedStep(savedStep, hasActiveAccount) {
  if (!RENDERABLE_STEPS.has(savedStep)) return "home";
  if (["dump", "confirm"].includes(savedStep)) return "home";
  if (!hasActiveAccount && savedStep !== "home") return "home";
  if (savedStep === "dm") return "dmlist";
  return savedStep;
}

export function stepFromPath(pathname, hasActiveAccount) {
  const routeStep = PATH_TO_STEP[pathname] || "home";
  if (!RENDERABLE_STEPS.has(routeStep)) return "home";
  if (["feed", "discover", "dmlist", "dm"].includes(routeStep) && !hasActiveAccount) return "home";
  if (routeStep === "dm") return "dmlist";
  return routeStep;
}

export function pathForStep(stepName) {
  return STEP_TO_PATH[RENDERABLE_STEPS.has(stepName) ? stepName : "home"] || "/app";
}

export const TONE_PRESETS = [
  { id: "calm", label: "차분/시크", hint: "말수 적고 담담함" },
  { id: "bright", label: "밝음/수다", hint: "감탄사 많고 활기참" },
  { id: "soft", label: "다정/여림", hint: "따뜻하고 조심스러움" },
  { id: "edgy", label: "까칠/도도", hint: "툭툭 던지고 자존심 셈" },
  { id: "chaos", label: "4차원/엉뚱", hint: "예측불가 드립" },
];

export const POST_MOODS = [
  "일상 / 방금 있었던 일",
  "혼잣말 / 생각",
  "셀카 찍은 척 (사진 묘사)",
  "푸념 / 투정",
  "지금 기분",
  "랜덤 / 알아서",
];

export const EXAMPLES = [
  {
    name: "리안", short: "시크·까칠 / 마법사",
    text: "이름은 리안. 21살, 마법학교 다님. 겉으론 시크하고 까칠한데 단 거 앞에선 무너짐. 고양이 키우고 밤에 글 쓰는 거 좋아함. 반말 쓰고 문장 끝에 '…' 자주 붙임. 현대 판타지 세계관.",
  },
  {
    name: "하루", short: "밝음·수다 / 대학생",
    text: "하루! 20살 평범한 대학생인데 텐션이 미쳤음. 아무한테나 말 검. 감탄사 폭발하고 이모지 많이 씀. 먹는 거랑 강아지 좋아하고 시험기간만 되면 세상 무너진 것처럼 굶. 캐치프레이즈는 '오늘도 일단 출발~!'",
  },
];

export function parseRelations(relStr) {
  if (!relStr) return [];
  const pieces = relStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of pieces) {
    if (/[—\-–:]/.test(p)) {
      const m = p.split(/[—\-–:]/);
      const who = m[0].trim();
      const label = m.slice(1).join("—").trim();
      out.push({ who, label });
    } else if (out.length > 0) {
      out[out.length - 1].label += (out[out.length - 1].label ? ", " : "") + p;
    } else {
      out.push({ who: p, label: "" });
    }
  }
  return out;
}

export function compactName(value) {
  return String(value || "").replace(/\s/g, "").toLowerCase();
}

export function identityText(c) {
  if (!c) return "";
  return [c.name, c.handle, c.age, c.persona, c.surface, c.inner, c.world, c.interests, ...(c.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isSpecialRelation(label) {
  return /연인|애인|연애|사랑|부부|배우자|약혼|반려|짝사랑|흠모|연모|썸|운명|순애/.test(label || "");
}

export function relationTargetMatches(rel, targetChar, strictSpecial = false) {
  const who = String(rel?.who || "").trim();
  const targetName = String(targetChar?.name || targetChar || "").trim();
  if (!who || !targetName) return false;
  const nw = compactName(who);
  const nt = compactName(targetName);
  if (nw === nt) return true;

  const whoTokens = who.split(/\s+/).filter(Boolean);
  const targetTokens = targetName.split(/\s+/).filter(Boolean);
  const special = strictSpecial || isSpecialRelation(rel?.label);

  if (special) {
    if (whoTokens.length === 1 && targetTokens.includes(whoTokens[0])) return true;
    if (targetTokens.length === 1 && whoTokens.includes(targetTokens[0])) return true;
    const haystack = identityText(targetChar);
    return who.length >= 2 && haystack.includes(who.toLowerCase()) && nw.length >= Math.min(3, nt.length);
  }

  if (whoTokens.length === 1 && targetTokens.includes(whoTokens[0])) return true;
  if (targetTokens.length === 1 && whoTokens.includes(targetTokens[0])) return true;
  return false;
}

export const QUICK_FIXES = ["말투가 아님", "성격이 아님", "이런 말 안 함", "너무 오버함", "관계 반영 안 됨", "이모지 안 씀"];

export const DISCOVER_POOL = [
  { id: "d1", name: "세인", handle: "sein_", owner: "@morgse", age: "23", persona: "냉정한 검사. 말이 짧고 핵심만. 속은 의외로 정 많음.",
    speech: "건조한 반말, 군더더기 없음", surface: "무표정, 검은 코트", inner: "지킬 사람 앞에선 약해짐",
    interests: "검술, 비 오는 날", catchphrase: "…쓸데없는 소리.", tags: ["냉미남", "검사", "느와르"] },
  { id: "d2", name: "포아", handle: "poaa", owner: "@cloudfish", age: "19", persona: "장난기 폭발하는 인어. 호기심 천국, 인간 세상에 환장함.",
    speech: "물결치는 밝은 말투, 어미 늘임~", surface: "청록 머리, 진주 장식", inner: "외로움을 장난으로 숨김",
    interests: "반짝이는 것, 인간 음식", catchphrase: "오와~ 이건 또 뭐야~?", tags: ["인어", "발랄", "판타지"] },
  { id: "d3", name: "리체르카", handle: "ricerca", owner: "@inkwell", age: "27", persona: "고서를 모으는 마도서가. 우아하고 비밀이 많음.",
    speech: "정중한 존댓말, 고풍스러움", surface: "은테 안경, 깃펜", inner: "금지된 지식에 끌림",
    interests: "고문서, 홍차", catchphrase: "그 페이지는… 아직 이르군요.", tags: ["마법사", "지적", "미스터리"] },
  { id: "d4", name: "둔타", handle: "dunta_z", owner: "@333zzz", age: "21", persona: "헬스 중독 대형견 같은 청년. 단순하고 직진. 정 많음.",
    speech: "우렁찬 반말, 느낌표 남발", surface: "구릿빛 피부, 큰 덩치", inner: "섬세한 면을 들키기 싫어함",
    interests: "운동, 고기, 강아지", catchphrase: "일단 해보자!! 어?!", tags: ["대형견", "햇살", "근육"] },
  { id: "d5", name: "야린", handle: "yarin.x", owner: "@velvetnoir", age: "25", persona: "퇴폐적인 바텐더. 나른하고 위험한 분위기. 속내를 안 보임.",
    speech: "낮고 느린 말투, 농담 섞음", surface: "흐트러진 셔츠, 담배 향", inner: "누구도 곁에 안 둠",
    interests: "칵테일, 재즈, 밤", catchphrase: "한 잔 더? …위험한데.", tags: ["퇴폐", "어른", "느와르"] },
  { id: "d6", name: "솜", handle: "ssom_o", owner: "@bunnybun", age: "18", persona: "수줍은 토끼 수인. 말 더듬고 잘 놀람. 용기 내려 애씀.",
    speech: "더듬는 존댓말, 작은 목소리", surface: "큰 귀, 솜뭉치 꼬리", inner: "사실 모험을 동경함",
    interests: "당근 디저트, 별 보기", catchphrase: "어, 어어… 죄송해요…!", tags: ["수인", "소심", "힐링"] },
  { id: "d7", name: "카이젠", handle: "kaizen__", owner: "@redgear", age: "29", persona: "오만한 천재 발명가. 자뻑 심하지만 실력은 진짜.",
    speech: "거만한 반말, 비웃음 섞음", surface: "고글, 기름때 장갑", inner: "인정받고 싶은 욕구",
    interests: "기계, 폭발물, 커피", catchphrase: "흥, 이 정도는 기본이지.", tags: ["천재", "오만", "스팀펑크"] },
  { id: "d8", name: "유레", handle: "yure_moon", owner: "@lunalune", age: "22", persona: "조용한 점성술사. 신비롭고 다정. 사람 마음을 잘 읽음.",
    speech: "잔잔한 존댓말, 시적인 표현", surface: "별무늬 로브, 보랏빛 눈", inner: "자기 미래만은 못 봄",
    interests: "별자리, 타로, 새벽", catchphrase: "오늘 밤, 당신의 별이 흔들리네요.", tags: ["점성술", "신비", "힐링"] },
];

export function relationMatched(char, ident) {
  const myName = (ident.name || "").trim();
  if (!myName) return ident.relation ? `${myName} — ${ident.relation}` : "";
  const norm = (s) => s.replace(/\s/g, "");
  const myNorm = norm(myName);
  if (char.relations) {
    const hit = parseRelations(char.relations)
      .find((r) => relationTargetMatches(r, { name: myName, relation: ident.relation }, true) || (norm(r.who).includes(myNorm) && myNorm.length >= 2));
    if (hit) return `${hit.who}${hit.label ? ` — ${hit.label}` : ""}`;
  }
  if (ident.relation) return `${myName} — ${ident.relation}`;
  return "";
}

export function relationshipMatchRuleLine(targetName, matchedRelation) {
  if (!matchedRelation) return "";
  return `관계 매칭 확정: 관계망의 "${matchedRelation}" 항목은 현재 상대 "${targetName}"에게 직접 적용된다. 짧게 "애인", "연인", "라이벌", "동생"처럼만 적혀 있어도 그 한 단어를 핵심 관계 설정으로 삼아 말투·거리감·질투·다정함·경계심을 조절하라. 단, 그 관계 전용 태도는 이 상대에게만 적용하고 다른 사람에게 흘리지 마라.`;
}

export function speechGuideLine(value, label = "말투 참고") {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join(", ")
    : value && typeof value === "object"
      ? Object.values(value).filter(Boolean).join(" / ")
      : String(value || "").trim();
  if (!text) return "";
  return `${label}: ${text} (스타일 참고용. 이 문구나 예시 문장을 그대로 출력하지 말고, 어조·리듬·호칭·문장 길이만 자연스럽게 반영)`;
}

export function catchphraseGuideLine(value) {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join(", ")
    : value && typeof value === "object"
      ? Object.values(value).filter(Boolean).join(" / ")
      : String(value || "").trim();
  if (!text) return "";
  return `캐치프레이즈/말버릇 참고: ${text} (상황에 맞을 때만 아주 가끔 변형해서 사용. 매번 반복하거나 그대로 복붙 금지)`;
}

export function selfSettingPriorityBlock(c, label = "자기 설정") {
  if (!c) return "";
  const lines = [
    c.persona ? `성격/핵심 설정: ${c.persona}` : "",
    c.world ? `세계관/출신: ${c.world}` : "",
    c.surface ? `겉으로 보이는 모습: ${c.surface}` : "",
    c.inner ? `속마음/내면: ${c.inner}` : "",
    c.situational ? `상황별 반응: ${c.situational}` : "",
    c.triggers ? `금기/트리거: ${c.triggers}` : "",
    c.interests ? `관심사: ${c.interests}` : "",
    speechGuideLine(c.speech, "말투"),
    catchphraseGuideLine(c.catchphrase),
    c.relations ? `관계망: ${c.relations}` : "",
  ].filter(Boolean).join("\n");
  if (!lines) return "";
  return `[${label} — 최우선]
${lines}

자기 설정 적용 규칙:
- 답하기 전에 위 자기 설정을 반드시 먼저 읽고, 성격·말투·금기·관계망과 충돌하는 말은 하지 마라.
- 최근 대화 분위기나 상대의 말투를 따라 하더라도, 위 설정의 금지/핵심 성격/호칭 규칙을 절대 깨지 마라.
- 말투 참고 문장이나 예시를 그대로 베끼지 말고, 설정의 성격과 리듬만 새 문장으로 반영하라.
- 설정에 없는 급격한 스킨십·집착·연애 진전·캐붕 행동을 임의로 만들지 마라.`;
}

export function relationshipBoundaryLine(c, audience = "public") {
  const rels = Array.isArray(c?.relations)
    ? c.relations.filter(Boolean).join(", ")
    : c?.relations && typeof c.relations === "object"
      ? Object.values(c.relations).filter(Boolean).join(" / ")
      : String(c?.relations || "").trim();
  if (!rels) return "";
  const scope = audience === "public"
    ? "현재 글은 공개 SNS 글이라 특정 관계 대상에게 보내는 말이 아니다"
    : "현재 상대에게 직접 해당되는 관계만 사용한다";
  return `관계망: ${rels}
관계 적용 규칙: ${scope}. 관계망의 "이름 — 관계" 항목은 짧아도 확정 설정이다. 대상 이름이 현재 상대와 매칭되면 "애인", "연인", "라이벌" 같은 한 단어를 중심축으로 삼아 거리감과 반응을 조절한다. "A 한정 다정함", "B에게만 약함" 같은 관계 전용 태도는 그 이름의 상대에게 말할 때만 쓴다. 불특정 독자나 다른 인물에게 그 다정함/집착/애정을 흘리지 마라.`;
}

export function hasBatchim(text) {
  const ch = String(text || "").trim().replace(/[^\uAC00-\uD7A3A-Za-z0-9]/g, "").slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export function josa(text, pair) {
  const value = String(text || "").trim();
  const [withBatchim, withoutBatchim] = pair.split("/");
  return `${value}${hasBatchim(value) ? withBatchim : withoutBatchim}`;
}
