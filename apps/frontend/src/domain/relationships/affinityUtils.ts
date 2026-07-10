type RelationRule = [RegExp, number];

type IntimacyBoundaryOptions = {
  speakerName?: string;
  listenerName?: string;
  affinityValue?: number;
  relationHint?: string;
  messageCount?: number;
};

export const RELATION_BASE: RelationRule[] = [
  [/부부|배우자/, 100],
  [/연인|애인|연애|사랑하는|사랑함|연심|반려/, 100],
  [/약혼/, 92],
  [/짝사랑|흠모|연모/, 65],
  [/썸|호감/, 65],
  [/단짝|절친/, 55],
  [/친구|친한|동료/, 45],
  [/가족|남매|형제|자매|부모|자식|혈육|소꿉/, 70],
  [/애착|소중|아끼는|특별/, 80],
  [/라이벌|앙숙|경쟁|적대/, 30],
  [/아는|지인/, 20],
];

export const SYMMETRIC_RELATION_BASE: RelationRule[] = [
  [/부부|배우자|연인|애인|연애|사랑하는|사랑함|반려|순애/, 100],
  [/약혼/, 92],
];

export const LOVE_RELATIONS = /썸|연인|애인|약혼|부부|배우자|짝사랑|연애/;

export function isLoveRelation(label: string | null | undefined): boolean {
  return LOVE_RELATIONS.test(label || "");
}

export function dirKey(from: string, to: string): string {
  return `${from}>${to}`;
}

export function nameMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a || "").replace(/\s/g, "");
  const right = (b || "").replace(/\s/g, "");
  if (!left || !right) return false;
  if (left === right) return true;
  return singleTokenMatches(a, b);
}

function singleTokenMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const leftTokens = (a || "").split(/\s+/).filter(Boolean);
  const rightTokens = (b || "").split(/\s+/).filter(Boolean);
  if (leftTokens.length === 1 && rightTokens.includes(leftTokens[0])) return true;
  return rightTokens.length === 1 && leftTokens.includes(rightTokens[0]);
}

export function relationBaseFromLabel(label: string | null | undefined): number | null {
  return baseFromLabel(label, RELATION_BASE);
}

export function symmetricRelationBaseFromLabel(label: string | null | undefined): number | null {
  return baseFromLabel(label, SYMMETRIC_RELATION_BASE);
}

function baseFromLabel(label: string | null | undefined, rules: RelationRule[]): number | null {
  if (!label) return null;
  const hit = rules.find(([matcher]) => matcher.test(label));
  return hit ? hit[1] : null;
}

export function affinityWithBase(stored: number | null | undefined, base: number | null | undefined): number {
  if (stored == null) return base == null ? 0 : base;
  if (base != null && base >= 90 && stored >= 0 && stored < base) return base;
  return stored;
}

export function finiteNumber(value: unknown, fallback: number | null = null): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function affinityStage(value: number): string {
  if (value >= 100) return "순애";
  if (value >= 85) return "특별한 사이";
  if (value >= 60) return "마음이 기움";
  if (value >= 35) return "호감";
  if (value >= 15) return "관심";
  if (value >= 0) return "아는 사이";
  if (value >= -20) return "서운함";
  if (value >= -50) return "미움";
  if (value >= -80) return "혐오";
  return "증오";
}

export function attachStage(value: number): string {
  if (value >= 100) return "맹목적 애정";
  if (value >= 85) return "둘도 없음";
  if (value >= 60) return "각별함";
  if (value >= 35) return "잘 따름";
  if (value >= 15) return "익숙함";
  if (value >= 0) return "서먹함";
  if (value >= -30) return "서운함";
  if (value >= -70) return "원망";
  return "등돌림";
}

export function relationStageLabel(label: string | null | undefined, affinity: number): string {
  const clean = String(label || "").trim();
  if (affinity >= 100 && /부부|배우자|연인|애인|연애|사랑|약혼|반려|순애/.test(clean)) return "순애";
  if (/서운함|미움|혐오|증오|관심|호감|아는 사이/.test(clean)) return affinityStage(affinity);
  return clean || affinityStage(affinity);
}

export function relationLabelFromAffinity(value: number, current = ""): string {
  if (/부부|배우자|연인|애인|약혼|짝사랑|썸/.test(current || "") && value >= 35) return current;
  if (/서운함|미움|혐오|증오/.test(current || "") && value >= 0) return positiveRelationLabel(value);
  if (/관심|호감|아는 사이/.test(current || "") && value < 0) return negativeRelationLabel(value);
  if (value < 0) return negativeRelationLabel(value);
  if (value >= 35 && !current) return "호감";
  if (value >= 15 && !current) return "관심";
  if (!current && value >= 0) return "아는 사이";
  return current;
}

function positiveRelationLabel(value: number): string {
  if (value >= 35) return "호감";
  return value >= 15 ? "관심" : "아는 사이";
}

function negativeRelationLabel(value: number): string {
  if (value <= -80) return "증오";
  if (value <= -50) return "혐오";
  if (value <= -20) return "미움";
  return "서운함";
}

export function intimacyBoundaryRules({ speakerName, listenerName, affinityValue = 0, relationHint = "", messageCount = 0 }: IntimacyBoundaryOptions = {}): string {
  const romantic = /연인|애인|연애|사랑|부부|배우자|약혼|반려|순애/.test(String(relationHint || "")) || affinityValue >= 85;
  return `
[스킨십/관계 진전 제한 — 중요]
- 능청스러운 농담, 노골적인 비유, 시선·거리감·손끝 같은 긴장감 표현은 가능하다. 하지만 그것을 곧바로 실제 키스·성적 접촉·침대 행동으로 실행하지 마라.
- 첫 대화거나 대화가 아직 짧으면(현재 ${messageCount}개 메시지), ${speakerName || "캐릭터"}가 ${listenerName || "상대"}에게 먼저 키스하려 들거나 입술을 들이대거나 성적 접촉을 시도하지 마라. 특히 첫 만남/첫 대화에서는 키스 금지.
- 현재 ${speakerName || "캐릭터"} → ${listenerName || "상대"} 호감도는 ${affinityValue}. ${romantic ? "관계가 깊어도" : "관계가 깊지 않으므로"} 강한 스킨십은 상대가 분명히 먼저 원하거나 동의한 뒤에만 가능하다.
- 낮은 호감도/초반 관계에서는 접촉을 한다면 손목을 살짝 잡으려다 멈춤, 가까이 기울었다가 물러남, 장난스러운 말로 떠보기 정도까지만. 키스·목덜미·허리 끌어안기·침대/성행위 암시는 실제 행동으로 가지 말고 말장난/비유 수준에 머물러라.
- 상대가 거절·당황·침묵하면 즉시 물러나고, 농담으로 무마하거나 사과하라. 집요하게 밀어붙이지 마라.`;
}
