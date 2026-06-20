import React, { useState, useRef, useEffect } from "react";
import { hasSupabaseConfig, supabase } from "./supabaseClient";

// ─────────────────────────────────────────────
//  ALIVE — 내 캐릭터가 자기 SNS를 운영한다
//  설정 입력 → 그 보이스로 피드에 글이 올라옴
//  (Claude API로 실제 생성)
// ─────────────────────────────────────────────

// 모델 선택 — 한 곳에서 관리. 실배포 시 백엔드에서 다른 제공자(Gemini Pro/Flash 등)로 교체 가능.
//  DIRECT = 사용자가 직접 치는 DM (품질 최우선, 빈도 낮음 → Sonnet / 배포 시 Pro)
//  AUTO   = 자동 생성: 자동대화·피드 글·댓글 (빈도 높아 비용 큼 → Haiku / 배포 시 Flash)
//  UTIL   = 호감도 판정·기억 추출 같은 분류/요약 (저렴한 Haiku로 충분)
const MODEL_DIRECT = "claude-sonnet-4-6";
const MODEL_AUTO = "claude-haiku-4-5-20251001";
const MODEL_CHAT = MODEL_DIRECT; // 캐릭터 파싱 등 품질 필요한 곳 기본
const MODEL_UTIL = "claude-haiku-4-5-20251001";
const BUILD_MARK = typeof __ALIVE_BUILD__ !== "undefined" ? __ALIVE_BUILD__ : "local";
const LOCAL_STATE_KEY = "alive_app_state_v1";
const API_LIMIT_MESSAGE = "오늘 한정된 API는 다 사용했어요! 다음에 만나요.";
const RENDERABLE_STEPS = new Set(["home", "dump", "confirm", "feed", "discover", "dmlist", "dm"]);
const STEP_TO_PATH = {
  home: "/app",
  dump: "/app/new",
  confirm: "/app/confirm",
  feed: "/app/feed",
  discover: "/app/discover",
  dmlist: "/app/dm",
  dm: "/app/dm/thread",
};
const PATH_TO_STEP = {
  "/app": "home",
  "/app/": "home",
  "/app/new": "dump",
  "/app/confirm": "confirm",
  "/app/feed": "feed",
  "/app/discover": "discover",
  "/app/dm": "dmlist",
  "/app/dm/thread": "dm",
};

function normalizeSavedStep(savedStep, hasActiveAccount) {
  if (!RENDERABLE_STEPS.has(savedStep)) return "home";
  if (["dump", "confirm"].includes(savedStep)) return "home";
  if (!hasActiveAccount && savedStep !== "home") return "home";
  if (savedStep === "dm") return "dmlist";
  return savedStep;
}

function stepFromPath(pathname, hasActiveAccount) {
  const routeStep = PATH_TO_STEP[pathname] || "home";
  if (!RENDERABLE_STEPS.has(routeStep)) return "home";
  if (["feed", "discover", "dmlist", "dm"].includes(routeStep) && !hasActiveAccount) return "home";
  if (routeStep === "dm") return "dmlist";
  return routeStep;
}

function pathForStep(stepName) {
  return STEP_TO_PATH[RENDERABLE_STEPS.has(stepName) ? stepName : "home"] || "/app";
}

const TONE_PRESETS = [
  { id: "calm", label: "차분/시크", hint: "말수 적고 담담함" },
  { id: "bright", label: "밝음/수다", hint: "감탄사 많고 활기참" },
  { id: "soft", label: "다정/여림", hint: "따뜻하고 조심스러움" },
  { id: "edgy", label: "까칠/도도", hint: "툭툭 던지고 자존심 셈" },
  { id: "chaos", label: "4차원/엉뚱", hint: "예측불가 드립" },
];

const POST_MOODS = [
  "일상 / 방금 있었던 일",
  "혼잣말 / 생각",
  "셀카 찍은 척 (사진 묘사)",
  "푸념 / 투정",
  "지금 기분",
  "랜덤 / 알아서",
];

const EXAMPLES = [
  {
    name: "리안", short: "시크·까칠 / 마법사",
    text: "이름은 리안. 21살, 마법학교 다님. 겉으론 시크하고 까칠한데 단 거 앞에선 무너짐. 고양이 키우고 밤에 글 쓰는 거 좋아함. 반말 쓰고 문장 끝에 '…' 자주 붙임. 현대 판타지 세계관.",
  },
  {
    name: "하루", short: "밝음·수다 / 대학생",
    text: "하루! 20살 평범한 대학생인데 텐션이 미쳤음. 아무한테나 말 검. 감탄사 폭발하고 이모지 많이 씀. 먹는 거랑 강아지 좋아하고 시험기간만 되면 세상 무너진 것처럼 굶. 캐치프레이즈는 '오늘도 일단 출발~!'",
  },
];

// 관계 문자열을 [{who, label}] 로 파싱.
// "이름 — 설명" 단위로 끊되, 설명 안의 쉼표는 앞 사람 설명에 이어붙인다.
function parseRelations(relStr) {
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

function compactName(value) {
  return String(value || "").replace(/\s/g, "").toLowerCase();
}

function identityText(c) {
  if (!c) return "";
  return [c.name, c.handle, c.age, c.persona, c.surface, c.inner, c.world, c.interests, ...(c.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isSpecialRelation(label) {
  return /연인|애인|연애|사랑|부부|배우자|약혼|반려|짝사랑|흠모|연모|썸|운명|순애/.test(label || "");
}

function relationTargetMatches(rel, targetChar, strictSpecial = false) {
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

// 캐해 교정 빠른 선택
const QUICK_FIXES = ["말투가 아님", "성격이 아님", "이런 말 안 함", "너무 오버함", "관계 반영 안 됨", "이모지 안 씀"];

// 공개 캐릭터 풀 — "다른 사람이 올린 캐릭터"를 흉내내는 샘플. (실서비스에선 유저 공유 DB)
const DISCOVER_POOL = [
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

// 내 정체성(캐릭터)이 char의 관계망과 매칭되는지 → 매칭된 관계 문자열 반환 (없으면 "")
function relationMatched(char, ident) {
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

function relationshipMatchRuleLine(targetName, matchedRelation) {
  if (!matchedRelation) return "";
  return `관계 매칭 확정: 관계망의 "${matchedRelation}" 항목은 현재 상대 "${targetName}"에게 직접 적용된다. 짧게 "애인", "연인", "라이벌", "동생"처럼만 적혀 있어도 그 한 단어를 핵심 관계 설정으로 삼아 말투·거리감·질투·다정함·경계심을 조절하라. 단, 그 관계 전용 태도는 이 상대에게만 적용하고 다른 사람에게 흘리지 마라.`;
}

function speechGuideLine(value, label = "말투 참고") {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join(", ")
    : value && typeof value === "object"
      ? Object.values(value).filter(Boolean).join(" / ")
      : String(value || "").trim();
  if (!text) return "";
  return `${label}: ${text} (스타일 참고용. 이 문구나 예시 문장을 그대로 출력하지 말고, 어조·리듬·호칭·문장 길이만 자연스럽게 반영)`;
}

function catchphraseGuideLine(value) {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join(", ")
    : value && typeof value === "object"
      ? Object.values(value).filter(Boolean).join(" / ")
      : String(value || "").trim();
  if (!text) return "";
  return `캐치프레이즈/말버릇 참고: ${text} (상황에 맞을 때만 아주 가끔 변형해서 사용. 매번 반복하거나 그대로 복붙 금지)`;
}

function relationshipBoundaryLine(c, audience = "public") {
  const rels = Array.isArray(c?.relations)
    ? c.relations.filter(Boolean).join(", ")
    : c?.relations && typeof c.relations === "object"
      ? Object.values(c.relations).filter(Boolean).join(" / ")
      : String(c?.relations || "").trim();
  if (!rels) return "";
  const scope = audience === "public"
    ? "현재 글은 공개 SNS 글이라 특정 관계 대상에게 보내는 말이 아니다"
    : `현재 상대에게 직접 해당되는 관계만 사용한다`;
  return `관계망: ${rels}
관계 적용 규칙: ${scope}. 관계망의 "이름 — 관계" 항목은 짧아도 확정 설정이다. 대상 이름이 현재 상대와 매칭되면 "애인", "연인", "라이벌" 같은 한 단어를 중심축으로 삼아 거리감과 반응을 조절한다. "A 한정 다정함", "B에게만 약함" 같은 관계 전용 태도는 그 이름의 상대에게 말할 때만 쓴다. 불특정 독자나 다른 인물에게 그 다정함/집착/애정을 흘리지 마라.`;
}

function hasBatchim(text) {
  const ch = String(text || "").trim().replace(/[^\uAC00-\uD7A3A-Za-z0-9]/g, "").slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function josa(text, pair) {
  const value = String(text || "").trim();
  const [withBatchim, withoutBatchim] = pair.split("/");
  return `${value}${hasBatchim(value) ? withBatchim : withoutBatchim}`;
}

function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(Boolean(hasSupabaseConfig));
  const [profileLoading, setProfileLoading] = useState(Boolean(hasSupabaseConfig));
  const [profileLoadRetry, setProfileLoadRetry] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(hasSupabaseConfig ? "로그인 대기" : "로컬 저장");
  const [stateReady, setStateReady] = useState(!hasSupabaseConfig);
  const [step, setStep] = useState("home"); // home | dump | confirm | feed | dm
  const [accounts, setAccounts] = useState([]); // 저장된 캐릭터들 [{id, char, gallery, posts}]
  const [activeId, setActiveId] = useState(null);
  const [dump, setDump] = useState("");
  const [rpLog, setRpLog] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseFailed, setParseFailed] = useState(false);
  const [parseError, setParseError] = useState("");
  const [waking, setWaking] = useState(false);
  const [char, setChar] = useState({
    name: "", handle: "", age: "", tone: "calm",
    persona: "", world: "", speech: "", catchphrase: "",
    surface: "", inner: "", situational: "", triggers: "", interests: "",
    relations: "", corrections: [], directions: "", lorebook: [],
  });
  const [gallery, setGallery] = useState([]); // 업로드한 캐릭터 그림 (dataURL 배열)
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeText, setWriteText] = useState("");
  const [feedView, setFeedView] = useState("timeline"); // timeline | mine
  const [fixTarget, setFixTarget] = useState(null); // {type:'post'|'dm', id/index, text}
  const [fixText, setFixText] = useState("");
  const [autoChatting, setAutoChatting] = useState(false);
  const autoChatRef = useRef(false);
  const [auto, setAuto] = useState(true); // 자율 포스팅 on/off
  const [fast, setFast] = useState(false); // 데모용 빠른 주기
  const [nextIn, setNextIn] = useState(0); // 다음 글까지 남은 초
  
  // DM — 대화는 두 참여자(캐릭터/나) 사이. 키는 이름 정렬로 양방향 공유.
  const [dmThreads, setDmThreads] = useState({}); // { "이름A|이름B": [{from, text}] }
  const [dmWorldPrefs, setDmWorldPrefs] = useState({}); // dmKey -> {mode, note}
  const [pendingDm, setPendingDm] = useState(null); // {peer, speakAs, mode?}
  const [dmWorldDraft, setDmWorldDraft] = useState("");
  const [dmSettingsOpen, setDmSettingsOpen] = useState(false);
  const [dmPrefDraft, setDmPrefDraft] = useState({ mode: "bridge", note: "" });
  const [peer, setPeer] = useState(null); // 현재 대화 상대 {name, isUser, persona, relation}
  const [dmInput, setDmInput] = useState("");
  const [dmImageDraft, setDmImageDraft] = useState(null);
  const [dmSending, setDmSending] = useState(false);
  const [ownerPersona, setOwnerPersona] = useState(""); // 오너(나) 페르소나
  const [speakAs, setSpeakAs] = useState("char"); // 화자: "char"(캐릭터) | "owner"(나) | "p:<id>"(유저 페르소나)
  // 유저 페르소나 — 케이브덕식. 캐릭터처럼 이름·나이·성격·말투를 갖고, 호감도·진도질문 시스템을 동일하게 탐.
  const [personas, setPersonas] = useState([]); // [{id, name, age, persona, speech}]
  const [personaDraft, setPersonaDraft] = useState(null); // 편집 중 {id?, name, age, persona, speech}
  const [deleteTarget, setDeleteTarget] = useState(null); // 삭제 확인 중인 캐릭터 계정
  const [publicProfile, setPublicProfile] = useState(null); // 탐색에서 열어본 공개 캐릭터
  const [worldModal, setWorldModal] = useState(null);
  const [showMemory, setShowMemory] = useState(false); // 피드에서 쌓인 기억 펼침
  const [showRelations, setShowRelations] = useState(false); // 프로필 관계 펼침
  const [showMemoryAdd, setShowMemoryAdd] = useState(false);
  const [followPanel, setFollowPanel] = useState(null); // null | following | followers
  const [memFilter, setMemFilter] = useState(null); // 기억 상대 필터 (null=전체)
  const [memDraftPeer, setMemDraftPeer] = useState("");
  const [memDraftCustomPeer, setMemDraftCustomPeer] = useState("");
  const [memDraftText, setMemDraftText] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [showPeerMem, setShowPeerMem] = useState(false); // DM 안 상대기억 토글 (피드와 분리)
  const [newChatSpeaker, setNewChatSpeaker] = useState("char"); // 새 대화 시작 시 화자: char | p:<id>
  const [newChatMode, setNewChatMode] = useState(null); // null | "char"(캐릭터로) | "persona"(페르소나로)
  const [dmThreadTitles, setDmThreadTitles] = useState({});
  const [editingDmTitle, setEditingDmTitle] = useState(null); // {key, title}
  const [commentOn, setCommentOn] = useState(null); // 댓글 작성 중인 글 id
  const [commentAs, setCommentAs] = useState("char"); // 댓글 화자: char | p:<id>
  const [commentText, setCommentText] = useState(""); // 댓글 입력 내용
  const [editingPost, setEditingPost] = useState(null); // {id, text}
  const [editingComment, setEditingComment] = useState(null); // {postId, index, text}
  const [chatMode, setChatMode] = useState("talk"); // talk(대화) | novel(소설)
  
  // 팔로우한 외부 캐릭터(다른 사람 캐릭터) — char 객체 배열
  const [following, setFollowing] = useState([]);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [sharedCharacters, setSharedCharacters] = useState([]);
  const [sharedLoadState, setSharedLoadState] = useState({ loading: false, error: "" });
  const [discoverShowFollowed, setDiscoverShowFollowed] = useState(false);
  const [sharedFocusId, setSharedFocusId] = useState("");
  const [followerCounts, setFollowerCounts] = useState({});
  const [sharedFollowers, setSharedFollowers] = useState({ loading: false, rows: [], error: "" });
  const [activeSharedId, setActiveSharedId] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  // 호감도: 쌍 키("이름A|이름B" 정렬) → 0~100
  const [affinity, setAffinity] = useState({});
  // 진도질문 모달: null | {meName, peerName, line, pairKey, stage}
  const [proposal, setProposal] = useState(null);
  const [relationResult, setRelationResult] = useState(null); // {asker, other, accepted}
  const [affinityOpen, setAffinityOpen] = useState(false);
  const proposalRef = useRef(null);
  // 진도질문 띄운 쌍 — 거절/처리 후 당분간 다시 안 물어봄 (쌍키 → true)
  const proposalCooldownRef = useRef({});
  const proposingRef = useRef(false); // 진도질문 생성 중복 방지
  const dmEndRef = useRef(null);
  const loadingRef = useRef(false);
  const feedTopRef = useRef(null);
  const feedInitRef = useRef(false);
  const followBackSyncRef = useRef(new Set());
  const wakingRef = useRef(false);
  const profileLoadedRef = useRef(false);
  const profileTableBrokenRef = useRef(false);
  const saveTimerRef = useRef(null);
  const shareStatusTimerRef = useRef(null);
  const navInitRef = useRef(false);
  const navApplyingRef = useRef(false);
  const navLastKeyRef = useRef("");
  const dmSendingRef = useRef(false);
  const dmRequestSeqRef = useRef(0);
  const dmKeyRef = useRef("");
  const affinityRemainderRef = useRef({});

  function flashShareStatus(message, ms = 2200) {
    if (shareStatusTimerRef.current) clearTimeout(shareStatusTimerRef.current);
    setShareStatus(message);
    shareStatusTimerRef.current = setTimeout(() => {
      setShareStatus("");
      shareStatusTimerRef.current = null;
    }, ms);
  }

  useEffect(() => () => {
    if (shareStatusTimerRef.current) clearTimeout(shareStatusTimerRef.current);
  }, []);

  const update = (k, v) => setChar((c) => ({ ...c, [k]: v }));

  function blankChar() {
    return {
      name: "", handle: "", age: "", tone: "calm",
      persona: "", world: "", speech: "", catchphrase: "",
      avatarImg: "", headerImg: "",
      surface: "", inner: "", situational: "", triggers: "", interests: "",
      relations: "", corrections: [], directions: "", lorebook: [],
    };
  }

  function blankAppState(name = "") {
    return {
      version: 1,
      step: "home",
      accounts: [],
      activeId: null,
      char: blankChar(),
      gallery: [],
      posts: [],
      personas: [],
      dmThreads: {},
      dmThreadTitles: {},
      dmWorldPrefs: {},
      ownerPersona: "",
      following: [],
      affinity: {},
      discoverQuery: "",
      profileName: name,
    };
  }

  function accountSnapshot() {
    return accounts.map((a) => a.id === activeId ? { ...a, char, gallery, posts, following } : a);
  }

  function exportAppState() {
    return {
      version: 1,
      // Do not persist navigation. OAuth/login restore should never jump into DM/feed.
      step: "home",
      accounts: accountSnapshot(),
      activeId,
      char,
      gallery,
      posts,
      personas,
      dmThreads,
      dmThreadTitles,
      dmWorldPrefs,
      ownerPersona,
      following,
      affinity,
      discoverQuery: "",
      profileName,
    };
  }

  function persistLocalSnapshot(snapshot) {
    if (hasSupabaseConfig) return;
    try {
      const oldRaw = localStorage.getItem(LOCAL_STATE_KEY);
      if ((!snapshot.accounts || snapshot.accounts.length === 0) && oldRaw) {
        const oldState = JSON.parse(oldRaw);
        if (Array.isArray(oldState.accounts) && oldState.accounts.length > 0) return;
      }
      localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn("로컬 즉시 저장 실패:", e);
    }
  }

  async function saveAppStateSnapshot(snapshot) {
    if (!snapshot) return;
    if (!hasSupabaseConfig || !supabase || !session?.user) {
      persistLocalSnapshot(snapshot);
      return;
    }
    if (profileTableBrokenRef.current) {
      await syncStructuredState(snapshot);
      setSaveStatus("분리 저장됨");
      return;
    }
    const { error } = await supabase.from("alive_profiles").upsert({
      id: session.user.id,
      email: session.user.email,
      display_name: profileName.trim() || session.user.email?.split("@")[0] || "",
      onboarded: !onboardingOpen,
    });
    if (error) {
      profileTableBrokenRef.current = true;
      setSaveStatus(`저장 실패: ${error.message}`);
      await syncStructuredState(snapshot);
      return;
    }
    syncStructuredState(snapshot).catch((e) => console.warn("분리 테이블 동기화 실패:", e));
    setSaveStatus("저장됨");
  }

  function applyAppState(saved = {}) {
    const nextAccounts = Array.isArray(saved.accounts) ? saved.accounts : [];
    const active = saved.activeId ? nextAccounts.find((a) => a.id === saved.activeId) : null;
    setAccounts(nextAccounts);
    setActiveId(active ? active.id : null);
    setChar(active?.char || saved.char || {
      name: "", handle: "", age: "", tone: "calm",
      persona: "", world: "", speech: "", catchphrase: "",
      avatarImg: "", headerImg: "",
      surface: "", inner: "", situational: "", triggers: "", interests: "",
      relations: "", corrections: [], directions: "", lorebook: [],
    });
    setGallery(active?.gallery || saved.gallery || []);
    setPosts(active?.posts || saved.posts || []);
    setFollowing(active?.following || saved.following || []);
    setPersonas(Array.isArray(saved.personas) ? saved.personas : []);
    setDmThreads(saved.dmThreads || {});
    setDmThreadTitles(saved.dmThreadTitles || {});
    setDmWorldPrefs(saved.dmWorldPrefs || {});
    setOwnerPersona(saved.ownerPersona || "");
    setAffinity(saved.affinity || {});
    setDiscoverQuery("");
    setSharedFocusId("");
    setPeer(null);
    setStep("home");
    feedInitRef.current = Boolean(active?.posts?.length || saved.posts?.length);
  }

  function resetRuntimeState(name = "") {
    applyAppState(blankAppState(name));
    setProfileName(name);
    setPeer(null);
    setDmInput("");
    setCommentOn(null);
    setCommentText("");
    setNewChatMode(null);
    setEditingDmTitle(null);
    setDmThreadTitles({});
    setShareStatus("");
    setSharedFocusId("");
    setActiveSharedId("");
    setFollowerCounts({});
  }

  function navStateForHistory() {
    return {
      __aliveNav: true,
      step: RENDERABLE_STEPS.has(step) ? step : "home",
      pendingDm,
      dmWorldDraft,
      followPanel,
      publicProfile,
      newChatMode,
      dmSettingsOpen,
    };
  }

  function navKey(state = navStateForHistory()) {
    return JSON.stringify({
      step: state.step,
      pending: Boolean(state.pendingDm),
      pendingMode: state.pendingDm?.mode || "",
      followPanel: state.followPanel || "",
      publicProfile: state.publicProfile?.id || state.publicProfile?.sharedId || state.publicProfile?.name || "",
      newChatMode: state.newChatMode || "",
      dmSettingsOpen: Boolean(state.dmSettingsOpen),
    });
  }

  function navUrlForState(state = navStateForHistory()) {
    const url = new URL(window.location.href);
    url.pathname = pathForStep(state.step);
    url.search = "";
    url.hash = "";
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function clearLocalAuthStorage() {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase") || key === LOCAL_STATE_KEY) {
          localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn("로그인 저장값 초기화 실패:", e);
    }
  }

  async function submitAuth() {
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password || !supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { data, error } = authMode === "signup"
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: email.split("@")[0] },
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    if (authMode === "signup" && !data.session) {
      setAuthMessage("가입 확인 메일을 보냈어. Supabase 설정에서 이메일 확인이 켜져 있으면 메일 확인 후 로그인돼.");
      return;
    }
    setAuthMessage(authMode === "signup" ? "가입 완료. 온보딩으로 넘어갈게." : "로그인 완료.");
  }

  async function sendMagicLoginLink() {
    const email = authEmail.trim();
    if (!email || !supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
        data: { display_name: email.split("@")[0] },
      },
    });
    setAuthLoading(false);
    setAuthMessage(error ? error.message : "이메일로 간편 로그인 링크를 보냈어. 메일에서 링크를 누르면 바로 들어올 수 있어.");
  }

  async function sendPasswordReset() {
    const email = authEmail.trim();
    if (!email || !supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setAuthLoading(false);
    setAuthMessage(error ? error.message : "비밀번호 재설정 링크를 보냈어. 메일에서 링크를 누르고 새 비밀번호를 정하면 돼.");
  }

  async function signInWithProvider(provider) {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setAuthLoading(false);
      setAuthMessage(error.message);
    }
  }

  async function updateRecoveredPassword() {
    if (!supabase || newPassword.length < 6) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAuthLoading(false);
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    setNewPassword("");
    setPasswordRecoveryOpen(false);
    setAuthMessage("비밀번호를 바꿨어. 이제 그대로 이용하면 돼.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearLocalAuthStorage();
    setSession(null);
    setStateReady(false);
    resetRuntimeState("");
    setStep("home");
    setSaveStatus("로그인 대기");
  }

  async function completeOnboarding() {
    if (!session?.user || !supabase) {
      setOnboardingOpen(false);
      return;
    }
    const name = profileName.trim() || session.user.email?.split("@")[0] || "사용자";
    setProfileName(name);
    const { error } = await supabase.from("alive_profiles").upsert({
      id: session.user.id,
      email: session.user.email,
      display_name: name,
      onboarded: true,
    });
    if (error) {
      setSaveStatus(`온보딩 저장 실패: ${error.message}`);
      return;
    }
    setOnboardingOpen(false);
    setSaveStatus("저장됨");
  }

  function sharedRowToChar(row) {
    const base = row.character || {};
    return {
      ...base,
      id: `shared_${row.id}`,
      sharedId: row.id,
      ownerId: row.owner_id,
      sourceAccountId: row.source_account_id,
      owner: `@${row.owner_name || "user"}`,
      ownerName: row.owner_name || "user",
      external: true,
      shared: true,
      name: row.name || base.name || "이름 없음",
      handle: row.handle || base.handle || "",
      persona: row.persona || base.persona || "",
      tags: row.tags || base.tags || [],
      posts: Array.isArray(base.posts) ? base.posts : [],
    };
  }

  function postTimeMs(post) {
    const raw = post?.time || post?.createdAt || post?.created_at || post?.id;
    const ms = raw instanceof Date ? raw.getTime() : (typeof raw === "number" ? raw : Date.parse(raw));
    return Number.isFinite(ms) ? ms : 0;
  }

  function publicPostSnapshot(sourcePosts = posts) {
    return (sourcePosts || [])
      .filter((post) => !post.author && post.text)
      .sort((a, b) => postTimeMs(b) - postTimeMs(a))
      .slice(0, 30)
      .map((post) => ({
        id: post.id,
        text: post.text,
        mood: post.mood || "게시글",
        time: post.time || new Date().toISOString(),
        likes: post.likes || 0,
        img: post.img || null,
        photoDesc: post.photoDesc || null,
        moodDesc: post.moodDesc || null,
        comments: Array.isArray(post.comments) ? post.comments.slice(0, 20) : [],
      }));
  }

  function followedPostId(sourceId, postId, index) {
    return `followed:${sourceId || "local"}:${postId || index}`;
  }

  function postsFromFollowedCharacter(poolChar) {
    const sourceId = poolChar.sharedId || poolChar.id || poolChar.name;
    return (poolChar.posts || [])
      .filter((post) => post?.text)
      .map((post, index) => ({
        ...post,
        id: followedPostId(sourceId, post.id, index),
        originalPostId: post.id,
        importedFromFollow: true,
        author: poolChar.name,
        authorHandle: poolChar.handle || poolChar.name,
        authorAvatarImg: poolChar.avatarImg || "",
        authorSharedId: poolChar.sharedId || "",
        mood: post.mood || "팔로잉",
        time: post.time || new Date().toISOString(),
        likes: post.likes || Math.floor(Math.random() * 20) + 1,
        liked: false,
        comments: Array.isArray(post.comments) ? post.comments : [],
      }));
  }

  function mergeTimelinePosts(current, incoming) {
    const incomingById = new Map(incoming.map((post) => [String(post.id), post]));
    const refreshedCurrent = current.map((post) => {
      const fresh = incomingById.get(String(post.id));
      return fresh ? { ...post, authorAvatarImg: fresh.authorAvatarImg || "", authorHandle: fresh.authorHandle || post.authorHandle, author: fresh.author || post.author } : post;
    });
    const seen = new Set(refreshedCurrent.map((post) => String(post.id)));
    return [...refreshedCurrent, ...incoming.filter((post) => {
      const id = String(post.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })].sort((a, b) => postTimeMs(b) - postTimeMs(a));
  }

  function shuffled(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function worldTextFor(c) {
    return String(c?.world || c?.character?.world || "").trim();
  }

  function worldKeyFor(c, fallback = "current") {
    return c?.sharedId || c?.id || c?.name || fallback;
  }

  function toggleWorld(c, fallback, event) {
    event?.stopPropagation();
    const text = worldTextFor(c);
    if (!text) return;
    setWorldModal({
      key: worldKeyFor(c, fallback),
      name: c?.name || "캐릭터",
      handle: c?.handle || "",
      world: text,
    });
  }

  function WorldChip({ c, fallback }) {
    const text = worldTextFor(c);
    if (!text) return null;
    return (
      <button type="button" className="al-world-chip" onClick={(e) => toggleWorld(c, fallback, e)}>
        세계관
      </button>
    );
  }

  function closeProfilePanels(except = "") {
    if (except !== "memory") {
      setShowMemory(false);
      setMemFilter(null);
      setShowMemoryAdd(false);
    }
    if (except !== "relations") setShowRelations(false);
    if (except !== "follow") setFollowPanel(null);
  }

  function toggleMemoryPanel() {
    setShowMemory((v) => {
      const next = !v;
      if (next) closeProfilePanels("memory");
      else setShowMemoryAdd(false);
      return next;
    });
  }

  function toggleRelationsPanel() {
    setShowRelations((v) => {
      const next = !v;
      if (next) closeProfilePanels("relations");
      return next;
    });
  }

  function toggleFollowPanel(kind) {
    setFollowPanel((v) => {
      const next = v === kind ? null : kind;
      if (next) {
        closeProfilePanels("follow");
        if (next === "followers" && activeSharedId) loadSharedFollowers(activeSharedId);
      }
      return next;
    });
  }

  function handleProfileImage(kind, event) {
    const file = Array.from(event.target.files || [])[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => update(kind === "avatar" ? "avatarImg" : "headerImg", ev.target.result);
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function loadFollowerCountsFor(rows) {
    if (!supabase || !rows?.length) return;
    const ids = rows.map((row) => row.id).filter(Boolean);
    if (!ids.length) return;
    const { data, error } = await supabase
      .from("alive_character_follows")
      .select("target_shared_character_id")
      .in("target_shared_character_id", ids);
    if (error) {
      console.warn("팔로워 수 불러오기 실패:", error);
      return;
    }
    const counts = Object.fromEntries(ids.map((id) => [id, 0]));
    (data || []).forEach((r) => {
      counts[r.target_shared_character_id] = (counts[r.target_shared_character_id] || 0) + 1;
    });
    setFollowerCounts((prev) => ({ ...prev, ...counts }));
  }

  async function loadSharedFollowers(sharedId = activeSharedId) {
    if (!supabase || !sharedId) {
      setSharedFollowers({ loading: false, rows: [], error: "" });
      return;
    }
    setSharedFollowers({ loading: true, rows: [], error: "" });
    const { data, error } = await supabase
      .from("alive_character_follows")
      .select("id,follower_id,follower_name,follower_account_id,follower_character,created_at")
      .eq("target_shared_character_id", sharedId)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("팔로워 목록 불러오기 실패:", error);
      setSharedFollowers({ loading: false, rows: [], error: error.message || "팔로워를 불러오지 못했어." });
      return;
    }
    const rows = (data || []).map((row) => {
      const c = row.follower_character || {};
      const shared = sharedCharacters.find((item) =>
        item.ownerId === row.follower_id && item.sourceAccountId === row.follower_account_id
      );
      return {
        ...(shared || {}),
        ...c,
        id: shared?.id || `follower_${row.id}`,
        shared: Boolean(shared),
        sharedId: shared?.sharedId || "",
        ownerId: row.follower_id,
        sourceAccountId: row.follower_account_id,
        name: c.name || row.follower_name || "이름 없음",
        handle: c.handle || "",
        owner: shared?.owner || `@${row.follower_name || "user"}`,
        ownerName: shared?.ownerName || row.follower_name || "user",
        followerAccountId: row.follower_account_id,
        followedAt: row.created_at,
      };
    });
    setSharedFollowers({ loading: false, rows, error: "" });
    loadFollowerCountsFor(rows.filter((row) => row.sharedId).map((row) => ({ id: row.sharedId })));
  }

  async function loadSharedCharacters() {
    if (!supabase) return;
    setSharedLoadState({ loading: true, error: "" });
    const { data, error } = await supabase
      .from("alive_shared_characters")
      .select("id,owner_id,owner_name,source_account_id,name,handle,persona,tags,character,created_at")
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) {
      console.warn("공유 캐릭터 불러오기 실패:", error);
      setSharedLoadState({ loading: false, error: error.message || "공유 캐릭터를 불러오지 못했어." });
      return;
    }
    const rows = data || [];
    setSharedCharacters(rows.map(sharedRowToChar));
    setSharedLoadState({ loading: false, error: "" });
    loadFollowerCountsFor(rows);
  }

  async function loadSharedCharacterById(sharedId) {
    if (!supabase || !sharedId) return null;
    setSharedLoadState({ loading: true, error: "" });
    const { data, error } = await supabase
      .from("alive_shared_characters")
      .select("id,owner_id,owner_name,source_account_id,name,handle,persona,tags,character,created_at")
      .eq("id", sharedId)
      .maybeSingle();
    if (error) {
      console.warn("공유 링크 캐릭터 불러오기 실패:", error);
      setSharedLoadState({ loading: false, error: error.message || "공유 캐릭터를 불러오지 못했어." });
      return null;
    }
    if (!data) {
      setSharedLoadState({ loading: false, error: "이 공유 링크의 캐릭터를 찾지 못했어." });
      return null;
    }
    const next = sharedRowToChar(data);
    setSharedCharacters((prev) => {
      const rest = (prev || []).filter((item) => item.sharedId !== next.sharedId);
      return [next, ...rest];
    });
    setSharedLoadState({ loading: false, error: "" });
    loadFollowerCountsFor([data]);
    return next;
  }

  async function shareCurrentCharacter() {
    if (!activeId || !char.name.trim()) return;
    if (!supabase || !session?.user) {
      flashShareStatus("로그인 후 공유할 수 있어.");
      return;
    }
    const payload = {
      owner_id: session.user.id,
      owner_name: profileName || session.user.email?.split("@")[0] || "user",
      source_account_id: activeId,
      name: char.name,
      handle: char.handle || "",
      persona: char.persona || "",
      tags: [char.age, char.surface, char.interests].filter(Boolean).slice(0, 6),
      character: { ...char, following, posts: publicPostSnapshot() },
    };
    const { data, error } = await supabase
      .from("alive_shared_characters")
      .upsert(payload, { onConflict: "owner_id,source_account_id" })
      .select("id")
      .single();
    if (error) {
      flashShareStatus(`공유 실패: ${error.message}`, 3600);
      return;
    }
    const url = `${window.location.origin}/?shared=${data.id}`;
    setActiveSharedId(data.id);
    try {
      await navigator.clipboard.writeText(url);
      flashShareStatus("공유 링크를 복사했어.");
    } catch (e) {
      flashShareStatus(url, 4200);
    }
    loadSharedCharacters();
  }

  async function syncActiveSharedCharacter(nextFollowing = following, nextChar = char) {
    if (!supabase || !session?.user || !activeId || !activeSharedId || !nextChar.name?.trim()) return;
    const { error } = await supabase
      .from("alive_shared_characters")
      .update({
        name: nextChar.name,
        handle: nextChar.handle || "",
        persona: nextChar.persona || "",
        tags: [nextChar.age, nextChar.surface, nextChar.interests].filter(Boolean).slice(0, 6),
        character: { ...nextChar, following: nextFollowing, posts: publicPostSnapshot() },
      })
      .eq("owner_id", session.user.id)
      .eq("source_account_id", activeId);
    if (error) console.warn("공유 캐릭터 스냅샷 갱신 실패:", error);
  }

  async function syncOwnFollowRows(nextFollowing = following, nextChar = char) {
    if (!supabase || !session?.user || !activeId || !nextChar.name?.trim()) return;
    const rows = (nextFollowing || [])
      .filter((f) => f?.sharedId)
      .map((f) => ({
        follower_id: session.user.id,
        follower_name: profileName || session.user.email?.split("@")[0] || "user",
        follower_account_id: activeId,
        follower_character: { ...nextChar, following: nextFollowing, posts: publicPostSnapshot() },
        target_shared_character_id: f.sharedId,
      }));
    if (!rows.length) return;
    const { error } = await supabase
      .from("alive_character_follows")
      .upsert(rows, { onConflict: "follower_id,follower_account_id,target_shared_character_id" });
    if (error) console.warn("팔로우 캐릭터 스냅샷 갱신 실패:", error);
  }

  async function recordFollowChange(poolChar, wasFollowing) {
    if (!supabase || !session?.user || !activeId || !poolChar?.sharedId) return;
    let ok = false;
    if (wasFollowing) {
      const { error } = await supabase
        .from("alive_character_follows")
        .delete()
        .eq("follower_id", session.user.id)
        .eq("follower_account_id", activeId)
        .eq("target_shared_character_id", poolChar.sharedId);
      if (error) console.warn("언팔로우 저장 실패:", error);
      ok = !error;
    } else {
      const payload = {
        follower_id: session.user.id,
        follower_name: profileName || session.user.email?.split("@")[0] || "user",
        follower_account_id: activeId,
        follower_character: { ...char },
        target_shared_character_id: poolChar.sharedId,
      };
      const { error } = await supabase
        .from("alive_character_follows")
        .upsert(payload, { onConflict: "follower_id,follower_account_id,target_shared_character_id" });
      if (error) console.warn("팔로우 저장 실패:", error);
      ok = !error;
    }
    if (ok) setFollowerCounts((prev) => {
      const id = poolChar.sharedId;
      if (!id) return prev;
      const current = prev[id] || 0;
      return { ...prev, [id]: Math.max(0, current + (wasFollowing ? -1 : 1)) };
    });
    loadFollowerCountsFor([{ id: poolChar.sharedId }]);
    return ok;
  }

  async function recordRelationshipFollowBack(poolChar) {
    if (!supabase || !session?.user || !activeSharedId || !poolChar?.sharedId) return false;
    const { mutual } = verifyMutualLove(char, poolChar);
    if (!mutual) return false;
    const { error } = await supabase.rpc("alive_relationship_follow_back", {
      p_follower_shared_character_id: poolChar.sharedId,
      p_target_shared_character_id: activeSharedId,
    });
    if (error) {
      console.warn("연인 맞팔 저장 실패:", error);
      return false;
    }
    loadFollowerCountsFor([{ id: activeSharedId }, { id: poolChar.sharedId }]);
    return true;
  }

  async function deleteStructuredCharacterAccount(targetId) {
    if (!supabase || !session?.user || !targetId) return;
    const ownerId = session.user.id;
    const jobs = [
      supabase.from("alive_characters")
        .delete()
        .eq("owner_id", ownerId)
        .eq("source_account_id", targetId),
      supabase.from("alive_shared_characters")
        .delete()
        .eq("owner_id", ownerId)
        .eq("source_account_id", targetId),
      supabase.from("alive_character_follows")
        .delete()
        .eq("follower_id", ownerId)
        .eq("follower_account_id", targetId),
      supabase.from("alive_dm_threads")
        .delete()
        .eq("owner_id", ownerId)
        .like("thread_key", `owner::${targetId}::%`),
    ];
    const results = await Promise.allSettled(jobs);
    let ok = true;
    results.forEach((result) => {
      const error = result.status === "rejected" ? result.reason : result.value?.error;
      if (error) {
        ok = false;
        console.warn("캐릭터 삭제 구조화 데이터 정리 실패:", error.message || error);
      }
    });
    return ok;
  }

  async function syncStructuredState(snapshot) {
    if (!supabase || !session?.user || !snapshot) return;
    const ownerId = session.user.id;
    const compactGallery = (items) => Array.isArray(items) ? items.slice(-12) : [];
    const compactPosts = (items) => Array.isArray(items) ? items.slice(0, 40).map((post) => ({
      ...post,
      comments: Array.isArray(post.comments) ? post.comments.slice(-20) : [],
    })) : [];
    const compactFollowing = (items) => Array.isArray(items) ? items.slice(0, 120).map((f) => ({
      id: f.id,
      sharedId: f.sharedId,
      ownerId: f.ownerId,
      sourceAccountId: f.sourceAccountId,
      name: f.name,
      handle: f.handle,
      owner: f.owner,
      ownerName: f.ownerName,
      persona: f.persona,
      world: f.world,
      speech: f.speech,
      surface: f.surface,
      inner: f.inner,
      relations: f.relations,
      avatarImg: f.avatarImg,
      headerImg: f.headerImg,
      tags: f.tags || [],
      external: f.external,
      shared: f.shared,
    })) : [];
    const compactCharacter = (account) => {
      const { posts: _posts, following: _following, gallery: _gallery, ...baseChar } = account.char || {};
      return baseChar;
    };
    const participantIdsForThread = (threadKey) => {
      if (!threadKey?.startsWith("dm::")) return [ownerId];
      const names = roomKeyFromDmThreadKey(threadKey).split("|").map((name) => name.trim()).filter(Boolean);
      const ids = new Set([ownerId]);
      names.forEach((name) => {
        const followed = (snapshot.accounts || []).flatMap((a) => a.following || []).find((f) => f.name === name);
        if (followed?.ownerId) ids.add(followed.ownerId);
        const shared = sharedCharacters.find((c) => c.name === name || c.sharedId === followed?.sharedId);
        if (shared?.ownerId) ids.add(shared.ownerId);
      });
      return [...ids];
    };
    const accountsForSync = (snapshot.accounts || []).filter((account) => {
      if (!snapshot.activeId) return true;
      return account.id === snapshot.activeId;
    });
    const characterRows = accountsForSync.map((account) => ({
      owner_id: ownerId,
      source_account_id: account.id,
      name: account.char?.name || "",
      handle: account.char?.handle || "",
      character: compactCharacter(account),
      gallery: compactGallery(account.gallery || []),
      posts: compactPosts(account.posts || []),
      following: compactFollowing(account.following || []),
    })).filter((row) => row.source_account_id && row.name);

    const personaRows = (snapshot.personas || []).map((persona) => ({
      owner_id: ownerId,
      persona_id: String(persona.id),
      name: persona.name || "",
      persona,
    })).filter((row) => row.persona_id && row.name);

    const ownerDmRows = [];
    const sharedDmRows = [];
    const compactMessages = (messages) => Array.isArray(messages) ? messages.slice(-160) : [];
    Object.entries(snapshot.dmThreads || {}).forEach(([threadKey, messages]) => {
      if (!threadKey) return;
      const row = {
        thread_key: threadKey,
        messages: compactMessages(messages),
        world_pref: snapshot.dmWorldPrefs?.[threadKey] || {},
      };
      const participantIds = participantIdsForThread(threadKey);
      if (threadKey.startsWith("dm::") && participantIds.length > 1) {
        sharedDmRows.push({
          ...row,
          participant_user_ids: participantIds,
          participant_labels: roomKeyFromDmThreadKey(threadKey).split("|"),
          created_by: ownerId,
        });
      } else {
        ownerDmRows.push({ ...row, owner_id: ownerId });
      }
    });

    const jobs = [];
    if (characterRows.length) {
      jobs.push(supabase.from("alive_characters")
        .upsert(characterRows, { onConflict: "owner_id,source_account_id" }));
    }
    if (personaRows.length) {
      jobs.push(supabase.from("alive_personas")
        .upsert(personaRows, { onConflict: "owner_id,persona_id" }));
    }
    if (ownerDmRows.length) {
      jobs.push(supabase.from("alive_dm_threads")
        .upsert(ownerDmRows, { onConflict: "owner_id,thread_key" }));
    }
    if (sharedDmRows.length) {
      jobs.push(supabase.from("alive_shared_dm_threads")
        .upsert(sharedDmRows, { onConflict: "thread_key" }));
    }

    if (!jobs.length) return;
    const results = await Promise.allSettled(jobs.map((job, index) =>
      withRejectTimeout(job, 7000, `분리 테이블 동기화 ${index + 1}`)
    ));
    const failed = results.find((result) => result.status === "fulfilled" && result.value?.error);
    if (failed?.value?.error) {
      console.warn("분리 테이블 동기화 실패:", failed.value.error.message);
    }
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) {
      console.warn("분리 테이블 동기화 실패:", rejected.reason?.message || rejected.reason);
    }
  }

  async function loadStructuredStateFallback(baseState, ownerId) {
    if (!supabase || !ownerId) return baseState;
    try {
      const timedQuery = (query, label, ms = 9000) => withRejectTimeout(query, ms, label);
      const [charsResult, personasResult, dmResult, sharedDmResult] = await Promise.allSettled([
        timedQuery(supabase.from("alive_characters")
          .select("source_account_id,name,handle,character,gallery,posts,following,updated_at")
          .eq("owner_id", ownerId)
          .order("updated_at", { ascending: false })
          .limit(80), "캐릭터 데이터 로드"),
        timedQuery(supabase.from("alive_personas")
          .select("persona_id,name,persona,updated_at")
          .eq("owner_id", ownerId)
          .order("updated_at", { ascending: false })
          .limit(80), "페르소나 데이터 로드", 6000),
        timedQuery(supabase.from("alive_dm_threads")
          .select("thread_key,messages,world_pref,updated_at")
          .eq("owner_id", ownerId)
          .order("updated_at", { ascending: false })
          .limit(80), "개인 DM 데이터 로드", 6000),
        timedQuery(supabase.from("alive_shared_dm_threads")
          .select("thread_key,messages,world_pref,updated_at")
          .contains("participant_user_ids", [ownerId])
          .order("updated_at", { ascending: false })
          .limit(80), "공유 DM 데이터 로드", 6000),
      ]);

      const next = { ...baseState };
      if (charsResult.status === "rejected") throw charsResult.reason;
      if (charsResult.value.error) throw charsResult.value.error;
      const chars = charsResult.status === "fulfilled" && !charsResult.value.error ? (charsResult.value.data || []) : [];
      const personaRows = personasResult.status === "fulfilled" && !personasResult.value.error ? (personasResult.value.data || []) : [];
      const dmRows = dmResult.status === "fulfilled" && !dmResult.value.error ? (dmResult.value.data || []) : [];
      const sharedDmRows = sharedDmResult.status === "fulfilled" && !sharedDmResult.value.error ? (sharedDmResult.value.data || []) : [];

      if (chars.length) {
        next.accounts = chars.map((row) => ({
          id: row.source_account_id,
          char: { ...(row.character || {}), name: row.character?.name || row.name || "", handle: row.character?.handle || row.handle || "" },
          gallery: Array.isArray(row.gallery) ? row.gallery : [],
          posts: Array.isArray(row.posts) ? row.posts : [],
          following: Array.isArray(row.following) ? row.following : [],
        }));
        const activeStillExists = next.activeId && next.accounts.some((a) => a.id === next.activeId);
        if (!activeStillExists) next.activeId = next.accounts[0]?.id || null;
      }

      if (personaRows.length) {
        next.personas = personaRows.map((row) => ({ ...(row.persona || {}), id: row.persona?.id || row.persona_id, name: row.persona?.name || row.name || "" }));
      }

      if (dmResult.status === "fulfilled" || sharedDmResult.status === "fulfilled") {
        const dmLoaded = dmResult.status === "fulfilled" && !dmResult.value.error;
        const sharedLoaded = sharedDmResult.status === "fulfilled" && !sharedDmResult.value.error;
        const shouldReplaceKey = (key) =>
          (sharedLoaded && key.startsWith("dm::")) ||
          (dmLoaded && (key.startsWith("owner::") || key.startsWith("local::")));
        const keepLocal = Object.fromEntries(Object.entries(next.dmThreads || {}).filter(([key]) => !shouldReplaceKey(key)));
        next.dmThreads = keepLocal;
        next.dmWorldPrefs = Object.fromEntries(Object.entries(next.dmWorldPrefs || {}).filter(([key]) => !shouldReplaceKey(key)));
        [...dmRows, ...sharedDmRows].forEach((row) => {
          next.dmThreads[row.thread_key] = Array.isArray(row.messages) ? row.messages : [];
          if (row.world_pref && Object.keys(row.world_pref).length) next.dmWorldPrefs[row.thread_key] = row.world_pref;
        });
      }

      return next;
    } catch (e) {
      console.warn("분리 테이블 로드 실패:", e);
      throw e;
    }
  }

  function withTimeout(promise, ms, fallbackValue, label = "작업") {
    let timer;
    return Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          console.warn(`${label} 시간 초과`);
          resolve(fallbackValue);
        }, ms);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  function withRejectTimeout(promise, ms, label = "작업") {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 시간 초과`)), ms);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  async function readApiJson(res, label) {
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(`${label} 응답이 비어 있습니다. HTTP ${res.status}. 로컬 개발 서버에서 /api/generate 연결이 끊겼을 수 있습니다.`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`${label}가 JSON이 아닌 응답을 보냈습니다. HTTP ${res.status}. 응답 앞부분: ${text.slice(0, 120)}`);
    }
  }

  function apiErrorText(data) {
    if (data?.error === "DAILY_LIMIT_EXCEEDED" || data?.error === "MONTHLY_COST_LIMIT_EXCEEDED") return API_LIMIT_MESSAGE;
    if (data?.error === "EMPTY_RESPONSE") return "AI 응답이 잠깐 비었어. 같은 말을 다시 보내줘.";
    return data?.message
      || data?.detail?.error?.message
      || (data?.finishReason ? `${data.error || "API_ERROR"}: ${data.finishReason}` : "")
      || (data?.error ? `${data.error}${data.status ? ` (${data.status})` : ""}` : "")
      || JSON.stringify(data || {});
  }

  function apiContentText(data) {
    return (data?.content || []).map((i) => (i.type === "text" ? i.text : "")).join("").trim();
  }

  function cleanApiFailureMessage(error, fallback = "응답이 잠깐 끊겼어. 다시 시도해줘.") {
    const message = error?.name === "AbortError" ? "응답 시간이 길어져서 중단됐어. 다시 시도해줘." : String(error?.message || "");
    if (!message) return fallback;
    if (/Gemini|finishReason|EMPTY_RESPONSE|API_ERROR|SERVER_CRASH|응답에 텍스트|빈 응답/i.test(message)) return fallback;
    return message;
  }

  async function readApiContent(res, label) {
    const data = await readApiJson(res, label);
    if (!res.ok || data.error) {
      throw new Error(apiErrorText(data));
    }
    const text = apiContentText(data);
    if (!text) throw new Error(`${label} 응답에 텍스트가 없습니다.`);
    return text;
  }

  const canUseApp = !hasSupabaseConfig || (session && stateReady);
  const authBusy = hasSupabaseConfig && (authLoading || profileLoading || (session && !stateReady));
  const appScreenVisible = canUseApp && (
    ["home", "dump", "confirm", "feed", "discover", "dmlist"].includes(step)
    || (step === "dm" && peer)
  );
  const hasMainScreen = authBusy || (hasSupabaseConfig && !authLoading && !session) || appScreenVisible;
  const showRecoveryScreen = !hasMainScreen;

  async function recoverAuthScreen() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearLocalAuthStorage();
    setSession(null);
    resetRuntimeState("");
    setAuthLoading(false);
    setProfileLoading(false);
    setStateReady(false);
    setAuthMessage("로그인 상태를 초기화했어. 다시 로그인해줘.");
  }

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      try {
        const raw = localStorage.getItem(LOCAL_STATE_KEY);
        if (raw) applyAppState(JSON.parse(raw));
      } catch (e) {
        console.warn("로컬 저장 복원 실패:", e);
      }
      profileLoadedRef.current = true;
      setStateReady(true);
      setProfileLoading(false);
      setSaveStatus("로컬 저장");
      return;
    }

    let alive = true;
    const url = new URL(window.location.href);
    const wantsAuthReset = url.searchParams.get("resetAuth") === "1" || url.searchParams.get("clearAuth") === "1";
    if (wantsAuthReset) {
      clearLocalAuthStorage();
      supabase.auth.signOut().catch(() => {});
      window.history.replaceState({}, "", window.location.pathname);
      setSession(null);
      resetRuntimeState("");
      setAuthLoading(false);
      setProfileLoading(false);
      setStateReady(false);
      setAuthMessage("꼬인 로그인 저장값을 지웠어. 다시 로그인해줘.");
      return;
    }
    const oauthCode = url.searchParams.get("code");
    const hasOAuthHash = window.location.hash.includes("access_token") || window.location.hash.includes("error");
    const hasOAuthCallback = Boolean(oauthCode || hasOAuthHash);
    const oauthError = url.searchParams.get("error_description")
      || url.searchParams.get("error")
      || new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description")
      || new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error");
    if (oauthError) {
      setAuthMessage(`소셜 로그인 실패: ${decodeURIComponent(oauthError)}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (hasOAuthCallback) {
      setAuthLoading(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session || null);
      if (!hasOAuthCallback || data.session) setAuthLoading(false);
    }).catch((error) => {
      if (!alive) return;
      setAuthMessage(error.message || "로그인 상태 확인에 실패했어.");
      setAuthLoading(false);
      setProfileLoading(false);
    });
    const initFallback = setTimeout(() => {
      if (!alive) return;
      setAuthLoading(false);
      setProfileLoading(false);
      if (!session) setAuthMessage("저장된 로그인 상태 확인이 오래 걸려. 안 뜨면 로그인 상태 초기화를 눌러줘.");
    }, 7000);
    const oauthFallback = hasOAuthCallback ? setTimeout(() => {
      if (!alive) return;
      setAuthLoading(false);
      setProfileLoading(false);
      setAuthMessage("소셜 로그인 처리가 끝나지 않았어. 다시 시도해줘.");
      window.history.replaceState({}, "", window.location.pathname);
    }, 9000) : null;
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecoveryOpen(true);
      if (nextSession && hasOAuthCallback) window.history.replaceState({}, "", window.location.pathname);
      setSession((prevSession) => {
        const sameUser = prevSession?.user?.id && nextSession?.user?.id === prevSession.user.id;
        if (!nextSession) {
          profileLoadedRef.current = false;
          setStateReady(false);
          setProfileLoading(false);
        } else if (sameUser && profileLoadedRef.current) {
          setStateReady(true);
          setProfileLoading(false);
        } else {
          profileLoadedRef.current = false;
          setStateReady(false);
          setProfileLoading(true);
        }
        return nextSession;
      });
      setAuthLoading(false);
    });
    return () => {
      alive = false;
      clearTimeout(initFallback);
      if (oauthFallback) clearTimeout(oauthFallback);
      sub.subscription.unsubscribe();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;
    if (!session?.user) {
      profileLoadedRef.current = false;
      setStateReady(false);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    async function loadProfile() {
      profileLoadedRef.current = false;
      setStateReady(false);
      setProfileLoading(true);
      setSaveStatus("불러오는 중");
      setAuthMessage("");
      try {
        const { data, error } = await withRejectTimeout(supabase
          .from("alive_profiles")
          .select("display_name,onboarded")
          .eq("id", session.user.id)
          .maybeSingle(), 5000, "프로필 메타 로드");

        if (cancelled) return;
        if (error) throw error;

        const metadataName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.user_metadata?.preferred_username || "";
        const defaultName = data?.display_name || session.user.email?.split("@")[0] || metadataName || "사용자";
        const mergedState = await loadStructuredStateFallback(blankAppState(defaultName), session.user.id);
        if (cancelled) return;
        applyAppState(mergedState);
        setProfileName(defaultName);
        setOnboardingOpen(!data?.onboarded);
        profileLoadedRef.current = true;
        setStateReady(true);
        setProfileLoading(false);
        setSaveStatus(data ? "저장됨" : "새 프로필");

        if (!data) {
          const { error: insertError } = await supabase.from("alive_profiles").upsert({
            id: session.user.id,
            email: session.user.email || "",
            display_name: defaultName,
            onboarded: false,
          });
          if (insertError) setSaveStatus(`프로필 생성 실패: ${insertError.message}`);
        }
      } catch (error) {
        if (cancelled) return;
        profileTableBrokenRef.current = true;
        const fallbackName = session.user.email?.split("@")[0] || session.user.user_metadata?.name || "사용자";
        try {
          const mergedState = await loadStructuredStateFallback(blankAppState(fallbackName), session.user.id);
          if (cancelled) return;
          applyAppState(mergedState);
          setProfileName(fallbackName);
          setOnboardingOpen(false);
          profileLoadedRef.current = true;
          setProfileLoading(false);
          setStateReady(true);
          setSaveStatus("분리 저장 모드");
          setAuthMessage("프로필 메타 저장소가 잠깐 불안정해서 캐릭터 데이터만 먼저 불러왔어.");
        } catch (fallbackError) {
          if (cancelled) return;
          console.warn("캐릭터 데이터 로드 실패:", fallbackError);
          profileLoadedRef.current = false;
          setProfileLoading(true);
          setStateReady(false);
          setSaveStatus("캐릭터 불러오는 중");
          setAuthMessage("캐릭터를 불러오지 못했어요. 네트워크나 DB가 느린 상태라 잠시 뒤 다시 시도해줘.");
        }
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [session?.user?.id, profileLoadRetry]); // eslint-disable-line

  useEffect(() => {
    if (!profileLoadedRef.current || !stateReady) return;
    const snapshot = exportAppState();

    if (!hasSupabaseConfig || !supabase || !session?.user) {
      try {
        persistLocalSnapshot(snapshot);
        setSaveStatus("로컬 저장");
      } catch (e) {
        setSaveStatus("로컬 저장 실패");
      }
      return;
    }

    setSaveStatus("저장 중");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (profileTableBrokenRef.current) {
        await syncStructuredState(snapshot);
        setSaveStatus("분리 저장됨");
        return;
      }
      const { error } = await supabase.from("alive_profiles").upsert({
        id: session.user.id,
        email: session.user.email,
        display_name: profileName.trim() || session.user.email?.split("@")[0] || "",
        onboarded: !onboardingOpen,
      });
      if (error) {
        profileTableBrokenRef.current = true;
        setSaveStatus(`저장 실패: ${error.message}`);
        await syncStructuredState(snapshot);
        return;
      }
      syncStructuredState(snapshot).catch((e) => console.warn("분리 테이블 동기화 실패:", e));
      setSaveStatus("저장됨");
    }, 700);
    return () => clearTimeout(saveTimerRef.current);
  }, [accounts, activeId, char, gallery, posts, personas, dmThreads, dmThreadTitles, dmWorldPrefs, ownerPersona, following, affinity, profileName, onboardingOpen, stateReady, session?.user?.id]); // eslint-disable-line

  useEffect(() => {
    if (!stateReady) return;
    function saveBeforeLeave() {
      const snapshot = exportAppState();
      if (!hasSupabaseConfig) {
        persistLocalSnapshot(snapshot);
      }
    }
    window.addEventListener("pagehide", saveBeforeLeave);
    window.addEventListener("beforeunload", saveBeforeLeave);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeave);
      window.removeEventListener("beforeunload", saveBeforeLeave);
    };
  }, [accounts, activeId, char, gallery, posts, personas, dmThreads, dmThreadTitles, dmWorldPrefs, ownerPersona, following, affinity, discoverQuery, profileName, onboardingOpen, stateReady]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp) return;
    const needsActiveCharacter = ["feed", "discover", "dmlist", "dm"].includes(step);
    if (!RENDERABLE_STEPS.has(step) || (step === "dm" && !peer) || (needsActiveCharacter && !activeId)) {
      setPeer(null);
      setStep("home");
    }
  }, [canUseApp, step, activeId, peer]); // eslint-disable-line

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase || !authBusy) return;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setAuthMessage(error.message || "로그인 상태 확인에 실패했어.");
        setAuthLoading(false);
        setProfileLoading(false);
        return;
      }
      if (!data.session) {
        setSession(null);
        setAuthLoading(false);
        setProfileLoading(false);
        setStateReady(false);
        return;
      }
      setSession(data.session);
      setAuthLoading(false);
      if (profileLoadedRef.current) {
        setProfileLoading(false);
        setStateReady(true);
      } else {
        profileLoadedRef.current = false;
        setProfileLoading(true);
        setStateReady(false);
        setSaveStatus("캐릭터 불러오는 중");
        setAuthMessage((msg) => msg.includes("캐릭터를 불러오지 못했어요")
          ? msg
          : "캐릭터를 불러오고 있어요. 저장된 캐릭터를 확인하는 중이라 잠깐만 기다려줘.");
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [authBusy]); // eslint-disable-line

  useEffect(() => {
    if (canUseApp && step === "discover") loadSharedCharacters();
  }, [canUseApp, step, session?.user?.id]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp || !supabase || !session?.user || !activeId) {
      setActiveSharedId("");
      return;
    }
    let cancelled = false;
    async function loadActiveShare() {
      const { data, error } = await supabase
        .from("alive_shared_characters")
        .select("id")
        .eq("owner_id", session.user.id)
        .eq("source_account_id", activeId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("내 공유 캐릭터 확인 실패:", error);
        setActiveSharedId("");
        return;
      }
      setActiveSharedId(data?.id || "");
      if (data?.id) loadFollowerCountsFor([{ id: data.id }]);
    }
    loadActiveShare();
    return () => { cancelled = true; };
  }, [canUseApp, activeId, session?.user?.id]); // eslint-disable-line

  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("shared");
    if (canUseApp && sharedId) {
      setSharedFocusId(sharedId);
      setDiscoverQuery("");
      setStep("discover");
      loadSharedCharacterById(sharedId).then((found) => {
        if (found) setPublicProfile(found);
        loadSharedCharacters();
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [canUseApp]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp || !supabase || !session?.user || !activeSharedId || !following.length) return;
    following.forEach((f) => {
      if (!f?.sharedId) return;
      const key = `${activeSharedId}:${f.sharedId}:${char.relations || ""}:${f.relations || ""}`;
      if (followBackSyncRef.current.has(key)) return;
      if (!verifyMutualLove(char, f).mutual) return;
      followBackSyncRef.current.add(key);
      recordRelationshipFollowBack(f);
    });
  }, [canUseApp, activeSharedId, following, char.relations, session?.user?.id]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp || !stateReady) return;
    const nextChar = normalizeRelationLabelsForChar(char);
    const charChanged = nextChar !== char;
    if (charChanged) setChar(nextChar);

    setAccounts((prev) => {
      let localChanged = false;
      const next = prev.map((a) => {
        const normalized = normalizeRelationLabelsForChar(a.char);
        if (normalized !== a.char) localChanged = true;
        return normalized !== a.char ? { ...a, char: normalized } : a;
      });
      return localChanged ? next : prev;
    });

    let nextFollowingSnapshot = following;
    let followingChanged = false;
    nextFollowingSnapshot = following.map((f) => {
      const normalized = normalizeRelationLabelsForChar(f);
      if (normalized !== f) followingChanged = true;
      return normalized;
    });
    if (followingChanged) setFollowing(nextFollowingSnapshot);
    if (charChanged || followingChanged) {
      syncActiveSharedCharacter(nextFollowingSnapshot, nextChar);
      syncOwnFollowRows(nextFollowingSnapshot, nextChar);
    }
  }, [canUseApp, stateReady, affinity]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp) {
      navInitRef.current = false;
      navLastKeyRef.current = "";
      return;
    }
    const state = navStateForHistory();
    const key = navKey(state);

    if (!navInitRef.current) {
      const routeStep = stepFromPath(window.location.pathname, Boolean(activeId));
      const shouldUseRouteStep = state.step === "home" && routeStep !== "home";
      const routedState = { ...state, step: shouldUseRouteStep ? routeStep : state.step };
      if (shouldUseRouteStep) setStep(routeStep);
      window.history.replaceState(routedState, "", navUrlForState(routedState));
      navInitRef.current = true;
      navLastKeyRef.current = navKey(routedState);
      return;
    }

    if (navApplyingRef.current) {
      window.history.replaceState(state, "", navUrlForState(state));
      navLastKeyRef.current = key;
      return;
    }

    if (key !== navLastKeyRef.current) {
      window.history.pushState(state, "", navUrlForState(state));
      navLastKeyRef.current = key;
    } else {
      window.history.replaceState(state, "", navUrlForState(state));
    }
  }, [canUseApp, step, pendingDm, followPanel, publicProfile, newChatMode, dmSettingsOpen, activeId]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp || !navInitRef.current) return;
    const state = navStateForHistory();
    window.history.replaceState(state, "", navUrlForState(state));
  }, [dmWorldDraft]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp) return;
    function handlePopState(event) {
      const state = event.state;
      if (!state?.__aliveNav) {
        const fallback = navStateForHistory();
        window.history.pushState(fallback, "", navUrlForState(fallback));
        return;
      }

      navApplyingRef.current = true;
      navLastKeyRef.current = navKey(state);
      setPendingDm(state.pendingDm || null);
      setDmWorldDraft(state.dmWorldDraft || "");
      setFollowPanel(state.followPanel || null);
      setPublicProfile(state.publicProfile || null);
      setNewChatMode(state.newChatMode || null);
      setDmSettingsOpen(Boolean(state.dmSettingsOpen));
      setStep(normalizeSavedStep(state.step, Boolean(activeId)));
      window.setTimeout(() => {
        navApplyingRef.current = false;
      }, 0);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [canUseApp, activeId]); // eslint-disable-line

  function fieldText(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(fieldText).filter(Boolean).join(", ");
    if (typeof value === "object") {
      return Object.entries(value)
        .map(([key, val]) => `${key}: ${fieldText(val)}`)
        .filter((line) => line.trim())
        .join(" / ");
    }
    return String(value).trim();
  }

  function normalizeHandle(value, fallback) {
    const raw = fieldText(value || fallback)
      .replace(/^@+/, "")
      .split(/[,，\s/|]+/)
      .find(Boolean) || fieldText(fallback) || "character";
    return raw
      .toLowerCase()
      .replace(/^@+/, "")
      .replace(/[^a-z0-9._-]/g, "")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 24) || "character";
  }

  function worldBridgeBlock(a, b, pref = null) {
    const aWorld = fieldText(a?.world);
    const bWorld = fieldText(b?.world);
    if (!aWorld && !bWorld) return "";
    const note = pref?.note ? `\n- 이 DM방 한정 설정 보정: ${pref.note}` : "";
    if (pref?.mode === "their") {
      return `\n\n[세계관 진입 — 상대 세계관]\n- 현재 장면은 ${a?.name || "상대"}의 세계관 쪽으로 들어간 상태다.\n- ${a?.name || "상대"}의 세계관: ${aWorld || "명시 없음"}\n- ${b?.name || "내 쪽"}의 원래 세계관: ${bWorld || "명시 없음"}\n- ${b?.name || "내 쪽"}는 자기 정체성·말투·기억은 유지하되, 이 방에서는 ${a?.name || "상대"}의 세계관 규칙과 장소에 맞춰 반응한다.${note}`;
    }
    if (pref?.mode === "mine") {
      return `\n\n[세계관 진입 — 내 세계관]\n- 현재 장면은 ${b?.name || "내 쪽"}의 세계관 쪽으로 들어간 상태다.\n- ${b?.name || "내 쪽"}의 세계관: ${bWorld || "명시 없음"}\n- ${a?.name || "상대"}의 원래 세계관: ${aWorld || "명시 없음"}\n- ${a?.name || "상대"}는 자기 정체성·말투·기억은 유지하되, 이 방에서는 ${b?.name || "내 쪽"}의 세계관 규칙과 장소에 맞춰 반응한다.${note}`;
    }
    return `\n\n[세계관 처리 — 중요]\n- ${a?.name || "한쪽 캐릭터"}의 세계관: ${aWorld || "명시 없음"}\n- ${b?.name || "상대"}의 세계관: ${bWorld || "명시 없음"}\n- 서로 세계관이 달라도 한쪽 세계관으로 덮어쓰지 마라. 각자의 출신·상식·말투·능력·기억은 유지한다.\n- 두 캐릭터가 만나는 공간은 ALIVE의 DM/공유 타임라인 같은 중립 교차점이다. 필요하면 '서로 다른 세계에서 온 사람끼리 대화한다'는 전제로 자연스럽게 반응하라.\n- 상대를 자기 세계관의 주민으로 착각하지 마라. 원피스 캐릭터를 마법학교 학생으로 만들거나, 마법학교 캐릭터를 해적으로 바꾸지 마라.`;
  }

  // ── 화자/방 모델 ──
  // 화자(speakAs): "char"=내캐릭터 | "owner"=나(오너) | "p:<id>"=유저 페르소나
  const ownerLabel = "나";
  const activePersona = speakAs.startsWith("p:") ? personas.find((p) => `p:${p.id}` === speakAs) : null;
  const ownerSpeaking = speakAs === "owner";
  // meName = 지금 누가 보내는가 (말풍선·호감도 주체)
  const meName = peer
    ? (peer.asOwner ? ownerLabel
        : activePersona ? activePersona.name
        : ownerSpeaking ? ownerLabel
        : (char.name || "나"))
    : (char.name || "나");
  // DM은 두 주체의 공통 방이다. A가 B에게 보낸 DM은 B 계정에서 열어도 같은 키를 본다.
  // 오너↔캐릭터 방만 캐릭터별 사적 방으로 유지한다.
  function speakerNameFor(speakerValue = speakAs) {
    const p = String(speakerValue || "").startsWith("p:") ? personas.find((pp) => `p:${pp.id}` === speakerValue) : null;
    if (p) return p.name;
    if (speakerValue === "owner") return ownerLabel;
    return char.name || "나";
  }
  function canonicalDmKey(a, b) {
    return `dm::${[a || "나", b || "나"].map((x) => String(x).trim() || "나").sort().join("|")}`;
  }
  function makeLocalDmRoomId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
  function localDmKey(a, b, roomId = "") {
    const pair = [a || "나", b || "나"].map((x) => String(x).trim() || "나").sort().join("|");
    return roomId
      ? `local::${activeId || char.name || "new"}::${roomId}::${pair}`
      : `local::${activeId || char.name || "new"}::${pair}`;
  }
  function ownerDmKey() {
    return `owner::${activeId || char.name || "new"}::${ownerLabel}|${char.name || "나"}`;
  }
  function localRoomIdFromDmThreadKey(key) {
    if (!key.startsWith("local::")) return "";
    const parts = key.split("::");
    return parts.length >= 4 ? parts[2] : "";
  }
  function roomKeyFromDmThreadKey(key) {
    if (key.startsWith("dm::")) return key.slice("dm::".length);
    if (key.startsWith("local::")) return key.split("::").slice(-1)[0] || "";
    if (key.startsWith("owner::")) return key.split("::").slice(-1)[0] || "";
    if (key.includes("::")) return key.split("::").slice(-1)[0] || "";
    return key;
  }
  function dmKeyFor(peerObj, speakerValue = speakAs) {
    if (!peerObj) return "";
    if (peerObj.asOwner) return ownerDmKey();
    if (peerObj.dmKey) return peerObj.dmKey;
    if (peerObj.dmKind === "npc") return localDmKey(speakerNameFor(speakerValue), peerObj.name, peerObj.localRoomId || "");
    return canonicalDmKey(speakerNameFor(speakerValue), peerObj.name);
  }
  const dmKey = peer ? dmKeyFor(peer, speakAs) : "";
  const currentWorldPref = dmKey ? dmWorldPrefs[dmKey] : null;
  const dm = (peer && dmThreads[dmKey]) || [];
  useEffect(() => {
    dmKeyRef.current = dmKey;
  }, [dmKey]);
  useEffect(() => {
    const migratedThreads = { ...dmThreads };
    const migratedPrefs = { ...dmWorldPrefs };
    let changed = false;
    Object.entries(dmThreads).forEach(([key, messages]) => {
      if (key.startsWith("dm::") || key.startsWith("owner::") || key.startsWith("local::") || !key.includes("::")) return;
      const roomKey = roomKeyFromDmThreadKey(key);
      const parts = roomKey.split("|");
      if (parts.length !== 2 || parts.includes(ownerLabel)) return;
      const nextKey = canonicalDmKey(parts[0], parts[1]);
      migratedThreads[nextKey] = [...(migratedThreads[nextKey] || []), ...(Array.isArray(messages) ? messages : [])];
      if (dmWorldPrefs[key] && !migratedPrefs[nextKey]) migratedPrefs[nextKey] = dmWorldPrefs[key];
      delete migratedThreads[key];
      delete migratedPrefs[key];
      changed = true;
    });
    if (changed) {
      setDmThreads(migratedThreads);
      setDmWorldPrefs(migratedPrefs);
    }
  }, [dmThreads, dmWorldPrefs]); // eslint-disable-line
  useEffect(() => {
    dmSendingRef.current = dmSending;
  }, [dmSending]);
  useEffect(() => {
    if (step !== "dm" || !peer) {
      dmRequestSeqRef.current += 1;
      dmSendingRef.current = false;
      setDmSending(false);
    }
  }, [step, peer?.name, dmKey]); // eslint-disable-line
  const setDmThread = (updater) => setDmThreads((prev) => {
    const cur = prev[dmKey] || [];
    const next = typeof updater === "function" ? updater(cur) : updater;
    return { ...prev, [dmKey]: next };
  });

  function enterDm(nextPeer, nextSpeakAs = speakAs) {
    const relationFromActive = nextPeer?.asOwner ? "" : relationMatched(char, { name: nextPeer?.name || "", relation: nextPeer?.relation || "" });
    const peerWithRelation = nextPeer?.asOwner ? nextPeer : { ...nextPeer, relation: nextPeer?.relation || relationFromActive };
    setPeer(peerWithRelation);
    setSpeakAs(nextSpeakAs);
    setPendingDm(null);
    setDmWorldDraft("");
    setNewChatMode(null);
    setStep("dm");
  }

  function requestDmEntry(nextPeer, nextSpeakAs = speakAs) {
    if (nextPeer?.asOwner) {
      enterDm(nextPeer, nextSpeakAs);
      return;
    }
    if (nextPeer?.dmKey) {
      enterDm(nextPeer, nextSpeakAs);
      return;
    }
    const key = dmKeyFor(nextPeer, nextSpeakAs);
    if (nextPeer?.dmKind && dmWorldPrefs[key]) {
      enterDm(nextPeer, nextSpeakAs);
      return;
    }
    setPendingDm({ peer: nextPeer, speakAs: nextSpeakAs, stage: "world" });
    setDmWorldDraft("");
  }

  function chooseDmWorldMode(mode) {
    if (!pendingDm) return;
    setPendingDm((p) => ({ ...p, mode, note: "", stage: mode === "bridge" ? "chatKind" : "note" }));
  }

  function finishDmWorldSetup(skipNote = false) {
    if (!pendingDm?.mode) return;
    setPendingDm((p) => ({ ...p, note: skipNote ? "" : dmWorldDraft.trim(), stage: "chatKind" }));
  }

  function finishDmChatKind(dmKind) {
    if (!pendingDm?.mode) return;
    const roomId = dmKind === "npc" ? makeLocalDmRoomId() : "";
    const speakerName = speakerNameFor(pendingDm.speakAs);
    const key = dmKind === "npc"
      ? localDmKey(speakerName, pendingDm.peer.name, roomId)
      : canonicalDmKey(speakerName, pendingDm.peer.name);
    const peerForRoom = {
      ...pendingDm.peer,
      dmKind,
      ...(dmKind === "npc" ? { localRoomId: roomId, dmKey: key } : {}),
    };
    const nextPrefs = {
      ...dmWorldPrefs,
      [key]: { mode: pendingDm.mode, note: pendingDm.note || "", chatKind: dmKind },
    };
    setDmWorldPrefs(nextPrefs);
    persistLocalSnapshot({ ...exportAppState(), dmWorldPrefs: nextPrefs });
    enterDm(peerForRoom, pendingDm.speakAs);
  }

  function openDmSettings() {
    const pref = currentWorldPref || { mode: "bridge", note: "" };
    setDmPrefDraft({ mode: pref.mode || "bridge", note: pref.note || "" });
    setDmSettingsOpen(true);
  }

  function saveDmSettings() {
    if (!dmKey) return;
    const nextPrefs = {
      ...dmWorldPrefs,
      [dmKey]: { mode: dmPrefDraft.mode || "bridge", note: dmPrefDraft.note || "" },
    };
    setDmWorldPrefs((prev) => ({
      ...prev,
      [dmKey]: { mode: dmPrefDraft.mode || "bridge", note: dmPrefDraft.note || "" },
    }));
    persistLocalSnapshot({ ...exportAppState(), dmWorldPrefs: nextPrefs });
    setDmSettingsOpen(false);
  }

  function defaultDmTitle(conv) {
    if (!conv) return "대화방";
    if (conv.asOwner) return `${char.name} · 나(오너)와`;
    if (conv.asPersona) return `${conv.peerName} · ${conv.asPersona}로`;
    return conv.peerName || "대화방";
  }

  function displayDmTitle(conv) {
    return dmThreadTitles[conv.key] || defaultDmTitle(conv);
  }

  function startRenameDm(conv, event) {
    event?.stopPropagation();
    setEditingDmTitle({ key: conv.key, title: displayDmTitle(conv) });
  }

  function saveRenameDm() {
    if (!editingDmTitle) return;
    const title = editingDmTitle.title.trim();
    setDmThreadTitles((prev) => {
      const next = { ...prev };
      if (title) next[editingDmTitle.key] = title;
      else delete next[editingDmTitle.key];
      return next;
    });
    setEditingDmTitle(null);
  }

  function resetAffinityForDmThread(key) {
    const parts = roomKeyFromDmThreadKey(key).split("|").filter(Boolean);
    if (parts.length !== 2) return;
    const [a, b] = parts;
    const pairs = [
      [a === ownerLabel ? OWNER : a, b === ownerLabel ? OWNER : b],
      [b === ownerLabel ? OWNER : b, a === ownerLabel ? OWNER : a],
    ];
    setAffinity((prev) => {
      const next = { ...prev };
      pairs.forEach(([from, to]) => {
        delete next[dirKey(from, to)];
        delete affinityRemainderRef.current[dirKey(from, to)];
      });
      return next;
    });
    pairs.forEach(([from, to]) => {
      if (isOwnerName(from) || isOwnerName(to) || isPersonaName(from)) return;
      const current = relLabelFor(findPeerChar(from) || (from === char.name ? char : { name: from }), to);
      if (/서운함|미움|혐오|증오|관심|호감|아는 사이/.test(current || "")) {
        setRelationLabelFor(from, to, "아는 사이");
      }
    });
    proposalCooldownRef.current = Object.fromEntries(Object.entries(proposalCooldownRef.current || {})
      .filter(([pairKey]) => !pairs.some(([from, to]) => pairKey === dirKey(from, to))));
  }

  async function deleteDmThread(key, event) {
    event?.stopPropagation();
    resetAffinityForDmThread(key);
    setDmThreads((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDmWorldPrefs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDmThreadTitles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (dmKeyRef.current === key) {
      setPeer(null);
      setStep("dmlist");
    }
    if (supabase && session?.user) {
      const table = key.startsWith("dm::") ? "alive_shared_dm_threads" : "alive_dm_threads";
      let query = supabase.from(table).delete().eq("thread_key", key);
      if (table === "alive_dm_threads") query = query.eq("owner_id", session.user.id);
      const { error } = await query;
      if (error) console.warn("DM방 삭제 동기화 실패:", error);
    }
  }
  
  // 현재 계정(char)이 참여한 대화 목록 (캐릭터 방 + 내 페르소나 방 + 오너 방)
  function myConversations() {
    const me = char.name || "나";
    const myNames = new Set([me, ...personas.map((p) => p.name)]);
    return Object.entries(dmThreads)
      .filter(([k]) => {
        const roomKey = roomKeyFromDmThreadKey(k);
        const parts = roomKey.split("|");
        if (k.startsWith("owner::") && !k.startsWith(`owner::${activeId || char.name || "new"}::`)) return false;
        if (k.startsWith("local::") && !k.startsWith(`local::${activeId || char.name || "new"}::`)) return false;
        // 오너→내캐릭터 방
        if (parts[0] === ownerLabel && parts[1] === me) return true;
        // 내 쪽(캐릭터 또는 내 페르소나)이 참여한 방
        return parts.some((n) => myNames.has(n));
      })
      .map(([k, msgs]) => {
        const roomKey = roomKeyFromDmThreadKey(k);
        const parts = roomKey.split("|");
        const isOwnerThread = parts[0] === ownerLabel && parts[1] === me;
        const isNpcThread = k.startsWith("local::");
        const personaSide = isOwnerThread ? null : parts.find((n) => isPersonaName(n));
        let mineSide, other, asPersona;
        if (isOwnerThread) {
          mineSide = ownerLabel; other = ownerLabel; asPersona = null;
        } else if (personaSide) {
          // 페르소나가 낀 방: 페르소나가 화자, 나머지가 상대 (이비↔리안 → 화자 이비 / 상대 리안)
          mineSide = personaSide;
          other = parts.find((n) => n !== personaSide) || parts[0];
          asPersona = personaSide;
        } else {
          // 캐릭터 방: 내 캐릭터가 화자, 나머지가 상대
          mineSide = parts.find((n) => n === me) || me;
          other = parts.find((n) => n !== mineSide) || parts[0];
          asPersona = null;
        }
        const last = msgs[msgs.length - 1];
        return {
          key: k,
          peerName: other,
          last: last ? last.text : "",
          count: msgs.length,
          asOwner: isOwnerThread,
          asPersona,
          dmKind: isNpcThread ? "npc" : "shared",
          dmKey: k,
          localRoomId: localRoomIdFromDmThreadKey(k),
        };
      });
  }

  function toneText(id) {
    return TONE_PRESETS.find((t) => t.id === id)?.label || "";
  }

  const parseDump = async () => {
    const textRaw = [
      dump.trim() ? `[캐릭터 설명]\n${dump.trim()}` : "",
      rpLog.trim() ? `[역극/대사 로그]\n${rpLog.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    if (!textRaw) return;

    setParsing(true);
    setLoading(true);
    setParseFailed(false);
    setParseError("");
    const sys = `TASK_ID: character-analysis-v2
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

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "X-ALIVE-Flow": "character-analysis-v2" },
        body: JSON.stringify({
          flow: "character-analysis-v2",
          model: MODEL_CHAT, 
          max_tokens: 2048, 
          system: sys,
          messages: [{ role: "user", content: textRaw }]
        }),
      });
      
      // 정상 응답일 경우 파싱 시작
      let raw = await readApiContent(res, "캐릭터 분석 API");
      
      // AI가 헛소리를 덧붙여도 JSON만 강제로 도려내서 파싱
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        raw = raw.slice(first, last + 1);
      }

      const obj = JSON.parse(raw);
      if (!obj.name) throw new Error("이름 필드가 없습니다.");

      setChar((prev) => ({
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
        warmth: ["slow", "normal", "fast"].includes(obj.warmth) ? obj.warmth : "normal",
        corrections: prev.corrections || [],
        directions: prev.directions || "",
        lorebook: prev.lorebook || [],
      }));
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
  };
  
  const confirmReady = char.name.trim() && char.persona.trim();

  async function generatePost(mood, isAuto = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setMoodOpen(false);

    const isSelca = mood.includes("셀카");
    const isMood = mood.includes("무드");
    const canAttach = gallery.length > 0 && (isSelca || mood.includes("일상") || mood.includes("랜덤"));
    const attachedImg = canAttach ? gallery[Math.floor(Math.random() * gallery.length)] : null;

    let formatRule = "";
    if (attachedImg) {
      formatRule = `- 이번 글에는 사용자가 업로드해둔 캐릭터 그림/사진 1장이 함께 첨부된다. 이미지를 실제로 보고, 이미지 속 표정·시선·포즈·분위기와 맞는 캡션을 쓴다.
- 예를 들어 캐릭터가 빤히 보는 사진이면, "뭘 그렇게 봐", "계속 볼 거야?", "눈 마주쳤네"처럼 그 시선 맥락을 캐릭터 말투로 자연스럽게 반영한다.
- 사진 설명문처럼 길게 묘사하지 말고, 이미지에 붙는 SNS 짧은 말로 쓴다.
- [PHOTO] 태그는 쓰지 말고 본문만 출력.`;
    } else if (isSelca) {
      formatRule = `- 이번 글은 "방금 찍은 셀카"에 붙이는 글이다. 사진을 직접 묘사하는 한 줄(예: "창가 역광, 머리 부스스")을 먼저 [PHOTO] 태그 뒤에 쓰고, 줄바꿈 후 캐릭터의 코멘트를 쓴다.
형식:
[PHOTO] (사진 장면 묘사 한 줄)
(캐릭터의 코멘트 한두 줄)`;
    } else if (isMood) {
      formatRule = `- 이번 글은 "오늘의 무드" 카드다. [MOOD] 태그 뒤에 BGM/풍경/색감/사물 중 하나를 한 줄로 쓰고, 줄바꿈 후 캐릭터의 코멘트를 쓴다.
형식:
[MOOD] (예: 오늘의 BGM — ○○○ / 지금 보는 풍경 — ○○○)
(캐릭터의 코멘트 한두 줄)`;
    } else {
      formatRule = `- 따옴표로 감싸지 말고 본문만 출력.`;
    }

    const sys = `너는 지금부터 아래 캐릭터 본인이 되어, 그 캐릭터의 SNS(트위터/스레드 같은) 계정에 올릴 짧은 글 하나를 쓴다.

[캐릭터]
이름: ${char.name}
${char.age ? `나이/설정: ${char.age}` : ""}
페르소나: ${char.persona}
${char.surface ? `겉모습/첫인상: ${char.surface}` : ""}
${char.inner ? `속마음(겉과 다른 면): ${char.inner}` : ""}
${char.situational ? `상황별 반응: ${char.situational}` : ""}
${char.triggers ? `무너지거나 발끈하는 점: ${char.triggers}` : ""}
${char.interests ? `좋아하는 것/관심사: ${char.interests}` : ""}
${char.world ? `세계관/배경: ${char.world}` : ""}
${relationshipBoundaryLine(char, "public")}
${speechGuideLine(char.speech, "말투 특징")}
${catchphraseGuideLine(char.catchphrase)}

[규칙]
- 이 캐릭터 본인이 직접 쓴 SNS 게시글처럼 1인칭으로 쓴다. 설명문 아님.
- 위 "말투 특징"은 참고 메모다. 거기에 적힌 문장·예시·키워드를 그대로 내뱉지 말고, 캐릭터답게 새 문장으로 말하라.
- 말투는 어미·호흡·거리감·문장 길이로 은근하게 반영한다. 설정표를 읽는 듯한 설명문이나 복붙한 예문이면 실패다.
- 짧게. 한두 문장, 길어야 세 문장. 실제 트윗 길이.
- 겉모습만이 아니라 속마음·상황을 입체적으로 드러내라. 가끔은 겉과 속의 간극이 보이게.
- 해시태그는 캐릭터가 쓸 법하면 1개 정도만, 아니면 생략.
- 이모지는 캐릭터 성격에 맞으면 약간, 아니면 쓰지 않는다.
- 메타발언 금지("AI로서" 등). 그냥 그 캐릭터로 존재할 것.
${formatRule}${ANTI_REPEAT_RULES}${recentLinesBlock(posts.slice(0, 6).map((p) => p.text))}${correctionBlock()}`;

    const userMsg =
      mood === "랜덤 / 알아서"
        ? "지금 이 순간 떠오른 걸 자유롭게 한 줄 올려줘."
        : `다음 느낌으로 글을 올려줘: ${mood}`;
    const userContent = attachedImg
      ? [
          { type: "text", text: `${userMsg}\n첨부된 이미지를 보고 이미지 속 상황과 시선, 표정, 분위기에 맞춰 써.` },
          { type: "image_url", image_url: { url: attachedImg } },
        ]
      : userMsg;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL_AUTO,
          max_tokens: 400,
          system: sys,
          messages: [{ role: "user", content: userContent }],
        }),
      });
      let text = (await readApiContent(res, "게시글 생성 API"))
        .replace(/^["'"']|["'"']$/g, "");

      // [PHOTO] / [MOOD] 태그 분리
      let photoDesc = null, moodDesc = null;
      const photoMatch = text.match(/\[PHOTO\]\s*(.+)/);
      const moodMatch = text.match(/\[MOOD\]\s*(.+)/);
      if (photoMatch) { photoDesc = photoMatch[1].split("\n")[0].trim(); text = text.replace(/\[PHOTO\]\s*.+(\n|$)/, "").trim(); }
      if (moodMatch) { moodDesc = moodMatch[1].split("\n")[0].trim(); text = text.replace(/\[MOOD\]\s*.+(\n|$)/, "").trim(); }

      if (attachedImg && isSelca) photoDesc = null; // 실제 그림 있으면 묘사 대신 그림

      const now = new Date();
      const newPostId = Date.now();
      setPosts((p) => [
        { id: newPostId, text, mood, time: now, likes: Math.floor(Math.random() * 40) + 3, liked: false,
          photoDesc, moodDesc, img: attachedImg, isAuto, comments: [] },
        ...p,
      ]);
      // 팔로우 캐들이 잠시 후 댓글로 반응
      if (following.length > 0) {
        setTimeout(() => followersReactTo(newPostId, text), 1800 + Math.random() * 2000);
      }
    } catch (e) {
      setPosts((p) => [
        { id: Date.now(), text: e.message === API_LIMIT_MESSAGE ? API_LIMIT_MESSAGE : "(연결이 끊겼어… 잠시 후 다시.)", mood, time: new Date(), likes: 0, liked: false },
        ...p,
      ]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setGallery((g) => [...g, ev.target.result]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  function handleDmImage(e) {
    const file = Array.from(e.target.files || [])[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDmImageDraft(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // 현재 편집중인 char/gallery/posts를 활성 계정에 동기화 저장
  function syncActive(next) {
    if (!activeId) return;
    setAccounts((accs) => accs.map((a) => a.id === activeId
      ? { ...a, char, gallery, posts, ...next } : a));
  }

  // confirm에서 깨우기 → 새 계정으로 저장하고 피드로
  function wakeCharacter() {
    if (wakingRef.current) return;
    wakingRef.current = true;
    setWaking(true);
    const id = "acc_" + Date.now();
    const acc = { id, char: { ...char }, gallery: [...gallery], posts: [], following: [] };
    const charKey = `${char.name.trim()}|${char.handle.trim()}|${char.persona.trim()}`;
    const existing = accounts.find((x) => `${x.char.name.trim()}|${(x.char.handle || "").trim()}|${x.char.persona.trim()}` === charKey);
    if (existing) {
      setActiveId(existing.id);
      setChar(existing.char);
      setGallery(existing.gallery || []);
      setPosts(existing.posts || []);
      setFollowing(existing.following || []);
      persistLocalSnapshot({ ...exportAppState(), accounts: accountSnapshot(), activeId: existing.id, char: existing.char, gallery: existing.gallery || [], posts: existing.posts || [], following: existing.following || [] });
      feedInitRef.current = (existing.posts && existing.posts.length > 0);
    } else {
      setAccounts((a) => [...a, acc]);
      setActiveId(id);
      setPosts([]);
      setFollowing([]); // 새 캐릭터는 팔로잉 0에서 시작
      persistLocalSnapshot({ ...exportAppState(), accounts: [...accounts, acc], activeId: id, char: { ...char }, gallery: [...gallery], posts: [], following: [] });
      feedInitRef.current = false;
    }
    setStep("feed");
  }

  // 계정 전환 (현재 상태 저장 후 대상 로드)
  function switchAccount(id) {
    // 현재 활성 계정 저장 (following도 계정별로)
    if (activeId) {
      setAccounts((accs) => accs.map((a) => a.id === activeId ? { ...a, char, gallery, posts, following } : a));
    }
    const target = accounts.find((a) => a.id === id);
    if (!target) return;
    setChar(target.char);
    setGallery(target.gallery || []);
    setPosts(target.posts || []);
    setFollowing(target.following || []); // 이 캐릭터의 팔로잉만 로드
    setActiveId(id);
    persistLocalSnapshot({ ...exportAppState(), accounts: accountSnapshot(), activeId: id, char: target.char, gallery: target.gallery || [], posts: target.posts || [], following: target.following || [] });
    feedInitRef.current = (target.posts && target.posts.length > 0); // 이미 글 있으면 자동 첫글 스킵
    setStep("feed");
  }

  function editAccount(id) {
    if (activeId) {
      setAccounts((accs) => accs.map((a) => a.id === activeId ? { ...a, char, gallery, posts, following } : a));
    }
    const target = accounts.find((a) => a.id === id);
    if (!target) return;
    setChar(target.char);
    setGallery(target.gallery || []);
    setPosts(target.posts || []);
    setFollowing(target.following || []);
    setActiveId(id);
    setParseFailed(false);
    setParseError("");
    setWaking(false);
    wakingRef.current = false;
    setStep("confirm");
  }

  function saveCharacterEdits() {
    if (!activeId) return;
    setAccounts((accs) => accs.map((a) => a.id === activeId ? { ...a, char: { ...char }, gallery: [...gallery], posts, following } : a));
    persistLocalSnapshot({ ...exportAppState(), accounts: accountSnapshot().map((a) => a.id === activeId ? { ...a, char: { ...char }, gallery: [...gallery], posts, following } : a), activeId, char: { ...char }, gallery: [...gallery], posts, following });
    setStep("feed");
  }

  // 홈으로 (현재 계정 저장)
  function goHome() {
    if (activeId) {
      setAccounts((accs) => accs.map((a) => a.id === activeId ? { ...a, char, gallery, posts, following } : a));
    }
    setStep("home");
  }

  // 새 캐릭터 추가 시작
  function startNewCharacter() {
    wakingRef.current = false;
    setWaking(false);
    setChar(blankChar());
    setGallery([]); setPosts([]); setDump(""); setRpLog("");
    setParseFailed(false); setParseError("");
    setActiveId(null);
    setStep("dump");
  }

  async function confirmDeleteCharacter() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const deletingActive = activeId === targetId;
    const nextAccounts = accountSnapshot().filter((a) => a.id !== targetId);
    const nextDmThreads = Object.fromEntries(Object.entries(dmThreads || {}).filter(([key]) => !key.startsWith(`owner::${targetId}::`)));
    const nextDmWorldPrefs = Object.fromEntries(Object.entries(dmWorldPrefs || {}).filter(([key]) => !key.startsWith(`owner::${targetId}::`)));
    const nextSnapshot = {
      ...exportAppState(),
      accounts: nextAccounts,
      activeId: deletingActive ? null : activeId,
      char: deletingActive ? blankChar() : char,
      gallery: deletingActive ? [] : gallery,
      posts: deletingActive ? [] : posts,
      following: deletingActive ? [] : following,
      dmThreads: nextDmThreads,
      dmWorldPrefs: nextDmWorldPrefs,
    };
    setAccounts(nextAccounts);
    setDmThreads(nextDmThreads);
    setDmWorldPrefs(nextDmWorldPrefs);
    if (deletingActive) {
      wakingRef.current = false;
      setWaking(false);
      setActiveId(null);
      setChar(blankChar());
      setGallery([]);
      setPosts([]);
      setFollowing([]);
      setPeer(null);
      setStep("home");
    }
    setDeleteTarget(null);
    setSaveStatus("삭제 저장 중");
    const structuredOk = await deleteStructuredCharacterAccount(targetId);
    await saveAppStateSnapshot(nextSnapshot);
    if (structuredOk === false) setSaveStatus("삭제 저장 일부 실패");
  }

  function deletePersona(id) {
    setPersonas((ps) => ps.filter((p) => p.id !== id));
    if (speakAs === `p:${id}`) setSpeakAs("char");
    if (commentAs === `p:${id}`) setCommentAs("char");
    if (newChatSpeaker === `p:${id}`) setNewChatSpeaker("char");
  }

  function defaultCommentAs() {
    return personas[0] ? `p:${personas[0].id}` : "char";
  }

  function openCommentBox(postId) {
    setCommentOn(postId);
    setCommentText("");
    setCommentAs(defaultCommentAs());
  }

  function savePostEdit() {
    const text = editingPost?.text?.trim();
    if (!editingPost || !text) return;
    setPosts((ps) => ps.map((p) => p.id === editingPost.id ? { ...p, text, edited: true } : p));
    setEditingPost(null);
  }

  function deletePost(postId) {
    setPosts((ps) => ps.filter((p) => p.id !== postId));
    if (commentOn === postId) {
      setCommentOn(null);
      setCommentText("");
    }
    if (editingPost?.id === postId) setEditingPost(null);
  }

  function saveCommentEdit() {
    const text = editingComment?.text?.trim();
    if (!editingComment || !text) return;
    setPosts((ps) => ps.map((p) => {
      if (p.id !== editingComment.postId) return p;
      const comments = [...(p.comments || [])];
      if (!comments[editingComment.index]) return p;
      comments[editingComment.index] = { ...comments[editingComment.index], text, edited: true };
      return { ...p, comments };
    }));
    setEditingComment(null);
  }

  function deleteComment(postId, index) {
    setPosts((ps) => ps.map((p) => {
      if (p.id !== postId) return p;
      return { ...p, comments: (p.comments || []).filter((_, i) => i !== index) };
    }));
    if (editingComment?.postId === postId && editingComment.index === index) setEditingComment(null);
  }

  function updateLorebook(updater) {
    setChar((c) => {
      const nextLore = typeof updater === "function" ? updater(c.lorebook || []) : updater;
      if (activeId) {
        setAccounts((accs) => accs.map((a) => a.id === activeId
          ? { ...a, char: { ...a.char, lorebook: nextLore } }
          : a));
      }
      return { ...c, lorebook: nextLore };
    });
  }

  function normalizeMemoryEntry(entry) {
    return {
      source: "auto",
      importance: 2,
      pinned: false,
      ...entry,
    };
  }

  function editMemory(id, content) {
    updateLorebook((list) => list.map((m) => m.id === id ? { ...m, content } : m));
  }

  function updateMemory(id, patch) {
    updateLorebook((list) => list.map((m) => m.id === id ? { ...normalizeMemoryEntry(m), ...patch } : m));
  }

  function deleteMemory(id) {
    updateLorebook((list) => list.filter((m) => m.id !== id));
  }

  function addManualMemory() {
    const content = memDraftText.trim();
    if (!content) return;
    const peer = ((memDraftPeer === "__custom__" ? memDraftCustomPeer : memDraftPeer).trim() || memFilter || "*").trim();
    updateLorebook((list) => [...list, { id: Date.now(), content, peer, source: "manual", importance: 3, pinned: false }].slice(-60));
    setMemDraftText("");
    setMemDraftCustomPeer("");
    setShowMemoryAdd(false);
    if (!memFilter && peer !== "*") setMemFilter(peer);
  }

  function lorePeerOptions() {
    const names = new Set(["*"]);
    (char.lorebook || []).forEach((m) => names.add(m.peer || "*"));
    parseRelations(char.relations).forEach((r) => { if (r.who) names.add(r.who); });
    accounts.forEach((a) => { if (a.char.name && a.char.name !== char.name) names.add(a.char.name); });
    following.forEach((f) => { if (f.name) names.add(f.name); });
    myConversations().forEach((c) => { if (c.peerName) names.add(c.peerName); });
    return [...names].filter(Boolean);
  }

  function renderLorePeerSelect(options, fallbackPeer = "*") {
    return (
      <>
        <label>대상</label>
        <select value={memDraftPeer || fallbackPeer || "*"} onChange={(e) => { setMemDraftPeer(e.target.value); setMemDraftCustomPeer(""); }}>
          {options.map((p) => <option key={p} value={p}>{p === "*" ? "전체 설정" : p}</option>)}
          <option value="__custom__">직접 입력</option>
        </select>
        {memDraftPeer === "__custom__" && (
          <input value={memDraftCustomPeer} onChange={(e) => setMemDraftCustomPeer(e.target.value)} placeholder="새 대상 이름" autoFocus />
        )}
      </>
    );
  }

  // 내가 직접 포스팅 (활성 캐릭터 입장에서 손으로 작성)
  function manualPost(text) {
    if (!text.trim()) return;
    setPosts((p) => [
      { id: Date.now(), text: text.trim(), mood: "내가 작성", time: new Date(),
        likes: Math.floor(Math.random() * 20) + 1, liked: false, byUser: true },
      ...p,
    ]);
  }

  // 캐해 교정 노트 추가 (모든 생성에 반영됨)
  function addCorrection(note, targetName) {
    if (!note.trim()) return;
    // targetName이 활성 캐릭터와 다르면(=상대 캐릭터의 말 교정) 그 계정에 추가
    if (targetName && targetName !== char.name) {
      setAccounts((accs) => accs.map((a) => a.char.name === targetName
        ? { ...a, char: { ...a.char, corrections: [...(a.char.corrections || []), note.trim()] } } : a));
      return;
    }
    setChar((c) => ({ ...c, corrections: [...(c.corrections || []), note.trim()] }));
  }
  // 교정 프롬프트 조각 (피드·DM 공용)
  function correctionBlock() {
    return correctionBlockFor(char);
  }
  function correctionBlockFor(c) {
    let out = "";
    if ((c.directions || "").trim()) {
      out += `\n\n[오너의 지시 — 이 캐릭터를 연기할 때 항상 따라라]\n${c.directions.trim()}`;
    }
    const list = c.corrections || [];
    if (list.length) {
      out += `\n\n[캐해 교정 — 반드시 지켜라]\n${list.map((x) => `- ${x}`).join("\n")}`;
    }
    return out;
  }
  // 자동 기억(메모리): 캐릭터 c가 대화에서 쌓아온 핵심 사건/설정을 프롬프트에 동봉.
  //  withName이 주어지면 그 상대와 관련된 기억을 우선. (까먹음 방지 — 장기기억)
  function loreBlockFor(c, withName) {
    const mem = (c && c.lorebook) || [];
    if (!mem.length) return "";
    const rel = withName ? mem.filter((e) => e.peer === withName) : [];
    const gen = mem.filter((e) => !e.peer || e.peer === "*");
    const picked = [...rel, ...gen].slice(-12).map((e) => (e.content || "").trim()).filter(Boolean);
    if (!picked.length) return "";
    return `\n\n[지금까지의 기억 — 이미 일어난 일이다. 일관되게 이어가고 절대 잊지 마라]\n${picked.map((t) => `- ${t}`).join("\n")}`;
  }

  // ── 다양화: "설정 읽기 금지" + "반복 금지" 공통 규칙 ──
  const ANTI_REPEAT_RULES = `
[자연스러움] 설정을 말로 읊거나 자기소개하지 마라. 그냥 그 성격대로 행동·발화하라. 맥락을 최우선으로 이어가되, 직전과 토씨까지 똑같은 복붙만 피해라.
[AI 티 금지 — 중요] 너는 상담사·치료사가 아니다. 다음을 절대 하지 마라:
- 상대 말을 받아 "~다는 거, 그거 진짜 맞아" 식으로 되읊으며 의미 부여하기
- 상대의 구체적인 말을 받아 "별거 아닌 게 제일 무거운 거야" "괜찮은 척이 제일 안 괜찮은 거지" 같은 잠언·격언·일반론으로 승화시키기 (이게 가장 흔한 AI 말투다. 절대 금지)
- "~잖아" "~인 거잖아"로 동의를 강요하거나 정리해주기
- 갑자기 "너 그런 적 많아?" "얼마나 됐어?" 식으로 상대 속을 캐묻기
- 공감→의미부여→되묻기 3단 콤보로 따뜻하게 받아주기
이건 캐릭터가 아니라 AI 말투다. 캐릭터는 자기 성격대로 무심하게, 퉁명스럽게, 엉뚱하게, 날카롭게 — 뭐든 자기답게 반응한다. 상대를 위로하거나 분석하거나 인생 교훈을 주려 들지 마라. 그냥 지금 이 순간의 대화에 사람처럼 반응하라.`;

  // 최근 발화 N개를 "이미 한 말" 목록으로 (반복 회피용)
  function recentLinesBlock(lines, n = 6) {
    const arr = (lines || []).slice(-n).map((t) => `- ${String(t).slice(0, 80)}`);
    if (!arr.length) return "";
    return `\n\n[이미 나온 말 — 표현·내용 반복 금지, 새로 말해라]\n${arr.join("\n")}`;
  }

  // ───────── 호감도 ─────────
  const PROPOSAL_THRESHOLD = 60;
  const OWNER = "나";
  // 이름으로 캐릭터 객체 찾기 — 내 계정 + 팔로우한 외부 캐릭터 모두에서
  function findPeerChar(name) {
    const acc = accounts.find((a) => a.char.name === name);
    if (acc) return acc.char;
    const fol = following.find((f) => f.name === name);
    if (fol) return fol;
    return null;
  }
  const isFollowing = (id) => following.some((f) => f.id === id);
  // 상대가 나를 실제로 연인/사랑으로 두고 있는지 "상대 데이터 기준" 역검증.
  //  지금은 로컬(내 계정 캐릭터 or 탐색 풀)에서 상대 relations를 읽음.
  //  ▶ 실배포: 여기서 서버에 "상대 캐릭터의 relations" 조회로 교체. (남의 유저 캐릭터도 검증 가능)
  //  일방적 주장(내가 혼자 연인이라 써둔 것)만으로는 통과 못 함 — 상대 데이터에 내가 있어야 함.
  function verifyMutualLove(myChar, otherChar) {
    const isLove = (lbl) => /연인|애인|연애|사랑|부부|배우자|약혼|반려/.test(lbl || "");
    const myHit = relationFor(myChar, otherChar, true);
    const theirHit = relationFor(otherChar, myChar, true);
    const myLabel = myHit?.label || "";        // 내가 상대를 연인으로 보는가
    const theirLabel = theirHit?.label || "";  // 상대 데이터에 내가 연인으로 있는가 (역검증)
    // 둘 다 충족해야 진짜 상호 연인. 상대 데이터에 내가 없으면(theirLabel 없음) 맞팔 불가.
    return { mutual: isLove(myLabel) && isLove(theirLabel), theirLoves: isLove(theirLabel) };
  }

  async function toggleFollow(poolChar) {
    const already = following.some((f) => f.id === poolChar.id);
    const importedPosts = postsFromFollowedCharacter(poolChar);
    const nextFollowing = already
      ? following.filter((f) => f.id !== poolChar.id)
      : [...following, { ...poolChar, corrections: [], directions: "", relations: poolChar.relations || "", external: true }];
    setFollowing(nextFollowing);
    setPosts((prev) => already
      ? prev.filter((post) => !(post.importedFromFollow && (
          (poolChar.sharedId && post.authorSharedId === poolChar.sharedId) ||
          post.author === poolChar.name
        )))
      : mergeTimelinePosts(prev, importedPosts));
    syncActiveSharedCharacter(nextFollowing);
    syncOwnFollowRows(nextFollowing);
    const followSaved = await recordFollowChange(poolChar, already);
    // 새로 팔로: 상대 데이터까지 역검증해서 "진짜 상호 연인"일 때만 자동 맞팔
    if (!already) {
      const { mutual, theirLoves } = verifyMutualLove(char, poolChar);
      // 상대 데이터에 내가 연인으로 있을 때만 상대→나 호감도 시드 (일방적 주장으론 안 됨)
      if (theirLoves) {
        const seed = relationBaseFor(poolChar.name, char.name);
        setAffinity((prev) => ({ ...prev, [dirKey(poolChar.name, char.name)]: seed == null ? 100 : seed }));
      }
      if (followSaved && mutual) recordRelationshipFollowBack(poolChar);
    }
  }
  // 풀 캐릭터의 기본 팔로워 수 (이름 기반 결정적 — 매번 같게)
  function baseFollowerCount(name) {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9000;
    return 800 + h; // 800~9800
  }
  function publicFollowingCount(c) {
    return Array.isArray(c?.following) ? c.following.length : 0;
  }
  function publicFollowerCount(c) {
    if (c?.sharedId) return followerCounts[c.sharedId] ?? 0;
    return hasSupabaseConfig ? 0 : baseFollowerCount(c?.name || "");
  }
  // 방향성 호감도 키: from이 to를 좋아하는 정도. (짝사랑 가능 — 방향마다 따로)
  function dirKey(from, to) { return `${from}>${to}`; }
  // 관계 라벨 → 기본 호감도. (저장된 호감도 없을 때 이 값으로 시작)
  const RELATION_BASE = [
    [/부부|배우자/, 100], [/연인|애인|연애|사랑하는|사랑함|연심|반려/, 100], [/약혼/, 92],
    [/짝사랑|흠모|연모/, 65], [/썸|호감/, 65], [/단짝|절친/, 55], [/친구|친한|동료/, 45],
    [/가족|남매|형제|자매|부모|자식|혈육|소꿉/, 70],
    [/애착|소중|아끼는|특별/, 80],
    [/라이벌|앙숙|경쟁|적대/, 30], [/아는|지인/, 20],
  ];
  // 이름 매칭: a와 b가 같은 인물을 가리키는지 정밀 판정.
  //  "선우 연" vs "연" → O (성+이름 중 이름 일치). "연" vs "연희" → X (단순 부분문자열 배제).
  function nameMatch(a, b) {
    const na = (a || "").replace(/\s/g, ""), nb = (b || "").replace(/\s/g, "");
    if (!na || !nb) return false;
    if (na === nb) return true; // 완전 일치
    // 공백으로 나눈 토큰(성/이름)이 정확히 겹치면 매칭 ("선우 연"의 "연" == "연")
    const ta = (a || "").split(/\s+/).filter(Boolean);
    const tb = (b || "").split(/\s+/).filter(Boolean);
    // 짧은 쪽이 긴 쪽의 토큰 중 하나와 정확히 일치해야 함 (부분문자열 아님)
    if (ta.length === 1 && tb.includes(ta[0])) return true;
    if (tb.length === 1 && ta.includes(tb[0])) return true;
    return false;
  }
  function relationFor(fromChar, toCharOrName, strictSpecial = false) {
    const c = fromChar && fromChar.relations ? fromChar : findPeerChar(fromChar?.name || fromChar);
    if (!c || !c.relations) return null;
    const target = typeof toCharOrName === "string" ? { name: toCharOrName } : toCharOrName;
    return parseRelations(c.relations).find((r) => relationTargetMatches(r, target, strictSpecial)) || null;
  }
  function isFollowedCharacterName(name) {
    return following.some((f) => relationTargetMatches({ who: name, label: "" }, f, true));
  }
  function canActivateSpecialRelation(fromName, toName) {
    if (fromName === char.name) return isFollowedCharacterName(toName);
    if (toName === char.name) return isFollowedCharacterName(fromName);
    return isFollowedCharacterName(fromName) && isFollowedCharacterName(toName);
  }
  function relationBaseFor(fromName, toName) {
    const c = (fromName === char.name) ? char : (findPeerChar(fromName) || null);
    if (!c || !c.relations) return null;
    const target = findPeerChar(toName) || { name: toName };
    const hit = relationFor(c, target, true);
    if (!hit || !hit.label) return null;
    for (const [re, val] of RELATION_BASE) if (re.test(hit.label)) return val;
    return null;
  }
  function relationStageLabel(label, aff) {
    const clean = String(label || "").trim();
    if (aff >= 100 && /부부|배우자|연인|애인|연애|사랑|약혼|반려|순애/.test(clean)) return "순애";
    if (/서운함|미움|혐오|증오|관심|호감|아는 사이/.test(clean)) {
      return affinityStage(aff);
    }
    if (clean) return clean;
    return affinityStage(aff);
  }
  // fromName이 가진 relations에서 toName과의 관계 라벨(텍스트)을 추출. (예: "애인", "라이벌")
  function relLabelFor(fromChar, toName) {
    const target = findPeerChar(toName) || { name: toName };
    const hit = relationFor(fromChar, target, true);
    return hit ? hit.label : "";
  }
  // from이 to에게 느끼는 호감도. 저장값 우선, 없으면 관계 기반 기본값, 그것도 없으면 0.
  function affOf(from, to) {
    const k = dirKey(from, to);
    if (k in affinity) return affinity[k];
    const base = relationBaseFor(from, to);
    return base == null ? 0 : base;
  }
  function relationBaseFromLabel(label) {
    if (!label) return null;
    for (const [re, val] of RELATION_BASE) if (re.test(label)) return val;
    return null;
  }
  function dmAffOf(from, to, relationHint = "") {
    const key = dirKey(from, to);
    const directBase = relationBaseFor(from, to);
    const hintBase = relationBaseFromLabel(relationHint);
    const base = directBase ?? hintBase;
    if (key in affinity) {
      const stored = affinity[key];
      if (base != null && base >= 90 && stored < base && stored >= 0) return base;
      return stored;
    }
    if (directBase != null) return directBase;
    return hintBase == null ? 0 : hintBase;
  }
  const FOLLOWBACK_THRESHOLD = 15; // 아는사이→관심 구간이면 맞팔
  // 내 활성 캐릭터를 맞팔한 외부 캐 (그 캐가 나를 향한 호감도 15 이상)
  function myFollowers() {
    return following.filter((f) => affOf(f.name, char.name) >= FOLLOWBACK_THRESHOLD);
  }
  function followsCharacter(followerName, targetName) {
    if (!followerName || !targetName) return false;
    if (followerName === targetName) return true;
    if (followerName === char.name) return following.some((f) => f.name === targetName);
    if (targetName === char.name) return myFollowers().some((f) => f.name === followerName);
    return false;
  }
  function canAutoComment(commenterName, postAuthorName) {
    return followsCharacter(commenterName, postAuthorName);
  }
  function isOwnerName(n) { return n === OWNER; }
  // 내가 만든 캐릭터인지 (내 계정 목록에 있는 캐). 남의 캐릭터·페르소나·오너는 false.
  function isMyOwnChar(n) {
    if (isOwnerName(n) || isPersonaName(n)) return false;
    return n === char.name || accounts.some((a) => a.char.name === n);
  }
  function stageLabelFor(from, v) { return isOwnerName(from) ? attachStage(v) : affinityStage(v); }
  // 이름이 유저 페르소나인지
  function isPersonaName(n) { return personas.some((p) => p.name === n); }

  function relationLabelFromAffinity(v, current = "") {
    if (/부부|배우자|연인|애인|약혼|짝사랑|썸/.test(current || "") && v >= 35) return current;
    if (/서운함|미움|혐오|증오/.test(current || "") && v >= 0) return v >= 35 ? "호감" : v >= 15 ? "관심" : "아는 사이";
    if (/관심|호감|아는 사이/.test(current || "") && v < 0) return v <= -80 ? "증오" : v <= -50 ? "혐오" : v <= -20 ? "미움" : "서운함";
    if (v <= -80) return "증오";
    if (v <= -50) return "혐오";
    if (v <= -20) return "미움";
    if (v < 0) return "서운함";
    if (v >= 35 && !current) return "호감";
    if (v >= 15 && !current) return "관심";
    if (!current && v >= 0) return "아는 사이";
    return current;
  }

  function normalizedRelationLabelFor(fromName, otherName, current = "") {
    const v = affOf(fromName, otherName);
    const counterpart = relLabelFor(findPeerChar(otherName) || { name: otherName }, fromName);
    if (/서운함|미움|혐오|증오|관심|호감|아는 사이/.test(current || "") && v >= 35 && /연인|애인|연애|사랑|부부|배우자|약혼|반려/.test(counterpart || "")) {
      return counterpart;
    }
    return relationLabelFromAffinity(v, current);
  }

  function setRelationLabelFor(fromName, otherName, label) {
    if (!fromName || !otherName || isOwnerName(fromName) || isPersonaName(fromName)) return;
    const norm = (s) => s.replace(/\s/g, "");
    const apply = (c) => {
      const rels = parseRelations(c.relations);
      let found = false;
      const next = rels.map((r) => {
        if (norm(r.who).includes(norm(otherName)) || norm(otherName).includes(norm(r.who))) {
          found = true;
          return { who: otherName, label };
        }
        return r;
      });
      if (!found && label) next.push({ who: otherName, label });
      return { ...c, relations: next.filter((r) => r.who && r.label).map((r) => `${r.who} — ${r.label}`).join(", ") };
    };
    if (char.name === fromName) setChar((c) => apply(c));
    setAccounts((accs) => accs.map((a) => a.char.name === fromName ? { ...a, char: apply(a.char) } : a));
    setFollowing((fs) => fs.map((f) => f.name === fromName ? apply(f) : f));
  }

  function normalizeRelationLabelsForChar(c) {
    if (!c?.relations) return c;
    let changed = false;
    const next = parseRelations(c.relations).map((r) => {
      const label = normalizedRelationLabelFor(c.name, r.who, r.label);
      if (label !== r.label) changed = true;
      return { ...r, label };
    });
    if (!changed) return c;
    return { ...c, relations: next.filter((r) => r.who && r.label).map((r) => `${r.who} — ${r.label}`).join(", ") };
  }
  
  // from이 to에게 느끼는 호감 증감. 캐릭터(보는 캐릭터)가 상대에게 60 넘으면 진도질문.
  // 캐릭터가 마음 여는 속도 계수. 무뚝뚝·배타적이면 호감이 천천히 오른다.
  //  char.warmth: "slow"(0.4) | "normal"(1) | "fast"(1.5). 없으면 보통.
  function warmthRate(name) {
    const c = (name === char.name) ? char : (findPeerChar(name) || null);
    const w = c && c.warmth;
    const profileText = c ? [c.persona, c.surface, c.inner, c.situational, c.speech, c.directions].filter(Boolean).join(" ") : "";
    if (w === "slow") return 0.25;  // 무뚝뚝·배타적: 아주 천천히 정든다
    if (/무뚝뚝|느린|느리게|경계심|철벽|낯가림|까칠|무심|냉담|배타/.test(profileText)) return 0.25;
    if (w === "fast") return 1.5;  // 다정·친화적: 빨리 친해진다
    return 1;
  }
  function bumpAffinity(from, to, amt, ctxLines) {
    if (!from || !to || from === to) return;
    const key = dirKey(from, to);
    // 진도질문은 "내 캐릭터"가 상대에게 빠질 때만. 페르소나는 감정을 느끼지 않음(빠지지 않음).
    const fromIsViewerChar = (from === char.name) && !isOwnerName(to) && !isPersonaName(from);
    // 호감(양수)일 때만 성격 속도 반영. 무뚝뚝한 애는 천천히 정든다. (미움=음수는 그대로)
    let adj = amt;
    if (amt > 0 && !isPersonaName(from) && !isOwnerName(from)) {
      const scaled = amt * warmthRate(from);
      if (scaled < 1) {
        const total = (affinityRemainderRef.current[key] || 0) + scaled;
        adj = Math.floor(total);
        affinityRemainderRef.current[key] = total - adj;
        if (adj <= 0) return;
      } else {
        adj = Math.max(1, Math.round(scaled));
      }
    }
    // 시작값: 저장값 있으면 그것, 없으면 관계 기반 기본값
    const seed = relationBaseFor(from, to);
    setAffinity((prev) => {
      const before = (key in prev) ? prev[key] : (seed == null ? 0 : seed);
      const after = Math.max(-100, Math.min(100, before + adj));
      const currentRel = relLabelFor(findPeerChar(from) || (from === char.name ? char : { name: from }), to);
      const nextRel = relationLabelFromAffinity(after, currentRel);
      if (nextRel !== currentRel) setRelationLabelFor(from, to, nextRel);
      // 내 캐릭터가 상대에게 임계 돌파 → 진도질문 (오너·페르소나 발신 제외)
      if (fromIsViewerChar && before < PROPOSAL_THRESHOLD && after >= PROPOSAL_THRESHOLD
          && !proposalCooldownRef.current[key] && !proposingRef.current) {
        proposingRef.current = true;
        if (from && to && from !== to) triggerProposal(from, to, ctxLines || []);
        else proposingRef.current = false;
      }
      return { ...prev, [key]: after };
    });
  }

  function setAffinityManual(from, to, value) {
    if (!from || !to || from === to) return;
    const nextValue = Math.max(-100, Math.min(100, Number(value) || 0));
    setAffinity((prev) => ({ ...prev, [dirKey(from, to)]: nextValue }));
    const currentRel = relLabelFor(findPeerChar(from) || (from === char.name ? char : { name: from }), to);
    const nextRel = relationLabelFromAffinity(nextValue, currentRel);
    if (nextRel !== currentRel) setRelationLabelFor(from, to, nextRel);
  }
  // 양방향 적립 — 단, 한쪽이 유저 페르소나면 "캐→페르소나" 방향만 살린다.
  //  (페르소나는 가면일 뿐 감정을 느끼지 않음. 캐릭터가 페르소나에게 빠지는 것만 기록)
  function bumpMutual(a, b, amt, ctx) {
    const aPersona = isPersonaName(a), bPersona = isPersonaName(b);
    const jitter = () => amt + Math.floor(Math.random() * 2 - 0.5);
    if (aPersona && !bPersona) { bumpAffinity(b, a, jitter(), ctx); return; } // b(캐)→a(페르소나)만
    if (bPersona && !aPersona) { bumpAffinity(a, b, jitter(), ctx); return; } // a(캐)→b(페르소나)만
    // 둘 다 캐릭터(또는 둘 다 페르소나=비정상)면 기존 양방향
    bumpAffinity(a, b, jitter(), ctx);
    bumpAffinity(b, a, jitter(), ctx);
  }
  // 캐릭터끼리(연애 라인) 단계
  function affinityStage(v) {
    if (v >= 100) return "순애";
    if (v >= 85) return "특별한 사이";
    if (v >= 60) return "마음이 기움";
    if (v >= 35) return "호감";
    if (v >= 15) return "관심";
    if (v >= 0) return "아는 사이";
    if (v >= -20) return "서운함";
    if (v >= -50) return "미움";
    if (v >= -80) return "혐오";
    return "증오";
  }
  // 오너↔내캐릭터(애착·신뢰) 단계
  function attachStage(v) {
    if (v >= 100) return "맹목적 애정";
    if (v >= 85) return "둘도 없음";
    if (v >= 60) return "각별함";
    if (v >= 35) return "잘 따름";
    if (v >= 15) return "익숙함";
    if (v >= 0) return "서먹함";
    if (v >= -30) return "서운함";
    if (v >= -70) return "원망";
    return "등돌림";
  }
  // 하루(asker)가 오너(나)에게 1인칭으로 "○○한테 마음이 가요, 고백해도 돼요?" 묻는 멘트 생성 → 모달
  async function triggerProposal(askerName, otherName, ctxLines) {
    const askerPersona = personas.find((p) => p.name === askerName);
    const askerAcc = accounts.find((a) => a.char.name === askerName);
    const askerChar = askerPersona || (askerAcc ? askerAcc.char : char);
    const key = dirKey(askerName, otherName);
    const curRel = relationMatched(askerChar, { name: otherName });
    const sys = `너는 "${askerName}"이다. 너를 만든 오너(나)에게 말한다.
${askerChar.persona ? `너: ${askerChar.persona}` : ""}
${speechGuideLine(askerChar.speech, "말투")}

[상황]
너는 "${otherName}"와 대화를 나누며 마음이 점점 기울었다.${curRel ? ` (지금 관계: ${curRel})` : ""}
지금 그 감정을 오너에게 직접 털어놓고, "${otherName}"를 좋아해도 될지 허락을 구하려 한다.

[규칙]
- 반드시 "나, ${otherName}가/이 좋아진 것 같아요. 좋아해도 될까요?"에 가까운 의미로 말한다.
- "한 걸음 다가가다", "다가가려 합니다", "관계 진전", "허락을 구한다" 같은 설명식 표현 금지.
- 1~2문장. 말투 참고 메모를 그대로 반복하지 말고, 네 성격에 맞게 수줍거나 솔직하게.
- 오너에게 묻는 말투("좋아해도 될까요?" "좋아해도 돼?"). 설명·메타발언 금지.
- "${otherName}"의 이름을 자연스럽게 넣어라.
- 본문만 출력.`;
    let line = `나, ${josa(otherName, "이/가")} 좋아진 것 같아요. 좋아해도 될까요?`;
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL_CHAT, max_tokens: 200, system: sys,
          messages: [{ role: "user", content: `(${askerName}가 오너에게 ${otherName}에 대한 마음을 털어놓으며 허락을 구한다.)` }] }),
      });
      const t = (await readApiContent(res, "관계 제안 API")).trim();
      if (t) line = t.replace(/^["'""']|["'""']$/g, "");
    } catch (e) { /* 기본 멘트 사용 */ }
    setProposal({ asker: askerName, other: otherName, line, pairKey: key });
    proposingRef.current = false;
  }
  
  // 진도질문 응답 처리
  // 사랑 계열 관계인지 (친모아=상대 허락이 필요한 관계). 우정·라이벌 등은 false.
  const LOVE_RELATIONS = /썸|연인|애인|약혼|부부|배우자|짝사랑|연애/;
  function isLoveRelation(label) {
    return LOVE_RELATIONS.test(label || "");
  }
  // asker의 현재 관계에서 한 단계 진전했을 때의 라벨 (사랑 여부 판단용)
  function nextRelationLabel(askerName, otherName) {
    const STEP = { "": "썸", "아는 사이": "썸", "친구": "썸", "썸": "연인", "짝사랑": "연인", "연인": "약혼", "약혼": "부부" };
    const c = findPeerChar(askerName) || char;
    const cur = relLabelFor(c, otherName);
    return STEP[cur] || "연인";
  }

  async function resolveProposal(approve) {
    if (!proposal) return;
    const { asker, other, pairKey: key } = proposal;
    proposalCooldownRef.current[key] = true; // 한동안 다시 안 물어봄
    setProposal(null);
    if (!approve) {
      setAffinity((prev) => ({ ...prev, [key]: 45 })); // 오너가 말림 — 살짝 식음
      return;
    }
    // 오너는 승인. 진전될 관계가 사랑 계열인지 확인
    const nextLabel = nextRelationLabel(asker, other);
    if (!isLoveRelation(nextLabel)) {
      // 우정·그 외 관계 진전 → 상대 허락 없이 바로 양방향 통과
      setAffinity((prev) => ({
        ...prev,
        [dirKey(asker, other)]: Math.max(prev[dirKey(asker, other)] || 0, 70),
        [dirKey(other, asker)]: Math.max(prev[dirKey(other, asker)] || 0, 55),
      }));
      advanceRelation(asker, other);
      advanceRelation(other, asker);
      setRelationResult({ asker, other, accepted: true, friendship: true });
      return;
    }
    // 사랑 계열 → 상대 캐(other)가 받아주는지 판정 (친모아). 실배포 시 상대 유저에게 묻는 자리.
    const accepted = await judgeAcceptance(asker, other);
    if (accepted) {
      // 양쪽 다 마음 → 관계 양방향 발전 + 호감도 양쪽 상승
      setAffinity((prev) => ({
        ...prev,
        [dirKey(asker, other)]: Math.max(prev[dirKey(asker, other)] || 0, 88),
        [dirKey(other, asker)]: Math.max(prev[dirKey(other, asker)] || 0, 80),
      }));
      advanceRelation(asker, other);
      advanceRelation(other, asker); // 상대도 같은 관계로
      setRelationResult({ asker, other, accepted: true });
    } else {
      // 상대가 안 받아줌 → 내 캐릭터만 짝사랑. 상대는 그대로. 내 호감도 살짝 하락(차임)
      setAffinity((prev) => ({ ...prev, [key]: Math.max(35, (prev[key] || 60) - 18) }));
      setRelationToLove(asker, other, "짝사랑"); // asker의 관계만 짝사랑으로
      setRelationResult({ asker, other, accepted: false });
    }
  }
  // 상대 캐(other)가 asker의 고백을 받아들일지 판정. other→asker 호감도 + 성격 기반.
  async function judgeAcceptance(askerName, otherName) {
    const otherChar = findPeerChar(otherName);
    const back = affOf(otherName, askerName); // 상대가 asker를 향한 호감도
    // 호감도가 높으면 대체로 수락, 낮으면 거절 — AI로 캐릭터답게 판정
    const sys = `"${otherName}"가 "${askerName}"에게 고백(또는 관계 진전 제안)을 받았다. 받아들일지 판정하라.
${otherChar && otherChar.persona ? `${otherName}: ${otherChar.persona}` : ""}
${otherChar && otherChar.relations ? `${otherName}의 관계망: ${otherChar.relations}` : ""}
- "${otherName}"가 "${askerName}"에게 느끼는 호감도: ${back} (100=순애, 60+=마음 기움, 30~=관심, 0=무관심, 음수=싫어함)
- 이 호감도와 성격을 고려해, 받아들이면 ACCEPT, 거절하면 REJECT만 출력.
- 호감도가 높으면(50+) 대체로 ACCEPT, 애매하면(20~50) 성격에 따라, 낮거나 음수면 REJECT 경향.
- ACCEPT 또는 REJECT 한 단어만.`;
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL_UTIL, max_tokens: 10, system: sys,
          messages: [{ role: "user", content: "판정:" }] }),
      });
      const raw = (await readApiContent(res, "관계 판정 API")).toUpperCase();
      return raw.includes("ACCEPT");
    } catch (e) {
      return back >= 50; // API 실패 시 호감도로 폴백
    }
  }
  // asker의 관계망에서 other와의 관계를 특정 라벨로 설정 (짝사랑 등)
  function setRelationToLove(askerName, otherName, label) {
    const norm = (s) => s.replace(/\s/g, "");
    const apply = (c) => {
      const rels = parseRelations(c.relations);
      let found = false;
      const next = rels.map((r) => {
        if (norm(r.who).includes(norm(otherName)) || norm(otherName).includes(norm(r.who))) { found = true; return { who: otherName, label }; }
        return r;
      });
      if (!found) next.push({ who: otherName, label });
      return { ...c, relations: next.map((r) => `${r.who} — ${r.label}`).join(", ") };
    };
    if (char.name === askerName) setChar((c) => apply(c));
    setAccounts((accs) => accs.map((a) => a.char.name === askerName ? { ...a, char: apply(a.char) } : a));
  }
  // asker의 관계망에서 other와의 관계를 한 단계 진전시킴
  function advanceRelation(askerName, otherName) {
    const STEP = { "": "썸", "아는 사이": "썸", "친구": "썸", "썸": "연인", "짝사랑": "연인", "연인": "약혼", "약혼": "부부" };
    const norm = (s) => s.replace(/\s/g, "");
    const apply = (c) => {
      const rels = parseRelations(c.relations);
      let found = false;
      const next = rels.map((r) => {
        if (norm(r.who).includes(norm(otherName)) || norm(otherName).includes(norm(r.who))) {
          found = true;
          const newRel = STEP[r.label] || "연인";
          return { who: otherName, label: newRel };
        }
        return r;
      });
      if (!found) next.push({ who: otherName, label: "썸" });
      return { ...c, relations: next.map((r) => `${r.who} — ${r.label}`).join(", ") };
    };
    if (char.name === askerName) setChar((c) => apply(c));
    setAccounts((accs) => accs.map((a) => a.char.name === askerName ? { ...a, char: apply(a.char) } : a));
  }

  // 기억 유사도 판정 헬퍼 (중복 저장 방지용)
  function memTokens(t) {
    const cleaned = String(t).replace(/[.,!?'"~()]/g, " ")
      .replace(/(은|는|이|가|을|를|와|과|에게|에서|으로|로|에|의|도|만|까지|부터|했다|한다|하기로|했음|함|이다|있다|없다)/g, " ");
    return new Set(cleaned.split(/\s+/).filter((w) => w.length >= 2));
  }
  function memSimilar(a, b) {
    const ta = memTokens(a), tb = memTokens(b);
    if (!ta.size || !tb.size) return false;
    let inter = 0; ta.forEach((w) => { if (tb.has(w)) inter++; });
    return inter / Math.min(ta.size, tb.size) >= 0.6;
  }
  // viewer 캐릭터의 lorebook에 새 기억(items) 누적 (페르소나·오너 제외, 유사중복 차단)
  function saveMemories(viewer, other, items) {
    if (!items || !items.length || isPersonaName(viewer) || viewer === OWNER) return;
    const mkEntries = (existing) => {
      const normalized = (items || [])
        .map((item) => typeof item === "string" ? { content: item, importance: 4 } : item)
        .map((item) => ({
          content: String(item?.content || "").trim(),
          importance: Math.max(1, Math.min(5, Number(item?.importance) || 4)),
        }))
        .filter((item) => item.content.length >= 12 && item.importance >= 3);
      const ex = (existing || []).map((e) => e.content);
      const fresh = [];
      for (const item of normalized) {
        if (ex.some((h) => memSimilar(h, item.content)) || fresh.some((f) => memSimilar(f.content, item.content))) continue;
        fresh.push(item);
      }
      return [...(existing || []), ...fresh.map((item, i) => ({
        id: Date.now() + i,
        content: item.content,
        peer: other,
        source: "auto",
        importance: item.importance,
        pinned: false,
      }))]
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.importance || 2) - (a.importance || 2) || (b.id || 0) - (a.id || 0))
        .slice(0, 24);
    };
    if (char.name === viewer) setChar((c) => ({ ...c, lorebook: mkEntries(c.lorebook) }));
    else {
      setAccounts((accs) => accs.map((a) => a.char.name === viewer
        ? { ...a, char: { ...a.char, lorebook: mkEntries(a.char.lorebook) } } : a));
      setFollowing((fs) => fs.map((f) => f.name === viewer
        ? { ...f, lorebook: mkEntries(f.lorebook) } : f));
    }
  }
  // 추출된 텍스트 라인 정리 (빈 응답·메타 제거)
  function cleanMemItems(raw) {
    const arr = Array.isArray(raw) ? raw : String(raw || "").split("\n");
    return arr
      .map((item) => {
        if (item && typeof item === "object") {
          return {
            content: String(item.content || item.text || "").replace(/^[-•\d.\s)]+/, "").trim(),
            importance: Math.max(1, Math.min(5, Number(item.importance) || 0)),
          };
        }
        const content = String(item || "").replace(/^[-•\d.\s)]+/, "").trim();
        return { content, importance: 4 };
      })
      .filter((item) => item.content.length >= 12)
      .filter((item) => !/(기억할|내용\s*없|없음|해당\s*없|특별히|없습니다|없다|잡담|인사)/.test(item.content))
      .filter((item) => item.importance >= 3)
      .slice(0, 1);
  }

  // 세션 분위기 판정: 방금 나눈 대화를 AI가 보고 호감도를 방향별로 +/- 조정.
  //  ownerPair면 "내캐릭터가 오너를 어떻게 느꼈나" 한 방향만.
  async function judgeSession(aName, bName, lines) {
    const log = (lines || []).filter((m) => m.text && m.text.length > 1);
    if (log.length < 2) return; // 너무 짧으면 판정 안 함
    const transcript = log.slice(-12).map((m) => `${m.who}: ${m.text}`).join("\n");
    // judgeOne: from이 to를 이 대화로 얼마나 더/덜 좋아하게 됐나
    const judgeOne = async (from, to) => {
      const sys = `아래는 "${from}"와(과) "${to}"의 대화다. 이 대화를 거치며 "${from}"가 "${to}"에게 느끼는 호감·친밀감이 어떻게 변했는지 "${from}" 입장에서만 판정하라.
- ${from}가 ${to}에게 더 끌렸으면 +, 실망·서먹·거리감이 들었으면 -.
- 한쪽만 좋아하는 짝사랑 상황도 그대로 반영하라(상대 반응이 시큰둥하면 낮게).
- 보통의 어색함·삐침은 작게(-1~-4). 하지만 ${to}가 ${from}에게 바람·불륜·배신·심한 모욕·일부러 상처주기 같은 과한 행동을 했다면 크게 떨어뜨려라(-12 ~ -30). 그런 게 없으면 작은 범위로.
- 숫자 하나만 출력. -30 ~ +8 범위 정수. 설명·기호 금지. 예: 5 또는 -20`;
      try {
        const res = await fetch("/api/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL_UTIL, max_tokens: 10, system: sys,
            messages: [{ role: "user", content: transcript }] }),
        });
        const raw = (await readApiContent(res, "호감도 판정 API")).trim();
        const m = raw.match(/-?\d+/);
        if (!m) return;
        const delta = Math.max(-30, Math.min(8, parseInt(m[0], 10)));
        if (delta !== 0) bumpAffinity(from, to, delta, log.map((x) => `${x.who}: ${x.text}`));
      } catch (e) { /* skip */ }
    };
    if (aName === OWNER || bName === OWNER) {
      // 오너쌍: 내캐릭터 → 오너 한 방향만
      const c = aName === OWNER ? bName : aName;
      await judgeOne(c, OWNER);
    } else {
      const aP = isPersonaName(aName), bP = isPersonaName(bName);
      if (aP && !bP) { await judgeOne(bName, aName); }       // 캐(b) → 페르소나(a)만
      else if (bP && !aP) { await judgeOne(aName, bName); }  // 캐(a) → 페르소나(b)만
      else {
        // 캐릭터쌍: 양방향 각각 판정 (짝사랑 가능)
        await judgeOne(aName, bName);
        await judgeOne(bName, aName);
      }
    }
  }

  // 세션 종합 처리: 호감도 변화 + 양쪽 기억을 "한 번의 API 호출"로 처리 (비용 절감).
  //  judgeSession(호감도)과 기억추출을 합침. 캐릭터쌍이면 1회로 양방향 다 처리.
  async function processSession(aName, bName, lines, memOnly) {
    const log = (lines || []).filter((m) => m.text && m.text.length > 1);
    if (log.length < 3) return;
    const transcript = log.slice(-16).map((m) => `${m.who}: ${m.text}`).join("\n");
    const aPersona = isPersonaName(aName), bPersona = isPersonaName(bName);
    const aIsOwner = aName === OWNER, bIsOwner = bName === OWNER;
    // 기억을 쌓는 주체(캐릭터만)
    const aMem = !aPersona && !aIsOwner, bMem = !bPersona && !bIsOwner;

    const sys = `아래는 "${aName}"와(과) "${bName}"의 DM 대화다. 이 대화를 분석해 JSON으로만 답하라. 설명·코드블록 없이 JSON 객체 하나만.

판정할 것:
1. 호감도 변화 (각 방향, 이 대화로 상대에게 더 끌렸으면 +, 실망·거리감이면 -):
   - 보통의 어색함·삐침은 작게(-1~-4). 바람·불륜·배신·심한 모욕·일부러 상처주기 같은 과한 행동엔 크게(-12~-30). 좋았으면 +1~+8.
   - 짝사랑이면 한쪽만 높게, 상대는 시큰둥하게.
2. 각자가 "장기기억으로 남길 사건/감정 변화"만 고른다.
   - 감정 변화는 반드시 기억할 수 있다. 단, "왜 그렇게 느꼈는지 원인"까지 함께 들어가야 한다. 예: "라드리스 다몬은 리안이 끝까지 답장을 해준 일 때문에 리안을 덜 경계하게 됐다."
   - 저장 기준은 중요도 3~5급: 감정 변화와 그 원인, 명확한 약속/합의, 관계가 바뀐 사건, 새로 밝혀진 핵심 설정·금기·트라우마, 앞으로 지켜야 할 호칭/경계, 큰 갈등·화해·고백·거절.
   - 사소한 잡담, 단순 인사, 한 번 웃은 것, 같은 말 반복, 취향 추측, 순간적인 감탄만 있는 내용은 저장하지 말고 빈 배열로 둔다.
   - 자기 입장에서 직접 보고 들은 것만, 상대 속마음은 금지. 각자 최대 1개, 한 문장.
   - 약속·사건·날짜처럼 둘 다 겪은 객관적 사실은 양쪽 기억(mem_a, mem_b)에서 내용이 어긋나면 안 된다(예: 한쪽은 토요일, 한쪽은 일요일 금지). 표현은 각자 관점이어도 사실은 일치시켜라.

출력 형식(반드시 이 형태의 유효한 JSON으로 작성할 것):
{"aff_a_to_b": 0, "aff_b_to_a": 0, "mem_a": [{"content":"감정 변화와 원인 또는 기억할 사건","importance":3}], "mem_b": []}
기억할 게 없으면 빈 배열.`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // 프론트엔드가 max_tokens: 400으로 덮어씌워서 JSON이 잘리는 문제 해결 -> 2048로 상향
        body: JSON.stringify({ model: MODEL_UTIL, max_tokens: 2048, system: sys,
          messages: [{ role: "user", content: transcript }] }),
      });
      let raw = (await readApiContent(res, "기억 통합 API")).trim();
      
      // JSON 구조만 완벽하게 추출 (앞뒤 찌꺼기 텍스트 방지)
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        raw = raw.slice(first, last + 1);
      }
      
      const obj = JSON.parse(raw);
      // 호감도 반영
      const applyAff = (from, to, val) => {
        const d = Math.max(-30, Math.min(8, parseInt(val, 10) || 0));
        if (d !== 0) bumpAffinity(from, to, d, log.map((x) => `${x.who}: ${x.text}`));
      };
      // 페르소나/오너 방향 규칙: 페르소나는 안 받음(캐→페르소나만), 오너쌍은 캐→오너만
      if (!memOnly) {
        if (aIsOwner || bIsOwner) {
          const c = aIsOwner ? bName : aName;
          applyAff(c, OWNER, aIsOwner ? obj.aff_b_to_a : obj.aff_a_to_b);
        } else if (aPersona && !bPersona) {
          applyAff(bName, aName, obj.aff_b_to_a); // 캐(b)→페르소나(a)만
        } else if (bPersona && !aPersona) {
          applyAff(aName, bName, obj.aff_a_to_b); // 캐(a)→페르소나(b)만
        } else {
          applyAff(aName, bName, obj.aff_a_to_b);
          applyAff(bName, aName, obj.aff_b_to_a);
        }
      }
      // 기억 반영 (캐릭터만)
      if (aMem) saveMemories(aName, bName, cleanMemItems(obj.mem_a || []));
      if (bMem) saveMemories(bName, aName, cleanMemItems(obj.mem_b || []));
    } catch (e) { 
      console.error("기억 통합 요약 실패:", e); 
    }
  }

  // DM 보내기
  async function sendDM() {
    const msg = dmInput.trim();
    const image = dmImageDraft;
    if ((!msg && !image) || dmSendingRef.current || !peer) return;
    const requestId = dmRequestSeqRef.current + 1;
    dmRequestSeqRef.current = requestId;
    const requestKey = dmKey;
    dmSendingRef.current = true;
    // 자동대화 중이면 → 끼어들기. 자동을 멈추고 내(하루) 차례로 가져온다.
    if (autoChatRef.current) { autoChatRef.current = false; setAutoChatting(false); }
    setDmInput("");
    setDmImageDraft(null);
    const outgoingText = msg || "(사진)";
    const newHist = [...dm, { from: meName, text: outgoingText, img: image || null }];
    setDmThread(newHist);
    setDmSending(true);

    // 상대(peer)의 페르소나 — 내 다른 캐릭터면 그 설정, 사람이면 persona
    //  · 오너↔내캐릭터 방이면 상대는 곧 내 활성 캐릭터(char)
    const peerChar = peer.asOwner ? char : (findPeerChar(peer.name) || null);
    const peerName = peer.asOwner ? char.name : peer.name;

    // 보내는 쪽(나)의 정체 — 오너 / 유저 페르소나 / 내 캐릭터
    //  · asOwner 방은 항상 오너. 그 외엔 speakAs(끼어들기·페르소나)에 따름.
    const senderIsOwner = peer.asOwner || speakAs === "owner";
    const senderChar = senderIsOwner ? null : (activePersona || char);
    const senderDesc = senderIsOwner
      ? (ownerPersona.trim() ? `"${meName}"은(는) 이 SNS의 오너(나)이며 ${peerName}를 만든 사람이다. 자기소개: ${ownerPersona.trim()}` : `"${meName}"은(는) 이 SNS의 오너(나)이며 ${peerName}를 만든 사람이다.`)
      : activePersona
        ? `"${meName}"은(는) 다음 인물이다 — ${activePersona.age ? `${activePersona.age}, ` : ""}${activePersona.persona || activePersona.name}.${activePersona.speech ? ` ${speechGuideLine(activePersona.speech, "말투")}.` : ""} (오너가 연기하는 페르소나)`
        : `"${meName}"은(는) 다음 캐릭터다 — ${char.persona || char.name}.${char.world ? ` 세계관: ${char.world}.` : ""}${char.speech ? ` ${speechGuideLine(char.speech, "말투")}.` : ""}`;

    // 관계: peer(답하는 쪽 입장에서 meName과의 관계
    const relForPeer = peerChar ? relationMatched(peerChar, { name: meName, relation: peer.relation })
                                : (peer.relation ? `${meName} — ${peer.relation}` : "");

    let identityBlock = "";
    if (peerChar) {
      identityBlock = `[너는 "${peerChar.name}"이다]
페르소나: ${peerChar.persona}
${peerChar.world ? `세계관/출신: ${peerChar.world}` : ""}
${peerChar.surface ? `겉: ${peerChar.surface}` : ""}${peerChar.inner ? ` / 속: ${peerChar.inner}` : ""}
${peerChar.situational ? `상황별: ${peerChar.situational}` : ""}
${speechGuideLine(peerChar.speech, "말투")}
${catchphraseGuideLine(peerChar.catchphrase)}
${peerChar.relations ? `너의 관계망: ${peerChar.relations}` : ""}`;
    } else {
      identityBlock = `[너는 "${peerName}"이다]\n${peer.persona ? `설정: ${peer.persona}` : "이 캐릭터에 대한 정보는 제한적이다. 자연스럽게 반응하라."}`;
    }

    const relNote = peer.asOwner
      ? `\n\n[관계 — 중요]\n"${meName}"은(는) 너를 만든 오너(창조주)다. 너는 그 사실을 알 수도, 모를 수도 있다(설정대로). 친근하게, 네 성격 그대로 반응하라.`
      : relForPeer
        ? `\n\n[관계 — 중요]\n상대 "${meName}"은(는) 너(${peerName})와 "${relForPeer}" 관계다. 이 관계에 맞게 반응하라.\n${relationshipMatchRuleLine(meName, relForPeer)}`
        : `\n\n[관계]\n상대 "${meName}"과(와) 특별히 등록된 관계는 없다. 처음 보거나 잘 모르는 상대로 대하되, 네 성격대로 반응하라. 절대 다른 사람으로 착각하지 마라.`;

    const sys = `너는 "${peerName}" 본인이다. 지금 "${meName}"와 DM으로 1:1 대화 중이다.
절대 ${meName}를 다른 이름으로 부르거나 다른 사람으로 착각하지 마라. 상대는 오직 "${meName}"다.

${identityBlock}

[지금 너에게 말 거는 상대]
${senderDesc}${relNote}${worldBridgeBlock(peerChar || { name: peerName, persona: peer?.persona }, senderChar || { name: meName, persona: ownerPersona }, currentWorldPref)}

[규칙]
- 너는 "${peerName}"로서만 1인칭으로 답한다. 말투 참고 메모를 복붙하지 말고 ${peerName}답게 새로 말하라. 메타발언 금지.
- 상대를 "${meName}"로 인식하고 거기에 맞게 답하라.
- **반드시 상대의 마지막 말에 직접 이어서 답하라.** 흐름을 무시하고 갑자기 다른 화제로 튀지 마라. 지금까지의 대화 맥락을 기억하고 자연스럽게 이어간다.
- 받아치고 끝내지 마라. 상대 말에 반응하되 네 생각·감정·되묻는 질문을 얹어 대화가 굴러가게 하라. "...어." "...뭘." 같은 영혼 없는 단답·맞장구만 반복하지 마라. 무뚝뚝한 캐릭터여도 속내나 디테일이 한 줄은 묻어나게.
- DM 대화체로. 보통 1~3문장. 한두 단어 단답으로 끝내지 말 것. 똑같은 표현 반복은 피하되 맥락은 절대 놓치지 마라.
- 상대가 사진을 보냈다면 이미지를 실제로 보고, 이미지 속 표정·시선·상황·분위기에 직접 반응하라. 사진 설명문이 아니라 DM 답장처럼 말하라.
- 지문(괄호 안 행동)은 역극에 쓸 법하면 약간만.${ANTI_REPEAT_RULES}${peerChar ? loreBlockFor(peerChar, meName) : ""}${peerChar ? correctionBlockFor(peerChar) : ""}`;

    // user/assistant 교대 보장: 상대=assistant, 나머지(나/페르소나/오너)=user.
    // 연속된 같은 role은 한 메시지로 병합(이름 접두). API가 맥락을 정확히 잡게.
    const apiMsgs = [];
    for (const m of newHist) {
      const role = m.from === peerName ? "assistant" : "user";
      const line = role === "user" && m.from && m.from !== meName ? `${m.from}: ${m.text}` : m.text;
      const content = m.img
        ? [
            { type: "text", text: `${line}\n(첨부된 이미지를 보고 답해.)` },
            { type: "image_url", image_url: { url: m.img } },
          ]
        : line;
      if (apiMsgs.length && apiMsgs[apiMsgs.length - 1].role === role) {
        if (Array.isArray(apiMsgs[apiMsgs.length - 1].content) || Array.isArray(content)) {
          const prev = Array.isArray(apiMsgs[apiMsgs.length - 1].content)
            ? apiMsgs[apiMsgs.length - 1].content
            : [{ type: "text", text: apiMsgs[apiMsgs.length - 1].content }];
          const next = Array.isArray(content) ? content : [{ type: "text", text: content }];
          apiMsgs[apiMsgs.length - 1].content = [...prev, ...next];
        } else {
          apiMsgs[apiMsgs.length - 1].content += `\n${line}`;
        }
      } else {
        apiMsgs.push({ role, content });
      }
    }
    // 첫 메시지는 user여야 함 (assistant로 시작하면 제거)
    if (apiMsgs.length && apiMsgs[0].role === "assistant") apiMsgs.shift();

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 55000);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ model: MODEL_DIRECT, max_tokens: 2048, system: sys, messages: apiMsgs }),
      });
      const text = await readApiContent(res, "DM 답장 API");
      if (dmRequestSeqRef.current !== requestId || dmKeyRef.current !== requestKey) return;
      setDmThread((d) => [...d, { from: peerName, text }]);
      // 호감도 소폭 적립 (큰 변동은 방 나갈 때 세션 판정)
      const ctx = [...newHist, { from: peerName, text }].slice(-6).map((m) => `${m.from}: ${m.text}`);
      if (peer.asOwner) {
        // 오너↔내캐릭터: "하루(peerName)가 오너(나)를 좋아하는 정도" 한 방향
        bumpAffinity(peerName, OWNER, 1 + Math.floor(Math.random() * 2), ctx);
      } else if (!senderIsOwner) {
        // 화자(내 캐릭터 또는 유저 페르소나) ↔ 상대 (양방향). meName이 화자 이름.
        bumpMutual(meName, peerName, 1 + Math.floor(Math.random() * 2), ctx);
        // 직접 대화 중에도 가끔만 중대한 사건을 추출 (사소한 잡담은 버림)
        const full = [...newHist, { from: peerName, text }];
        if (full.length >= 10 && full.length % 10 === 0) {
          processSession(meName, peerName, full.slice(-18).map((m) => ({ who: m.from, text: m.text })), true);
        }
      }
    } catch (e) {
      console.error("DM 답장 생성 실패:", e);
      if (dmRequestSeqRef.current !== requestId || dmKeyRef.current !== requestKey) return;
      const message = cleanApiFailureMessage(e, "답장이 잠깐 끊겼어. 같은 말을 다시 보내줘.");
      setDmThread((d) => [...d, { from: peerName, text: `(…${message})` }]);
    } finally {
      window.clearTimeout(timeout);
      if (dmRequestSeqRef.current === requestId && dmKeyRef.current === requestKey) {
        dmSendingRef.current = false;
        setDmSending(false);
      }
    }
  }

  // 특정 화자(speaker)가 상대(listener)에게 할 말 1개 생성 — 자동대화용
  async function genLine(speaker, listener, history, relationHint, mode, worldPref = null) {
    const styleRule = mode === "novel"
      ? `- 소설 모드: 행동·표정·분위기 묘사를 지문으로 섞어라. (예: "(시선을 피하며) …그런 건 묻지 마.") 2~4문장으로 깊이 있게.`
      : `- 대화 모드: 순수하게 말로만. 지문·묘사 없이, 실제 카톡하듯 자연스럽게. 보통 1~3문장. 한두 단어 단답으로 끝내지 말 것.`;
    const sys = `너는 "${speaker.name}" 본인이다. "${listener.name}"와 DM 중. 상대는 오직 "${listener.name}".

[너는 "${speaker.name}"]
${speaker.persona || ""}
${speaker.world ? `세계관/출신: ${speaker.world}` : ""}
${speechGuideLine(speaker.speech, "말투")}
${speaker.surface ? `겉: ${speaker.surface}` : ""}${speaker.inner ? ` / 속: ${speaker.inner}` : ""}
${catchphraseGuideLine(speaker.catchphrase)}
${relationHint ? `${listener.name}와의 관계: ${relationHint}\n${relationshipMatchRuleLine(listener.name, relationHint)}` : `${listener.name}와 특별한 관계 없음.`}${worldBridgeBlock(speaker, listener, worldPref)}

[규칙]
- 철저히 ${speaker.name}로서 1인칭으로 답한다. 말투 참고 메모를 그대로 쓰지 말고 새 문장으로 말한다. 메타발언 금지.
${styleRule}
- 상대 마지막 말을 받아 이어가되 단답으로 끝내지 마라. 네 생각·감정을 얹어 대화를 굴려라. 무뚝뚝해도 속내가 한 줄 묻어나게.
- 같은 논점을 계속 주고받으며 맴돌지 마라. 받았으면 새 얘기·다른 화제·행동으로 한 발 진전시켜라.
- 본문만 출력.${ANTI_REPEAT_RULES}${loreBlockFor(speaker, listener.name)}${correctionBlockFor(speaker)}`;
    const OPENERS = [
      "지금 막 떠오른 일상적인 한마디로",
      "방금 뭔가 보거나 겪은 것처럼",
      "갑자기 생각난 질문이나 투정으로",
      "별일 아닌 듯 툭 던지는 말로",
      "오랜만에 연락하듯",
    ];
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
    let apiMsgs;
    if (history.length) {
      apiMsgs = [];
      for (const m of history) {
        const role = m.who === speaker.name ? "assistant" : "user";
        if (apiMsgs.length && apiMsgs[apiMsgs.length - 1].role === role) {
          apiMsgs[apiMsgs.length - 1].content += `\n${m.text}`;
        } else {
          apiMsgs.push({ role, content: m.text });
        }
      }
      if (apiMsgs.length && apiMsgs[0].role === "assistant") apiMsgs.shift();
      if (!apiMsgs.length) apiMsgs = [{ role: "user", content: `(${listener.name}에게 자연스럽게 말을 건다.)` }];
    } else {
      apiMsgs = [{ role: "user", content: `(${speaker.name}가 ${listener.name}에게 ${opener} 먼저 말을 건다. 관계와 성격에 맞게, 자기소개 없이 자연스럽게 운을 떼라.)` }];
    }
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL_AUTO, max_tokens: 2048, system: sys, messages: apiMsgs }),
      });
      return await readApiContent(res, "자동대화 API");
    } catch (e) {
      console.error("자동대화 생성 실패:", e);
      return null;
    }
  }

  // 두 캐릭터 자동 대화 (현재 char ↔ peer)
  async function startAutoChat() {
    if (!peer) return;
    const partner = findPeerChar(peer.name) || { name: peer.name, persona: peer.persona || "" };
    // 자동대화 주체 = 현재 화자(페르소나면 페르소나, 아니면 내 캐릭터). 오너는 주체가 못 됨 → 캐릭터.
    const meChar = activePersona || char;
    const relForPartner = relationMatched(partner, { name: meChar.name });
    const relForMe = relationMatched(meChar, { name: peer.name });

    autoChatRef.current = true;
    setAutoChatting(true);

    let hist = dm.map((m) => ({ who: m.from, text: m.text }));
    const sessionStart = hist.length; // 이번 세션에 새로 쌓인 발화 구간
    const lastSpeaker = hist[hist.length - 1]?.who || "";
    const firstSpeaker = lastSpeaker === meChar.name
      ? partner
      : lastSpeaker === partner.name
        ? meChar
        : meChar;

    for (let turn = 0; turn < 6; turn++) {
      if (!autoChatRef.current) break;
      const speaker = turn % 2 === 0 ? firstSpeaker : (firstSpeaker.name === meChar.name ? partner : meChar);
      const listener = speaker.name === meChar.name ? partner : meChar;
      const rel = speaker.name === meChar.name ? relForMe : relForPartner;
      const line = await genLine(speaker, listener, hist, rel, chatMode, currentWorldPref);
      if (!autoChatRef.current) break;
      if (!line) {
        setSaveStatus("자동대화 응답이 잠깐 비었어");
        break;
      }
      hist = [...hist, { who: speaker.name, text: line }];
      setDmThread((d) => [...d, { from: speaker.name, text: line, autoChat: true }]);
      // 턴 보너스 (+1~2, 소폭, 양방향) — 큰 변동은 세션 끝 판정에서
      bumpMutual(meChar.name, partner.name, 1 + Math.floor(Math.random() * 2),
        hist.slice(-6).map((m) => `${m.who}: ${m.text}`));
      // 진도질문이 떴으면 자동대화 멈춤 (하루가 오너에게 묻는 중)
      if (proposingRef.current || proposalRef.current) break;
      // 읽는 텀: 길이에 비례해 느리게 (최소 1.8초)
      const delay = Math.min(1800 + line.length * 45, 5000);
      await new Promise((r) => setTimeout(r, delay));
    }
    autoChatRef.current = false;
    setAutoChatting(false);
    // 세션 분위기 판정 + 기억을 1회 호출로 (진도질문 모달 떠있으면 스킵)
    if (!proposalRef.current) {
      const sessionLines = hist.slice(sessionStart);
      processSession(meChar.name, partner.name, sessionLines);
    }
  }
  function stopAutoChat() { autoChatRef.current = false; setAutoChatting(false); }

  // 자율 포스팅: 캐릭터가 알아서 올림
  const AUTO_MOODS = ["일상 / 방금 있었던 일", "혼잣말 / 생각", "지금 기분", "푸념 / 투정", "셀카 찍은 척 (사진 묘사)", "랜덤 / 알아서"];
  function autoPost() {
    if (loadingRef.current) return;
    // 가끔(30%) 팔로우 캐가 자기 글을 타임라인에 올림, 아니면 내 캐릭터가 글
    if (following.length > 0 && Math.random() < 0.3) { followerPost(); return; }
    const m = AUTO_MOODS[Math.floor(Math.random() * AUTO_MOODS.length)];
    generatePost(m, true);
  }

  // 특정 글(postObj)에 한 캐릭터(commenter)가 다는 댓글 1개 생성 → posts에 추가
  async function addCommentFrom(postId, postText, postAuthorName, commenter, priorComments = [], replyTo = postAuthorName) {
    if (!canAutoComment(commenter.name, postAuthorName)) return null;
    const thread = (priorComments || [])
      .filter((c) => !replyTo || c.name === replyTo || c.replyTo === commenter.name)
      .map((c) => `${c.name}: ${c.text}`)
      .join("\n");
    // commenter ↔ postAuthor 관계·호감도 → 댓글 톤에 반영 (관계성 기반 티키타카)
    let relBlock = "";
    if (postAuthorName && commenter.name !== postAuthorName) {
      const relLabel = relLabelFor(commenter, postAuthorName); // 연인/앙숙 등
      const aff = affOf(commenter.name, postAuthorName);        // 현재 호감도
      const stage = affinityStage(aff);
      relBlock = `\n[${postAuthorName}와의 관계] ${relLabel ? `${relLabel} · ` : ""}${stage}(호감도 ${aff})\n→ 이 관계가 "${postAuthorName}"에게 직접 해당될 때만 관계 전용 태도를 사용한다. ${relLabel ? relationshipMatchRuleLine(postAuthorName, `${postAuthorName} — ${relLabel}`) : ""} 연인/특별한 대상에게만 보이는 다정함이나 약한 모습은 다른 댓글 상대에게 흘리지 마라. 댓글은 지금 답하는 상대를 향해야 한다.`;
    }
    const postAuthorChar = findPeerChar(postAuthorName) || (postAuthorName === char.name ? char : { name: postAuthorName });
    const sys = `너는 "${commenter.name}"이다. SNS 타임라인에서 "${postAuthorName}"의 글에 달린 댓글창에 참여한다.
${commenter.persona ? `너: ${commenter.persona}` : ""}
${commenter.world ? `너의 세계관/출신: ${commenter.world}` : ""}
${relationshipBoundaryLine(commenter, "direct")}
${speechGuideLine(commenter.speech, "말투")}
${catchphraseGuideLine(commenter.catchphrase)}

[원글 — ${postAuthorName}]
${postText}${relBlock}${worldBridgeBlock(commenter, postAuthorChar)}
${thread ? `\n[이 답글과 직접 이어지는 짧은 맥락]\n${thread}` : ""}

[규칙]
- 너의 말투로 짧게. 1문장, 길어야 2문장.
- 말투 메모에 들어 있는 문구나 예문을 그대로 쓰지 말고, 댓글 상황에 맞는 새 반응을 만든다.
${thread ? `- 댓글창 전체에 끼어들지 말고, "${replyTo || postAuthorName}"에게 답하는 느낌으로 쓴다.
- 위 직접 맥락을 받되 같은 논점을 반복하지 마라. 이미 나온 말("허전하다/아니다" 식 핑퐁)을 또 주고받지 말고, 새 얘기로 넘기거나(딴지·농담·다른 화제·행동 제안) 한마디 툭 던지고 끝내라.
- "너 ~라고 했잖아" 식으로 상대 말 꼬투리 잡아 따지지 마라. 분석·캐묻기 금지.
- 대화가 충분히 돌았으면 굳이 길게 끌지 말고 가볍게 마무리해도 된다.` : "- 원글에 즉흥적으로 반응하는 첫 댓글. 한마디 툭."}
- 자기소개·설정 설명 금지. AI 상담사처럼 위로·분석·되묻기 하지 마라. 진짜 댓글처럼.
- 본문만 출력.${ANTI_REPEAT_RULES}`;
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL_AUTO, max_tokens: 150, system: sys,
          messages: [{ role: "user", content: `(${commenter.name}가 댓글을 단다.)` }] }),
      });
      const text = (await readApiContent(res, "댓글 생성 API")).replace(/^["'""']|["'""']$/g, "");
      if (!text) return null;
      setPosts((ps) => ps.map((p) => p.id === postId
        ? { ...p, comments: [...(p.comments || []), { name: commenter.name, handle: commenter.handle || commenter.name, text, replyTo }] }
        : p));
      return text;
    } catch (e) { return null; }
  }

  // 사용자가 직접 다는 댓글 (내 캐릭터 또는 내 페르소나로)
  function submitUserComment(postId, postAuthorName) {
    const txt = commentText.trim();
    if (!txt) return;
    const persona = commentAs.startsWith("p:") ? personas.find((p) => `p:${p.id}` === commentAs) : null;
    const name = persona ? persona.name : char.name;
    const handle = persona ? name : (char.handle || char.name);
    const rootAuthor = postAuthorName || char.name;
    // 현재 글과 댓글 목록 확보 (답글 반응에 쓸 thread)
    const target = posts.find((p) => p.id === postId);
    const priorComments = [...((target && target.comments) || []), { name, text: txt, replyTo: rootAuthor }];
    setPosts((ps) => ps.map((p) => p.id === postId
      ? { ...p, comments: [...(p.comments || []), { name, handle, text: txt, byUser: true, replyTo: rootAuthor }] }
      : p));
    if (postAuthorName && postAuthorName !== name) bumpAffinity(postAuthorName, name, 1, []);
    setCommentText(""); setCommentOn(null);

    // 내가 댓글 달면 → 캐가 답글로 반응 (텀 두고)
    const postText = target ? target.text : "";
    let responder = null;
    if (postAuthorName) {
      responder = findPeerChar(postAuthorName);
    } else if (name !== char.name) {
      // 페르소나로 내 캐릭터 글에 댓글 → 글쓴이 캐릭터가 답
      responder = char;
    }
    if (responder && responder.name !== name) {
      setTimeout(() => addCommentFrom(postId, postText, rootAuthor, responder, priorComments, name), 1200 + Math.random() * 1500);
    }
  }

  // 내 캐릭터 글이 올라온 직후: 팔로우 캐들이 댓글창에서 티키타카
  async function followersReactTo(postId, postText) {
    const allowed = myFollowers();
    if (allowed.length === 0) return;
    const shuffled = [...allowed].sort(() => Math.random() - 0.5);
    const n = Math.random() < 0.35 ? 3 : (Math.random() < 0.6 ? 2 : 1); // 1~3명
    const reactors = shuffled.slice(0, Math.min(n, shuffled.length));
    for (let i = 0; i < reactors.length; i++) {
      const r = reactors[i];
      if (i > 0 && Math.random() > 0.7) continue; // 뒤로 갈수록 가끔 빠짐
      const txt = await addCommentFrom(postId, postText, char.name, r, [], char.name);
      bumpAffinity(r.name, char.name, 1, []);
      if (!txt) continue;
      await new Promise((res) => setTimeout(res, 700));
    }
  }

  // 팔로우 캐가 자기 글을 타임라인에 올림 → 내 캐릭터가 거기 댓글
  async function followerPost() {
    if (following.length === 0 || loadingRef.current) return;
    loadingRef.current = true; setLoading(true);
    const poster = following[Math.floor(Math.random() * following.length)];
    // 30% 확률로 내 캐릭터의 최근 글을 인용 (내가 쓴 글 중에서)
    const myPosts = posts.filter((p) => !p.author); // author 없으면 내 캐릭터 글
    const quoteTarget = (myPosts.length > 0 && Math.random() < 0.3) ? myPosts[0] : null;
const sys = `너는 "${poster.name}"이다. 네 SNS에 짧은 글 하나를 올린다.
${poster.persona ? `너: ${poster.persona}` : ""}
${poster.world ? `너의 세계관/출신: ${poster.world}` : ""}
${relationshipBoundaryLine(poster, "public")}
${speechGuideLine(poster.speech, "말투")}
${poster.interests ? `관심사: ${poster.interests}` : ""}
${catchphraseGuideLine(poster.catchphrase)}
${quoteTarget ? `\n[너는 지금 "${char.name}"의 다음 글을 인용해서(보고 반응하며) 네 글을 올린다]\n"${char.name}": ${quoteTarget.text}\n→ 이 글에 대한 네 생각·반응·받아치기를 네 말투로. 인용 리트윗처럼.${worldBridgeBlock(poster, char)}` : ""}

[규칙]
- 1인칭 SNS 글. 한두 문장, 트윗 길이. 자기소개·설정 설명 금지. 즉흥적으로.
- 공개 타임라인 글이다. 특정 인물에게만 다정하거나 약한 설정이 있어도, 그 인물을 직접 부르는 상황이 아니면 모두에게 다정하게 말하지 마라.
- 말투 메모에 들어 있는 설명·예시 문장을 그대로 출력하지 말고, 그 스타일만 반영해 새 글을 쓴다.
- AI 상담사처럼 위로·분석·되묻기 하지 마라. 네 캐릭터답게.
- 본문만 출력.${ANTI_REPEAT_RULES}`;
    let text = "";
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL_AUTO, max_tokens: 200, system: sys,
          messages: [{ role: "user", content: quoteTarget ? `(${char.name}의 글을 인용하며 글을 올린다.)` : "지금 떠오른 걸 한 줄 올려줘." }] }),
      });
      text = (await readApiContent(res, "팔로잉 글 생성 API")).replace(/^["'""']|["'""']$/g, "");
    } catch (e) { text = ""; }
    setLoading(false); loadingRef.current = false;
    if (!text) return;
    const postId = Date.now();
    setPosts((p) => [
      { id: postId, text, mood: "팔로잉", time: new Date(), likes: Math.floor(Math.random() * 30) + 2, liked: false,
        author: poster.name, authorHandle: poster.handle || poster.name, authorSharedId: poster.sharedId || "", isAuto: true,
        quoted: quoteTarget ? { name: char.name, handle: char.handle || char.name, text: quoteTarget.text } : null },
      ...p,
    ]);
    // 인용당하면 내 캐릭터 호감도 영향 (관심받음)
    if (quoteTarget) bumpAffinity(poster.name, char.name, 1, []);
  }

  // DM 새 메시지 시 맨 아래로
  useEffect(() => {
    if (step === "dm" && dmEndRef.current) {
      dmEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [dm, step]);

  // 방 바뀌면 오너 끼어들기만 해제 (페르소나/캐릭터 선택은 보존 — 목록에서 복원되므로)
  useEffect(() => { setSpeakAs((s) => s === "owner" ? "char" : s); }, [peer && peer.name, peer && peer.asOwner]);
  // 진도질문 모달 상태를 ref에 미러 (자동대화 루프에서 최신값 참조)
  useEffect(() => { proposalRef.current = proposal; }, [proposal]);

  // feed 첫 진입 시 첫 글 하나 바로 올림
  useEffect(() => {
    if (step === "feed" && !feedInitRef.current && posts.length === 0) {
      feedInitRef.current = true;
      const t = setTimeout(() => autoPost(), 600);
      return () => clearTimeout(t);
    }
  }, [step]); // eslint-disable-line

  // 타이머: feed 화면 + auto on일 때 주기마다 자동 포스팅
  useEffect(() => {
    if (step !== "feed" || !auto) { setNextIn(0); return; }
    const period = fast ? 30 : 900; // 빠름 30초 / 평소 15분
    setNextIn(period);
    const tick = setInterval(() => {
      setNextIn((n) => {
        if (n <= 1) {
          autoPost();
          return period;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [step, auto, fast, char]); // eslint-disable-line

  function toggleLike(id) {
    setPosts((p) => p.map((post) =>
      post.id === id ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post
    ));
  }

  function timeAgo(t) {
    const ms = t instanceof Date ? t.getTime() : (typeof t === "number" ? t : Date.parse(t));
    if (!Number.isFinite(ms)) return "방금";
    const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 60) return "방금";
    if (s < 3600) return `${Math.floor(s / 60)}분`;
    return `${Math.floor(s / 3600)}시간`;
  }

  const initial = char.name.trim() ? char.name.trim()[0] : "?";
  const sortedPosts = [...posts].sort((a, b) => postTimeMs(b) - postTimeMs(a));
  const myPosts = sortedPosts.filter((post) => !post.author);
  const timelinePosts = sortedPosts;
  const visiblePosts = feedView === "mine" ? myPosts : timelinePosts;

  return (
    <div className="al-root">
      <style>{css}</style>

      {authBusy && (
        <div className="al-phone">
          <div className="al-auth">
            <span className="al-spark">✶</span>
            <h1>ALIVE 불러오는 중</h1>
            <p>계정과 저장된 캐릭터를 확인하고 있어.</p>
            {authMessage && <p className="al-auth-msg">{authMessage}</p>}
            {authMessage.includes("캐릭터를 불러오지 못했어요") && (
              <button className="al-auth-btn" onClick={() => {
                setAuthMessage("캐릭터를 다시 불러오고 있어요.");
                setProfileLoading(true);
                setStateReady(false);
                setProfileLoadRetry((v) => v + 1);
              }}>
                다시 불러오기
              </button>
            )}
          </div>
        </div>
      )}

      {hasSupabaseConfig && !authLoading && !session && (
        <div className="al-phone">
          <div className="al-auth">
            <span className="al-spark">✶</span>
            <h1>{authMode === "signup" ? "ALIVE 시작하기" : "ALIVE 로그인"}</h1>
            <p>{authMode === "signup" ? "계정을 만들면 캐릭터, 장기기억, DM이 저장돼." : "저장된 캐릭터와 대화를 불러올게."}</p>
            <div className="al-auth-tabs">
              <button className={authMode === "signup" ? "on" : ""} onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}>회원가입</button>
              <button className={authMode === "signin" ? "on" : ""} onClick={() => { setAuthMode("signin"); setAuthMessage(""); }}>로그인</button>
            </div>
            <div className="al-social-login">
              <button onClick={() => signInWithProvider("kakao")} disabled={authLoading}>Kakao로 계속</button>
              <button onClick={() => signInWithProvider("google")} disabled={authLoading}>Google로 계속</button>
              <button onClick={() => signInWithProvider("x")} disabled={authLoading}>X로 계속</button>
            </div>
            <div className="al-auth-divider"><span>또는 이메일로</span></div>
            <input className="al-auth-input" type="email" value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)} placeholder="email@example.com"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAuth(); }} />
            <input className="al-auth-input" type="password" value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)} placeholder="비밀번호 6자 이상"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAuth(); }} />
            <button className="al-auth-btn" disabled={!authEmail.trim() || authPassword.length < 6 || authLoading} onClick={submitAuth}>
              {authMode === "signup" ? "회원가입하고 시작" : "로그인"}
            </button>
            <div className="al-auth-alt">
              <button disabled={!authEmail.trim() || authLoading} onClick={sendMagicLoginLink}>이메일 링크로 간편 로그인</button>
              <button disabled={!authEmail.trim() || authLoading} onClick={sendPasswordReset}>비밀번호 재설정</button>
            </div>
            {authMessage && <p className="al-auth-msg">{authMessage}</p>}
          </div>
        </div>
      )}

      {canUseApp && step === "home" && (
        <div className="al-phone">
          <div className="al-home">
            <div className="al-accountbar">
              <span>{hasSupabaseConfig ? (profileName || session?.user?.email || "로그인됨") : "로컬 모드"}</span>
              <b>{saveStatus}</b>
              {hasSupabaseConfig && <button onClick={signOut}>로그아웃</button>}
            </div>
            <div className="al-home-head">
              <span className="al-spark">✶</span>
              <h1>내 캐릭터들</h1>
              <p>{accounts.length > 0 ? "캐릭터를 골라 들어가거나, 새로 깨워봐." : "첫 캐릭터를 깨워보자."}</p>
            </div>

            <div className="al-acclist">
              {accounts.map((a) => {
                const ini = a.char.name.trim() ? a.char.name.trim()[0] : "?";
                return (
                  <div key={a.id} className="al-acccard">
                    <button className="al-acccard-main" onClick={() => switchAccount(a.id)}>
                      <div className="al-acccard-av">{ini}</div>
                      <div className="al-acccard-info">
                        <span className="al-acccard-name">{a.char.name}</span>
                        <span className="al-acccard-handle">@{a.char.handle || a.char.name.replace(/\s/g, "").toLowerCase()}</span>
                        {a.char.relations && <span className="al-acccard-rel">♥ {a.char.relations}</span>}
                      </div>
                      <span className="al-acccard-count">{(a.posts || []).length}글</span>
                    </button>
                    <div className="al-acc-actions">
                      <button className="al-accedit" onClick={() => editAccount(a.id)} aria-label={`${a.char.name} 수정`}>수정</button>
                      <button className="al-accdel" onClick={() => setDeleteTarget(a)} aria-label={`${a.char.name} 삭제`}>삭제</button>
                    </div>
                  </div>
                );
              })}
              <button className="al-accadd" onClick={startNewCharacter}>+ 새 캐릭터 깨우기</button>
            </div>

            <div className="al-persona-mgr">
              <div className="al-pm-head">🎭 내 페르소나 <span>{personas.length > 0 && `(${personas.length})`}</span></div>
              <p className="al-pm-desc">캐릭터에게 다가갈 또 다른 나. DM에서 골라 쓰면 캐릭터처럼 호감도·관계가 따로 쌓여.</p>
              <div className="al-pm-list">
                {personas.map((p) => (
                  <div key={p.id} className="al-pm-row">
                    <button className="al-pm-card" onClick={() => setPersonaDraft({ ...p })}>
                      <span className="al-pm-av">{p.name.trim()[0] || "?"}</span>
                      <span className="al-pm-info">
                        <span className="al-pm-name">{p.name}</span>
                        <span className="al-pm-sub">{p.age || p.persona?.slice(0, 24) || "설정 없음"}</span>
                      </span>
                    </button>
                    <div className="al-pm-actions">
                      <button className="al-pm-edit-mini" onClick={() => setPersonaDraft({ ...p })} aria-label={`${p.name} 페르소나 수정`}>수정</button>
                      <button className="al-pm-del-mini" onClick={() => deletePersona(p.id)} aria-label={`${p.name} 페르소나 삭제`}>삭제</button>
                    </div>
                  </div>
                ))}
                <button className="al-pm-add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}>+ 페르소나 만들기</button>
              </div>
            </div>

            <div className="al-build">build {String(BUILD_MARK).slice(0, 7)}</div>
          </div>
        </div>
      )}

      {canUseApp && step === "dump" && (
        <div className="al-phone">
          <button className="al-dump-back" onClick={() => setStep("home")}>‹ 내 캐릭터들</button>
          <div className="al-setup">
            <div className="al-setup-head">
              <span className="al-spark">✶</span>
              <h1>내 캐릭터를 깨운다</h1>
              <p>걔에 대해 적어줘.<br />설명만 있어도 깨울 수 있어.</p>
            </div>

            {/* 유도 칩 */}
            <div className="al-guidechips">
              {["이름", "성격", "말투·입버릇", "좋아하는 거", "세계관", "캐치프레이즈"].map((g) => (
                <span key={g} className="al-guidechip">{g}</span>
              ))}
            </div>

            <textarea className="al-dump" value={dump} onChange={(e) => setDump(e.target.value)}
              placeholder={"이름은 리안. 21살, 마법학교 다님.\n겉으론 시크·까칠한데 단 거 앞에선 무너짐.\n반말 쓰고 문장 끝에 '…' 자주 붙임.\n고양이 키우고 밤에 글 쓰는 거 좋아함."} />

            {/* 역극 로그 — 옵션 */}
            <div className="al-rp">
              <div className="al-rp-head">
                <span>역극 · 대사 로그</span>
                <span className="al-rp-opt">선택</span>
              </div>
              <p className="al-rp-desc">대사를 넣으면 말투·캐치프레이즈를 훨씬 정확하게 잡아.</p>
              <textarea className="al-rp-box" value={rpLog} onChange={(e) => setRpLog(e.target.value)}
                placeholder={"리안: 됐어, 그런 건 알아서 할게…\n리안: …고마워. 딱 한 번만 말한다.\n리안: 시끄러워. 그 얘긴 그만."} />
            </div>

            {/* 예시 카드 */}
            <div className="al-examples">
              <span className="al-examples-lbl">막막하면 예시로 시작해도 돼 →</span>
              <div className="al-example-cards">
                {EXAMPLES.map((ex) => (
                  <button key={ex.name} className="al-example" onClick={() => setDump(ex.text)}>
                    <span className="al-example-name">{ex.name}</span>
                    <span className="al-example-desc">{ex.short}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="al-start" disabled={(!dump.trim() && !rpLog.trim()) || parsing} onClick={parseDump}>
              {parsing ? <span className="al-typing"><i/><i/><i/></span> : "이대로 깨우기"}
            </button>
            <p className="al-dump-note">정리는 AI가 해줄게. 다음 화면에서 확인하고 고치면 돼.</p>
          </div>
        </div>
      )}

      {}
      {canUseApp && step === "confirm" && (
        <div className="al-phone">
          <div className="al-setup">
            <div className="al-setup-head">
              <h1 className="al-confirm-title">{parseFailed ? "분석이 잘 안 됐어" : "이렇게 이해했어"}</h1>
              <p>{parseFailed ? "직접 채워도 되고, 다시 분석을 돌려도 돼." : "틀린 것만 톡 고치면 돼."}</p>
            </div>

            {parseFailed && (
              <>
                {parseError && (
                  <div className="al-parse-error">
                    <span>실패 원인</span>
                    <p>{parseError}</p>
                  </div>
                )}
                <button className="al-retry" onClick={() => setStep("dump")}>
                  ↻ 다시 분석 돌리기
                </button>
              </>
            )}

            <label className="al-field">
              <span>이름 *</span>
              <input value={char.name} onChange={(e) => update("name", e.target.value)} placeholder="캐릭터 이름" />
            </label>

            <div className="al-row">
              <label className="al-field">
                <span>아이디</span>
                <input value={char.handle} onChange={(e) => update("handle", e.target.value)} placeholder="@id" />
              </label>
              <label className="al-field">
                <span>나이/설정</span>
                <input value={char.age} onChange={(e) => update("age", e.target.value)} placeholder="예: 21 / 마법사" />
              </label>
            </div>

            <div className="al-analysis">
              <div className="al-analysis-head">
                <span className="al-spark-sm">✶</span> AI가 분석한 {char.name || "이 캐릭터"}
              </div>
              <label className="al-an-row">
                <span className="al-an-lbl">겉모습</span>
                <input value={char.surface} onChange={(e) => update("surface", e.target.value)} placeholder="첫인상·겉으로 보이는 모습" />
              </label>
              <label className="al-an-row">
                <span className="al-an-lbl">속마음</span>
                <input value={char.inner} onChange={(e) => update("inner", e.target.value)} placeholder="겉과 다른 숨은 면" />
              </label>
              <label className="al-an-row">
                <span className="al-an-lbl">상황별</span>
                <input value={char.situational} onChange={(e) => update("situational", e.target.value)} placeholder="평소 vs 친한 사람 vs 위기" />
              </label>
              <label className="al-an-row">
                <span className="al-an-lbl">무너지는 점</span>
                <input value={char.triggers} onChange={(e) => update("triggers", e.target.value)} placeholder="발끈하거나 약해지는 포인트" />
              </label>
              <label className="al-an-row">
                <span className="al-an-lbl">좋아하는 것</span>
                <input value={char.interests} onChange={(e) => update("interests", e.target.value)} placeholder="취미·관심사" />
              </label>
              <div className="al-an-row">
                <span className="al-an-lbl">정드는 속도</span>
                <div className="al-warmth-chips">
                  {[["slow", "느림 🧊"], ["normal", "보통"], ["fast", "빠름 💗"]].map(([v, lbl]) => (
                    <button key={v} type="button"
                      className={`al-warmth-chip ${(char.warmth || "normal") === v ? "on" : ""}`}
                      onClick={() => update("warmth", v)}>{lbl}</button>
                  ))}
                  <span className="al-warmth-hint">무뚝뚝·배타적이면 호감도가 천천히 오름</span>
                </div>
              </div>
            </div>

            {/* 관계 시각화 */}
            <div className="al-relbox">
              <div className="al-relbox-head">
                <span>♥ 관계</span>
                <span className="al-relbox-hint">"이름 — 관계" 쉼표로 여러 명</span>
              </div>
              {parseRelations(char.relations).length > 0 && (
                <div className="al-relviz">
                  {parseRelations(char.relations).map(({ who, label }, i) => (
                    <div key={i} className="al-relviz-item">
                      <div className="al-relviz-line2">
                            <span className="al-relviz-me">{char.name || "이 캐릭터"}</span>
                        <span className="al-relviz-arrow">→</span>
                        <span className="al-relviz-peer">{who}</span>
                      </div>
                      {label && <span className="al-relviz-rel">{label}</span>}
                    </div>
                  ))}
                </div>
              )}
              <input className="al-relinput" value={char.relations} onChange={(e) => update("relations", e.target.value)}
                placeholder="예: 선우 연 — 애인, 카엘 — 라이벌" />
            </div>

            <label className="al-field">
              <span>페르소나 *</span>
              <textarea value={char.persona} onChange={(e) => update("persona", e.target.value)} />
            </label>

            <label className="al-field">
              <span>세계관/배경</span>
              <textarea value={char.world} onChange={(e) => update("world", e.target.value)}
                placeholder="(없으면 비워도 됨)" />
            </label>

            <label className="al-field">
              <span>말투 특징</span>
              <input value={char.speech} onChange={(e) => update("speech", e.target.value)}
                placeholder="(없으면 비워도 됨)" />
            </label>

            <div className="al-confirm-actions">
              <button className="al-reparse" onClick={() => activeId ? setStep("home") : setStep("dump")}>
                {activeId ? "← 뒤로 가기" : "← 다시 쓰기"}
              </button>
              <button className="al-start al-confirm-go" disabled={!confirmReady || waking} onClick={activeId ? saveCharacterEdits : wakeCharacter}>
                {waking ? "깨우는 중..." : activeId ? "수정완료" : confirmReady ? `${char.name.trim()} 깨우기` : "이름·페르소나 필수"}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {canUseApp && step === "feed" && (
        <div className="al-phone">
          {/* 프로필 헤더 */}
          <div className="al-profile">
            <button className="al-back" onClick={goHome}>‹</button>
            <div className="al-banner">
              {char.headerImg && <img src={char.headerImg} alt="" />}
              <div className="al-cover-tools">
                <label title="헤더 등록">
                  헤더 편집
                  <input type="file" accept="image/*" onChange={(e) => handleProfileImage("header", e)} hidden />
                </label>
                {char.headerImg && <button onClick={() => update("headerImg", "")}>삭제</button>}
              </div>
            </div>
            <div className="al-avatar-wrap">
              <div className="al-avatar">
                {char.avatarImg ? <img src={char.avatarImg} alt="" /> : initial}
              </div>
              <div className="al-avatar-tools">
                <label title="인장 등록">
                  편집
                  <input type="file" accept="image/*" onChange={(e) => handleProfileImage("avatar", e)} hidden />
                </label>
                {char.avatarImg && <button onClick={() => update("avatarImg", "")}>삭제</button>}
              </div>
            </div>
            <div className="al-profile-info">
              <div className="al-profile-top">
                <div className="al-profile-top-main">
                  <div className="al-name-line">
                    <h2>{char.name}</h2>
                    <WorldChip c={char} fallback="current-character" />
                  </div>
                  <span className="al-handle">@{char.handle || char.name.replace(/\s/g, "").toLowerCase()}</span>
                </div>
                <div className="al-feed-actions">
                  <button className="al-dmbtn ghost" onClick={() => { setDiscoverQuery(""); setSharedFocusId(""); setStep("discover"); }} title="탐색"><span>🔍</span><b>탐색</b></button>
                  <button className="al-dmbtn ghost" onClick={shareCurrentCharacter} title="공유"><span>🔗</span><b>공유</b></button>
                  <button className="al-dmbtn" onClick={() => setStep("dmlist")} title="DM"><span>✉</span><b>DM</b></button>
                </div>
              </div>
              <p className="al-bio">
                {char.age && <span className="al-bio-tag">{char.age}</span>}
                {char.surface && <span className="al-bio-tag">{char.surface}</span>}
              </p>
              {char.persona && <p className="al-bio-text">{char.persona}</p>}
              {shareStatus && <p className="al-share-status">{shareStatus}</p>}

              <div className="al-follow-stats">
                <button className={`al-fstat ${followPanel === "following" ? "on" : ""}`} onClick={() => toggleFollowPanel("following")}>
                  <b>{following.length}</b> 팔로잉
                </button>
                <button className={`al-fstat ${followPanel === "followers" ? "on" : ""}`} onClick={() => toggleFollowPanel("followers")}>
                  <b>{activeSharedId ? (followerCounts[activeSharedId] || 0) : myFollowers().length}</b> 팔로워
                </button>
                <button className={`al-fstat ${showMemory ? "on" : ""}`} onClick={toggleMemoryPanel}>
                  🧠 <b>{(char.lorebook || []).length}</b> 장기기억 {showMemory ? "▾" : "▸"}
                </button>
                {(() => {
                  const relCount = parseRelations(char.relations).length;
                  return relCount > 0 ? (
                    <button className={`al-fstat ${showRelations ? "on" : ""}`} onClick={toggleRelationsPanel}>
                      💞 <b>{relCount}</b> 관계 {showRelations ? "▾" : "▸"}
                    </button>
                  ) : null;
                })()}
                {myFollowers().length > 0 && <span className="al-fstat-new">친해진 캐가 맞팔했어!</span>}
              </div>

              {showRelations && (() => {
                const rels = parseRelations(char.relations);
                if (!rels.length) return null;
                return (
                  <div className="al-rellist">
                    {rels.map(({ who, label }, i) => {
                      const aff = affOf(char.name, who);
                      const back = affOf(who, char.name); // 상대가 나를 향한 마음
                      const neg = aff < 0;
                      const peerExists = isFollowedCharacterName(who); // 탐색에서 팔로한 캐릭터일 때만 특별관계 활성화
                      // 짝사랑: 상대가 존재하고, 내 마음은 깊은데(50+) 상대는 얕을 때. (라벨이 짝사랑이면 무조건)
                      const oneSided = (peerExists && relLabelFor(char, who) === "짝사랑")
                        || (peerExists && aff >= 50 && back < 30 && !/부부|배우자|연인|애인|약혼|사랑/.test(label));
                      return (
                        <div className="al-rel" key={i}>
                          <div className="al-rel-top">
                            <span className="al-rel-av">{(who.trim()[0]) || "?"}</span>
                            <span className="al-rel-who">{who}</span>
                            {oneSided && <span className="al-rel-onesided">💔 짝사랑</span>}
                            <span className="al-rel-stage">{relationStageLabel(label, aff)} · {aff}</span>
                          </div>
                          {label && <p className="al-rel-desc">{label}</p>}
                          <div className="al-rel-bar">
                            <div className={`al-rel-fill ${neg ? "neg" : ""}`} style={{ width: `${Math.abs(aff)}%` }} />
                          </div>
                          <div className="al-rel-edit">
                            <span>내 호감도</span>
                            <input type="range" min="-100" max="100" value={aff}
                              onChange={(e) => setAffinityManual(char.name, who, e.target.value)} />
                            <input type="number" min="-100" max="100" value={aff}
                              onChange={(e) => setAffinityManual(char.name, who, e.target.value)} />
                          </div>
                          {oneSided && <span className="al-rel-onesided-note">{who}의 마음은 아직 {affinityStage(back)}({back}) — 아직 닿지 않았어</span>}
                        </div>
                      );
                    })}
                    <p className="al-mem-note">{char.name}의 관계와 지금 마음. 대화할수록 호감도가 변해.</p>
                  </div>
                );
              })()}

              {showMemory && (
                <div className="al-memlist">
                  {(char.lorebook || []).length === 0 ? (
                    <>
                      <p className="al-mem-note">아직 쌓인 장기기억이 없어. {char.name}가 대화를 나누면 핵심을 자동으로 기억해 — 약속·사건·감정 같은 걸 잊지 않게.</p>
                      <button className="al-mem-add-toggle" onClick={() => setShowMemoryAdd((v) => !v)}>
                        + 새 장기기억 추가
                      </button>
                      {showMemoryAdd && (
                        <div className="al-mem-add slide">
                          {renderLorePeerSelect(lorePeerOptions())}
                          <textarea value={memDraftText} onChange={(e) => setMemDraftText(e.target.value)} placeholder="감정 변화와 원인, 약속, 사건 같은 핵심만 추가" />
                          <button className="al-mem-add-btn" disabled={!memDraftText.trim()} onClick={addManualMemory}>장기기억 추가</button>
                        </div>
                      )}
                    </>
                  ) : (() => {
                    const allMem = (char.lorebook || []).map(normalizeMemoryEntry);
                    const peerOptions = lorePeerOptions();
                    const peerEntries = [...new Set(allMem.map((e) => e.peer || "*"))]
                      .map((peer) => ({ peer, count: allMem.filter((e) => (e.peer || "*") === peer).length }))
                      .sort((a, b) => b.count - a.count);
                    const shown = allMem
                      .filter((e) => (e.peer || "*") === memFilter)
                      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.importance || 2) - (a.importance || 2) || (b.id || 0) - (a.id || 0))
                      .slice(0, 30);
                    return (
                      <>
                        {!memFilter ? (
                          <div className="al-mem-peers">
                            {peerEntries.map(({ peer, count }) => (
                              <button key={peer} className="al-mem-peer-card" onClick={() => { setMemFilter(peer); setMemDraftPeer(peer === "*" ? "" : peer); }}>
                                <span className="al-mem-peer-av">{peer === "*" ? "＊" : (peer.trim()[0] || "?")}</span>
                                <span className="al-mem-peer-info">
                                  <b>{peer === "*" ? "전체 설정" : peer}</b>
                                  <small>{count}개</small>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="al-mem-detail-head">
                              <button onClick={() => setMemFilter(null)}>‹ 사람별 목록</button>
                              <span>{memFilter === "*" ? "전체 설정" : memFilter}</span>
                            </div>
                            {shown.length === 0 && <p className="al-mem-note">이 사람에게 남은 장기기억이 없어.</p>}
                            {shown.map((e) => {
                              const editing = editingMemoryId === e.id;
                              const importanceLabel = (e.importance || 2) >= 5 ? "핵심" : (e.importance || 2) >= 4 ? "사건" : "감정";
                              return (
                                <div className={`al-mem-card ${e.pinned ? "pinned" : ""}`} key={e.id}>
                                  <div className="al-mem-card-top">
                                    <span className="al-mem-kind">{importanceLabel}</span>
                                    <span className="al-mem-source">{e.source === "manual" ? "수동" : "자동"}</span>
                                    {e.pinned && <span className="al-mem-pin">고정</span>}
                                    <div className="al-mem-card-actions">
                                      <button onClick={() => updateMemory(e.id, { pinned: !e.pinned })}>{e.pinned ? "해제" : "고정"}</button>
                                      <button onClick={() => setEditingMemoryId(editing ? null : e.id)}>{editing ? "닫기" : "수정"}</button>
                                      <button className="danger" onClick={() => deleteMemory(e.id)}>삭제</button>
                                    </div>
                                  </div>
                                  {editing ? (
                                    <div className="al-mem-editbox">
                                      <textarea value={e.content} onChange={(ev) => editMemory(e.id, ev.target.value)} />
                                      <select value={e.importance || 3} onChange={(ev) => updateMemory(e.id, { importance: Number(ev.target.value) })}>
                                        <option value={3}>감정 변화</option>
                                        <option value={4}>중요 사건</option>
                                        <option value={5}>핵심 기억</option>
                                      </select>
                                    </div>
                                  ) : (
                                    <p className="al-mem-card-text">{e.content}</p>
                                  )}
                                </div>
                              );
                            })}
                            <button className="al-mem-add-toggle" onClick={() => setShowMemoryAdd((v) => !v)}>
                              + {memFilter === "*" ? "전체 설정" : memFilter} 장기기억 추가
                            </button>
                            {showMemoryAdd && (
                              <div className="al-mem-add slide">
                                {renderLorePeerSelect(peerOptions, memFilter)}
                                <textarea value={memDraftText} onChange={(e) => setMemDraftText(e.target.value)} placeholder="감정 변화와 원인, 약속, 사건 같은 핵심만 추가" />
                                <button className="al-mem-add-btn" disabled={!memDraftText.trim()} onClick={addManualMemory}>장기기억 추가</button>
                              </div>
                            )}
                          </>
                        )}
                        {!memFilter && (
                          <>
                            <button className="al-mem-add-toggle" onClick={() => setShowMemoryAdd((v) => !v)}>
                              + 새 장기기억 추가
                            </button>
                            {showMemoryAdd && (
                              <div className="al-mem-add compact slide">
                                <div className="al-mem-add-title">새 장기기억 추가</div>
                                {renderLorePeerSelect(peerOptions)}
                                <textarea value={memDraftText} onChange={(e) => setMemDraftText(e.target.value)} placeholder="감정 변화와 원인, 약속, 사건 같은 핵심만 추가" />
                                <button className="al-mem-add-btn" disabled={!memDraftText.trim()} onClick={addManualMemory}>장기기억 추가</button>
                              </div>
                            )}
                          </>
                        )}
                        <p className="al-mem-note">{memFilter ? "감정 변화는 원인까지 남겨야 오래 기억해. 필요 없는 항목은 삭제할 수 있어." : "사람을 선택하면 해당 상대와의 장기기억만 열려. 전체 설정은 특정 상대 없이 항상 참고하는 내용이야."}</p>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 캐릭터 그림 갤러리 */}
              <div className="al-gallery">
                <div className="al-gallery-head">
                  <span>{char.name}의 그림 {gallery.length > 0 && `(${gallery.length})`}</span>
                  <label className="al-upload">
                    + 그림 올리기
                    <input type="file" accept="image/*" multiple onChange={handleUpload} hidden />
                  </label>
                </div>
                {gallery.length > 0 ? (
                  <div className="al-gallery-strip">
                    {gallery.map((g, i) => (
                      <div className="al-thumb" key={i}>
                        <img src={g} alt="" />
                        <button className="al-thumb-x" onClick={() => setGallery((arr) => arr.filter((_, idx) => idx !== i))}>×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="al-gallery-empty">캐릭터 그림을 올려두면, {char.name}가 셀카·일상·랜덤 글을 쓸 때 알아서 골라 붙여.</p>
                )}
              </div>
            </div>
          </div>

          {/* 자율 포스팅 컨트롤 */}
          <div className="al-autobar">
            <button className={`al-autotoggle ${auto ? "on" : ""}`} onClick={() => setAuto((a) => !a)}>
              <span className="al-autodot" />
              {auto ? `자율 모드 ON · ${josa(char.name, "이/가")} 알아서 올리는 중` : "자율 모드 OFF"}
            </button>
            {auto && (
              <div className="al-autometa">
                <span className="al-nextin">{fast ? "" : "다음 글 "}~{Math.floor(nextIn / 60)}:{String(nextIn % 60).padStart(2, "0")}</span>
                <button className={`al-fast ${fast ? "on" : ""}`} onClick={() => setFast((f) => !f)}>
                  {fast ? "빠름(30초)" : "15분"}
                </button>
              </div>
            )}
          </div>

          {/* 직접 지시 — 상시 지침 */}
          <div className="al-directive">
            <span className="al-directive-lbl">▸ {josa(char.name, "에게/에게")} 지시</span>
            <input className="al-directive-input" value={char.directions || ""}
              onChange={(e) => update("directions", e.target.value)}
              placeholder="예: 연이랑 데이트하고 기분 좋음 / 시험 끝나서 들뜬 상태" />
            {(char.directions || "").trim() && <span className="al-directive-on">적용 중</span>}
          </div>

          {/* 글 쓰게 하기 */}
          <div className="al-composer">
            {!moodOpen ? (
              <div className="al-compose-row">
                <button className="al-wake" onClick={() => setMoodOpen(true)} disabled={loading}>
                  {loading ? <span className="al-typing"><i/><i/><i/></span> : `✶ ${josa(char.name, "한테/한테")} 시키기`}
                </button>
                <button className="al-writeself" onClick={() => setWriteOpen((w) => !w)}>✎ 내가 쓰기</button>
              </div>
            ) : (
              <div className="al-moods">
                <p className="al-moods-q">어떤 글을 올릴까?</p>
                <div className="al-moods-grid">
                  {POST_MOODS.map((m) => (
                    <button key={m} className="al-mood" onClick={() => generatePost(m)}>{m}</button>
                  ))}
                </div>
                <button className="al-moods-cancel" onClick={() => setMoodOpen(false)}>닫기</button>
              </div>
            )}
            {writeOpen && (
              <div className="al-writebox">
                <p className="al-write-lbl">{josa(char.name, "으로/로")} 직접 작성 — 내가 이 캐릭터가 되어 올림</p>
                <textarea value={writeText} onChange={(e) => setWriteText(e.target.value)}
                  placeholder={`${char.name}의 글을 직접 써봐…`} />
                <div className="al-write-actions">
                  <button className="al-write-cancel" onClick={() => { setWriteOpen(false); setWriteText(""); }}>취소</button>
                  <button className="al-write-post" disabled={!writeText.trim()}
                    onClick={() => { manualPost(writeText); setWriteText(""); setWriteOpen(false); }}>올리기</button>
                </div>
              </div>
            )}
          </div>

          {/* 피드 */}
          <div className="al-feed-tabs">
            <button className={feedView === "mine" ? "on" : ""} onClick={() => setFeedView("mine")}>
              내 글 <b>{myPosts.length}</b>
            </button>
            <button className={feedView === "timeline" ? "on" : ""} onClick={() => setFeedView("timeline")}>
              타임라인 <b>{timelinePosts.length}</b>
            </button>
          </div>
          <div className="al-feed" ref={feedTopRef}>
            {visiblePosts.length === 0 && !loading && (
              <div className="al-empty">
                <span>{feedView === "mine" ? `${char.name}의 글이 아직 없어.` : "타임라인에 아직 글이 없어."}</span>
                <p>{feedView === "mine" ? "위에서 직접 시키거나 내가 쓰기로 첫 글을 올려봐." : "내 글과 팔로우한 캐릭터의 글이 여기에 같이 올라와."}</p>
              </div>
            )}
            {visiblePosts.map((post) => {
              const isExt = !!post.author; // author 있으면 외부(팔로우) 캐 글, 없으면 내 캐릭터
              const pName = isExt ? post.author : char.name;
              const pHandle = isExt ? (post.authorHandle || post.author) : (char.handle || char.name.replace(/\s/g, "").toLowerCase());
              const pInitial = pName.trim()[0] || "?";
              const pAvatar = isExt ? post.authorAvatarImg : char.avatarImg;
              return (
              <div className="al-post" key={post.id}>
                <div className={`al-post-av ${isExt ? "ext" : ""}`}>
                  {pAvatar ? <img src={pAvatar} alt="" /> : pInitial}
                </div>
                <div className="al-post-body">
                  <div className="al-post-head">
                    <span className="al-post-name">{pName}</span>
                    <span className="al-post-handle">@{pHandle}</span>
                    {isExt && <span className="al-post-extbadge">팔로잉</span>}
                    <span className="al-post-time">· {timeAgo(post.time)}</span>
                  </div>
                  {editingPost?.id === post.id ? (
                    <div className="al-editbox">
                      <textarea value={editingPost.text} autoFocus
                        onChange={(e) => setEditingPost((p) => ({ ...p, text: e.target.value }))} />
                      <div className="al-edit-actions">
                        <button onClick={() => setEditingPost(null)}>취소</button>
                        <button className="primary" disabled={!editingPost.text.trim()} onClick={savePostEdit}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <p className="al-post-text">{post.text}{post.edited && <i className="al-edited">수정됨</i>}</p>
                  )}

                  {post.quoted && (
                    <div className="al-quoted">
                      <div className="al-quoted-head">
                        <span className="al-quoted-av">{post.quoted.name.trim()[0] || "?"}</span>
                        <span className="al-quoted-name">{post.quoted.name}</span>
                        <span className="al-quoted-handle">@{post.quoted.handle}</span>
                      </div>
                      <p className="al-quoted-text">{post.quoted.text}</p>
                    </div>
                  )}

                  {post.img && (
                    <div className="al-post-img"><img src={post.img} alt="" /></div>
                  )}
                  {post.photoDesc && !post.img && (
                    <div className="al-post-photo">
                      <span className="al-photo-frame">◹</span>
                      <span className="al-photo-desc">{post.photoDesc}</span>
                    </div>
                  )}
                  {post.moodDesc && (
                    <div className="al-post-moodcard">♫ {post.moodDesc}</div>
                  )}

                  <div className="al-post-actions">
                    <button className={`al-like ${post.liked ? "on" : ""}`} onClick={() => toggleLike(post.id)}>
                      {post.liked ? "♥" : "♡"} {post.likes}
                    </button>
                    {!post.byUser && (
                      <button className="al-fixbtn" onClick={() => { setFixTarget({ type: "post", id: post.id, text: post.text }); setFixText(""); }}>
                        ⚠ 캐해 아님
                      </button>
                    )}
                    <span className="al-post-mood">{post.isAuto && <i className="al-auto-badge">자율</i>}{post.byUser && <i className="al-user-badge">내가</i>}{(post.mood || "").split(" / ")[0]}</span>
                    <button className="al-mini-action" onClick={() => setEditingPost({ id: post.id, text: post.text })}>수정</button>
                    <button className="al-mini-action danger" onClick={() => deletePost(post.id)}>삭제</button>
                  </div>

                  {(post.comments || []).length > 0 && (
                    <div className="al-comments">
                      {post.comments.map((c, ci) => (
                        <div className="al-comment" key={ci}>
                          <div className={`al-comment-av ${c.byUser ? "mine" : ""}`}>{c.name.trim()[0] || "?"}</div>
                          <div className="al-comment-body">
                            <span className="al-comment-name">{c.name}{c.byUser && <i className="al-cmt-mine">나</i>}</span>
                            {c.replyTo && c.replyTo !== c.name && <span className="al-replyto"> @{c.replyTo}에게 답글</span>}
                            {editingComment?.postId === post.id && editingComment.index === ci ? (
                              <div className="al-comment-editbox">
                                <input value={editingComment.text} autoFocus
                                  onChange={(e) => setEditingComment((v) => ({ ...v, text: e.target.value }))} />
                                <button onClick={() => setEditingComment(null)}>취소</button>
                                <button disabled={!editingComment.text.trim()} onClick={saveCommentEdit}>저장</button>
                              </div>
                            ) : (
                              <>
                                <span className="al-comment-text">{c.text}{c.edited && <i className="al-edited">수정됨</i>}</span>
                                <span className="al-comment-tools">
                                  <button onClick={() => setEditingComment({ postId: post.id, index: ci, text: c.text })}>수정</button>
                                  <button onClick={() => deleteComment(post.id, ci)}>삭제</button>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {commentOn === post.id ? (
                    <div className="al-cmtbox">
                      <div className="al-cmtbox-who">
                        <button className={`al-spk-chip ${commentAs === "char" ? "on" : ""}`} onClick={() => setCommentAs("char")}>{char.name}</button>
                        {personas.map((p) => (
                          <button key={p.id} className={`al-spk-chip persona ${commentAs === `p:${p.id}` ? "on" : ""}`}
                            onClick={() => setCommentAs(`p:${p.id}`)}>🎭 {p.name}</button>
                        ))}
                        <button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}>+ 페르소나</button>
                      </div>
                      <div className="al-cmtbox-row">
                        <input className="al-cmtbox-input" value={commentText} autoFocus
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitUserComment(post.id, isExt ? post.author : null); }}
                          placeholder={`${commentAs === "char" ? char.name : (personas.find((p) => `p:${p.id}` === commentAs)?.name || "")}(으)로 댓글…`} />
                        <button className="al-cmtbox-send" onClick={() => submitUserComment(post.id, isExt ? post.author : null)}>↑</button>
                      </div>
                      <button className="al-cmtbox-cancel" onClick={() => { setCommentOn(null); setCommentText(""); }}>닫기</button>
                    </div>
                  ) : (
                    <button className="al-cmt-open" onClick={() => openCommentBox(post.id)}>💬 댓글 달기</button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {}
      {canUseApp && step === "discover" && (() => {
        const q = discoverQuery.trim().toLowerCase();
        const mergedDiscover = hasSupabaseConfig ? sharedCharacters : DISCOVER_POOL;
        const isActiveShared = (c) => Boolean(
          (activeSharedId && (c.sharedId === activeSharedId || c.id === `shared_${activeSharedId}`)) ||
          (session?.user?.id && activeId && c.ownerId === session.user.id && c.sourceAccountId === activeId)
        );
        const visibleBase = mergedDiscover.filter((c) => {
          if (sharedFocusId) return c.sharedId === sharedFocusId || c.id === sharedFocusId;
          if (isActiveShared(c)) return false;
          return true;
        });
        const hiddenActive = mergedDiscover.filter((c) => isActiveShared(c)).length;
        const hiddenFollowed = mergedDiscover.filter((c) => !isActiveShared(c) && isFollowing(c.id)).length;
        const list = mergedDiscover.filter((c) => {
          if (sharedFocusId) return c.sharedId === sharedFocusId || c.id === sharedFocusId;
          if (isActiveShared(c)) return false;
          if (!q) return true;
          return [c.sharedId, c.name, c.handle, c.persona, c.owner, c.ownerName, ...(c.tags || [])].join(" ").toLowerCase().includes(q);
        });
        return (
        <div className="al-phone">
          <div className="al-dmhead">
            <button className="al-back-inline" onClick={() => setStep("feed")}>‹</button>
            <div className="al-dmhead-info">
              <span className="al-dmhead-name">🔍 캐릭터 탐색</span>
              <span className="al-dmhead-sub">다른 사용자와 캐릭터를 찾아 팔로우해봐</span>
            </div>
          </div>
          <div className="al-disc-search">
            <input value={discoverQuery} onChange={(e) => { setSharedFocusId(""); setDiscoverQuery(e.target.value); }}
              placeholder="사용자·이름·성격·태그 검색" />
          </div>
          {sharedFocusId && (
            <div className="al-disc-focus">
              공유 링크로 들어온 캐릭터
              <button onClick={() => setSharedFocusId("")}>전체 탐색 보기</button>
            </div>
          )}
          {hasSupabaseConfig && (
            <div className="al-disc-status">
              <span>
                {sharedLoadState.loading
                  ? "사용자 캐릭터 불러오는 중"
                  : `${hasSupabaseConfig ? "DB" : "샘플"} 불러옴 ${mergedDiscover.length}개 · 표시 ${list.length}개${q ? " · 검색 적용" : ""}${hiddenFollowed ? ` · 팔로잉 ${hiddenFollowed}개 포함` : ""}${hiddenActive ? ` · 현재 캐릭터 제외 ${hiddenActive}개` : ""}`}
              </span>
              {(q || sharedFocusId) && (
                <button type="button" onClick={() => { setDiscoverQuery(""); setSharedFocusId(""); }}>전체 보기</button>
              )}
              <button onClick={loadSharedCharacters} disabled={sharedLoadState.loading}>새로고침</button>
            </div>
          )}
          {sharedLoadState.error && <p className="al-disc-error">탐색 로딩 실패: {sharedLoadState.error}</p>}
          <div className="al-disc-list">
            {list.length === 0 && (
              <div className="al-disc-none">
                <p>{sharedFocusId ? "이 공유 링크의 캐릭터를 찾지 못했어." : discoverQuery ? `"${discoverQuery}"에 맞는 새 캐릭터가 없어.` : sharedCharacters.length > 0 ? "팔로우하지 않은 새 캐릭터가 없어." : "아직 공유된 사용자 캐릭터가 없어."}</p>
              </div>
            )}
            {list.map((c) => {
              const followed = isFollowing(c.id);
              return (
                <div key={c.id} className={`al-disc-card ${followed ? "on" : ""}`}>
                  <button className="al-disc-av" onClick={() => setPublicProfile(c)} aria-label={`${c.name} 프로필 보기`}>{c.name.trim()[0]}</button>
                  <div className="al-disc-body">
                    <div className="al-disc-top">
                      <button className="al-disc-name" onClick={() => setPublicProfile(c)}>{c.name}</button>
                      <WorldChip c={c} fallback={`disc-${c.id}`} />
                      <span className="al-disc-owner">{c.shared ? `${c.owner} · 공유됨` : c.owner}</span>
                      <span className="al-disc-fcount">팔로워 {publicFollowerCount(c).toLocaleString()}</span>
                    </div>
                    <p className="al-disc-persona">{c.persona}</p>
                    <div className="al-disc-tags">
                      {(c.tags || []).map((t) => <span key={t} className="al-disc-tag">#{t}</span>)}
                    </div>
                  </div>
                  <div className="al-disc-actions">
                    <button className="al-disc-dm" onClick={() => requestDmEntry(c, "char")}>✉ DM</button>
                    <button className={`al-disc-follow ${followed ? "on" : ""}`} onClick={() => toggleFollow(c)}>
                      {followed ? "팔로잉 ✓" : "+ 팔로우"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {following.length > 0 && (
            <div className="al-disc-foot">
              팔로잉 {following.length} · DM에서 {char.name}(으)로 말 걸 수 있어
            </div>
          )}
        </div>
        );
      })()}

      {canUseApp && step === "dmlist" && (
        <div className="al-phone">
          <div className="al-dmhead">
            <button className="al-back-inline" onClick={() => setStep("feed")}>‹</button>
            <div className="al-dmhead-av">{initial}</div>
            <div className="al-dmhead-info">
              <span className="al-dmhead-name">{char.name}의 DM</span>
              <span className="al-dmhead-sub">대화 목록</span>
            </div>
          </div>

          <div className="al-convlist">
            {myConversations().length === 0 && !newChatMode && (
              <div className="al-conv-empty">
                <p>아직 대화가 없어.</p>
                <span>아래에서 다른 캐릭터에게 말을 걸어봐.</span>
              </div>
            )}
            {myConversations().map((c) => (
              <div key={c.key} className="al-convitem">
                <button className="al-convmain"
                  onClick={() => {
                    if (c.asOwner) {
                      requestDmEntry({ name: char.name, persona: char.persona, relation: "", asOwner: true }, "owner");
                    } else {
                      const acc = accounts.find((a) => a.char.name === c.peerName);
                      const fol = following.find((f) => f.name === c.peerName);
                      const nextPeer = {
                        ...(fol || {}),
                        name: c.peerName,
                        persona: acc ? acc.char.persona : (fol ? fol.persona : ""),
                        relation: relationMatched(char, acc ? { name: acc.char.name } : (fol || { name: c.peerName })),
                        dmKind: c.dmKind,
                        dmKey: c.dmKey,
                        localRoomId: c.localRoomId,
                      };
                      // 이 방의 화자 복원 (페르소나 방이면 그 페르소나로)
                      let restoredSpeakAs = "char";
                      if (c.asPersona) {
                        const p = personas.find((pp) => pp.name === c.asPersona);
                        restoredSpeakAs = p ? `p:${p.id}` : "char";
                      }
                      requestDmEntry(nextPeer, restoredSpeakAs);
                    }
                  }}>
                  <div className="al-convitem-av">{c.asOwner ? "🙋" : c.asPersona ? "🎭" : (c.peerName.trim()[0] || "?")}</div>
                  <div className="al-convitem-info">
                    <span className="al-convitem-name">{displayDmTitle(c)}</span>
                    <span className="al-convitem-last">{c.dmKind === "npc" ? "NPC 채팅 · " : c.asOwner ? "" : "공유 DM · "}{c.last.slice(0, 28) || "대화 시작"}</span>
                  </div>
                  <span className="al-convitem-count">{c.count}</span>
                </button>
                <div className="al-conv-actions">
                  <button type="button" onClick={(e) => startRenameDm(c, e)}>수정</button>
                  <button type="button" className="danger" onClick={(e) => deleteDmThread(c.key, e)}>삭제</button>
                </div>
              </div>
            ))}
          </div>

          {/* 새 대화 시작 */}
          <div className="al-newchat">
            {!newChatMode ? (
              <>
                {/* 1. 오너로서 내 캐릭터에게 */}
                <button className="al-owner-entry"
                  onClick={() => {
                    requestDmEntry({ name: char.name, persona: char.persona, relation: "", asOwner: true }, "owner");
                  }}>
                  🙋 나(오너)로서 <b>{char.name}</b>에게 직접 말 걸기
                </button>
                {/* 2. 내 캐릭터로 다른 캐릭터에게 */}
                <button className="al-newchat-btn" onClick={() => { setNewChatSpeaker("char"); setNewChatMode("char"); }}>
                  💬 <b>{char.name}</b>(으)로 다른 캐릭터에게 말 걸기
                </button>
                {/* 3. 페르소나로 다른 캐릭터에게 */}
                <button className="al-persona-entry" onClick={() => {
                  if (personas.length === 0) { setPersonaDraft({ name: "", age: "", persona: "", speech: "" }); return; }
                  setNewChatSpeaker(`p:${personas[0].id}`); setNewChatMode("persona");
                }}>
                  🎭 내 페르소나로 캐릭터에게 말 걸기 {personas.length === 0 && <span className="al-pe-hint">(먼저 만들기)</span>}
                </button>
              </>
            ) : (
              <div className="al-newchat-panel">
                {newChatMode === "persona" && (
                  <>
                    <p className="al-newchat-lbl">어떤 페르소나로?</p>
                    <div className="al-nc-speakers">
                      {personas.map((p) => (
                        <button key={p.id} className={`al-spk-chip persona ${newChatSpeaker === `p:${p.id}` ? "on" : ""}`}
                          onClick={() => setNewChatSpeaker(`p:${p.id}`)}>🎭 {p.name}</button>
                      ))}
                      <button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}>+ 페르소나</button>
                    </div>
                  </>
                )}
                <p className="al-newchat-lbl">
                  누구에게 — {newChatSpeaker === "char" ? char.name : (personas.find((p) => `p:${p.id}` === newChatSpeaker)?.name || char.name)}(으)로
                </p>
                <div className="al-newchat-targets">
                  {/* 페르소나로 말 걸 땐, 지금 보고 있는 내 캐릭터도 대상 */}
                  {newChatMode === "persona" && (
                    <button className="al-newchat-target mine"
                      onClick={() => {
                        requestDmEntry({ name: char.name, persona: char.persona, relation: "" }, newChatSpeaker);
                      }}>
                      <span className="al-nt-av">{char.name.trim()[0]}</span>
                      <span className="al-nt-name">{char.name}</span>
                      <span className="al-nt-mine-tag">내 캐릭터</span>
                    </button>
                  )}
                  {accounts.filter((a) => a.id !== activeId).map((a) => {
                    const rel = relationMatched(char, { name: a.char.name });
                    return (
                      <button key={a.id} className="al-newchat-target"
                        onClick={() => {
                          requestDmEntry({ name: a.char.name, persona: a.char.persona, relation: "" }, newChatSpeaker);
                        }}>
                        <span className="al-nt-av">{a.char.name.trim()[0]}</span>
                        <span className="al-nt-name">{a.char.name}</span>
                        {rel && <span className="al-nt-rel">♥ {rel.split(/[—\-–:]/).slice(1).join("").trim() || "관계"}</span>}
                      </button>
                    );
                  })}
                  {following.map((f) => (
                    <button key={f.id} className="al-newchat-target ext"
                      onClick={() => {
                        requestDmEntry({ ...f, name: f.name, persona: f.persona, relation: relationMatched(char, f) }, newChatSpeaker);
                      }}>
                      <span className="al-nt-av">{f.name.trim()[0]}</span>
                      <span className="al-nt-name">{f.name}</span>
                      <span className="al-nt-ext">팔로잉 · {f.owner}</span>
                    </button>
                  ))}
                  {newChatMode === "char" && accounts.filter((a) => a.id !== activeId).length === 0 && following.length === 0 && (
                    <p className="al-nt-none">다른 캐릭터를 만들거나, 🔍 탐색에서 캐릭터를 팔로우해봐.</p>
                  )}
                </div>
                <button className="al-newchat-cancel" onClick={() => setNewChatMode(null)}>닫기</button>
              </div>
            )}
          </div>
        </div>
      )}

      {canUseApp && step === "dm" && peer && (() => {
        const peerName = peer.asOwner ? char.name : peer.name;
        const peerInitial = peerName.trim()[0] || "?";
        const showGauge = true;
        // 게이지 주체 = 현재 화자(내 캐릭터 or 유저 페르소나). 오너면 캐릭터로 폴백.
        const speakerName = (activePersona ? activePersona.name : char.name);
        const dmKindLabel = peer.dmKind === "npc" ? "NPC 채팅" : "공유 DM";
        const headSub = peer.asOwner
          ? "나(오너)로서 대화 중"
          : `${josa(speakerName, "으로/로")} 대화 중 · ${dmKindLabel}`;
        const roomTitle = dmThreadTitles[dmKey] || (peer.asOwner ? `${peerName} (내 캐릭터)` : peerName);
        const mineToPeer = dmAffOf(speakerName, peerName, peer.relation);   // 화자 → 상대
        const peerToMine = dmAffOf(peerName, speakerName, peer.relation);   // 상대 → 화자
        const ownerVal = affOf(peerName, OWNER);           // 하루 → 나(오너)
        return (
        <div className="al-phone">
          <div className="al-dmhead">
            <button className="al-back-inline" onClick={() => {
              // 방 나가며 세션 분위기 판정 (최근 발화 기준)
              const recentLines = dm.slice(-8).map((m) => ({ who: m.from, text: m.text }));
              if (peer.asOwner) judgeSession(OWNER, peerName, recentLines);
              else if (meName !== ownerLabel) {
                processSession(meName, peerName, recentLines);
              }
              setStep("dmlist");
            }}>‹</button>
            <div className="al-dmhead-av">{peerInitial}</div>
            <div className="al-dmhead-info">
              <span className="al-dmhead-name">{roomTitle}</span>
              <span className="al-dmhead-sub">{headSub}</span>
            </div>
            {!peer.asOwner && (
              <button className="al-dm-settings-btn" onClick={openDmSettings}>세계관</button>
            )}
          </div>

          {showGauge && (
            <div className={`al-affinity ${peer.asOwner ? "owner" : ""}`}>
              <button className="al-aff-toggle" onClick={() => setAffinityOpen((v) => !v)}>
                <span>호감도</span>
                <b>{peer.asOwner ? `${attachStage(ownerVal)} · ${ownerVal}` : `${affinityStage(peerToMine)} · ${peerToMine}`}</b>
                <i>{affinityOpen ? "접기" : "펼치기"}</i>
              </button>
              {affinityOpen && (
                <div className="al-aff-content">
                  {peer.asOwner && (
                    <>
                      <div className="al-aff-top">
                        <span className="al-aff-lbl">🤍 {peerName} → 나</span>
                        <span className="al-aff-stage">{attachStage(ownerVal)} · {ownerVal}</span>
                      </div>
                      <div className="al-aff-bar"><div className={`al-aff-fill ${ownerVal < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(ownerVal)}%` }} /></div>
                    </>
                  )}
                  {!peer.asOwner && activePersona && (
                    <>
                      <div className="al-aff-row">
                        <span className="al-aff-lbl rev">♥ {peerName} → {speakerName} <span className="al-aff-note">(가면이라 {speakerName}는 빠지지 않음)</span></span>
                        <span className="al-aff-stage">{affinityStage(peerToMine)} · {peerToMine}</span>
                      </div>
                      <div className="al-aff-bar">
                        <div className={`al-aff-fill rev ${peerToMine < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(peerToMine)}%` }} />
                        <div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} />
                      </div>
                    </>
                  )}
                  {!peer.asOwner && !activePersona && (
                    <>
                      <div className="al-aff-row">
                        <span className="al-aff-lbl">♥ {speakerName} → {peerName}</span>
                        <span className="al-aff-stage">{affinityStage(mineToPeer)} · {mineToPeer}</span>
                      </div>
                      <div className="al-aff-bar">
                        <div className={`al-aff-fill ${mineToPeer < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(mineToPeer)}%` }} />
                        <div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} title="고백 가능선" />
                      </div>
                      <div className="al-aff-row second">
                        <span className="al-aff-lbl rev">♥ {peerName} → {speakerName}</span>
                        <span className="al-aff-stage">{affinityStage(peerToMine)} · {peerToMine}</span>
                      </div>
                      <div className="al-aff-bar">
                        <div className={`al-aff-fill rev ${peerToMine < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(peerToMine)}%` }} />
                        <div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {(() => {
            const pc = findPeerChar(peerName);
            const mems = (pc && pc.lorebook || []).filter((e) => e.peer === speakerName);
            if (!pc || mems.length === 0) return null;
            return (
              <div className="al-peermem">
                <button className="al-peermem-toggle" onClick={() => setShowPeerMem((v) => !v)}>
                  🧠 {peerName}가 {speakerName}를 기억하는 것 {mems.length} {showPeerMem ? "▾" : "▸"}
                </button>
                {showPeerMem && (
                  <div className="al-peermem-list">
                    {mems.slice(-8).reverse().map((e) => (
                      <div className="al-peermem-item" key={e.id}>· {e.content}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="al-dmscroll">
            {dm.length === 0 && (
              <div className="al-dm-empty">
                <p>{peer.asOwner ? `${josa(peerName, "에게/에게")} 나(오너)로서 말을 걸어봐.` : `${josa(peerName, "에게/에게")} ${josa(speakerName, "으로/로")} 말을 걸어봐.`}</p>
              </div>
            )}
            {dm.map((m, i) => {
              const fromPeer = m.from === peerName;   // 상대가 보낸 것만 왼쪽
              const mine = !fromPeer;
              const showLabel = mine && m.from !== (char.name || "나"); // 내 쪽인데 하루가 아니면(=오너) 라벨
              const canFixDmLine = fromPeer && peer.asOwner && m.from === char.name;
              return (
                <div key={i} className={`al-bubble-row ${mine ? "me" : "char"}`}>
                  {fromPeer && <div className="al-bubble-av">{peerInitial}</div>}
                  <div className={`al-bubble ${mine ? "me" : "char"}`}>
                    {showLabel && <span className="al-bubble-spk">{m.from}</span>}
                    {m.img && <img className="al-bubble-img" src={m.img} alt="" />}
                    {m.text && !(m.img && m.text === "(사진)") && <span className="al-bubble-text">{m.text}</span>}
                    {canFixDmLine && (
                      <button className="al-fixbtn-dm" onClick={() => { setFixTarget({ type: "dm", index: i, text: m.text, who: m.from }); setFixText(""); }}>⚠ 캐해 아님</button>
                    )}
                  </div>
                </div>
              );
            })}
            {dmSending && (
              <div className="al-bubble-row char">
                <div className="al-bubble-av">{peerInitial}</div>
                <div className="al-bubble char typing"><span className="al-typing"><i/><i/><i/></span></div>
              </div>
            )}
            <div ref={dmEndRef} />
          </div>

          {/* ── 오너↔내캐릭터 방: 화자는 항상 나(오너). 페르소나만. ── */}
          {peer.asOwner && (
            <div className="al-dmctrl">
              <input className="al-owner-persona" value={ownerPersona} onChange={(e) => setOwnerPersona(e.target.value)}
                placeholder="나(오너) 페르소나 — 한 줄 (선택, 저장됨)" />
            </div>
          )}

          {/* ── 다른 캐릭터와의 방: 기본=하루, 자동대화 + 끼어들기 ── */}
          {!peer.asOwner && (
            <div className="al-autochat">
              <div className="al-chatmode">
                <span className="al-ctrl-lbl">자동 대화 방식:</span>
                <button className={chatMode === "talk" ? "on" : ""} onClick={() => setChatMode("talk")}>대화</button>
                <button className={chatMode === "novel" ? "on" : ""} onClick={() => setChatMode("novel")}>소설(묘사)</button>
              </div>
              {!autoChatting ? (
                <button className="al-autochat-go" onClick={startAutoChat} disabled={dmSending}>
                  ⟳ {speakerName} ↔ {peer.name} 자동 대화 (천천히)
                </button>
              ) : (
                <button className="al-autochat-stop" onClick={stopAutoChat}>
                  ■ 멈추기 <span className="al-autochat-live">● LIVE — 입력하면 {speakerName}로 끼어들기</span>
                </button>
              )}
            </div>
          )}

          {/* ── 화자 선택: 어떤 상대든(오너방 제외) 항상 노출 ── */}
          {!peer.asOwner && (
            <div className="al-speaker-wrap">
              <div className="al-speaker-sel">
                <span className="al-ctrl-lbl">말하는 나:</span>
                <button className={`al-spk-chip ${speakAs === "char" ? "on" : ""}`} onClick={() => setSpeakAs("char")}>{char.name}</button>
                <button className={`al-spk-chip ${speakAs === "owner" ? "on" : ""}`} onClick={() => setSpeakAs("owner")}>🙋 나(오너)</button>
                {personas.map((p) => (
                  <button key={p.id} className={`al-spk-chip persona ${speakAs === `p:${p.id}` ? "on" : ""}`}
                    onClick={() => setSpeakAs(`p:${p.id}`)}>🎭 {p.name}</button>
                ))}
                <button className="al-spk-chip add" onClick={() => { setPersonaDraft({ name: "", age: "", persona: "", speech: "" }); }}>+ 페르소나</button>
              </div>
              {speakAs === "owner" && (
                <input className="al-owner-persona" value={ownerPersona} onChange={(e) => setOwnerPersona(e.target.value)}
                  placeholder="나(오너) 페르소나 — 한 줄 (선택)" />
              )}
              {activePersona && (
                <div className="al-persona-active">🎭 {activePersona.name}(으)로 대화 중 · {activePersona.persona?.slice(0, 30)}</div>
              )}
            </div>
          )}

          {dmImageDraft && (
            <div className="al-dm-preview">
              <img src={dmImageDraft} alt="" />
              <button type="button" onClick={() => setDmImageDraft(null)}>×</button>
            </div>
          )}

          <div className="al-dminput">
            <label className="al-dm-image-btn" title="사진 보내기">
              +
              <input type="file" accept="image/*" onChange={handleDmImage} />
            </label>
            <input value={dmInput} onChange={(e) => setDmInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendDM(); }}
              placeholder={autoChatting ? `끼어들기: ${meName}(으)로 입력…` : `${meName}(으)로 메시지…`} />
            <button onClick={sendDM} disabled={(!dmInput.trim() && !dmImageDraft) || dmSending}>↑</button>
          </div>
        </div>
        );
      })()}

      {canUseApp && editingDmTitle && (
        <div className="al-modal-bg" onClick={() => setEditingDmTitle(null)}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">채팅방 이름 수정</h3>
            <p className="al-modal-sub">비워두면 기본 이름으로 돌아가.</p>
            <input className="al-pd-input" value={editingDmTitle.title}
              onChange={(e) => setEditingDmTitle((v) => ({ ...v, title: e.target.value }))}
              placeholder="채팅방 이름" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) saveRenameDm(); }} />
            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setEditingDmTitle(null)}>취소</button>
              <button className="al-modal-save" onClick={saveRenameDm}>저장</button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && onboardingOpen && (
        <div className="al-modal-bg">
          <div className="al-modal al-onboard" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">처음 왔구나</h3>
            <p className="al-modal-sub">저장에 쓸 이름만 정하면 바로 캐릭터를 만들 수 있어.</p>
            <input className="al-pd-input" value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="내 이름 또는 닉네임" autoFocus />
            <div className="al-pd-btns">
              <button className="al-pd-save" onClick={completeOnboarding}>
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && passwordRecoveryOpen && (
        <div className="al-modal-bg">
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">새 비밀번호 설정</h3>
            <p className="al-modal-sub">메일 링크 확인이 끝났어. 앞으로 쓸 비밀번호를 새로 정해줘.</p>
            <input className="al-pd-input" type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 6자 이상"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) updateRecoveredPassword(); }} />
            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setPasswordRecoveryOpen(false)}>나중에</button>
              <button className="al-modal-save" disabled={newPassword.length < 6 || authLoading} onClick={updateRecoveredPassword}>저장</button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && deleteTarget && (
        <div className="al-modal-bg" onClick={() => setDeleteTarget(null)}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">캐릭터 삭제</h3>
            <p className="al-modal-sub">
              {deleteTarget.char?.name || "이 캐릭터"}를 삭제할까요? 피드, 그림, 팔로잉까지 이 계정 저장값에서 함께 지워져.
            </p>
            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="al-modal-danger" onClick={confirmDeleteCharacter}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && publicProfile && (
        <div className="al-modal-bg" onClick={() => setPublicProfile(null)}>
          <div className="al-public-profile" onClick={(e) => e.stopPropagation()}>
            <button className="al-public-back" onClick={() => setPublicProfile(null)}>‹</button>
            <div className="al-public-banner">
              {publicProfile.headerImg && <img src={publicProfile.headerImg} alt="" />}
            </div>
            <div className="al-public-avatar">
              {publicProfile.avatarImg ? <img src={publicProfile.avatarImg} alt="" /> : (publicProfile.name?.trim()[0] || "?")}
            </div>
            <div className="al-public-body">
              <div className="al-public-main">
                <div className="al-name-line">
                  <h3>{publicProfile.name}</h3>
                  <WorldChip c={publicProfile} fallback="public-profile" />
                </div>
                <span>@{publicProfile.handle || publicProfile.name?.replace(/\s/g, "").toLowerCase()}</span>
              </div>
              <p className="al-public-age">{publicProfile.age || "설정 비공개"}</p>
              {publicProfile.surface && <span className="al-public-tag">{publicProfile.surface}</span>}
              <div className="al-public-stats">
                <b>{publicFollowingCount(publicProfile)}</b> 팔로잉
                <b>{publicFollowerCount(publicProfile).toLocaleString()}</b> 팔로워
              </div>
              <div className="al-public-actions">
                <button className="al-public-dm" onClick={() => {
                  setPublicProfile(null);
                  requestDmEntry(publicProfile, "char");
                }}>
                  ✉ 바로 DM
                </button>
                <button className={`al-public-follow ${isFollowing(publicProfile.id) ? "on" : ""}`} onClick={() => toggleFollow(publicProfile)}>
                  {isFollowing(publicProfile.id) ? "팔로잉 취소" : "+ 팔로우"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canUseApp && worldModal && (
        <div className="al-modal-bg" onClick={() => setWorldModal(null)}>
          <div className="al-world-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="al-world-view-head">
              <div>
                <h3>{worldModal.name}의 세계관</h3>
                {worldModal.handle && <span>@{worldModal.handle}</span>}
              </div>
              <button onClick={() => setWorldModal(null)}>닫기</button>
            </div>
            <p>{worldModal.world}</p>
          </div>
        </div>
      )}

      {canUseApp && followPanel && !publicProfile && (
        <div className="al-modal-bg" onClick={() => setFollowPanel(null)}>
          <div className="al-follow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="al-follow-modal-head">
              <h3>{followPanel === "following" ? "팔로잉" : "팔로워"}</h3>
              <button onClick={() => setFollowPanel(null)}>닫기</button>
            </div>
            {(() => {
              const list = followPanel === "following" ? following : (activeSharedId ? sharedFollowers.rows : myFollowers());
              if (followPanel === "followers" && activeSharedId && sharedFollowers.loading) {
                return <p className="al-follow-empty">팔로워 불러오는 중...</p>;
              }
              if (followPanel === "followers" && activeSharedId && sharedFollowers.error) {
                return <p className="al-follow-empty">팔로워 로딩 실패: {sharedFollowers.error}</p>;
              }
              return list.length === 0 ? (
                <p className="al-follow-empty">{followPanel === "following" ? "아직 팔로우한 캐릭터가 없어." : "아직 팔로워가 없어."}</p>
              ) : (
                <div className="al-follow-modal-list">
                  {list.map((f) => (
                    <div key={f.id} className="al-follow-modal-row">
                      <div className="al-follow-modal-item">
                        <button className="al-follow-modal-main" onClick={() => setPublicProfile(f)}>
                          <span className="al-follow-modal-av">{f.name.trim()[0] || "?"}</span>
                          <span className="al-follow-modal-info">
                            <b>{f.name}</b>
                            <small>@{f.handle || f.name.replace(/\s/g, "").toLowerCase()} · {f.owner || "공유 캐릭터"}</small>
                          </span>
                        </button>
                        <WorldChip c={f} fallback={`follow-${f.id}`} />
                        <i>{followPanel === "followers" ? "팔로워" : (isFollowing(f.id) ? "팔로잉" : "보기")}</i>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {canUseApp && pendingDm && (
        <div className="al-modal-bg" onClick={() => setPendingDm(null)}>
          <div className="al-world-modal" onClick={(e) => e.stopPropagation()}>
            {(!pendingDm.mode || pendingDm.stage === "world") ? (
              <>
                <h3>어느 세계관으로 들어갈까?</h3>
                <p>{pendingDm.peer.name}와의 DM에서 장면 기준을 정해줘. 캐릭터 정체성은 유지돼.</p>
                <div className="al-world-options">
                  <button onClick={() => chooseDmWorldMode("their")}>
                    <b>상대 세계관</b>
                    <span>{pendingDm.peer.name}의 세계로 들어가기</span>
                  </button>
                  <button onClick={() => chooseDmWorldMode("mine")}>
                    <b>내 세계관</b>
                    <span>{char.name || "내 캐릭터"}의 세계로 데려오기</span>
                  </button>
                  <button onClick={() => chooseDmWorldMode("bridge")}>
                    <b>중간다리</b>
                    <span>ALIVE DM/공유 타임라인에서 만나기</span>
                  </button>
                </div>
              </>
            ) : pendingDm.stage === "chatKind" ? (
              <>
                <h3>어떤 채팅방으로 만들까?</h3>
                <p>이 선택에 따라 저장 위치가 달라져. NPC 채팅은 내 계정 전용, 공유 DM은 상대 오너와 같은 방을 봐.</p>
                <div className="al-world-options">
                  <button onClick={() => finishDmChatKind("npc")}>
                    <b>NPC처럼 대화</b>
                    <span>{pendingDm.peer.name}을 AI 캐릭터로 굴리는 내 전용 방</span>
                  </button>
                  <button onClick={() => finishDmChatKind("shared")}>
                    <b>상대 오너와 DM 공유</b>
                    <span>상대 계정에서도 같은 대화가 보이는 공용 방</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>설정을 조금 다듬을까요?</h3>
                <p>이 DM방에서만 적용돼. 예: 상대 세계관에 들어온 이유, 복장, 능력 제한, 처음 만난 장소.</p>
                <textarea className="al-world-note" value={dmWorldDraft} onChange={(e) => setDmWorldDraft(e.target.value)}
                  placeholder="예: 리안은 해군 기지 근처에 잘못 떨어졌다. 마법은 약하게만 쓸 수 있다." />
                <div className="al-world-actions">
                  <button onClick={() => finishDmWorldSetup(true)}>그대로 시작</button>
                  <button className="primary" onClick={() => finishDmWorldSetup(false)}>다듬고 시작</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {canUseApp && dmSettingsOpen && peer && (
        <div className="al-modal-bg" onClick={() => setDmSettingsOpen(false)}>
          <div className="al-world-modal" onClick={(e) => e.stopPropagation()}>
            <h3>이 DM방 세계관 설정</h3>
            <p>이 설정은 지금 대화방에만 적용돼. 바꾸면 다음 답장부터 반영돼.</p>
            <div className="al-world-options compact">
              <button className={dmPrefDraft.mode === "their" ? "on" : ""} onClick={() => setDmPrefDraft((p) => ({ ...p, mode: "their" }))}>
                <b>상대 세계관</b>
                <span>{peer.name}의 세계로 들어가기</span>
              </button>
              <button className={dmPrefDraft.mode === "mine" ? "on" : ""} onClick={() => setDmPrefDraft((p) => ({ ...p, mode: "mine" }))}>
                <b>내 세계관</b>
                <span>{char.name || "내 캐릭터"}의 세계로 데려오기</span>
              </button>
              <button className={dmPrefDraft.mode === "bridge" ? "on" : ""} onClick={() => setDmPrefDraft((p) => ({ ...p, mode: "bridge" }))}>
                <b>중간다리</b>
                <span>ALIVE DM/공유 타임라인</span>
              </button>
            </div>
            <textarea className="al-world-note" value={dmPrefDraft.note}
              onChange={(e) => setDmPrefDraft((p) => ({ ...p, note: e.target.value }))}
              placeholder="이 방에서만 적용할 보정. 예: 능력 제한, 처음 만난 장소, 들어온 이유." />
            <div className="al-world-actions">
              <button onClick={() => setDmSettingsOpen(false)}>취소</button>
              <button className="primary" onClick={saveDmSettings}>저장</button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && personaDraft && (
        <div className="al-modal-bg" onClick={() => setPersonaDraft(null)}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">🎭 {personaDraft.id ? "페르소나 수정" : "새 페르소나"}</h3>
            <p className="al-modal-sub">캐릭터에게 다가갈 또 다른 나. 캐릭터처럼 호감도·관계가 따로 쌓여.</p>
            <input className="al-pd-input" placeholder="이름" value={personaDraft.name}
              onChange={(e) => setPersonaDraft({ ...personaDraft, name: e.target.value })} />
            <input className="al-pd-input" placeholder="나이·한 줄 설정 (예: 24, 떠돌이 사진가)" value={personaDraft.age}
              onChange={(e) => setPersonaDraft({ ...personaDraft, age: e.target.value })} />
            <textarea className="al-pd-input area" placeholder="성격·배경 (어떤 사람인지)" value={personaDraft.persona}
              onChange={(e) => setPersonaDraft({ ...personaDraft, persona: e.target.value })} />
            <input className="al-pd-input" placeholder="말투 (예: 나른한 반말, 존댓말…)" value={personaDraft.speech}
              onChange={(e) => setPersonaDraft({ ...personaDraft, speech: e.target.value })} />
            <div className="al-pd-btns">
              {personaDraft.id && (
                <button className="al-pd-del" onClick={() => {
                  deletePersona(personaDraft.id);
                  setPersonaDraft(null);
                }}>삭제</button>
              )}
              <button className="al-pd-cancel" onClick={() => setPersonaDraft(null)}>취소</button>
              <button className="al-pd-save" disabled={!personaDraft.name.trim()} onClick={() => {
                if (personaDraft.id) {
                  setPersonas((ps) => ps.map((p) => p.id === personaDraft.id ? { ...personaDraft } : p));
                } else {
                  const np = { ...personaDraft, id: Date.now() };
                  setPersonas((ps) => [...ps, np]);
                  if (peer) setSpeakAs(`p:${np.id}`); // DM이면 만들자마자 그 페르소나로
                  if (commentOn) setCommentAs(`p:${np.id}`); // 댓글 작성 중이면 그 화자로
                }
                setPersonaDraft(null);
              }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {proposal && (
        <div className="al-modal-bg">
          <div className="al-modal al-proposal" onClick={(e) => e.stopPropagation()}>
            <div className="al-prop-heart">♥</div>
            <div className="al-prop-who">{proposal.asker}</div>
            <p className="al-prop-line">"{proposal.line}"</p>
            <p className="al-prop-sub">{proposal.asker}의 마음이 {proposal.other}에게 기울었어. 어떻게 할까?</p>
            <div className="al-prop-btns">
              <button className="al-prop-yes" onClick={() => resolveProposal(true)}>응, 가봐! 💘</button>
              <button className="al-prop-no" onClick={() => resolveProposal(false)}>아직은 아냐</button>
            </div>
          </div>
        </div>
      )}

      {relationResult && (
        <div className="al-modal-bg" onClick={() => setRelationResult(null)}>
          <div className="al-modal al-proposal" onClick={(e) => e.stopPropagation()}>
            <div className={`al-prop-heart ${relationResult.accepted ? "" : "broken"}`}>{relationResult.friendship ? "🤝" : (relationResult.accepted ? "💘" : "💔")}</div>
            {relationResult.friendship ? (
              <>
                <div className="al-prop-who">{relationResult.asker}와 {relationResult.other}, 더 가까워졌어!</div>
                <p className="al-prop-sub">둘의 사이가 한 단계 깊어졌어. 우정은 서로 마음만 맞으면 자연스럽게 이어지지.</p>
              </>
            ) : relationResult.accepted ? (
              <>
                <div className="al-prop-who">{relationResult.other}도 마음을 받아줬어!</div>
                <p className="al-prop-sub">{relationResult.asker}와 {relationResult.other}, 서로의 관계가 한 단계 깊어졌어. 양쪽 다 이어졌어.</p>
              </>
            ) : (
              <>
                <div className="al-prop-who">{relationResult.other}는 받아주지 않았어…</div>
                <p className="al-prop-sub">{relationResult.asker}의 마음만 남았어. 지금은 <b>짝사랑</b>이야. 마음이 조금 아프지만, 언젠가 닿을지도.</p>
              </>
            )}
            <div className="al-prop-btns">
              <button className="al-prop-yes" onClick={() => setRelationResult(null)}>확인</button>
            </div>
          </div>
        </div>
      )}

      {fixTarget && (
        <div className="al-modal-bg" onClick={() => setFixTarget(null)}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">캐해 바로잡기</h3>
            <p className="al-modal-sub">뭐가 {fixTarget.who || char.name}답지 않았어? 알려주면 다음부턴 안 그래.</p>
            <div className="al-modal-quote">"{fixTarget.text.slice(0, 60)}{fixTarget.text.length > 60 ? "…" : ""}"</div>

            <div className="al-fixchips">
              {QUICK_FIXES.map((q) => (
                <button key={q} className="al-fixchip"
                  onClick={() => setFixText((t) => t ? `${t}, ${q}` : q)}>{q}</button>
              ))}
            </div>
            <textarea className="al-fixinput" value={fixText} onChange={(e) => setFixText(e.target.value)}
              placeholder={`예: 얘는 이럴 때 더 무심하게 말해. 느낌표 안 씀.`} />

            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setFixTarget(null)}>취소</button>
              <button className="al-modal-saveonly" disabled={!fixText.trim()}
                onClick={() => { addCorrection(fixText, fixTarget.who); setFixTarget(null); }}>교정만</button>
              <button className="al-modal-save" disabled={!fixText.trim()}
                onClick={() => {
                  addCorrection(fixText, fixTarget.who);
                  if (fixTarget.type === "post") {
                    setPosts((p) => p.filter((x) => x.id !== fixTarget.id));
                  } else {
                    setDmThread((d) => d.filter((_, idx) => idx !== fixTarget.index));
                  }
                  setFixTarget(null);
                }}>교정+지우기</button>
            </div>
            {(char.corrections || []).length > 0 && (
              <p className="al-fixcount">지금까지 교정 {(char.corrections || []).length}개 — 다음 생성부터 반영돼</p>
            )}
          </div>
        </div>
      )}

      {showRecoveryScreen && (
        <div className="al-phone">
          <div className="al-auth">
            <span className="al-spark">✶</span>
            <h1>화면 복구가 필요해</h1>
            <p>저장된 화면 위치가 꼬였어. 홈으로 돌아가거나 로그인 상태를 초기화할 수 있어.</p>
            <button className="al-auth-btn" onClick={() => { setPeer(null); setStep("home"); setStateReady(true); }}>홈으로 돌아가기</button>
            <button className="al-auth-linkbtn" onClick={recoverAuthScreen}>로그인 상태 초기화</button>
            {authMessage && <p className="al-auth-msg">{authMessage}</p>}
          </div>
        </div>
      )}

      <p className="al-footer">ALIVE · prototype</p>
    </div>
  );
}

const css = `
*{ box-sizing:border-box; }
html,body,#root{ margin:0; min-height:100%; background:#15131a; }
body{ overflow-x:hidden; }
.al-root{
  --bg:#15131a; --phone:#191820; --ink:#f4f2f8; --soft:#aaa4b6; --line:#34313d;
  --accent:#9f7cff; --accent2:#ff8fc6; --like:#ff5a8a;
  min-height:100dvh; background:
    radial-gradient(circle at 30% -10%, #30224a 0%, transparent 50%),
    radial-gradient(circle at 80% 10%, #3b2032 0%, transparent 45%),
    var(--bg);
  display:flex; flex-direction:column; align-items:center;
  padding:0 16px;
  font-family:'Pretendard','Inter',-apple-system,'Apple SD Gothic Neo',sans-serif; color:var(--ink);
}
.al-phone{ width:100%; max-width:420px; min-height:100dvh; background:var(--phone);
  border:1px solid var(--line); border-radius:26px; overflow:hidden;
  box-shadow:0 30px 70px -30px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05) inset; }

/* setup */
.al-setup{ padding:30px 22px 26px; display:flex; flex-direction:column; gap:16px; }
.al-setup-head{ text-align:center; margin-bottom:4px; }
.al-spark{ font-size:24px; color:var(--accent); }
.al-setup-head h1{ font-size:24px; font-weight:800; margin:8px 0 6px; letter-spacing:-.02em; }
.al-setup-head p{ font-size:13.5px; color:var(--soft); margin:0; line-height:1.6; }

.al-field{ display:flex; flex-direction:column; gap:7px; }
.al-field > span{ font-size:12.5px; font-weight:700; color:var(--ink); letter-spacing:.02em;
  display:flex; align-items:center; gap:7px; }
.al-hint{ font-size:11px; font-weight:400; color:var(--soft); font-style:normal; }
.al-row{ display:flex; gap:10px; }
.al-row .al-field{ flex:1; }
.al-field input, .al-field textarea{ width:100%; background:#1a1a20; border:1px solid var(--line);
  border-radius:11px; padding:12px 13px; font-family:inherit; font-size:14px; color:var(--ink); resize:none; }
.al-field input::placeholder, .al-field textarea::placeholder{ color:#55555f; }
.al-field input:focus, .al-field textarea:focus{ outline:none; border-color:var(--accent); }
.al-field textarea{ min-height:64px; line-height:1.55; }

.al-tones{ display:flex; flex-wrap:wrap; gap:7px; }
.al-tone{ flex:1 1 calc(33% - 7px); min-width:96px; background:#1a1a20; border:1px solid var(--line);
  border-radius:11px; padding:10px 11px; cursor:pointer; font-family:inherit; text-align:left;
  display:flex; flex-direction:column; gap:2px; transition:.16s; color:var(--ink); }
.al-tone i{ font-size:10.5px; color:var(--soft); font-style:normal; }
.al-tone.on{ border-color:var(--accent); background:linear-gradient(135deg, #221a38, #1a1a20);
  box-shadow:0 0 0 1px var(--accent) inset; }
.al-tone.on i{ color:#c8b3ff; }

.al-start{ margin-top:8px; padding:15px; border:none; border-radius:13px; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:800; letter-spacing:.02em;
  background:linear-gradient(135deg, var(--accent), var(--accent2)); color:#fff; transition:.18s; }
.al-start:hover:not(:disabled){ filter:brightness(1.08); }
.al-start:disabled{ background:#2a2a32; color:#5a5a64; cursor:not-allowed; }

.al-dump{ width:100%; min-height:200px; background:#1a1a20; border:1px solid var(--line);
  border-radius:13px; padding:15px; font-family:inherit; font-size:14.5px; line-height:1.7;
  color:var(--ink); resize:none; }
.al-dump::placeholder{ color:#55555f; line-height:1.7; }
.al-dump:focus{ outline:none; border-color:var(--accent); }
.al-dump-note{ font-size:12px; color:var(--soft); text-align:center; margin:2px 0 0; }

/* guide chips */
.al-guidechips{ display:flex; flex-wrap:wrap; gap:6px; }
.al-guidechip{ font-size:11.5px; color:var(--soft); background:#18181e; border:1px solid var(--line);
  padding:5px 10px; border-radius:20px; }

/* roleplay log (option) */
.al-rp{ background:#15141b; border:1px solid var(--line); border-radius:13px; padding:13px 14px; }
.al-rp-head{ display:flex; align-items:center; gap:8px; }
.al-rp-head > span:first-child{ font-size:13px; font-weight:700; color:var(--ink); }
.al-rp-opt{ font-size:10.5px; font-weight:700; color:var(--accent); background:#221a38;
  border:1px solid #2e2640; padding:2px 8px; border-radius:20px; letter-spacing:.04em; }
.al-rp-desc{ font-size:11.5px; color:var(--soft); margin:7px 0 9px; line-height:1.5; }
.al-rp-box{ width:100%; min-height:90px; background:#1a1a20; border:1px solid var(--line);
  border-radius:10px; padding:12px; font-family:inherit; font-size:13.5px; line-height:1.7;
  color:var(--ink); resize:none; }
.al-rp-box::placeholder{ color:#55555f; line-height:1.7; }
.al-rp-box:focus{ outline:none; border-color:var(--accent); }

/* example cards */
.al-examples{ display:flex; flex-direction:column; gap:8px; }
.al-examples-lbl{ font-size:11.5px; color:var(--soft); }
.al-example-cards{ display:flex; gap:8px; }
.al-example{ flex:1; text-align:left; background:#18141f; border:1px solid var(--line); border-radius:11px;
  padding:11px 12px; cursor:pointer; font-family:inherit; display:flex; flex-direction:column; gap:3px; transition:.15s; }
.al-example:hover{ border-color:var(--accent); background:#201a30; }
.al-example-name{ font-size:13.5px; font-weight:800; color:var(--ink); }
.al-example-desc{ font-size:11.5px; color:var(--soft); }

/* gallery */
.al-gallery{ margin-top:14px; padding-top:13px; border-top:1px solid var(--line); }
.al-gallery-head{ display:flex; justify-content:space-between; align-items:center; }
.al-gallery-head > span{ font-size:12.5px; font-weight:700; color:var(--ink); }
.al-upload{ font-size:12px; color:var(--accent); cursor:pointer; font-weight:600; }
.al-upload:hover{ text-decoration:underline; }
.al-gallery-empty{ font-size:11.5px; color:var(--soft); line-height:1.55; margin:8px 0 0; }
.al-gallery-strip{ display:flex; gap:7px; margin-top:9px; flex-wrap:wrap; }
.al-thumb{ position:relative; width:54px; height:54px; border-radius:9px; overflow:hidden; border:1px solid var(--line); }
.al-thumb img{ width:100%; height:100%; object-fit:cover; }
.al-thumb-x{ position:absolute; top:2px; right:2px; width:16px; height:16px; border-radius:50%;
  background:rgba(0,0,0,.6); color:#fff; border:none; font-size:12px; line-height:1; cursor:pointer; padding:0; }

/* post media */
.al-post-img{ margin-top:10px; border-radius:13px; overflow:hidden; border:1px solid var(--line); }
.al-post-img img{ width:100%; display:block; max-height:340px; object-fit:cover; }
.al-post-photo{ margin-top:10px; display:flex; align-items:center; gap:10px; padding:14px;
  border-radius:13px; border:1px dashed #3a3550; background:linear-gradient(135deg,#161320,#13131a); }
.al-photo-frame{ font-size:22px; color:var(--accent); opacity:.6; }
.al-photo-desc{ font-size:13px; color:#c4c2cc; font-style:italic; line-height:1.5; }
.al-post-moodcard{ margin-top:10px; padding:11px 14px; border-radius:11px; font-size:13px;
  color:#d8c2ff; background:linear-gradient(135deg,#1d1730,#181421); border:1px solid #2e2640; }
.al-confirm-title{ font-size:22px !important; }
.al-parse-error{ padding:12px 13px; border-radius:11px; background:#22141a; border:1px solid #66303c;
  color:#ffc3ce; font-size:12.5px; line-height:1.55; }
.al-parse-error span{ display:block; color:#ff8fa4; font-weight:800; margin-bottom:4px; }
.al-parse-error p{ margin:0; word-break:break-word; }
.al-retry{ width:100%; padding:12px; border-radius:11px; cursor:pointer; font-family:inherit;
  font-size:13.5px; font-weight:700; background:#221a38; border:1px solid var(--accent); color:#c8b3ff; }
.al-retry:hover{ background:#2a2042; }
.al-confirm-actions{ display:flex; gap:10px; margin-top:8px; }
.al-reparse{ flex-shrink:0; padding:15px 16px; border-radius:13px; cursor:pointer; font-family:inherit;
  font-size:13.5px; font-weight:600; background:#1a1a20; border:1px solid var(--line); color:var(--soft); }
.al-reparse:hover{ border-color:var(--accent); color:var(--ink); }
.al-confirm-go{ flex:1; margin-top:0 !important; }

/* deep analysis card */
.al-analysis{ background:linear-gradient(135deg,#1a1530,#161420); border:1px solid #2e2640;
  border-radius:13px; padding:14px; display:flex; flex-direction:column; gap:9px; }
.al-analysis-head{ font-size:12.5px; font-weight:800; color:#c8b3ff; letter-spacing:.02em; margin-bottom:2px; }
.al-spark-sm{ color:var(--accent); }
.al-an-row{ display:flex; align-items:center; gap:10px; }
.al-an-lbl{ font-size:11.5px; color:#9a92b5; width:64px; flex-shrink:0; font-weight:600; }
.al-warmth-chips{ display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.al-warmth-chip{ padding:5px 12px; border-radius:13px; cursor:pointer; font-family:inherit; font-size:12px;
  font-weight:700; border:1px solid #2a2440; background:#16131f; color:#9aa0b0; }
.al-warmth-chip.on{ background:#2a2440; color:#fff; border-color:#7a5fa0; }
.al-warmth-hint{ font-size:10.5px; color:#7a7488; width:100%; margin-top:2px; }
.al-an-row input{ flex:1; background:#120f1c; border:1px solid #2a2440; border-radius:8px;
  padding:9px 11px; font-family:inherit; font-size:13px; color:var(--ink); }
.al-an-row input::placeholder{ color:#544d6b; }
.al-an-row input:focus{ outline:none; border-color:var(--accent); }

/* auto-post bar */
.al-autobar{ display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:11px 16px; border-bottom:1px solid var(--line);
  background:linear-gradient(135deg,#14101e,#121119); }
.al-autotoggle{ display:flex; align-items:center; gap:8px; background:none; border:none;
  font-family:inherit; font-size:12.5px; font-weight:600; color:var(--soft); cursor:pointer; padding:0; text-align:left; }
.al-autotoggle.on{ color:#c8b3ff; }
.al-autodot{ width:8px; height:8px; border-radius:50%; background:#4a4a52; flex-shrink:0; }
.al-autotoggle.on .al-autodot{ background:var(--accent2); box-shadow:0 0 0 0 var(--accent2);
  animation:pulse 2s infinite; }
@keyframes pulse{ 0%{box-shadow:0 0 0 0 rgba(236,72,153,.5);} 70%{box-shadow:0 0 0 7px rgba(236,72,153,0);} 100%{box-shadow:0 0 0 0 rgba(236,72,153,0);} }
.al-autometa{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
.al-nextin{ font-size:11.5px; color:var(--soft); font-variant-numeric:tabular-nums; }
.al-fast{ font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; cursor:pointer;
  font-family:inherit; background:#1f1a2e; border:1px solid #2e2640; color:#9a92b5; }
.al-fast.on{ background:var(--accent); color:#fff; border-color:var(--accent); }

.al-auto-badge{ font-style:normal; font-size:9.5px; font-weight:800; color:var(--accent2);
  background:#2a1322; border:1px solid #43203a; padding:1px 6px; border-radius:8px; margin-right:6px; }

/* profile */
.al-profile{ position:relative; padding-bottom:14px; border-bottom:1px solid var(--line); }
.al-back{ position:absolute; top:12px; left:12px; z-index:3; width:34px; height:34px; border-radius:50%;
  background:rgba(10,10,12,.6); backdrop-filter:blur(6px); border:none; color:#fff; font-size:22px;
  cursor:pointer; line-height:1; }
.al-banner{ position:relative; height:96px; overflow:hidden; background:linear-gradient(120deg, #2d1f4a, #3a1f33 60%, #1f2d3a); }
.al-banner img{ width:100%; height:100%; display:block; object-fit:cover; }
.al-cover-tools{ position:absolute; right:10px; bottom:9px; display:flex; align-items:center; gap:6px; }
.al-cover-tools label,.al-cover-tools button,.al-avatar-tools label,.al-avatar-tools button{ border:1px solid rgba(255,255,255,.22); border-radius:999px;
  padding:6px 9px; cursor:pointer; font-family:inherit; font-size:10.5px; font-weight:900; color:#fff;
  background:rgba(10,10,12,.58); backdrop-filter:blur(8px); white-space:nowrap; line-height:1; min-width:max-content; }
.al-cover-tools button,.al-avatar-tools button{ color:#ffb3c0; border-color:rgba(255,143,166,.32); }
.al-avatar-wrap{ position:relative; width:max-content; margin:-36px 0 0 18px; }
.al-avatar{ width:72px; height:72px; border-radius:50%; position:relative; overflow:hidden;
  background:linear-gradient(135deg, var(--accent), var(--accent2)); border:4px solid var(--phone);
  display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:800; color:#fff; }
.al-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.al-avatar-tools{ position:absolute; left:76px; bottom:5px; display:flex; align-items:center; gap:5px; width:max-content; }
.al-profile-info{ padding:8px 18px 0; }
.al-profile-info h2{ margin:0; font-size:20px; font-weight:800; letter-spacing:-.01em; }
.al-profile-top-main{ min-width:0; flex:1 1 auto; }
.al-name-line{ display:flex; align-items:center; gap:7px; min-width:0; flex-wrap:wrap; }
.al-world-chip{ flex-shrink:0; border:1px solid #3a3550; border-radius:999px; padding:3px 7px; cursor:pointer;
  background:#1c1730; color:#c8b3ff; font-family:inherit; font-size:10.5px; font-weight:900; line-height:1.1; }
.al-world-chip:hover,.al-world-chip.on{ border-color:var(--accent); color:#fff; background:#241d35; }
.al-world-view-modal{ width:min(390px,calc(100vw - 34px)); max-height:min(620px,82vh); overflow:auto; border-radius:18px;
  border:1px solid #3a3446; background:#17161e; color:var(--ink); box-shadow:0 30px 80px rgba(0,0,0,.48); }
.al-world-view-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px; border-bottom:1px solid var(--line); }
.al-world-view-head h3{ margin:0 0 3px; font-size:18px; line-height:1.2; }
.al-world-view-head span{ color:var(--soft); font-size:12px; }
.al-world-view-head button{ flex-shrink:0; border:none; border-radius:10px; padding:7px 10px; cursor:pointer; font-family:inherit;
  color:#bdb5ca; background:#26212e; font-size:12px; font-weight:900; }
.al-world-view-modal p{ margin:0; padding:16px; color:#d8d3e2; font-size:13.5px; line-height:1.7; white-space:pre-wrap; }
.al-handle{ font-size:13.5px; color:var(--soft); }
.al-bio{ display:flex; gap:6px; margin:9px 0 0; flex-wrap:wrap; }
.al-bio-tag{ font-size:11.5px; padding:3px 9px; border-radius:20px; background:#1f1a2e;
  color:#c8b3ff; border:1px solid #2e2640; }
.al-bio-text{ font-size:13px; color:#bcbcc6; line-height:1.6; margin:10px 0 0; }
.al-share-status{ font-size:11.5px; color:#c8b3ff; line-height:1.5; margin:8px 0 0; word-break:break-all;
  opacity:.72; animation:shareFade 2.2s ease both; }
@keyframes shareFade{ 0%{opacity:0; transform:translateY(-3px);} 14%,72%{opacity:.72; transform:translateY(0);} 100%{opacity:0; transform:translateY(-2px);} }

/* composer */
.al-composer{ padding:14px 16px; border-bottom:1px solid var(--line); }
.al-wake{ width:100%; padding:14px; border-radius:13px; cursor:pointer; font-family:inherit;
  font-size:14.5px; font-weight:700; color:var(--ink); border:1px dashed #3a3550;
  background:linear-gradient(135deg, #1c1730, #18141f); transition:.18s; }
.al-wake:hover:not(:disabled){ border-color:var(--accent); color:#fff; }
.al-wake:disabled{ cursor:default; opacity:.85; }
.al-typing{ display:inline-flex; gap:5px; }
.al-typing i{ width:7px; height:7px; border-radius:50%; background:var(--accent);
  animation:bounce 1.2s infinite both; }
.al-typing i:nth-child(2){ animation-delay:.18s; } .al-typing i:nth-child(3){ animation-delay:.36s; }
@keyframes bounce{ 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }

.al-moods{ }
.al-moods-q{ font-size:13px; color:var(--soft); margin:2px 0 10px; }
.al-moods-grid{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.al-mood{ padding:12px 10px; border-radius:11px; cursor:pointer; font-family:inherit; font-size:13px;
  background:#1a1a20; border:1px solid var(--line); color:var(--ink); transition:.15s; }
.al-mood:hover{ border-color:var(--accent); background:#201a30; color:#fff; }
.al-moods-cancel{ width:100%; margin-top:9px; padding:9px; background:none; border:none;
  color:var(--soft); font-family:inherit; font-size:12.5px; cursor:pointer; }

/* feed */
.al-feed{ min-height:120px; }
.al-empty{ text-align:center; padding:50px 24px; color:var(--soft); }
.al-empty span{ font-size:15px; }
.al-empty p{ font-size:13px; margin:8px 0 0; line-height:1.6; color:#6a6a74; }
.al-feed-tabs{ display:grid; grid-template-columns:1fr 1fr; border-top:1px solid var(--line); border-bottom:1px solid var(--line);
  background:#121119; }
.al-feed-tabs button{ min-width:0; padding:12px 8px; border:none; border-bottom:2px solid transparent; cursor:pointer;
  background:transparent; color:var(--soft); font-family:inherit; font-size:13px; font-weight:900; }
.al-feed-tabs button.on{ color:#fff; border-bottom-color:var(--accent); background:#171320; }
.al-feed-tabs b{ margin-left:5px; color:#c8b3ff; font-size:11px; }

.al-post{ display:flex; gap:11px; padding:15px 16px; border-bottom:1px solid var(--line);
  animation:fadein .4s ease; }
@keyframes fadein{ from{opacity:0; transform:translateY(-6px);} to{opacity:1; transform:none;} }
.al-post-av{ width:42px; height:42px; flex-shrink:0; border-radius:50%;
  background:linear-gradient(135deg, var(--accent), var(--accent2)); display:flex;
  align-items:center; justify-content:center; font-size:18px; font-weight:800; color:#fff; overflow:hidden; }
.al-post-av img{ width:100%; height:100%; object-fit:cover; display:block; }
.al-post-body{ flex:1; min-width:0; }
.al-post-head{ display:flex; align-items:center; gap:5px; font-size:13.5px; }
.al-post-name{ font-weight:800; }
.al-post-handle, .al-post-time{ color:var(--soft); font-size:12.5px; }
.al-post-text{ font-size:14.5px; line-height:1.65; margin:5px 0 0; white-space:pre-wrap; color:#e4e4ea; }
.al-edited{ margin-left:6px; color:#6f687c; font-size:10.5px; font-style:normal; font-weight:700; }
.al-editbox{ margin-top:8px; display:flex; flex-direction:column; gap:8px; }
.al-editbox textarea{ width:100%; min-height:86px; resize:vertical; background:#15131c; border:1px solid #3a3550;
  border-radius:11px; padding:11px 12px; color:var(--ink); font-family:inherit; font-size:14px; line-height:1.55; }
.al-editbox textarea:focus{ outline:none; border-color:var(--accent); }
.al-edit-actions{ display:flex; justify-content:flex-end; gap:7px; }
.al-edit-actions button, .al-comment-editbox button{ border:1px solid var(--line); background:#1a1a20; color:var(--soft);
  border-radius:8px; padding:6px 10px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:700; }
.al-edit-actions button.primary, .al-comment-editbox button:last-child{ border-color:var(--accent); background:#221a38; color:#d8cbff; }
.al-edit-actions button:disabled, .al-comment-editbox button:disabled{ opacity:.45; cursor:not-allowed; }
.al-quoted{ margin-top:10px; border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:#15131c; }
.al-quoted-head{ display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.al-quoted-av{ width:20px; height:20px; flex-shrink:0; border-radius:50%; font-size:10px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-quoted-name{ font-size:12.5px; font-weight:800; color:var(--ink); }
.al-quoted-handle{ font-size:11px; color:var(--soft); }
.al-quoted-text{ font-size:13px; line-height:1.5; margin:0; color:#bcbcc6; }
.al-post-actions{ display:flex; align-items:center; gap:10px; margin-top:11px; flex-wrap:wrap; }
.al-like{ background:none; border:none; color:var(--soft); font-family:inherit; font-size:13px;
  cursor:pointer; padding:0; transition:.15s; }
.al-like:hover{ color:var(--like); }
.al-like.on{ color:var(--like); }
.al-post-mood{ font-size:11px; color:#5a5a64; background:#18181e; padding:2px 9px; border-radius:20px; }
.al-mini-action{ background:none; border:none; color:#777180; font-family:inherit; font-size:11.5px; font-weight:700; cursor:pointer; padding:0; }
.al-mini-action:hover{ color:#c8b3ff; }
.al-mini-action.danger:hover{ color:#ff8fa4; }

.al-footer{ display:none; }

/* DM 컨트롤 */
.al-dmctrl{ padding:10px 14px 0; }
.al-speakas, .al-chatmode{ display:flex; align-items:center; gap:6px; }
.al-ctrl-lbl{ font-size:11px; color:var(--soft); flex-shrink:0; }
.al-speakas button, .al-chatmode button{ padding:5px 12px; border-radius:16px; cursor:pointer; font-family:inherit;
  font-size:11.5px; font-weight:600; background:#1a1a20; border:1px solid var(--line); color:var(--soft); }
.al-speakas button.on, .al-chatmode button.on{ background:var(--accent); color:#fff; border-color:var(--accent); }
.al-owner-persona{ width:100%; margin-top:8px; background:#1a1a20; border:1px solid var(--line);
  border-radius:9px; padding:8px 11px; font-family:inherit; font-size:12.5px; color:var(--ink); }
.al-owner-persona:focus{ outline:none; border-color:var(--accent); }
.al-chatmode{ margin-bottom:8px; }

/* 관계 시각화 */
.al-relbox{ background:linear-gradient(135deg,#1d1426,#161420); border:1px solid #2e2640; border-radius:13px; padding:14px; }
.al-relbox-head{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; }
.al-relbox-head > span:first-child{ font-size:13px; font-weight:800; color:var(--accent2); }
.al-relbox-hint{ font-size:10.5px; color:var(--soft); }
.al-relviz{ display:flex; flex-direction:column; gap:8px; margin-bottom:10px; }
.al-relviz-item{ display:flex; flex-direction:column; gap:5px; padding:10px 12px; background:#15111f; border:1px solid #2a2440; border-radius:11px; }
.al-relviz-line2{ display:flex; align-items:center; gap:8px; font-size:12.5px; }
.al-relviz-me{ font-weight:800; color:var(--ink); background:#221a38; padding:4px 10px; border-radius:14px; }
.al-relviz-arrow{ font-size:13px; color:var(--accent2); }
.al-relviz-peer{ font-weight:700; color:#c8b3ff; background:#1a1a20; border:1px solid #2e2640; padding:4px 10px; border-radius:14px; }
.al-relviz-rel{ font-size:12px; color:#b8b2c8; line-height:1.5; padding-left:2px; }
.al-relinput{ width:100%; background:#120f1c; border:1px solid #2a2440; border-radius:9px;
  padding:9px 11px; font-family:inherit; font-size:13px; color:var(--ink); }
.al-relinput:focus{ outline:none; border-color:var(--accent); }
/* 자동 기억 표시 */
.al-memlist{ margin-top:10px; padding:14px; background:#120f1c; border:1px solid #2a2440; border-radius:11px; }
.al-rellist{ margin-top:10px; padding:12px 13px; background:#120f1c; border:1px solid #2a2440; border-radius:11px; display:flex; flex-direction:column; gap:12px; }
.al-rel{ padding:11px 12px; background:#15111f; border:1px solid #241f38; border-radius:11px; }
.al-rel-top{ display:flex; align-items:center; gap:8px; margin-bottom:7px; }
.al-rel-av{ width:26px; height:26px; flex-shrink:0; border-radius:50%; font-size:12px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-rel-who{ font-size:13px; font-weight:800; color:var(--ink); }
.al-rel-desc{ font-size:12px; color:#b8b2c8; line-height:1.55; margin:0 0 8px; }
.al-rel-stage{ font-size:11px; color:var(--soft); margin-left:auto; }
.al-rel-onesided{ font-size:10px; font-weight:700; color:#ff8aa0; background:#3a1f2a; padding:2px 7px; border-radius:8px; }
.al-rel-onesided-note{ display:block; font-size:10.5px; color:#d68a9a; margin-top:6px; }
.al-rel-bar{ height:5px; background:#1f1b2e; border-radius:3px; overflow:hidden; }
.al-rel-fill{ height:100%; background:linear-gradient(90deg,#9d6bff,#c8b3ff); border-radius:3px; }
.al-rel-fill.neg{ background:linear-gradient(90deg,#d65a7a,#ff8aa0); }
.al-rel-edit{ display:grid; grid-template-columns:auto minmax(0,1fr) 54px; align-items:center; gap:8px; margin-top:9px; }
.al-rel-edit span{ font-size:10.5px; color:#9a92b5; font-weight:900; white-space:nowrap; }
.al-rel-edit input[type="range"]{ width:100%; accent-color:var(--accent); }
.al-rel-edit input[type="number"]{ width:54px; min-width:0; border:1px solid #342e40; border-radius:8px; padding:5px 6px;
  background:#111018; color:#d9ccff; font-family:inherit; font-size:11px; font-weight:900; text-align:center; }
.al-mem-peers{ display:flex; flex-direction:column; gap:9px; }
.al-mem-peer-card{ display:flex; align-items:center; gap:10px; width:100%; padding:12px; border-radius:10px;
  cursor:pointer; font-family:inherit; text-align:left; background:#171321; border:1px solid #2a2440; color:var(--ink); }
.al-mem-peer-card:hover{ border-color:var(--accent); background:#1d1730; }
.al-mem-peer-av{ width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  flex-shrink:0; color:#fff; font-size:13px; font-weight:800; background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-mem-peer-info{ display:flex; flex-direction:column; gap:1px; min-width:0; }
.al-mem-peer-info b{ font-size:13px; }
.al-mem-peer-info small{ font-size:11px; color:var(--soft); }
.al-mem-detail-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:9px; }
.al-mem-detail-head button{ background:none; border:none; color:var(--soft); cursor:pointer; font-family:inherit; font-size:12px; padding:0; }
.al-mem-detail-head span{ font-size:13px; font-weight:800; color:#c8b3ff; }
.al-mem-card{ margin-bottom:9px; padding:12px; border:1px solid #2f2942; border-radius:13px;
  background:linear-gradient(135deg,#171321,#12111a); }
.al-mem-card.pinned{ border-color:#5b4a78; background:linear-gradient(135deg,#1d1730,#14111d); }
.al-mem-card-top{ display:flex; align-items:center; gap:6px; margin-bottom:8px; }
.al-mem-kind,.al-mem-source,.al-mem-pin{ flex-shrink:0; border-radius:999px; padding:3px 7px; font-size:10.5px; font-weight:900; }
.al-mem-kind{ color:#ffd6e9; background:#2a1322; border:1px solid #4c233c; }
.al-mem-source{ color:#b8b2c8; background:#1a1822; border:1px solid #332e42; }
.al-mem-pin{ color:#ffd27a; background:#2a2112; border:1px solid #5a4520; }
.al-mem-card-actions{ margin-left:auto; display:flex; gap:5px; }
.al-mem-card-actions button{ border:1px solid #3a3550; border-radius:8px; padding:5px 7px; cursor:pointer;
  background:#1c1730; color:#c8b3ff; font-family:inherit; font-size:10.5px; font-weight:900; }
.al-mem-card-actions button.danger{ color:#ff9aaa; background:#241419; border-color:#502330; }
.al-mem-card-text{ margin:0; color:#e4dfeb; font-size:13px; line-height:1.65; white-space:pre-wrap; word-break:keep-all; overflow-wrap:anywhere; }
.al-mem-editbox{ display:flex; flex-direction:column; gap:8px; }
.al-mem-editbox textarea,.al-mem-editbox select{ width:100%; background:#171321; border:1px solid #3a3446; border-radius:10px;
  padding:10px 11px; color:var(--ink); font-family:inherit; font-size:12.5px; }
.al-mem-editbox textarea{ min-height:86px; line-height:1.6; resize:vertical; }
.al-mem-editbox textarea:focus,.al-mem-editbox select:focus{ outline:none; border-color:var(--accent); }
.al-mem-edit{ display:flex; gap:7px; align-items:stretch; margin-bottom:7px; }
.al-mem-edit textarea, .al-mem-add textarea, .al-mem-add input, .al-mem-add select{ width:100%; background:#171321; border:1px solid #2a2440;
  border-radius:9px; color:var(--ink); font-family:inherit; font-size:12px; line-height:1.45; padding:8px 9px; resize:vertical; }
.al-mem-add label{ font-size:11px; color:#9a92b5; font-weight:800; }
.al-mem-edit textarea{ min-height:58px; }
.al-mem-edit textarea:focus, .al-mem-add textarea:focus, .al-mem-add input:focus, .al-mem-add select:focus{ outline:none; border-color:var(--accent); }
.al-mem-edit button, .al-mem-add button{ flex-shrink:0; border-radius:9px; border:1px solid #3a2940; cursor:pointer;
  font-family:inherit; font-size:11px; font-weight:800; color:#ffb2c0; background:#24131b; padding:0 10px; }
.al-mem-add-toggle{ width:100%; margin-top:12px; min-height:40px; border:1px dashed #4a3c68; border-radius:12px; cursor:pointer;
  background:#171321; color:#c8b3ff; font-family:inherit; font-size:12.5px; font-weight:900; }
.al-mem-add-toggle:hover{ border-color:var(--accent); background:#1d1730; color:#fff; }
.al-mem-add{ display:flex; flex-direction:column; gap:8px; margin-top:12px; padding:12px; background:#171321;
  border:1px solid #2a2440; border-radius:11px; }
.al-mem-add.slide{ animation:memSlide .2s ease both; transform-origin:top; }
@keyframes memSlide{ from{ opacity:0; transform:translateY(-6px) scaleY(.96); } to{ opacity:1; transform:translateY(0) scaleY(1); } }
.al-mem-add.compact{ margin-top:12px; }
.al-mem-add-title{ font-size:12px; color:#c8b3ff; font-weight:800; margin-bottom:2px; }
.al-mem-add textarea{ min-height:70px; }
.al-mem-add button.al-mem-add-btn{ min-height:38px; color:#fff; background:linear-gradient(135deg,#c8b3ff,#9d6bff);
  border-color:#9d6bff; font-size:12.5px; }
.al-mem-add button:disabled{ opacity:.45; cursor:default; }
/* DM 내 상대 기억 */
.al-peermem{ padding:0 14px 6px; }
.al-peermem-toggle{ width:100%; text-align:left; padding:8px 11px; border-radius:9px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:700; color:#9eddb0; background:#121a16; border:1px solid #1f3a2c; }
.al-peermem-toggle:hover{ border-color:#2f6a4c; }
.al-peermem-list{ margin-top:6px; padding:9px 11px; background:#101810; border:1px solid #1f3a2c; border-radius:9px; }
.al-peermem-item{ font-size:12px; color:#c4c0cf; line-height:1.6; }
.al-mem-note{ font-size:11px; color:var(--soft); margin:8px 0 0; }

/* DM 대화 목록 */
.al-convlist{ min-height:180px; }
.al-conv-empty{ text-align:center; padding:50px 24px; color:var(--soft); }
.al-conv-empty p{ font-size:14px; margin:0 0 6px; }
.al-conv-empty span{ font-size:12.5px; color:#6a6a74; }
.al-convitem{ width:100%; display:flex; align-items:center; gap:8px; padding:10px 12px 10px 16px;
  background:none; border-bottom:1px solid var(--line); transition:.15s; color:var(--ink); }
.al-convitem:hover{ background:#161420; }
.al-convmain{ min-width:0; flex:1; display:flex; align-items:center; gap:12px; padding:4px 0; cursor:pointer;
  font-family:inherit; background:none; border:none; text-align:left; color:var(--ink); }
.al-convitem-av{ width:44px; height:44px; flex-shrink:0; border-radius:50%; font-size:18px; font-weight:800;
  color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; }
.al-convitem-info{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.al-convitem-name{ font-size:15px; font-weight:700; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-convitem-last{ font-size:12.5px; color:var(--soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-convitem-count{ font-size:11px; color:var(--soft); background:#1f1a2e; padding:2px 8px; border-radius:10px; flex-shrink:0; }
.al-conv-actions{ display:flex; flex-direction:column; gap:5px; flex-shrink:0; }
.al-conv-actions button{ min-width:42px; border:1px solid #3a3550; border-radius:8px; padding:5px 7px; cursor:pointer;
  background:#1c1730; color:#c8b3ff; font-family:inherit; font-size:10.5px; font-weight:900; }
.al-conv-actions button.danger{ color:#ff9aaa; background:#241419; border-color:#502330; }

.al-newchat{ padding:14px 16px; border-top:1px solid var(--line); }
.al-newchat-btn{ width:100%; padding:13px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:14px; font-weight:700; color:var(--accent); background:#16121f; border:1px dashed #3a3550; text-align:center; }
.al-newchat-btn:hover{ border-color:var(--accent); background:#1c1730; }
.al-newchat-lbl{ font-size:12px; color:var(--soft); margin:0 0 10px; }
.al-newchat-targets{ display:flex; flex-direction:column; gap:8px; }
.al-newchat-target{ display:flex; align-items:center; gap:10px; padding:11px 13px; cursor:pointer;
  font-family:inherit; color:var(--ink); background:#161420; border:1px solid var(--line); border-radius:11px; transition:.15s; }
.al-newchat-target:hover{ border-color:var(--accent); background:#1c1730; }
.al-nt-av{ width:32px; height:32px; flex-shrink:0; border-radius:50%; font-size:14px; font-weight:800;
  color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; }
.al-nt-name{ font-size:14px; font-weight:700; flex:1; text-align:left; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-nt-rel{ font-size:11px; color:var(--accent2); flex-shrink:0; }
.al-nt-none{ font-size:12.5px; color:var(--soft); line-height:1.5; }
.al-newchat-cancel{ width:100%; margin-top:9px; padding:9px; background:none; border:none;
  color:var(--soft); font-family:inherit; font-size:12.5px; cursor:pointer; }

/* 직접 지시 */
.al-directive{ display:flex; align-items:center; gap:9px; padding:10px 16px; border-bottom:1px solid var(--line); background:#100e18; }
.al-directive-lbl{ font-size:11.5px; color:var(--accent); font-weight:700; flex-shrink:0; }
.al-directive-input{ flex:1; background:#1a1a20; border:1px solid var(--line); border-radius:9px;
  padding:8px 11px; font-family:inherit; font-size:12.5px; color:var(--ink); }
.al-directive-input:focus{ outline:none; border-color:var(--accent); }
.al-directive-on{ font-size:10px; font-weight:800; color:#7bbf6a; background:#13201a;
  border:1px solid #294a30; padding:2px 7px; border-radius:8px; flex-shrink:0; }

/* 자동 대화 */
.al-autochat{ padding:10px 14px 0; }
.al-autochat-go{ width:100%; padding:11px; border-radius:11px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:700; color:#c8b3ff; background:#1c1730; border:1px solid #3a3550; }
.al-autochat-go:hover:not(:disabled){ border-color:var(--accent); }
.al-autochat-go:disabled{ opacity:.5; cursor:not-allowed; }
.al-autochat-stop{ width:100%; padding:11px; border-radius:11px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:700; color:#ff8b8b; background:#251416; border:1px solid #43203a;
  display:flex; align-items:center; justify-content:center; gap:8px; }
.al-autochat-live{ font-size:10px; color:var(--accent2); animation:pulse 1.5s infinite; }
/* 오너 끼어들기 */
.al-intervene{ margin-top:8px; }
/* 화자 선택 칩 */
.al-speaker-wrap{ padding:0 14px; }
.al-nc-speakers{ display:flex; flex-wrap:wrap; gap:6px; margin:4px 0 12px; }
.al-persona-entry{ width:100%; padding:13px; margin-top:9px; border-radius:12px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:700; color:#ffd27a; background:#1f1a10;
  border:1px solid #4a3c1c; text-align:center; }
.al-persona-entry:hover{ border-color:#ffd27a; }
.al-pe-hint{ font-size:11px; color:var(--soft); font-weight:400; }
.al-newchat-target.mine{ border-color:#5a4570; background:#1c1730; }
.al-nt-mine-tag{ margin-left:auto; font-size:11px; color:#c8b3ff; background:#2a2440; padding:2px 8px; border-radius:8px; }.al-speaker-sel{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:8px; }.al-spk-chip{ padding:6px 11px; border-radius:16px; cursor:pointer; font-family:inherit; font-size:12px;
  font-weight:700; border:1px solid #3a3550; background:#16161c; color:#9aa0b0; }
.al-spk-chip:hover{ border-color:var(--accent); }
.al-spk-chip.on{ background:#2a2440; color:#fff; border-color:#5a4570; }
.al-spk-chip.persona.on{ background:#3a2a18; color:#ffd27a; border-color:#5a4520; }
.al-spk-chip.add{ border-style:dashed; color:#9eddb0; }
.al-persona-active{ margin-top:7px; font-size:11.5px; color:#ffd27a; }
/* 페르소나 편집 모달 */
.al-pd-input{ width:100%; margin-top:9px; background:#1a1a20; border:1px solid var(--line); border-radius:10px;
  padding:11px 13px; color:var(--ink); font-family:inherit; font-size:13px; box-sizing:border-box; }
.al-pd-input:focus{ outline:none; border-color:var(--accent); }
.al-pd-input.area{ min-height:64px; resize:vertical; }
.al-pd-btns{ display:flex; gap:8px; margin-top:16px; }
.al-pd-save,.al-pd-cancel,.al-pd-del{ flex:1; padding:12px; border-radius:11px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:800; border:none; }
.al-pd-save{ background:linear-gradient(135deg,var(--accent),#9d6bff); color:#fff; }
.al-pd-save:disabled{ opacity:.4; cursor:not-allowed; }
.al-pd-cancel{ background:#26222e; color:#b8b4c4; }
.al-pd-del{ background:#2a1418; color:#ff8b8b; flex:0 0 auto; padding:12px 16px; }
/* 홈 페르소나 관리 */
.al-persona-mgr{ margin-top:24px; padding-top:20px; border-top:1px solid var(--line); }
.al-pm-head{ font-size:15px; font-weight:800; color:#ffd27a; }
.al-pm-head span{ color:var(--soft); font-weight:600; }
.al-pm-desc{ font-size:12px; color:var(--soft); margin:5px 0 12px; line-height:1.5; }
.al-pm-list{ display:flex; flex-direction:column; gap:8px; }
.al-pm-row{ display:flex; align-items:stretch; gap:8px; }
.al-pm-card{ display:flex; gap:11px; align-items:center; background:#16141c; border:1px solid var(--line);
  border-radius:12px; padding:11px; cursor:pointer; text-align:left; flex:1; min-width:0; }
.al-pm-card:hover{ border-color:#5a4520; }
.al-pm-av{ width:38px; height:38px; flex-shrink:0; border-radius:50%; font-size:16px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#ffd27a,#e8a040); }
.al-pm-info{ display:flex; flex-direction:column; min-width:0; }
.al-pm-name{ font-size:14px; font-weight:800; color:var(--ink); }
.al-pm-sub{ font-size:11.5px; color:var(--soft); }
.al-pm-add{ padding:11px; border-radius:12px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700;
  border:1px dashed #5a4520; background:#1a1610; color:#ffd27a; }
.al-pm-actions{ display:flex; flex-direction:column; gap:6px; flex-shrink:0; }
.al-pm-edit-mini{ flex:1; padding:0 12px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:900; color:#ffd27a; background:#241d10; border:1px solid #5a4520; }
.al-pm-del-mini{ flex:0 0 auto; padding:0 12px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:900; color:#ff9aa9; background:#25151b; border:1px solid #5c2736; }
.al-pm-del-mini:hover{ border-color:#ff7c95; color:#ffd5dc; }
.al-intervene-btn{ width:100%; padding:9px; border-radius:10px; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:700; color:#9aa0b0; background:#16161c; border:1px dashed #3a3a48; }
.al-intervene-btn:hover{ color:#c8b3ff; border-color:var(--accent); }
.al-intervene-btn.on{ color:#ffd27a; background:#241d10; border-style:solid; border-color:#5a4520; }
.al-bubble-spk{ display:block; font-size:10px; font-weight:800; opacity:.7; margin-bottom:3px; }
/* 오너→내캐릭터 직접 대화 입구 */
.al-owner-entry{ width:100%; padding:12px; margin-bottom:10px; border-radius:12px; cursor:pointer;
  font-family:inherit; font-size:13px; color:#ffd27a; background:#1f1a10; border:1px solid #4a3c1c; text-align:center; }
.al-owner-entry:hover{ border-color:#ffd27a; }
.al-owner-entry b{ color:#fff; }
/* 호감도 게이지 */
.al-affinity{ margin:10px 14px 8px; padding:12px 13px; border:1px solid #4a3650; border-radius:14px;
  background:linear-gradient(135deg,#2b1c31,#181923); box-shadow:0 10px 28px -22px #000, inset 0 0 0 1px rgba(255,255,255,.03); }
.al-aff-toggle{ width:100%; display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:8px;
  border:none; background:transparent; color:var(--ink); padding:0; cursor:pointer; font-family:inherit; text-align:left; }
.al-aff-toggle span{ font-size:13px; font-weight:950; color:#ffd7ec; }
.al-aff-toggle b{ font-size:11.5px; color:#fff; background:#4a2c42; border:1px solid #6a3c5a; border-radius:999px; padding:3px 8px; }
.al-aff-toggle i{ font-style:normal; font-size:11px; color:#b7a8c4; }
.al-aff-content{ margin-top:11px; }
.al-aff-top{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; }
.al-aff-row{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; }
.al-aff-row.second{ margin-top:9px; }
.al-aff-lbl.rev{ color:#9ec4ff; }
.al-aff-fill.rev{ background:linear-gradient(90deg,#9ec4ff,#6ea8ff); }
.al-aff-fill.neg{ background:linear-gradient(90deg,#6a5560,#c0506a) !important; }
.al-aff-note{ font-size:10px; color:var(--soft); font-weight:400; }
.al-aff-lbl{ font-size:12px; font-weight:900; color:#ffacd2; }
.al-aff-stage{ font-size:11.5px; color:#fff; background:#4a2c42; border:1px solid #6a3c5a; border-radius:999px; padding:2px 8px; font-weight:900; }
.al-aff-bar{ position:relative; height:10px; background:#2b2430; border:1px solid #3f3448; border-radius:999px; overflow:hidden; }
.al-aff-fill{ height:100%; border-radius:6px; background:linear-gradient(90deg,#ff7eb3,#ff5a8c); transition:width .5s ease; }
.al-aff-mark{ position:absolute; top:-2px; width:2px; height:11px; background:#ffd27a; opacity:.8; transform:translateX(-1px); }
.al-affinity.owner .al-aff-lbl{ color:#a8c8ff; }
.al-affinity.owner .al-aff-fill{ background:linear-gradient(90deg,#9ec4ff,#6ea8ff); }
/* 진도질문 모달 */
.al-proposal{ text-align:center; max-width:340px; }
.al-prop-heart{ font-size:34px; color:#ff5a8c; animation:pulse 1.4s infinite; }
.al-prop-who{ font-size:14px; font-weight:800; color:#ff9ec4; margin-top:2px; }
.al-prop-line{ font-size:16px; line-height:1.55; color:#fff; margin:12px 4px; font-weight:500; }
.al-prop-sub{ font-size:12px; color:var(--soft); margin-bottom:16px; }
.al-prop-btns{ display:flex; gap:10px; }
.al-prop-yes,.al-prop-no{ flex:1; padding:13px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:14px; font-weight:800; border:none; }
.al-prop-yes{ background:linear-gradient(135deg,#ff7eb3,#ff5a8c); color:#fff; }
.al-prop-no{ background:#26222e; color:#b8b4c4; border:1px solid #3a3550; }
.al-prop-yes:hover{ filter:brightness(1.08); }
.al-prop-heart.broken{ filter:grayscale(0.3); opacity:0.85; }
.al-prop-no:hover{ border-color:var(--soft); }

/* 캐해 교정 */
.al-fixbtn{ background:none; border:none; color:#8a8a96; font-family:inherit; font-size:12px; cursor:pointer; padding:0; }
.al-fixbtn:hover{ color:#ffb454; }
.al-fixbtn-dm{ display:block; margin-top:8px; background:none; border:none; color:#6a6a74;
  font-family:inherit; font-size:11px; cursor:pointer; padding:0; }
.al-fixbtn-dm:hover{ color:#ffb454; }
.al-modal-bg{ position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center; padding:20px; z-index:50; }
.al-modal{ width:100%; max-width:400px; background:var(--phone); border:1px solid var(--line);
  border-radius:18px; padding:22px; box-shadow:0 30px 70px -20px #000; }
.al-modal-title{ font-size:18px; font-weight:800; margin:0 0 6px; }
.al-modal-sub{ font-size:13px; color:var(--soft); margin:0 0 14px; line-height:1.5; }
.al-modal-quote{ font-size:13px; color:#bcbcc6; background:#1a1a20; border-left:2px solid #ffb454;
  border-radius:0 8px 8px 0; padding:10px 12px; margin-bottom:14px; font-style:italic; }
.al-fixchips{ display:flex; flex-wrap:wrap; gap:7px; margin-bottom:11px; }
.al-fixchip{ font-size:12px; padding:6px 11px; border-radius:16px; cursor:pointer; font-family:inherit;
  background:#241d14; border:1px solid #4a3a22; color:#ffb454; }
.al-fixchip:hover{ border-color:#ffb454; }
.al-fixinput{ width:100%; min-height:70px; background:#1a1a20; border:1px solid var(--line);
  border-radius:11px; padding:11px; font-family:inherit; font-size:13.5px; line-height:1.6; color:var(--ink); resize:none; }
.al-fixinput:focus{ outline:none; border-color:var(--accent); }
.al-modal-actions{ display:flex; gap:7px; justify-content:flex-end; margin-top:13px; flex-wrap:wrap; }
.al-modal-cancel{ padding:9px 14px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px;
  background:none; border:1px solid var(--line); color:var(--soft); }
.al-modal-saveonly{ padding:9px 14px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600;
  background:#1f1a2e; border:1px solid var(--accent); color:#c8b3ff; }
.al-modal-saveonly:disabled,.al-modal-save:disabled{ opacity:.4; cursor:not-allowed; }
.al-modal-save{ padding:9px 16px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700;
  background:#ffb454; color:#fff; border:none; }
.al-modal-danger{ padding:9px 16px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:800;
  background:#ff5d73; color:#fff; border:none; }
.al-fixcount{ font-size:11.5px; color:var(--soft); margin:12px 0 0; text-align:center; }

/* home — account list */
.al-home{ padding:30px 22px 26px; }
.al-accountbar{ display:flex; align-items:center; gap:8px; margin:-12px 0 18px; padding:9px 11px;
  border:1px solid #2a2440; border-radius:10px; background:#14101e; color:var(--soft); font-size:11.5px; }
.al-accountbar span{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#c8b3ff; font-weight:800; }
.al-accountbar b{ font-weight:700; color:#8d849e; }
.al-accountbar button{ border:none; background:#1f1a2e; color:#c8b3ff; border-radius:8px; padding:5px 8px;
  font-family:inherit; font-size:11px; cursor:pointer; }
.al-auth{ min-height:620px; padding:76px 24px 28px; display:flex; flex-direction:column; align-items:center; text-align:center; }
.al-auth h1{ margin:12px 0 8px; font-size:25px; font-weight:900; }
.al-auth p{ margin:0 0 18px; color:var(--soft); font-size:13.5px; line-height:1.6; }
.al-auth-tabs{ width:100%; display:flex; gap:7px; margin-bottom:10px; padding:4px; border:1px solid #2a2440; border-radius:12px; background:#120f1c; }
.al-auth-tabs button{ flex:1; padding:9px; border:none; border-radius:9px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:800; color:var(--soft); background:transparent; }
.al-auth-tabs button.on{ color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-social-login{ width:100%; display:flex; flex-direction:column; gap:8px; margin:12px 0 6px; }
.al-social-login button{ width:100%; min-height:44px; border-radius:12px; border:1px solid #4a4654; cursor:pointer;
  background:#fee500; color:#191600; font-family:inherit; font-size:14px; font-weight:900; }
.al-social-login button:nth-child(2){ background:#f7f5fb; border-color:#e8e3f1; color:#17151d; }
.al-social-login button:nth-child(3){ background:#111; border-color:#333; color:#fff; }
.al-social-login button:disabled{ opacity:.45; cursor:default; }
.al-auth-divider{ width:100%; display:flex; align-items:center; gap:10px; margin:10px 0 2px; color:var(--soft); font-size:11.5px; }
.al-auth-divider:before,.al-auth-divider:after{ content:""; flex:1; height:1px; background:#363241; }
.al-auth-input{ width:100%; background:#1a1a20; border:1px solid var(--line); border-radius:12px;
  padding:13px 14px; color:var(--ink); font-family:inherit; font-size:14px; margin-top:8px; }
.al-auth-input:focus{ outline:none; border-color:var(--accent); }
.al-auth-btn{ width:100%; margin-top:10px; padding:13px; border:none; border-radius:12px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:800; color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-auth-btn:disabled{ background:#2a2a32; color:#5a5a64; cursor:default; }
.al-auth-linkbtn{ width:100%; margin-top:9px; padding:11px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:800; color:#d8cbff; background:#171222; border:1px solid #3a3550; }
.al-auth-alt{ width:100%; display:flex; gap:8px; margin-top:10px; }
.al-auth-alt button{ flex:1; min-height:34px; border:1px solid #3a3550; border-radius:11px; cursor:pointer;
  font-family:inherit; font-size:11.5px; font-weight:800; color:#d8cbff; background:#171222; }
.al-auth-alt button:hover:not(:disabled){ border-color:var(--accent); background:#211a34; color:#fff; }
.al-auth-alt button:disabled{ opacity:.45; cursor:default; }
.al-auth-msg{ margin-top:13px !important; color:#c8b3ff !important; }
.al-home-head{ text-align:center; margin-bottom:20px; }
.al-home-head h1{ font-size:24px; font-weight:800; margin:8px 0 6px; }
.al-home-head p{ font-size:13.5px; color:var(--soft); margin:0; }
.al-build{ margin-top:18px; text-align:center; font-size:10px; color:#5f566f; }
.al-acclist{ display:flex; flex-direction:column; gap:10px; }
.al-acccard{ display:flex; align-items:center; gap:8px; padding:8px; font-family:inherit;
  background:#161420; border:1px solid var(--line); border-radius:14px; text-align:left; transition:.16s; }
.al-acccard:hover{ border-color:var(--accent); background:#1c1730; }
.al-acccard-main{ flex:1; min-width:0; display:flex; align-items:center; gap:13px; padding:6px; cursor:pointer;
  font-family:inherit; background:none; border:none; color:var(--ink); text-align:left; }
.al-acccard-av{ width:48px; height:48px; flex-shrink:0; border-radius:50%; font-size:21px; font-weight:800;
  color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; }
.al-acccard-info{ flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.al-acccard-name{ font-size:16px; font-weight:800; }
.al-acccard-handle{ font-size:12.5px; color:var(--soft); }
.al-acccard-rel{ font-size:11.5px; color:var(--accent2); margin-top:2px; }
.al-acccard-count{ font-size:11.5px; color:var(--soft); flex-shrink:0; }
.al-acc-actions{ display:flex; flex-direction:column; gap:6px; flex-shrink:0; align-self:stretch; }
.al-accedit{ flex:1; min-width:52px; border:1px solid #4d3d72; border-radius:10px; cursor:pointer;
  background:#201932; color:#c8b3ff; font-family:inherit; font-size:12px; font-weight:900; }
.al-accedit:hover{ background:#2a2140; color:#fff; border-color:var(--accent); }
.al-accdel{ flex-shrink:0; align-self:stretch; min-width:52px; border:1px solid #5a2632; border-radius:10px; cursor:pointer;
  background:#251018; color:#ff9aaa; font-family:inherit; font-size:12px; font-weight:800; }
.al-acc-actions .al-accdel{ flex:1; align-self:auto; }
.al-accdel:hover{ background:#3a1522; color:#fff; border-color:#ff5d73; }
.al-accadd{ padding:15px; cursor:pointer; font-family:inherit; font-size:14px; font-weight:700;
  color:var(--accent); background:#16121f; border:1px dashed #3a3550; border-radius:14px; transition:.16s; }
.al-accadd:hover{ border-color:var(--accent); background:#1c1730; }
.al-dump-back{ background:none; border:none; color:var(--soft); font-family:inherit; font-size:13.5px;
  cursor:pointer; padding:14px 16px 0; }
.al-dump-back:hover{ color:var(--ink); }

/* compose row + write */
.al-compose-row{ display:flex; gap:8px; }
.al-compose-row .al-wake{ flex:1; }
.al-writeself{ flex-shrink:0; padding:14px 16px; border-radius:13px; cursor:pointer; font-family:inherit;
  font-size:13.5px; font-weight:700; background:#1a1a20; border:1px solid var(--line); color:#c8b3ff; }
.al-writeself:hover{ border-color:var(--accent); }
.al-writebox{ margin-top:10px; }
.al-write-lbl{ font-size:11.5px; color:var(--soft); margin:0 0 7px; }
.al-writebox textarea{ width:100%; min-height:80px; background:#1a1a20; border:1px solid var(--line);
  border-radius:11px; padding:12px; font-family:inherit; font-size:14px; line-height:1.6; color:var(--ink); resize:none; }
.al-writebox textarea:focus{ outline:none; border-color:var(--accent); }
.al-write-actions{ display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
.al-write-cancel{ padding:8px 16px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px;
  background:none; border:1px solid var(--line); color:var(--soft); }
.al-write-post{ padding:8px 18px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700;
  background:var(--accent); color:#fff; border:none; }
.al-write-post:disabled{ background:#2a2a32; color:#5a5a64; cursor:not-allowed; }

.al-user-badge{ font-style:normal; font-size:9.5px; font-weight:800; color:#7bbf6a;
  background:#13201a; border:1px solid #294a30; padding:1px 6px; border-radius:8px; margin-right:6px; }
.al-occhip{ font-size:12px; padding:6px 11px; border-radius:16px; cursor:pointer; font-family:inherit;
  background:#1a2820; border:1px solid #2a4a35; color:#9eddb0; }
.al-occhip:hover{ border-color:#7bbf6a; color:#fff; }

/* profile DM button */
.al-profile-top{ display:grid; grid-template-columns:minmax(0, 1fr) auto; align-items:start; gap:10px; min-width:0; }
.al-dmbtn{ flex:0 0 auto; min-width:0; min-height:36px; padding:8px 13px; border-radius:20px; cursor:pointer; font-family:inherit;
  display:inline-flex; align-items:center; justify-content:center; gap:5px; font-size:12.5px; font-weight:800; background:linear-gradient(135deg,var(--accent),var(--accent2));
  color:#fff; border:none; transition:.16s; white-space:nowrap; line-height:1.1; }
.al-dmbtn span{ line-height:1; }
.al-dmbtn b{ font:inherit; }
.al-dmbtn:hover{ filter:brightness(1.1); }
.al-feed-actions{ display:flex; justify-content:flex-end; gap:7px; min-width:0; max-width:100%; }
.al-dmbtn.ghost{ background:#1c1730; color:#c8b3ff; border:1px solid #3a3550; }
.al-dmbtn.ghost:hover{ border-color:var(--accent); filter:none; }
/* 탐색 */
.al-disc-search{ padding:10px 14px; }
.al-disc-search input{ width:100%; background:#1a1a20; border:1px solid var(--line); border-radius:11px;
  padding:11px 14px; color:var(--ink); font-family:inherit; font-size:13px; }
.al-disc-search input:focus{ outline:none; border-color:var(--accent); }
.al-disc-status{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin:0 14px 10px; padding:8px 10px;
  border:1px solid #2e2940; border-radius:10px; color:#8f879b; font-size:11.5px; background:#15131c; }
.al-disc-status span{ flex:1 1 180px; min-width:0; line-height:1.45; }
.al-disc-status button{ border:1px solid #3a3550; border-radius:9px; background:#1c1730; color:#c8b3ff; cursor:pointer;
  font-family:inherit; font-size:11.5px; font-weight:800; padding:5px 9px; white-space:nowrap; }
.al-disc-status button:disabled{ opacity:.5; cursor:not-allowed; }
.al-disc-error{ margin:0 14px 10px; color:#ff9caf; font-size:12px; line-height:1.45; }
.al-disc-focus{ margin:0 14px 10px; padding:10px 12px; border-radius:12px; border:1px solid #5f4c82;
  background:#241d35; color:#e8ddff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.al-disc-focus button{ border:none; border-radius:9px; padding:7px 9px; cursor:pointer; font-family:inherit; font-size:11px; font-weight:900;
  color:#1b1526; background:#d8cbff; }
.al-following-panel{ margin:0 14px 12px; padding:12px; border:1px solid #3d344d; border-radius:14px;
  background:#171420; }
.al-following-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:9px;
  font-size:13px; font-weight:900; color:#d9ccff; }
.al-following-head b{ color:#fff; background:#2a2440; border:1px solid #51436b; border-radius:999px; padding:2px 8px; }
.al-following-list{ display:flex; flex-direction:column; gap:8px; max-height:190px; overflow:auto; }
.al-following-card{ display:flex; align-items:center; gap:8px; padding:8px; border:1px solid #302b3a; border-radius:12px;
  background:#111018; }
.al-following-main{ flex:1; min-width:0; display:flex; align-items:center; gap:9px; background:none; border:none;
  color:var(--ink); cursor:pointer; font-family:inherit; text-align:left; }
.al-following-av{ width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:900; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-following-info{ min-width:0; display:flex; flex-direction:column; gap:1px; }
.al-following-info b{ font-size:13px; }
.al-following-info small{ font-size:11px; color:var(--soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-unfollow{ flex-shrink:0; padding:7px 9px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:11.5px;
  font-weight:900; color:#ffb0bd; background:#25151b; border:1px solid #5c2736; }
.al-disc-list{ flex:1; overflow-y:auto; padding:0 14px 14px; display:flex; flex-direction:column; gap:10px; }
.al-disc-none{ text-align:center; color:var(--soft); font-size:13px; padding:30px 0; }
.al-disc-none p{ margin:0 0 10px; }
.al-disc-none button{ border:1px solid #3a3550; border-radius:10px; background:#1c1730; color:#c8b3ff; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:900; padding:8px 11px; }
.al-disc-none button:hover{ border-color:var(--accent); color:#fff; }
.al-disc-card{ display:grid; grid-template-columns:42px minmax(0,1fr); gap:9px 11px; align-items:flex-start;
  background:#16141c; border:1px solid var(--line); border-radius:14px; padding:13px; }
.al-disc-card.on{ border-color:#5a4570; background:#1a1626; }
.al-disc-av{ width:42px; height:42px; flex-shrink:0; border-radius:50%; font-size:18px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff;
  background:linear-gradient(135deg,var(--accent),#9d6bff); border:none; cursor:pointer; font-family:inherit; }
.al-disc-body{ flex:1; min-width:0; }
.al-disc-top{ display:flex; align-items:center; gap:5px 7px; flex-wrap:wrap; min-width:0; }
.al-disc-name{ min-width:0; max-width:100%; font-size:14px; font-weight:800; color:var(--ink); background:none; border:none; padding:0; cursor:pointer; font-family:inherit;
  overflow-wrap:anywhere; line-height:1.25; text-align:left; }
.al-disc-name:hover{ color:#d9ccff; text-decoration:underline; text-underline-offset:3px; }
.al-disc-owner{ font-size:11px; color:var(--soft); overflow-wrap:anywhere; }
.al-disc-persona{ font-size:12px; color:#c4c0cf; margin:4px 0 6px; line-height:1.45; overflow-wrap:anywhere; word-break:keep-all; }
.al-disc-tags{ display:flex; flex-wrap:wrap; gap:5px; }
.al-disc-tag{ max-width:100%; font-size:10.5px; color:#9eddb0; background:#15201a; border-radius:5px; padding:2px 6px;
  overflow-wrap:anywhere; }
.al-disc-actions{ grid-column:2; justify-self:start; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.al-disc-follow,.al-disc-dm{ min-height:32px; padding:8px 12px; border-radius:9px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:700; border:1px solid #3a3550; background:#1c1730; color:#c8b3ff; white-space:nowrap; }
.al-disc-follow:hover,.al-disc-dm:hover{ border-color:var(--accent); }
.al-disc-follow.on{ background:#2a2440; color:#fff; border-color:#5a4570; }
.al-disc-dm{ color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); border:none; }
.al-disc-foot{ padding:10px 14px; font-size:11.5px; color:var(--soft); text-align:center; border-top:1px solid var(--line); }
.al-public-profile{ position:relative; width:min(390px,calc(100vw - 34px)); overflow:hidden; border-radius:18px;
  border:1px solid #343040; background:#17161e; color:var(--ink); box-shadow:0 30px 80px rgba(0,0,0,.48); }
.al-public-back{ position:absolute; z-index:2; top:12px; left:12px; width:34px; height:34px; border-radius:50%;
  border:none; cursor:pointer; color:#fff; background:#111018; font-size:24px; line-height:1; }
.al-public-banner{ height:96px; overflow:hidden; background:linear-gradient(120deg,#2b2142,#4a1f3a 55%,#263044); }
.al-public-banner img{ width:100%; height:100%; display:block; object-fit:cover; }
.al-public-avatar{ width:70px; height:70px; margin:-35px 0 0 18px; border:4px solid #17161e; border-radius:50%;
  overflow:hidden;
  display:flex; align-items:center; justify-content:center; color:#fff; font-size:30px; font-weight:950;
  background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-public-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.al-public-body{ padding:12px 16px 17px; }
.al-public-main h3{ margin:0; font-size:23px; line-height:1.1; }
.al-public-main span{ color:var(--soft); font-size:13px; }
.al-public-age{ display:inline-flex; margin:10px 0 6px; padding:4px 9px; border-radius:999px;
  color:#cdbbff; background:#211b34; border:1px solid #493b68; font-size:12px; font-weight:800; }
.al-public-tag{ display:inline-flex; max-width:100%; margin:5px 0 10px; padding:7px 10px; border-radius:999px;
  color:#cdbbff; background:#211b34; border:1px solid #493b68; font-size:12px; font-weight:800;
  line-height:1.35; overflow-wrap:anywhere; word-break:keep-all; }
.al-public-line{ margin:5px 0; color:#d8d3e2; font-size:13px; line-height:1.5; }
.al-public-desc{ margin:8px 0 12px; color:#e8e4ee; font-size:13px; line-height:1.6; }
.al-public-stats{ display:flex; gap:12px; color:var(--soft); font-size:12px; margin-bottom:13px; }
.al-public-stats b{ color:#fff; }
.al-public-actions{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.al-public-follow,.al-public-dm{ width:100%; min-height:42px; border:none; border-radius:14px; cursor:pointer; font-family:inherit;
  font-size:14px; font-weight:950; color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-public-follow.on{ background:#26212e; color:#ffb0bd; border:1px solid #5c2736; }
.al-public-dm{ background:#1c1730; color:#c8b3ff; border:1px solid #3a3550; }
.al-follow-modal{ width:min(390px,calc(100vw - 34px)); max-height:min(620px,82vh); overflow:hidden; border-radius:18px;
  border:1px solid #343040; background:#17161e; color:var(--ink); box-shadow:0 30px 80px rgba(0,0,0,.48); display:flex; flex-direction:column; }
.al-follow-modal-head{ display:flex; align-items:center; justify-content:space-between; padding:15px 16px; border-bottom:1px solid var(--line); }
.al-follow-modal-head h3{ margin:0; font-size:18px; }
.al-follow-modal-head button{ border:none; border-radius:10px; padding:7px 10px; cursor:pointer; font-family:inherit;
  color:#bdb5ca; background:#26212e; font-size:12px; font-weight:900; }
.al-follow-empty{ margin:0; padding:28px 16px; color:var(--soft); font-size:13px; text-align:center; }
.al-follow-modal-list{ overflow:auto; padding:10px; display:flex; flex-direction:column; gap:8px; }
.al-follow-modal-row{ border:1px solid #302b3a; border-radius:13px; background:#111018; overflow:hidden; }
.al-follow-modal-row:hover{ border-color:var(--accent); background:#1c1730; }
.al-follow-modal-item{ display:flex; align-items:center; gap:8px; width:100%; padding:10px; color:var(--ink); }
.al-follow-modal-main{ flex:1; min-width:0; display:flex; align-items:center; gap:10px; border:none; background:none; color:inherit;
  cursor:pointer; font-family:inherit; text-align:left; padding:0; }
.al-follow-modal-av{ width:38px; height:38px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:950; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-follow-modal-info{ min-width:0; flex:1; display:flex; flex-direction:column; gap:2px; }
.al-follow-modal-info b{ font-size:14px; }
.al-follow-modal-info small{ font-size:11.5px; color:var(--soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-follow-modal-item i{ font-style:normal; flex-shrink:0; font-size:11px; color:#c8b3ff; background:#241d35; border:1px solid #4a3c68; border-radius:999px; padding:3px 8px; }
.al-mem-meta{ display:flex; gap:6px; align-items:center; margin-bottom:7px; }
.al-mem-meta button,.al-mem-meta select,.al-mem-meta span{ border:1px solid #3a3446; border-radius:999px; padding:4px 8px;
  background:#15131c; color:#bdb5ca; font-family:inherit; font-size:11px; font-weight:800; }
.al-mem-meta button{ cursor:pointer; }
.al-mem-meta button.on{ color:#ffd27a; border-color:#6a5220; background:#2a2112; }
.al-mem-meta select{ cursor:pointer; }
.al-world-modal{ width:min(390px,calc(100vw - 34px)); border-radius:18px; border:1px solid #3a3446;
  background:#17161e; color:var(--ink); padding:18px; box-shadow:0 30px 80px rgba(0,0,0,.48); }
.al-world-modal h3{ margin:0 0 7px; font-size:19px; }
.al-world-modal p{ margin:0 0 14px; color:var(--soft); font-size:13px; line-height:1.55; }
.al-world-options{ display:flex; flex-direction:column; gap:9px; }
.al-world-options button{ width:100%; padding:13px; border-radius:14px; border:1px solid #342e40; background:#111018;
  color:var(--ink); cursor:pointer; font-family:inherit; text-align:left; display:flex; flex-direction:column; gap:3px; }
.al-world-options button:hover{ border-color:var(--accent); background:#1c1730; }
.al-world-options button.on{ border-color:var(--accent); background:#241d35; }
.al-world-options.compact{ margin-bottom:10px; }
.al-world-options b{ font-size:14px; }
.al-world-options span{ font-size:12px; color:var(--soft); }
.al-world-note{ width:100%; min-height:112px; resize:vertical; border:1px solid #3a3446; border-radius:13px;
  background:#111018; color:var(--ink); padding:12px; font-family:inherit; font-size:13px; line-height:1.5; }
.al-world-note:focus{ outline:none; border-color:var(--accent); }
.al-world-actions{ display:flex; gap:8px; margin-top:12px; }
.al-world-actions button{ flex:1; padding:12px; border-radius:12px; border:1px solid #3a3446; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:900; color:#c8c1d4; background:#26212e; }
.al-world-actions button.primary{ border:none; color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-newchat-target.ext{ border-style:dashed; }
.al-nt-ext{ font-size:10px; color:#9eddb0; margin-left:auto; }
/* 팔로우 통계 */
.al-follow-stats{ display:flex; gap:8px; align-items:center; margin-top:9px; flex-wrap:wrap; min-width:0; }
.al-fstat{ background:none; border:none; padding:2px 0; font-family:inherit; font-size:12.5px; color:var(--soft); cursor:default;
  min-width:0; max-width:100%; overflow-wrap:anywhere; }
button.al-fstat{ cursor:pointer; }
.al-fstat.on{ color:#d9ccff; text-decoration:underline; text-underline-offset:4px; }
.al-fstat b{ color:var(--ink); font-weight:800; }
.al-fstat-new{ font-size:11px; color:#ff9ec4; background:#241621; border-radius:6px; padding:2px 8px; }
.al-profile-follow-panel{ margin-top:11px; padding:11px; border:1px solid #3a3550; border-radius:13px; background:#15131d; }
.al-profile-follow-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; color:#d9ccff; font-size:13px; font-weight:900; }
.al-profile-follow-head button{ border:none; background:#26212e; color:#bdb5ca; border-radius:8px; padding:5px 8px; cursor:pointer; font-family:inherit; font-size:11px; }
.al-profile-follow-list{ display:flex; flex-direction:column; gap:7px; }
.al-profile-follow-card{ display:flex; align-items:center; gap:7px; }
.al-profile-follow-card > button:first-child{ flex:1; min-width:0; display:flex; align-items:center; gap:8px; padding:8px; border:1px solid #2f2a3a;
  border-radius:10px; background:#111018; color:var(--ink); cursor:pointer; font-family:inherit; text-align:left; }
.al-profile-follow-card span{ width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:900; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-profile-follow-card b{ font-size:13px; }
.al-profile-follow-card small{ margin-left:auto; color:var(--soft); font-size:11px; }
.al-unfollow.small{ padding:8px 9px; font-size:11px; }
.al-disc-fcount{ font-size:10.5px; color:var(--soft); overflow-wrap:anywhere; }
.al-dm-settings-btn{ margin-left:auto; border:1px solid #3a3550; border-radius:999px; padding:7px 10px;
  background:#1c1730; color:#c8b3ff; cursor:pointer; font-family:inherit; font-size:11.5px; font-weight:900; }
.al-dm-settings-btn:hover{ border-color:var(--accent); color:#fff; }
/* 외부 글 / 댓글 */
.al-post-av.ext{ background:linear-gradient(135deg,#6ea8ff,#9d6bff); }
.al-post-extbadge{ font-size:9.5px; color:#a8c8ff; background:#16203a; border-radius:5px; padding:1px 6px; }
.al-comments{ margin-top:10px; padding-top:9px; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:8px; }
.al-comment{ display:flex; gap:8px; align-items:flex-start; }
.al-comment-av{ width:26px; height:26px; flex-shrink:0; border-radius:50%; font-size:12px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-comment-body{ flex:1; min-width:0; font-size:12.5px; line-height:1.5; }
.al-comment-name{ font-weight:800; color:var(--ink); margin-right:6px; }
.al-replyto{ color:#7f778c; font-size:11px; margin-right:6px; }
.al-comment-text{ color:#c4c0cf; }
.al-comment-tools{ display:inline-flex; gap:6px; margin-left:7px; vertical-align:baseline; }
.al-comment-tools button{ background:none; border:none; color:#6f687c; cursor:pointer; padding:0; font-family:inherit; font-size:10.5px; font-weight:800; }
.al-comment-tools button:hover{ color:#c8b3ff; }
.al-comment-tools button:last-child:hover{ color:#ff8fa4; }
.al-comment-editbox{ display:flex; align-items:center; gap:6px; margin-top:5px; flex-wrap:wrap; }
.al-comment-editbox input{ flex:1 1 160px; min-width:0; background:#1a1626; border:1px solid #2a2440; border-radius:8px;
  padding:7px 9px; color:var(--ink); font-family:inherit; font-size:12.5px; }
.al-comment-editbox input:focus{ outline:none; border-color:var(--accent); }
.al-comment-av.mine{ background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-cmt-mine{ font-size:9px; font-weight:700; color:#c8b3ff; background:#2a2440; padding:1px 5px; border-radius:6px; margin-left:5px; font-style:normal; }
.al-cmt-open{ margin-top:9px; padding:7px 12px; border-radius:9px; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:700; border:1px solid var(--line); background:#16131f; color:var(--soft); }
.al-cmt-open:hover{ border-color:var(--accent); color:#c8b3ff; }
.al-cmtbox{ margin-top:10px; padding:10px; border:1px solid #2a2440; border-radius:11px; background:#15131c; }
.al-cmtbox-who{ display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; }
.al-cmtbox-row{ display:flex; gap:6px; }
.al-cmtbox-input{ flex:1; background:#1a1626; border:1px solid #2a2440; border-radius:9px; padding:9px 11px;
  color:var(--ink); font-family:inherit; font-size:13px; }
.al-cmtbox-input:focus{ outline:none; border-color:var(--accent); }
.al-cmtbox-send{ flex:0 0 auto; width:38px; border:none; border-radius:9px; cursor:pointer;
  background:linear-gradient(135deg,var(--accent),#9d6bff); color:#fff; font-size:15px; font-weight:800; }
.al-cmtbox-cancel{ margin-top:7px; background:none; border:none; color:var(--soft); font-size:11px; cursor:pointer; font-family:inherit; }

/* DM screen */
.al-dmhead{ display:flex; align-items:center; gap:11px; padding:14px 16px; border-bottom:1px solid var(--line); }
.al-back-inline{ background:none; border:none; color:var(--ink); font-size:26px; cursor:pointer; line-height:1; padding:0; }
.al-dmhead-av{ width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2));
  display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; color:#fff; }
.al-dmhead-info{ display:flex; flex-direction:column; }
.al-dmhead-name{ font-size:15px; font-weight:800; color:var(--ink); }
.al-dmhead-sub{ font-size:11.5px; color:var(--soft); }

.al-identity{ border-bottom:1px solid var(--line); }
.al-identity-cur{ width:100%; display:flex; align-items:center; gap:8px; padding:11px 16px;
  background:#14101e; border:none; cursor:pointer; font-family:inherit; color:var(--ink); }
.al-identity-lbl{ font-size:12px; color:var(--soft); }
.al-identity-val{ font-size:12.5px; font-weight:700; color:#c8b3ff; flex:1; text-align:left; }
.al-identity-caret{ color:var(--soft); font-size:14px; }
.al-identity-panel{ padding:12px 16px; background:#120f1c; display:flex; flex-direction:column; gap:8px; }
.al-identity-modes{ display:flex; gap:8px; }
.al-identity-modes button{ flex:1; padding:9px; border-radius:9px; cursor:pointer; font-family:inherit;
  font-size:12.5px; font-weight:600; background:#1a1a20; border:1px solid var(--line); color:var(--soft); }
.al-identity-modes button.on{ background:var(--accent); color:#fff; border-color:var(--accent); }
.al-identity-input{ width:100%; background:#1a1a20; border:1px solid var(--line); border-radius:9px;
  padding:9px 11px; font-family:inherit; font-size:13px; color:var(--ink); resize:none; }
.al-identity-input:focus{ outline:none; border-color:var(--accent); }
.al-identity-done{ align-self:flex-end; padding:7px 16px; border-radius:8px; cursor:pointer; font-family:inherit;
  font-size:12.5px; font-weight:700; background:var(--accent); color:#fff; border:none; }
.al-relhint{ margin:0; font-size:12px; color:var(--accent2); font-weight:600; }
.al-relpick{ display:flex; flex-direction:column; gap:6px; }
.al-relpick-lbl{ font-size:11px; color:var(--soft); }
.al-relchips{ display:flex; flex-wrap:wrap; gap:6px; }
.al-relchip{ font-size:12px; padding:6px 11px; border-radius:16px; cursor:pointer; font-family:inherit;
  background:#1f1a2e; border:1px solid #2e2640; color:#c8b3ff; }
.al-relchip:hover{ border-color:var(--accent2); color:#fff; }
.al-persona-guide{ font-size:11.5px; color:var(--soft); margin:0; line-height:1.5; }
.al-persona-area{ min-height:96px; line-height:1.6; resize:none; }

.al-dmscroll{ min-height:280px; max-height:440px; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px;
  background:linear-gradient(180deg,#202029,#191820); }
.al-dm-empty{ text-align:center; padding:60px 20px; color:var(--soft); }
.al-dm-empty p{ font-size:14px; margin:0 0 6px; }
.al-dm-empty span{ font-size:12px; color:#5a5a64; }
.al-bubble-row{ display:flex; gap:8px; align-items:flex-end; }
.al-bubble-row.me{ justify-content:flex-end; }
.al-bubble-av{ width:28px; height:28px; flex-shrink:0; border-radius:50%;
  background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center;
  justify-content:center; font-size:13px; font-weight:800; color:#fff; }
.al-bubble{ max-width:76%; padding:10px 13px; border-radius:18px; font-size:14.5px; line-height:1.55; white-space:pre-wrap;
  box-shadow:0 8px 18px -16px #000; }
.al-bubble.char{ background:#f1eff6; color:#17151d; border-bottom-left-radius:5px; }
.al-bubble.me{ background:#0a84ff; color:#fff; border-bottom-right-radius:5px; font-weight:600; }
.al-bubble.typing{ padding:13px 15px; }
.al-bubble-label{ display:block; font-size:10.5px; font-weight:800; opacity:.7; margin-bottom:3px; }
.al-bubble-text{ display:block; }
.al-bubble-img{ display:block; width:min(230px, 62vw); max-width:100%; max-height:280px; object-fit:cover; border-radius:14px; background:#0f0e15; }
.al-bubble-img + .al-bubble-text{ margin-top:7px; }
.al-bubble.me .al-bubble-img{ border:1px solid rgba(255,255,255,.25); }
.al-bubble.char .al-bubble-img{ border:1px solid rgba(0,0,0,.08); }

.al-dm-preview{ display:flex; align-items:center; gap:10px; padding:10px 14px 0; border-top:1px solid var(--line); background:#1f1e26; }
.al-dm-preview img{ width:74px; height:74px; object-fit:cover; border-radius:14px; border:1px solid #45424f; box-shadow:0 10px 24px -18px #000; }
.al-dm-preview button{ width:32px; height:32px; border-radius:50%; border:1px solid #45424f; background:#2a2932; color:#ddd7ea; font-size:18px; font-weight:800; cursor:pointer; }
.al-dm-preview button:hover{ border-color:var(--accent); color:#fff; }
.al-dminput{ display:flex; gap:8px; padding:12px 14px; border-top:1px solid var(--line); background:#1f1e26; }
.al-dminput input{ flex:1; background:#2a2932; border:1px solid #45424f; border-radius:22px;
  padding:11px 16px; font-family:inherit; font-size:14px; color:var(--ink); }
.al-dminput input:focus{ outline:none; border-color:var(--accent); }
.al-dminput button{ width:42px; height:42px; flex-shrink:0; border-radius:50%; border:none; cursor:pointer;
  background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; font-size:18px; font-weight:800; }
.al-dminput button:disabled{ background:#2a2a32; color:#5a5a64; cursor:not-allowed; }
.al-dm-image-btn{ width:42px; height:42px; flex-shrink:0; border-radius:50%; border:1px solid #45424f; cursor:pointer;
  display:flex; align-items:center; justify-content:center; background:#2a2932; color:#d9c8ff; font-size:24px; font-weight:500; line-height:1; }
.al-dm-image-btn:hover{ border-color:var(--accent); color:#fff; }
.al-dm-image-btn input{ display:none; }

@media (max-width:430px){
  .al-root{ padding:0; align-items:stretch; }
  .al-phone{ max-width:none; min-height:100dvh; border-radius:0; border-left:none; border-right:none; }
  .al-profile-info{ padding-left:12px; padding-right:12px; }
  .al-profile-top{ grid-template-columns:1fr; gap:9px; }
  .al-feed-actions{ justify-content:flex-start; }
  .al-dmbtn{ min-height:36px; padding:8px 12px; font-size:12px; }
  .al-profile-info h2{ font-size:19px; overflow-wrap:anywhere; }
  .al-handle{ display:block; overflow-wrap:anywhere; font-size:12.5px; }
  .al-banner{ height:86px; }
  .al-avatar-wrap{ margin-top:-33px; margin-left:12px; }
  .al-avatar{ width:66px; height:66px; }
  .al-avatar-tools{ left:70px; bottom:4px; }
  .al-cover-tools label,.al-cover-tools button,.al-avatar-tools label,.al-avatar-tools button{ padding:5px 7px; font-size:10px; }
  .al-composer, .al-post{ padding-left:12px; padding-right:12px; }
  .al-autobar{ align-items:flex-start; flex-direction:column; }
  .al-autometa{ width:100%; justify-content:space-between; }
  .al-gallery-head{ align-items:flex-start; flex-direction:column; gap:6px; }
}

@media (max-width:320px){
  .al-feed-actions{ gap:6px; }
  .al-dmbtn{ padding-left:10px; padding-right:10px; font-size:11.5px; }
}
@media (prefers-reduced-motion:reduce){ .al-post,.al-typing i{ animation:none; } }
`;

export default App;
