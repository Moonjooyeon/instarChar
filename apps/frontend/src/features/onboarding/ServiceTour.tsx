import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";

const TOUR_STEPS = [
  { label: "01 · FEED", title: "한 줄만 적으면\n캐릭터가 먼저 써요.", description: "장면 하나를 고르면 캐릭터의 목소리로 첫 글이 시작돼요.", scene: "feed" },
  { label: "02 · MEET", title: "새로운 캐릭터를\n이야기에 들여와요.", description: "타임라인에 추가하면 글을 보고 바로 대화할 수 있어요.", scene: "connection" },
  { label: "03 · TALK", title: "나눈 대화를 기억하며\n다음 장면을 이어가요.", description: "중요한 약속과 감정은 다음 대화에도 자연스럽게 이어져요.", scene: "story" },
];

const TOUR_BACK_CLASS = "border-line bg-surface-raised text-accent-ink hover:border-accent hover:bg-accent-soft";
const TOUR_PREVIOUS_CLASS = "al-tour-prev border-line bg-surface-raised text-soft hover:border-accent hover:bg-accent-soft hover:text-ink";
const TOUR_NEXT_CLASS = "al-tour-next bg-accent text-white hover:bg-accent-strong";

export function ServiceTour({ completeLabel, onBack, onComplete }) {
  const [stepIndex, setStepIndex] = React.useState(0);
  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  return (
    <div className="al-phone al-theme-ready">
      <div className="al-tour">
        <header className="al-tour-head"><button className={TOUR_BACK_CLASS} onClick={onBack} aria-label="이전 화면으로 돌아가기"><AliveIcon name="chevron-left" size={21} /></button><span>ALIVE 미리보기</span><small>{stepIndex + 1} / {TOUR_STEPS.length}</small></header>
        <main key={step.scene} className="al-tour-chapter">
          <span className="al-tour-label">{step.label}</span>
          <h1>{step.title.split("\n").map((line) => <React.Fragment key={line}>{line}<br /></React.Fragment>)}</h1>
          <p>{step.description}</p>
          <TourScene scene={step.scene} />
        </main>
        <footer className="al-tour-foot">
          <div className="al-tour-progress" aria-label={`${stepIndex + 1}번째 안내, 총 ${TOUR_STEPS.length}개`}>{TOUR_STEPS.map((item, index) => <i key={item.scene} className={index === stepIndex ? "on" : ""} />)}</div>
          <div className="al-tour-actions"><button className={TOUR_PREVIOUS_CLASS} disabled={stepIndex === 0} onClick={() => setStepIndex((index) => index - 1)}>이전</button><button className={TOUR_NEXT_CLASS} onClick={() => isLastStep ? onComplete() : setStepIndex((index) => index + 1)}>{isLastStep ? completeLabel : "다음 장면"}</button></div>
        </footer>
      </div>
    </div>
  );
}

function TourScene({ scene }) {
  if (scene === "feed") return <FeedDemo />;
  if (scene === "connection") return <DiscoverDemo />;
  return <DmDemo />;
}

function FeedDemo() {
  return <div className="al-tour-scene feed"><div className="al-tour-demo-head"><span><AliveIcon name="chevron-left" size={17} /></span><b>리안</b><i><AliveIcon name="more" size={17} /></i></div><div className="al-tour-demo-tabs"><b>내 글 <small>2</small></b><span>타임라인 <small>5</small></span></div><div className="al-tour-demo-post"><i><CharacterAvatarImage /></i><div><b>리안 <small>@rian · 방금</small></b><p>밤 산책 끝. 별이 생각보다 가까웠다…</p><span><AliveIcon name="heart" size={12} /> 12&nbsp;&nbsp; <AliveIcon name="message" size={12} /> 댓글 달기</span></div></div></div>;
}

function DiscoverDemo() {
  return <div className="al-tour-scene discover"><div className="al-tour-demo-head"><span><AliveIcon name="chevron-left" size={17} /></span><b>새로운 캐릭터 만나기</b></div><div className="al-tour-demo-search">이름·성격·태그 검색</div><div className="al-tour-demo-discover-card"><i><CharacterAvatarImage /></i><div><b>세인 <small>달빛 도서관</small></b><p>밤의 도서관 사서. 조용한 이야기를 모아둔다.</p><span>#판타지&nbsp; #사서</span><button><AliveIcon name="plus" size={10} /> 추가</button></div></div></div>;
}

function DmDemo() {
  return <div className="al-tour-scene dm"><div className="al-tour-demo-head"><span><AliveIcon name="chevron-left" size={17} /></span><b>세인과의 대화 <small>나만 보는 대화</small></b><i><AliveIcon name="settings" size={15} /></i></div><div className="al-tour-demo-messages"><p>오늘도 산책해?</p><p>…응. 별 보러 갈 거야.</p><p>그럼 나도 같이 갈래.</p></div><div className="al-tour-demo-memory"><span>이 말을 기억했어요</span><p>두 사람은 밤 산책을 함께하기 시작했다.</p></div><div className="al-tour-demo-input">리안(으)로 메시지… <b><AliveIcon name="send" size={13} /></b></div></div>;
}
