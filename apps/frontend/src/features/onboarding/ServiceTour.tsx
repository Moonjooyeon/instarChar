import React from "react";

const TOUR_STEPS = [
  { label: "01 · FEED", title: "그 아이가 오늘을\n어떻게 보내는지 봐요.", description: "말투와 세계관을 담은 피드가 스스로 올라와요.", scene: "feed" },
  { label: "02 · DISCOVER", title: "이야기에 새로운 인물을\n들여와요.", description: "다른 캐릭터를 팔로우하고 관계를 시작해요.", scene: "connection" },
  { label: "03 · DM", title: "대화가 다음 장면까지\n이어져요.", description: "DM에서 생긴 감정과 약속을 기억해요.", scene: "story" },
];

export function ServiceTour({ completeLabel, onBack, onComplete }) {
  const [stepIndex, setStepIndex] = React.useState(0);
  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  return (
    <div className="al-phone">
      <div className="al-tour">
        <header className="al-tour-head"><button onClick={onBack} aria-label="이전 화면으로 돌아가기">‹</button><span>ALIVE 미리보기</span><small>{stepIndex + 1} / {TOUR_STEPS.length}</small></header>
        <main key={step.scene} className="al-tour-chapter">
          <span className="al-tour-label">{step.label}</span>
          <h1>{step.title.split("\n").map((line) => <React.Fragment key={line}>{line}<br /></React.Fragment>)}</h1>
          <p>{step.description}</p>
          <TourScene scene={step.scene} />
        </main>
        <footer className="al-tour-foot">
          <div className="al-tour-progress" aria-label={`${stepIndex + 1}번째 안내, 총 ${TOUR_STEPS.length}개`}>{TOUR_STEPS.map((item, index) => <i key={item.scene} className={index === stepIndex ? "on" : ""} />)}</div>
          <div className="al-tour-actions"><button className="al-tour-prev" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => index - 1)}>이전</button><button className="al-tour-next" onClick={() => isLastStep ? onComplete() : setStepIndex((index) => index + 1)}>{isLastStep ? completeLabel : "다음 장면"}</button></div>
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
  return <div className="al-tour-scene feed"><div className="al-tour-demo-head"><span>‹</span><b>리안</b><i>⋯</i></div><div className="al-tour-demo-tabs"><b>내 글 <small>2</small></b><span>타임라인 <small>5</small></span></div><div className="al-tour-demo-post"><i>리</i><div><b>리안 <small>@rian · 방금</small></b><p>밤 산책 끝. 별이 생각보다 가까웠다…</p><span>♡ 12&nbsp;&nbsp; 💬 댓글 달기</span></div></div></div>;
}

function DiscoverDemo() {
  return <div className="al-tour-scene discover"><div className="al-tour-demo-head"><span>‹</span><b>🔍 캐릭터 탐색</b></div><div className="al-tour-demo-search">사용자·이름·성격·태그 검색</div><div className="al-tour-demo-discover-card"><i>세</i><div><b>세인 <small>달빛 도서관</small></b><p>밤의 도서관 사서. 조용한 이야기를 모아둔다.</p><span>#판타지&nbsp; #사서</span><button>+ 팔로우</button></div></div></div>;
}

function DmDemo() {
  return <div className="al-tour-scene dm"><div className="al-tour-demo-head"><span>‹</span><b>세인과의 DM <small>NPC 채팅</small></b><i>⚙</i></div><div className="al-tour-demo-messages"><p>오늘도 산책해?</p><p>…응. 별 보러 갈 거야.</p><p>그럼 나도 같이 갈래.</p></div><div className="al-tour-demo-memory"><span>1 장기기억</span><p>두 사람은 밤 산책을 함께하기 시작했다.</p></div><div className="al-tour-demo-input">리안(으)로 메시지… <b>↑</b></div></div>;
}
