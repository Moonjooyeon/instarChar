export type CreditFlowCost = {
  code: string;
  credits: number;
  energy_percent: number;
  energy_eligible?: boolean;
  bonus_eligible?: boolean;
  label: string;
};

export type CreditFlowMeta = {
  available: boolean;
  category: "conversation" | "content";
  description: string;
  tier: string;
};

export type CreditUsageAmounts = {
  credits: number;
  energy_percent: number;
  bonus_credits: number;
  purchased_credits: number;
};

export type CreditBalancePreview = {
  energy_percent: number;
  purchased_credits: number;
  total_credits: number;
};

export type CreditUsagePreview = {
  action: "none" | "open-credits";
  detail: string;
  label: string;
  state: "credits" | "energy" | "free" | "insufficient";
};

const FLOW_META: Record<string, CreditFlowMeta> = {
  direct_dm_basic: { available: true, category: "conversation", description: "짧고 빠르게 이어가는 일상 대화", tier: "기본 대화" },
  direct_dm_context: { available: true, category: "conversation", description: "장기기억과 유저 노트를 조금 더 반영", tier: "기억 반영" },
  direct_dm_flash_long: { available: true, category: "conversation", description: "긴 기억과 관계 맥락을 폭넓게 반영", tier: "긴 맥락" },
  direct_dm_pro: { available: true, category: "conversation", description: "중요한 장면을 위한 고품질 응답", tier: "중요한 답장" },
  direct_dm_pro_story: { available: true, category: "conversation", description: "긴 추론과 감정선을 깊게 이어가는 서사", tier: "서사 집중" },
  feed_post: { available: true, category: "content", description: "캐릭터의 말투로 피드 글 한 편 생성", tier: "피드" },
  image_understanding: { available: true, category: "content", description: "보낸 사진을 보고 맥락에 맞게 답장", tier: "이미지" },
  character_interaction: { available: false, category: "content", description: "캐릭터 사이의 관계 장면과 상호작용", tier: "관계" },
};

const FALLBACK_META: CreditFlowMeta = { available: false, category: "content", description: "AI 기능 사용", tier: "AI" };

export function creditFlowMeta(code: string): CreditFlowMeta {
  return FLOW_META[code] || FALLBACK_META;
}

export function creditCostSummary(flow: CreditFlowCost, maxUses = 1): string {
  if (flow.credits === 0 && flow.energy_percent === 0) return "추가 사용량 없음";
  if (flow.energy_eligible === false && flow.bonus_eligible === false) return `구매 크레딧 ${flow.credits}C`;
  if (maxUses > 1) return `회당 에너지 ${flow.energy_percent}% 또는 ${flow.credits}C · 최대 ${flow.credits * maxUses}C`;
  return `에너지 ${flow.energy_percent}% 우선 · 부족하면 ${flow.credits}C`;
}

export function creditUsageAmount(usage: CreditUsageAmounts): string {
  const amounts: string[] = [];
  if (usage.energy_percent) amounts.push(`무료 에너지 ${usage.energy_percent}%`);
  if (usage.bonus_credits) amounts.push(`무료 보너스 ${usage.bonus_credits}C`);
  if (usage.purchased_credits) amounts.push(`구매 크레딧 ${usage.purchased_credits}C`);
  return amounts.join(" + ") || `${usage.credits}C`;
}

export function creditUsagePreview(flow: CreditFlowCost, balance: CreditBalancePreview): CreditUsagePreview {
  if (flow.credits === 0 && flow.energy_percent === 0) return { action: "none", detail: "추가 사용량 없음", label: "무료", state: "free" };
  if (flow.energy_eligible !== false && balance.energy_percent >= flow.energy_percent) return { action: "none", detail: `이번 답장에 에너지 ${flow.energy_percent}% 사용 예상`, label: `무료 에너지 ${balance.energy_percent}%`, state: "energy" };
  const usableCredits = flow.bonus_eligible === false ? balance.purchased_credits : balance.total_credits;
  const balanceLabel = flow.bonus_eligible === false ? "구매 크레딧" : "보유 크레딧";
  const detail = flow.energy_eligible === false ? `이번 답장에 ${flow.credits}C 사용 예상` : `에너지 부족 시 ${flow.credits}C 사용 예상`;
  if (usableCredits >= flow.credits) return { action: "none", detail, label: `${balanceLabel} ${usableCredits}C`, state: "credits" };
  if (flow.bonus_eligible === false) return { action: "open-credits", detail: `${flow.label}은 구매 C만 사용해요 · ${flow.credits}C 필요, 현재 ${usableCredits}C`, label: "구매 크레딧이 부족해요", state: "insufficient" };
  return { action: "open-credits", detail: `이번 답장에 ${flow.credits}C 필요 · 보유 ${usableCredits}C`, label: "크레딧이 부족해요", state: "insufficient" };
}
