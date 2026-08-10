export type RewardMissionCode = "signup" | "first_character" | "first_dm";

export type RewardMissionState = {
  code: RewardMissionCode;
  completed: boolean;
  credits: number;
};

export type StarterMissionItem = RewardMissionState & {
  actionLabel: string;
  description: string;
  title: string;
};

export type StarterMissionProgress = {
  completedCount: number;
  earnedCredits: number;
  items: StarterMissionItem[];
  next: StarterMissionItem | null;
  totalCredits: number;
};

const DEFINITIONS: readonly Omit<StarterMissionItem, "completed" | "credits">[] = [
  { code: "signup", title: "문 열기", description: "ALIVE에 들어왔어요.", actionLabel: "완료" },
  { code: "first_character", title: "주인공 깨우기", description: "첫 캐릭터를 세상에 꺼내요.", actionLabel: "주인공 만들기" },
  { code: "first_dm", title: "첫 장면 잇기", description: "캐릭터와 첫 대화를 주고받아요.", actionLabel: "첫 대화 열기" },
];

export function starterMissionProgress(missions: readonly RewardMissionState[]): StarterMissionProgress {
  const states = new Map(missions.map((mission) => [mission.code, mission]));
  const items = DEFINITIONS.map((definition) => missionItem(definition, states.get(definition.code)));
  const completed = items.filter((item) => item.completed);
  return { completedCount: completed.length, earnedCredits: completed.reduce((sum, item) => sum + item.credits, 0), items, next: items.find((item) => !item.completed) || null, totalCredits: items.reduce((sum, item) => sum + item.credits, 0) };
}

function missionItem(definition: Omit<StarterMissionItem, "completed" | "credits">, state?: RewardMissionState): StarterMissionItem {
  return { ...definition, completed: state?.completed === true, credits: state?.credits && state.credits > 0 ? state.credits : 50 };
}
