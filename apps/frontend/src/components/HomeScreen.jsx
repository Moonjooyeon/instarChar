import React from "react";

export function HomeScreen({
  accounts,
  buildMark,
  deletePersona,
  editAccount,
  hasSupabaseConfig,
  personas,
  profileName,
  saveStatus,
  session,
  setDeleteTarget,
  setPersonaDraft,
  signOut,
  startNewCharacter,
  switchAccount,
}) {
  return (
    <div className="al-phone">
      <div className="al-home">
        <div className="al-accountbar">
          <span>{hasSupabaseConfig ? (profileName || session?.user?.email || "로그인됨") : "로컬 모드"}</span>
          <b>{saveStatus}</b>
          {hasSupabaseConfig && <button onClick={signOut}>로그아웃</button>}
        </div>
        <div className="al-home-head">
          <span className="al-spark">✶</span>
          <h1>내 캐릭터들</h1>
          <p>{accounts.length > 0 ? "캐릭터를 골라 들어가거나, 새로 깨워봐." : "첫 캐릭터를 깨워보자."}</p>
        </div>

        <div className="al-acclist">
          {accounts.map((a) => {
            const ini = a.char.name.trim() ? a.char.name.trim()[0] : "?";
            return (
              <div key={a.id} className="al-acccard">
                <button className="al-acccard-main" onClick={() => switchAccount(a.id)}>
                  <div className="al-acccard-av">{ini}</div>
                  <div className="al-acccard-info">
                    <span className="al-acccard-name">{a.char.name}</span>
                    <span className="al-acccard-handle">@{a.char.handle || a.char.name.replace(/\s/g, "").toLowerCase()}</span>
                    {a.char.relations && <span className="al-acccard-rel">♥ {a.char.relations}</span>}
                  </div>
                  <span className="al-acccard-count">{(a.posts || []).length}글</span>
                </button>
                <div className="al-acc-actions">
                  <button className="al-accedit" onClick={() => editAccount(a.id)} aria-label={`${a.char.name} 수정`}>수정</button>
                  <button className="al-accdel" onClick={() => setDeleteTarget(a)} aria-label={`${a.char.name} 삭제`}>삭제</button>
                </div>
              </div>
            );
          })}
          <button className="al-accadd" onClick={startNewCharacter}>+ 새 캐릭터 깨우기</button>
        </div>

        <div className="al-persona-mgr">
          <div className="al-pm-head">🎭 내 페르소나 <span>{personas.length > 0 && `(${personas.length})`}</span></div>
          <p className="al-pm-desc">캐릭터에게 다가갈 또 다른 나. DM에서 골라 쓰면 캐릭터처럼 호감도·관계가 따로 쌓여.</p>
          <div className="al-pm-list">
            {personas.map((p) => (
              <div key={p.id} className="al-pm-row">
                <button className="al-pm-card" onClick={() => setPersonaDraft({ ...p })}>
                  <span className="al-pm-av">{p.name.trim()[0] || "?"}</span>
                  <span className="al-pm-info">
                    <span className="al-pm-name">{p.name}</span>
                    <span className="al-pm-sub">{p.age || p.persona?.slice(0, 24) || "설정 없음"}</span>
                  </span>
                </button>
                <div className="al-pm-actions">
                  <button className="al-pm-edit-mini" onClick={() => setPersonaDraft({ ...p })} aria-label={`${p.name} 페르소나 수정`}>수정</button>
                  <button className="al-pm-del-mini" onClick={() => deletePersona(p.id)} aria-label={`${p.name} 페르소나 삭제`}>삭제</button>
                </div>
              </div>
            ))}
            <button className="al-pm-add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}>+ 페르소나 만들기</button>
          </div>
        </div>

        <div className="al-build">build {String(buildMark).slice(0, 7)}</div>
      </div>
    </div>
  );
}
