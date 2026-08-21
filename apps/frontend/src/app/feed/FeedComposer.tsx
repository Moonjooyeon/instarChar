import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CreditUsageHint } from "@/features/credits/CreditUsageHint";
import { normalizeCharacterName } from "@/domain/app/textUtils";

type AutoSetter = (enabled: boolean, intervalSeconds?: number) => Promise<boolean>;
type AutoRoutinePanelProps = { auto: boolean; autoIntervalSeconds: number; autoPostNotice: string; nextIn: number; setAuto: AutoSetter; };
type AutoPostSettingsProps = { auto: boolean; autoIntervalSeconds: number; autoPostNotice: string; char: { directions?: string }; isOpen: boolean; nextIn: number; onToggle: () => void; setAuto: AutoSetter; update: (field: string, value: string) => void; };
type AutoPace = { intervalSeconds: number; label: string; recommended?: boolean; };

const AUTO_POST_PACES: AutoPace[] = [
  { intervalSeconds: 43200, label: "가끔" },
  { intervalSeconds: 21600, label: "보통", recommended: true },
  { intervalSeconds: 3600, label: "자주" },
];

export function FeedComposer({ ctx }) {
  const {
    auto,
    autoIntervalSeconds,
    autoPostNotice,
    char,
    generatePost,
    josa,
    loading,
    manualPost,
    moodOpen,
    myPosts,
    nextIn,
    POST_MOODS,
    setAuto,
    setFeedView,
    setMoodOpen,
    setWriteOpen,
    setWriteText,
    update,
    writeOpen,
    writeText,
  } = ctx;
  const isFirstPost = myPosts.length === 0;
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(() => isFirstPost);
  const displayName = normalizeCharacterName(char.name);
  if (loading) return null;
  const autoPostSettings = <AutoPostSettings auto={auto} autoIntervalSeconds={autoIntervalSeconds} autoPostNotice={autoPostNotice} char={char} isOpen={isAdvancedOpen} nextIn={nextIn} onToggle={() => setIsAdvancedOpen((open) => !open)} setAuto={setAuto} update={update} />;
  if (isFirstPost && !moodOpen) return autoPostSettings;
  return (
    <>
      <div className="al-composer">
        {!moodOpen ? (
          <div className="al-compose-row">
            <button className="al-wake border-line-strong bg-accent-soft text-accent-ink hover:border-accent hover:bg-accent hover:text-on-accent" onClick={() => setMoodOpen(true)}><AliveIcon name="sparkle" size={16} /> {josa(displayName, "한테/한테")} 글 부탁하기</button>
            <button className="al-writeself border-line bg-surface-raised text-ink hover:border-accent hover:bg-accent-soft" onClick={() => setWriteOpen((value) => !value)}><AliveIcon name="pen" size={15} /> 직접 쓰기</button>
          </div>
        ) : (
          <div className="al-moods"><header className="al-moods-head"><small>{isFirstPost ? "다른 시작" : "글 부탁하기"}</small><p className="al-moods-q">{isFirstPost ? `${displayName}의 첫 글은 어떤 장면일까요?` : "어떤 글을 부탁할까요?"}</p><CreditUsageHint className="feed" flowCode="feed_post" label="글 한 편 예상 사용량" /></header><div className="al-moods-grid">{POST_MOODS.map((mood) => <MoodButton key={mood} mood={mood} onSelect={(value) => { setFeedView("mine"); generatePost(value); }} />)}</div><button className="al-moods-cancel" onClick={() => setMoodOpen(false)}>닫기</button></div>
        )}
        {writeOpen && <div className="al-writebox"><p className="al-write-lbl">{displayName}의 목소리로 직접 작성해요.</p><textarea value={writeText} onChange={(event) => setWriteText(event.target.value)} placeholder={`${displayName}의 글을 직접 써보세요.`} /><div className="al-write-actions"><button className="al-write-cancel border-line bg-transparent text-soft hover:border-line-strong hover:bg-surface-muted hover:text-ink" onClick={() => { setWriteOpen(false); setWriteText(""); }}>취소</button><button className="al-write-post bg-accent text-on-accent hover:bg-accent-strong disabled:bg-surface-muted disabled:text-soft" disabled={!writeText.trim()} onClick={() => { manualPost(writeText); setWriteText(""); setWriteOpen(false); }}>올리기</button></div></div>}
      </div>
      {autoPostSettings}
    </>
  );
}

function AutoPostSettings({ auto, autoIntervalSeconds, autoPostNotice, char, isOpen, nextIn, onToggle, setAuto, update }: AutoPostSettingsProps): React.ReactElement {
  return <><button className="al-compose-settings-toggle" type="button" aria-expanded={isOpen} onClick={onToggle}><span className="al-compose-settings-copy"><i><AliveIcon name="sparkle" size={15} /></i><span><b>근황 루틴</b><small>{composerSettingsSummary(auto, autoIntervalSeconds, autoPostNotice)}</small></span></span><i className="al-compose-settings-icon"><AliveIcon name={isOpen ? "minus" : "plus"} size={15} /></i></button>{!isOpen && autoPostNotice && <p className="al-auto-post-notice al-auto-post-notice-collapsed" role="status">{autoPostNotice}</p>}{isOpen && <div className="al-compose-settings"><AutoRoutinePanel auto={auto} autoIntervalSeconds={autoIntervalSeconds} autoPostNotice={autoPostNotice} nextIn={nextIn} setAuto={setAuto} /><div className="al-directive"><span className="al-directive-lbl">다음 근황에 담을 지금 상황</span><input className="al-directive-input" value={char.directions || ""} onChange={(event) => update("directions", event.target.value)} placeholder="예: 연이랑 데이트하고 기분 좋음 / 시험 끝나서 들뜬 상태" />{(char.directions || "").trim() && <span className="al-directive-on">적용 중</span>}</div></div>}</>;
}

function MoodButton({ mood, onSelect }: { mood: string; onSelect: (mood: string) => void }): React.ReactElement {
  const label = moodLabel(mood);
  return <button type="button" className="al-mood" onClick={() => onSelect(mood)}><b>{label.title}</b>{label.hint && <small>{label.hint}</small>}</button>;
}

function moodLabel(mood: string): { hint: string; title: string } {
  const slashParts = mood.split(" / ");
  if (slashParts.length > 1) return { title: slashParts[0], hint: slashParts.slice(1).join(" / ") };
  const parenthetical = mood.match(/^(.+?)\s*\((.+)\)$/);
  if (!parenthetical) return { title: mood, hint: "" };
  return { title: parenthetical[1], hint: parenthetical[2] };
}

function composerSettingsSummary(auto: boolean, interval: number, notice: string): string {
  if (notice) return auto ? `자동 재시도 중 · ${autoIntervalLabel(interval)}마다` : "루틴 종료 · 자원을 채운 뒤 다시 시작";
  return `${auto ? "남기는 중" : "쉬는 중"} · ${autoIntervalLabel(interval)}마다 · 에너지 우선`;
}

function AutoRoutinePanel({ auto, autoIntervalSeconds, autoPostNotice, nextIn, setAuto }: AutoRoutinePanelProps): React.ReactElement {
  const [draftInterval, setDraftInterval] = React.useState(autoIntervalSeconds);
  const [isSaving, setIsSaving] = React.useState(false);
  React.useEffect(() => { setDraftInterval(autoIntervalSeconds); }, [autoIntervalSeconds]);
  const pace = autoPostPace(draftInterval);
  const isChangePending = auto && draftInterval !== autoIntervalSeconds;
  const action = auto ? isChangePending ? "이 주기로 바꾸기" : "루틴 멈추기" : "루틴 시작하기";
  async function applyRoutine(): Promise<void> {
    if (isSaving) return;
    setIsSaving(true);
    await setAuto(auto ? isChangePending : true, draftInterval);
    setIsSaving(false);
  }
  return <section className="al-auto-routine" aria-labelledby="auto-routine-title"><header><small>캐릭터의 루틴</small><b id="auto-routine-title">혼자 남기는 근황</b><p>캐릭터가 자신의 일상을 가끔 남겨요.</p></header><div className="al-auto-paces" role="group" aria-label="근황 빈도">{AUTO_POST_PACES.map((item) => <AutoPaceButton current={draftInterval} key={item.intervalSeconds} pace={item} onSelect={setDraftInterval} />)}</div><p className="al-auto-selection"><b>{pace.label} · {autoIntervalLabel(pace.intervalSeconds)}마다</b><span>에너지 25% 우선 · 부족하면 2C</span></p><p className="al-auto-schedule">{routineScheduleCopy(auto, isChangePending, draftInterval, nextIn)}</p><button className={`al-auto-action ${auto && !isChangePending ? "on" : ""}`} disabled={isSaving} type="button" onClick={() => { void applyRoutine(); }}>{isSaving ? "저장 중…" : `${autoIntervalLabel(draftInterval)} ${action}`}</button><CreditLifecycleNote />{autoPostNotice && <p className="al-auto-post-notice" role="status">{autoPostNotice}</p>}</section>;
}

function AutoPaceButton({ current, pace, onSelect }: { current: number; pace: AutoPace; onSelect: (interval: number) => void; }): React.ReactElement {
  const selected = current === pace.intervalSeconds;
  return <button type="button" aria-pressed={selected} className={selected ? "selected" : ""} onClick={() => onSelect(pace.intervalSeconds)}><b>{pace.label}{pace.recommended && <em>추천</em>}</b><small>{autoIntervalLabel(pace.intervalSeconds)}마다</small></button>;
}

function CreditLifecycleNote(): React.ReactElement {
  return <details className="al-auto-credit-life"><summary>사용 자원과 종료 기준</summary><p>한 편마다 무료 회복 에너지 25%를 먼저 사용해요. 부족하면 무료 보너스, 구매 크레딧 순서로 2C를 사용하고, 모두 부족하면 루틴이 종료돼요. 일시적인 생성 실패는 차감 없이 자동으로 다시 시도해요.</p></details>;
}

function routineScheduleCopy(auto: boolean, isChangePending: boolean, interval: number, nextIn: number): string {
  if (!auto) return `시작하면 첫 근황은 약 ${autoIntervalLabel(interval)} 뒤에 남겨요.`;
  if (!isChangePending) return nextIn > 0 ? `다음 근황까지 약 ${countdownText(nextIn)}` : "다음 근황 시간을 확인하고 있어요.";
  if (nextIn <= 0) return "새 주기는 다음 근황부터 적용돼요.";
  return `다음 근황은 약 ${countdownText(Math.min(nextIn, interval))} 뒤, 그다음부터 ${autoIntervalLabel(interval)}마다예요.`;
}

function autoIntervalLabel(interval: number): string {
  return interval === 3600 ? "1시간" : interval === 21600 ? "6시간" : "12시간";
}

function autoPostPace(interval: number): AutoPace {
  return AUTO_POST_PACES.find((pace) => pace.intervalSeconds === interval) || AUTO_POST_PACES[1];
}

function countdownText(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${remaining}` : `${minutes}:${remaining}`;
}
