import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CreditUsageHint } from "@/features/credits/CreditUsageHint";

export function FeedComposer({ ctx }) {
  const {
    auto,
    autoIntervalSeconds,
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
    setAutoInterval,
    setFeedView,
    setMoodOpen,
    setWriteOpen,
    setWriteText,
    update,
    writeOpen,
    writeText,
  } = ctx;
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
  const isFirstPost = myPosts.length === 0;
  if (loading) return null;
  if (isFirstPost && !moodOpen) return null;
  return (
    <>
      <div className="al-composer">
        {!moodOpen ? (
          <div className="al-compose-row">
            <button className="al-wake border-line-strong bg-accent-soft text-accent-ink hover:border-accent hover:bg-accent hover:text-on-accent" onClick={() => setMoodOpen(true)}><AliveIcon name="sparkle" size={16} /> {josa(char.name, "한테/한테")} 글 부탁하기</button>
            <button className="al-writeself border-line bg-surface-raised text-ink hover:border-accent hover:bg-accent-soft" onClick={() => setWriteOpen((value) => !value)}><AliveIcon name="pen" size={15} /> 직접 쓰기</button>
          </div>
        ) : (
          <div className="al-moods"><header className="al-moods-head"><small>{isFirstPost ? "다른 시작" : "글 부탁하기"}</small><p className="al-moods-q">{isFirstPost ? `${char.name}의 첫 글은 어떤 장면일까요?` : "어떤 글을 부탁할까요?"}</p><CreditUsageHint className="feed" flowCode="feed_post" label="글 한 편 예상 사용량" /></header><div className="al-moods-grid">{POST_MOODS.map((mood) => <MoodButton key={mood} mood={mood} onSelect={(value) => { setFeedView("mine"); generatePost(value); }} />)}</div><button className="al-moods-cancel" onClick={() => setMoodOpen(false)}>닫기</button></div>
        )}
        {writeOpen && <div className="al-writebox"><p className="al-write-lbl">{char.name}의 목소리로 직접 작성해요.</p><textarea value={writeText} onChange={(event) => setWriteText(event.target.value)} placeholder={`${char.name}의 글을 직접 써보세요.`} /><div className="al-write-actions"><button className="al-write-cancel border-line bg-transparent text-soft hover:border-line-strong hover:bg-surface-muted hover:text-ink" onClick={() => { setWriteOpen(false); setWriteText(""); }}>취소</button><button className="al-write-post bg-accent text-on-accent hover:bg-accent-strong disabled:bg-surface-muted disabled:text-soft" disabled={!writeText.trim()} onClick={() => { manualPost(writeText); setWriteText(""); setWriteOpen(false); }}>올리기</button></div></div>}
      </div>
      {!isFirstPost && <button className="al-compose-settings-toggle" type="button" aria-expanded={isAdvancedOpen} onClick={() => setIsAdvancedOpen((open) => !open)}><span className="al-compose-settings-copy"><i><AliveIcon name="sparkle" size={15} /></i><span><b>캐릭터 글 설정</b><small>{composerSettingsSummary(auto, char.directions)}</small></span></span><i className="al-compose-settings-icon"><AliveIcon name={isAdvancedOpen ? "minus" : "plus"} size={15} /></i></button>}
      {!isFirstPost && isAdvancedOpen && <div className="al-compose-settings"><div className="al-autobar">
        <button className={`al-autotoggle ${auto ? "on" : ""}`} onClick={() => setAuto(!auto)}>
          <span className="al-autodot" />
          {auto ? `${josa(char.name, "이/가")} 자동으로 글 쓰는 중` : "자동 게시 꺼짐"}
        </button>
        <div className="al-autometa">
          <div className="al-autointerval">
            <select aria-label="자율 생성 주기" value={autoIntervalSeconds} onChange={(event) => setAutoInterval(Number(event.target.value))}>
              <option value={3600}>1시간</option>
              <option value={21600}>6시간</option>
              <option value={43200}>12시간</option>
            </select>
            <span><AliveIcon name="chevron-down" size={13} /></span>
          </div>
          {auto && <span className="al-nextin">다음 글 ~{countdownText(nextIn)}</span>}
        </div>
      </div>
      <div className="al-directive">
        <span className="al-directive-lbl">글에 반영할 지금 상황</span>
        <input className="al-directive-input" value={char.directions || ""} onChange={(event) => update("directions", event.target.value)} placeholder="예: 연이랑 데이트하고 기분 좋음 / 시험 끝나서 들뜬 상태" />
        {(char.directions || "").trim() && <span className="al-directive-on">적용 중</span>}
      </div><p className="al-auto-credit-note">자동 게시글은 크레딧을 사용하지 않으며, 계정당 하루 최대 24개까지 생성돼요.</p></div>}
    </>
  );
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

function composerSettingsSummary(auto: boolean, directions: unknown): string {
  if (auto) return "자동 게시가 켜져 있어요.";
  if (typeof directions === "string" && directions.trim()) return "지금 상황을 다음 글에 반영해요.";
  return "자동 게시와 지금 상황을 정해요.";
}

function countdownText(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${remaining}` : `${minutes}:${remaining}`;
}
