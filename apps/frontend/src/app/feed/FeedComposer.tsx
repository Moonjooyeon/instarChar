import React from "react";

export function FeedComposer({ ctx }) {
  const {
    auto,
    char,
    fast,
    generatePost,
    josa,
    loading,
    manualPost,
    moodOpen,
    nextIn,
    POST_MOODS,
    setAuto,
    setFast,
    setMoodOpen,
    setWriteOpen,
    setWriteText,
    update,
    writeOpen,
    writeText,
  } = ctx;
  return (
    <>
      <div className="al-autobar">
        <button className={`al-autotoggle ${auto ? "on" : ""}`} onClick={() => setAuto((value) => !value)}>
          <span className="al-autodot" />
          {auto ? `자율 모드 ON · ${josa(char.name, "이/가")} 알아서 올리는 중` : "자율 모드 OFF"}
        </button>
        {auto && (
          <div className="al-autometa">
            <span className="al-nextin">{fast ? "" : "다음 글 "}~{Math.floor(nextIn / 60)}:{String(nextIn % 60).padStart(2, "0")}</span>
            <button className={`al-fast ${fast ? "on" : ""}`} onClick={() => setFast((value) => !value)}>
              {fast ? "빠름(30초)" : "15분"}
            </button>
          </div>
        )}
      </div>
      <div className="al-directive">
        <span className="al-directive-lbl">▸ {josa(char.name, "에게/에게")} 지시</span>
        <input className="al-directive-input" value={char.directions || ""} onChange={(event) => update("directions", event.target.value)} placeholder="예: 연이랑 데이트하고 기분 좋음 / 시험 끝나서 들뜬 상태" />
        {(char.directions || "").trim() && <span className="al-directive-on">적용 중</span>}
      </div>
      <div className="al-composer">
        {!moodOpen ? (
          <div className="al-compose-row">
            <button className="al-wake" onClick={() => setMoodOpen(true)} disabled={loading}>
              {loading ? <span className="al-typing"><i/><i/><i/></span> : `✶ ${josa(char.name, "한테/한테")} 시키기`}
            </button>
            <button className="al-writeself" onClick={() => setWriteOpen((value) => !value)}>✎ 내가 쓰기</button>
          </div>
        ) : (
          <div className="al-moods">
            <p className="al-moods-q">어떤 글을 올릴까?</p>
            <div className="al-moods-grid">
              {POST_MOODS.map((mood) => (
                <button key={mood} className="al-mood" onClick={() => generatePost(mood)}>{mood}</button>
              ))}
            </div>
            <button className="al-moods-cancel" onClick={() => setMoodOpen(false)}>닫기</button>
          </div>
        )}
        {writeOpen && (
          <div className="al-writebox">
            <p className="al-write-lbl">{josa(char.name, "으로/로")} 직접 작성 — 내가 이 캐릭터가 되어 올림</p>
            <textarea value={writeText} onChange={(event) => setWriteText(event.target.value)} placeholder={`${char.name}의 글을 직접 써봐…`} />
            <div className="al-write-actions">
              <button className="al-write-cancel" onClick={() => { setWriteOpen(false); setWriteText(""); }}>취소</button>
              <button className="al-write-post" disabled={!writeText.trim()} onClick={() => { manualPost(writeText); setWriteText(""); setWriteOpen(false); }}>올리기</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
