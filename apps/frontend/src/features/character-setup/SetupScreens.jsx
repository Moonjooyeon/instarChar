import React from "react";

export function DumpScreen({
  dump,
  examples,
  parsing,
  parseDump,
  rpLog,
  setDump,
  setRpLog,
  setStep,
}) {
  return (
    <div className="al-phone">
      <button className="al-dump-back" onClick={() => setStep("home")}>‹ 내 캐릭터들</button>
      <div className="al-setup">
        <div className="al-setup-head">
          <span className="al-spark">✶</span>
          <h1>내 캐릭터를 깨운다</h1>
          <p>걔에 대해 적어줘.<br />설명만 있어도 깨울 수 있어.</p>
        </div>

        <div className="al-guidechips">
          {["이름", "성격", "말투·입버릇", "좋아하는 거", "세계관", "캐치프레이즈"].map((g) => (
            <span key={g} className="al-guidechip">{g}</span>
          ))}
        </div>

        <textarea
          className="al-dump"
          value={dump}
          onChange={(e) => setDump(e.target.value)}
          placeholder={"이름은 리안. 21살, 마법학교 다님.\n겉으론 시크·까칠한데 단 거 앞에선 무너짐.\n반말 쓰고 문장 끝에 '…' 자주 붙임.\n고양이 키우고 밤에 글 쓰는 거 좋아함."}
        />

        <div className="al-rp">
          <div className="al-rp-head">
            <span>역극 · 대사 로그</span>
            <span className="al-rp-opt">선택</span>
          </div>
          <p className="al-rp-desc">대사를 넣으면 말투·캐치프레이즈를 훨씬 정확하게 잡아.</p>
          <textarea
            className="al-rp-box"
            value={rpLog}
            onChange={(e) => setRpLog(e.target.value)}
            placeholder={"리안: 됐어, 그런 건 알아서 할게…\n리안: …고마워. 딱 한 번만 말한다.\n리안: 시끄러워. 그 얘긴 그만."}
          />
        </div>

        <div className="al-examples">
          <span className="al-examples-lbl">막막하면 예시로 시작해도 돼 →</span>
          <div className="al-example-cards">
            {examples.map((ex) => (
              <button key={ex.name} className="al-example" onClick={() => setDump(ex.text)}>
                <span className="al-example-name">{ex.name}</span>
                <span className="al-example-desc">{ex.short}</span>
              </button>
            ))}
          </div>
        </div>

        <button className="al-start" disabled={(!dump.trim() && !rpLog.trim()) || parsing} onClick={parseDump}>
          {parsing ? <span className="al-typing"><i/><i/><i/></span> : "이대로 깨우기"}
        </button>
        <p className="al-dump-note">정리는 AI가 해줄게. 다음 화면에서 확인하고 고치면 돼.</p>
      </div>
    </div>
  );
}

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
            {parseError && (
              <div className="al-parse-error">
                <span>실패 원인</span>
                <p>{parseError}</p>
              </div>
            )}
            <button className="al-retry" onClick={() => setStep("dump")}>
              ↻ 다시 분석 돌리기
            </button>
          </>
        )}

        <label className="al-field">
          <span>이름 *</span>
          <input value={char.name} onChange={(e) => update("name", e.target.value)} placeholder="캐릭터 이름" />
        </label>

        <div className="al-row">
          <label className="al-field">
            <span>아이디</span>
            <input value={char.handle} onChange={(e) => update("handle", e.target.value)} placeholder="@id" />
          </label>
          <label className="al-field">
            <span>나이/설정</span>
            <input value={char.age} onChange={(e) => update("age", e.target.value)} placeholder="예: 21 / 마법사" />
          </label>
        </div>

        <div className="al-analysis">
          <div className="al-analysis-head">
            <span className="al-spark-sm">✶</span> AI가 분석한 {char.name || "이 캐릭터"}
          </div>
          <label className="al-an-row">
            <span className="al-an-lbl">겉모습</span>
            <input value={char.surface} onChange={(e) => update("surface", e.target.value)} placeholder="첫인상·겉으로 보이는 모습" />
          </label>
          <label className="al-an-row">
            <span className="al-an-lbl">속마음</span>
            <input value={char.inner} onChange={(e) => update("inner", e.target.value)} placeholder="겉과 다른 숨은 면" />
          </label>
          <label className="al-an-row">
            <span className="al-an-lbl">상황별</span>
            <input value={char.situational} onChange={(e) => update("situational", e.target.value)} placeholder="평소 vs 친한 사람 vs 위기" />
          </label>
          <label className="al-an-row">
            <span className="al-an-lbl">무너지는 점</span>
            <input value={char.triggers} onChange={(e) => update("triggers", e.target.value)} placeholder="발끈하거나 약해지는 포인트" />
          </label>
          <label className="al-an-row">
            <span className="al-an-lbl">좋아하는 것</span>
            <input value={char.interests} onChange={(e) => update("interests", e.target.value)} placeholder="취미·관심사" />
          </label>
          <div className="al-an-row">
            <span className="al-an-lbl">정드는 속도</span>
            <div className="al-warmth-chips">
              {[["slow", "느림 🧊"], ["normal", "보통"], ["fast", "빠름 💗"]].map(([v, lbl]) => (
                <button
                  key={v}
                  type="button"
                  className={`al-warmth-chip ${(char.warmth || "normal") === v ? "on" : ""}`}
                  onClick={() => update("warmth", v)}
                >
                  {lbl}
                </button>
              ))}
              <span className="al-warmth-hint">무뚝뚝·배타적이면 호감도가 천천히 오름</span>
            </div>
          </div>
        </div>

        <div className="al-relbox">
          <div className="al-relbox-head">
            <span>♥ 관계</span>
            <span className="al-relbox-hint">"이름 — 관계" 쉼표로 여러 명</span>
          </div>
          {parseRelations(char.relations).length > 0 && (
            <div className="al-relviz">
              {parseRelations(char.relations).map(({ who, label }, i) => (
                <div key={i} className="al-relviz-item">
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
          <input
            className="al-relinput"
            value={char.relations}
            onChange={(e) => update("relations", e.target.value)}
            placeholder="예: 선우 연 — 애인, 카엘 — 라이벌"
          />
        </div>

        <label className="al-field">
          <span>페르소나 *</span>
          <textarea value={char.persona} onChange={(e) => update("persona", e.target.value)} />
        </label>

        <label className="al-field">
          <span>세계관/배경</span>
          <textarea value={char.world} onChange={(e) => update("world", e.target.value)} placeholder="(없으면 비워도 됨)" />
        </label>

        <label className="al-field">
          <span>말투 특징</span>
          <input value={char.speech} onChange={(e) => update("speech", e.target.value)} placeholder="(없으면 비워도 됨)" />
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
