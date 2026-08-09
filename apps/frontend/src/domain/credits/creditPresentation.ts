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

const FLOW_META: Record<string, CreditFlowMeta> = {
  direct_dm_basic: { available: true, category: "conversation", description: "짧고 빠르게 이어가는 일상 대화", tier: "빠른 응답" },
  direct_dm_context: { available: false, category: "conversation", description: "최근 대화와 저장된 기억을 더 반영", tier: "문맥 강화" },
  direct_dm_flash_long: { available: false, category: "conversation", description: "묘사와 답변 길이가 더 긴 대화", tier: "긴 응답" },
  direct_dm_pro: { available: false, category: "conversation", description: "중요한 장면을 위한 고품질 대화", tier: "고품질" },
  direct_dm_pro_story: { available: false, category: "conversation", description: "긴 감정선과 서사를 깊게 이어가는 대화", tier: "서사형" },
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
