import React from "react";

export function ConfirmScreen({
  activeId,
  char,
  confirmReady,
  parseError,
  parseFailed,
  parseRelations,
  saveCharacterEdits,
  setStep,
  update,
  wakeCharacter,
  waking,
}) {
  return (
    <div className="al-phone">
      <div className="al-setup">
        <div className="al-setup-head">
          <h1 className="al-confirm-title">{parseFailed ? "분석이 잘 안 됐어" : "이렇게 이해했어"}</h1>
          <p>{parseFailed ? "직접 채워도 되고, 다시 분석을 돌려도 돼." : "틀린 것만 톡 고치면 돼."}</p>
        </div>
        {parseFailed && (
          <>
            {parseError && <div className="al-parse-error"><span>실패 원인</span><p>{parseError}</p></div>}
            <button className="al-retry" onClick={() => setStep("dump")}>↻ 다시 분석 돌리기</button>
          </>
        )}
        <label className="al-field">
          <span>이름 *</span>
          <input value={char.name} onChange={(event) => update("name", event.target.value)} placeholder="캐릭터 이름" />
        </label>
        <div className="al-row">
          <label className="al-field">
            <span>아이디</span>
            <input value={char.handle} onChange={(event) => update("handle", event.target.value)} placeholder="@id" />
          </label>
          <label className="al-field">
            <span>나이/설정</span>
            <input value={char.age} onChange={(event) => update("age", event.target.value)} placeholder="예: 21 / 마법사" />
          </label>
        </div>
        <CharacterAnalysisFields char={char} update={update} />
        <div className="al-relbox">
          <div className="al-relbox-head">
            <span>♥ 관계</span>
            <span className="al-relbox-hint">"이름 — 관계" 쉼표로 여러 명</span>
          </div>
          {parseRelations(char.relations).length > 0 && (
            <div className="al-relviz">
              {parseRelations(char.relations).map(({ who, label }, index) => (
                <div key={index} className="al-relviz-item">
                  <div className="al-relviz-line2">
                    <span className="al-relviz-me">{char.name || "이 캐릭터"}</span>
                    <span className="al-relviz-arrow">→</span>
                    <span className="al-relviz-peer">{who}</span>
                  </div>
                  {label && <span className="al-relviz-rel">{label}</span>}
                </div>
              ))}
            </div>
          )}
          <input className="al-relinput" value={char.relations} onChange={(event) => update("relations", event.target.value)} placeholder="예: 선우 연 — 애인, 카엘 — 라이벌" />
        </div>
        <label className="al-field">
          <span>페르소나 *</span>
          <textarea value={char.persona} onChange={(event) => update("persona", event.target.value)} />
        </label>
        <label className="al-field">
          <span>세계관/배경</span>
          <textarea value={char.world} onChange={(event) => update("world", event.target.value)} placeholder="(없으면 비워도 됨)" />
        </label>
        <label className="al-field">
          <span>말투 특징</span>
          <input value={char.speech} onChange={(event) => update("speech", event.target.value)} placeholder="(없으면 비워도 됨)" />
        </label>
        <div className="al-confirm-actions">
          <button className="al-reparse" onClick={() => activeId ? setStep("home") : setStep("dump")}>
            {activeId ? "← 뒤로 가기" : "← 다시 쓰기"}
          </button>
          <button className="al-start al-confirm-go" disabled={!confirmReady || waking} onClick={activeId ? saveCharacterEdits : wakeCharacter}>
            {waking ? "깨우는 중..." : activeId ? "수정완료" : confirmReady ? `${char.name.trim()} 깨우기` : "이름·페르소나 필수"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CharacterAnalysisFields({ char, update }) {
  return (
    <div className="al-analysis">
      <div className="al-analysis-head"><span className="al-spark-sm">✶</span> AI가 분석한 {char.name || "이 캐릭터"}</div>
      {[
        ["surface", "겉모습", "첫인상·겉으로 보이는 모습"],
        ["inner", "속마음", "겉과 다른 숨은 면"],
        ["situational", "상황별", "평소 vs 친한 사람 vs 위기"],
        ["triggers", "무너지는 점", "발끈하거나 약해지는 포인트"],
        ["interests", "좋아하는 것", "취미·관심사"],
      ].map(([key, label, placeholder]) => (
        <label className="al-an-row" key={key}>
          <span className="al-an-lbl">{label}</span>
          <input value={char[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} />
        </label>
      ))}
      <div className="al-an-row">
        <span className="al-an-lbl">정드는 속도</span>
        <div className="al-warmth-chips">
          {[["slow", "느림 🧊"], ["normal", "보통"], ["fast", "빠름 💗"]].map(([value, label]) => (
            <button key={value} type="button" className={`al-warmth-chip ${(char.warmth || "normal") === value ? "on" : ""}`} onClick={() => update("warmth", value)}>
              {label}
            </button>
          ))}
          <span className="al-warmth-hint">무뚝뚝·배타적이면 호감도가 천천히 오름</span>
        </div>
      </div>
    </div>
  );
}
