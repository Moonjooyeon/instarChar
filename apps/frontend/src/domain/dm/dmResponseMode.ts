export const DM_RESPONSE_MODES = [
  { code: "direct_dm_basic", credits: 1, description: "가볍게 이어가는 짧은 대화", historyLimit: 10, memoryLimit: 3, name: "기본 대화", outputTokens: 512 },
  { code: "direct_dm_context", credits: 2, description: "장기기억과 유저 노트를 조금 더 반영", historyLimit: 24, memoryLimit: 6, name: "기억 반영", outputTokens: 768 },
  { code: "direct_dm_flash_long", credits: 2, description: "긴 기억과 관계 맥락을 폭넓게 반영", historyLimit: 48, memoryLimit: 12, name: "긴 맥락", outputTokens: 1536 },
  { code: "direct_dm_pro", credits: 5, description: "아주 중요한 장면을 위한 고품질 응답", historyLimit: 28, memoryLimit: 12, name: "중요한 답장", outputTokens: 1536 },
  { code: "direct_dm_pro_story", credits: 7, description: "긴 추론, 감정선, 서사를 깊게 이어감", historyLimit: 60, memoryLimit: 12, name: "서사 집중", outputTokens: 3072 },
] as const;

export type DmResponseFlow = (typeof DM_RESPONSE_MODES)[number]["code"];

export type DmResponseMode = (typeof DM_RESPONSE_MODES)[number];

export function dmResponseMode(code: string): DmResponseMode {
  return DM_RESPONSE_MODES.find((mode) => mode.code === code) || DM_RESPONSE_MODES[0];
}

export function dmResponseFlowLabel(code: string): string | null {
  return DM_RESPONSE_MODES.find((mode) => mode.code === code)?.name || null;
}
