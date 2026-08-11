import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { starterMissionProgress, type RewardMissionCode, type RewardMissionState, type StarterMissionItem } from "@/domain/credits/rewardMissions";

interface StarterMissionJourneyProps {
  missions: readonly RewardMissionState[];
  onContinue: (code: RewardMissionCode) => void;
}

interface StarterMissionPromptProps extends StarterMissionJourneyProps {
  missionCode: Exclude<RewardMissionCode, "signup">;
}

export function StarterMissionJourney({ missions, onContinue }: StarterMissionJourneyProps): React.ReactElement | null {
  if (!missions.length) return null;
  const progress = starterMissionProgress(missions);
  return (
    <section className="al-starter-journey" aria-labelledby="starter-mission-title">
      <MissionHeader completed={progress.completedCount} earned={progress.earnedCredits} total={progress.totalCredits} />
      <ol>{progress.items.map((item, index) => <MissionRow index={index} item={item} key={item.code} />)}</ol>
      <MissionFooter next={progress.next} onContinue={onContinue} />
    </section>
  );
}

export function StarterMissionPrompt({ missionCode, missions, onContinue }: StarterMissionPromptProps): React.ReactElement | null {
  if (!missions.length) return null;
  const progress = starterMissionProgress(missions);
  if (!progress.next || progress.next.code !== missionCode) return null;
  return (
    <section className="al-starter-prompt" aria-label="시작의 세 장면 다음 미션">
      <span className="al-starter-prompt-step">{String(progress.completedCount + 1).padStart(2, "0")}</span>
      <div><small>시작의 세 장면 · {progress.completedCount} / 3</small><b>{progress.next.title}</b><p>{progress.next.description}</p></div>
      <button type="button" onClick={() => onContinue(progress.next!.code)}><span>+{progress.next.credits}C</span>{progress.next.actionLabel} <AliveIcon name="arrow-right" size={13} /></button>
    </section>
  );
}

function MissionHeader({ completed, earned, total }: { completed: number; earned: number; total: number }): React.ReactElement {
  return <header><div><small>첫 이야기 보상</small><h2 id="starter-mission-title">시작의 세 장면</h2><p>하나씩 열 때마다 50C가 들어와요.</p></div><span><b>{completed} / 3</b><small>{earned} / {total}C</small></span></header>;
}

function MissionRow({ index, item }: { index: number; item: StarterMissionItem }): React.ReactElement {
  const state = item.completed ? "done" : "waiting";
  return <li className={state}><span>{item.completed ? <AliveIcon name="check" size={15} /> : String(index + 1).padStart(2, "0")}</span><div><b>{item.title}</b><p>{item.description}</p></div><em>{item.completed ? "받음 · " : "+"}{item.credits}C</em></li>;
}

function MissionFooter({ next, onContinue }: { next: StarterMissionItem | null; onContinue: (code: RewardMissionCode) => void }): React.ReactElement {
  if (!next) return <footer className="complete"><AliveIcon name="sparkle" size={16} /><span><b>세 장면을 모두 열었어요.</b><small>150C를 전부 챙겼어요.</small></span></footer>;
  return <footer><span><small>다음 장면</small><b>{next.title}</b></span><button type="button" onClick={() => onContinue(next.code)}>{next.actionLabel} <AliveIcon name="arrow-right" size={13} /></button></footer>;
}
