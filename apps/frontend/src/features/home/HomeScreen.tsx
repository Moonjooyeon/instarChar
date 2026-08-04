import React from "react";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";
import { ServiceTour } from "@/features/onboarding/ServiceTour";
import {
  ACCOUNT_DELETION_URL,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} from "@/domain/app/legal";

const SERVICE_TOUR_DISMISSED_KEY = "alive_service_tour_dismissed";

export function HomeScreen({
  accounts,
  deleteAccount,
  deletePersona,
  editAccount,
  hasBackendApiConfig,
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
  const hasCharacters = accounts.length > 0;
  const [isTourOpen, setIsTourOpen] = React.useState(() => !hasCharacters && sessionStorage.getItem(SERVICE_TOUR_DISMISSED_KEY) !== "true");
  const dismissServiceTour = () => { sessionStorage.setItem(SERVICE_TOUR_DISMISSED_KEY, "true"); setIsTourOpen(false); };
  const startCharacterCreation = () => { sessionStorage.setItem(SERVICE_TOUR_DISMISSED_KEY, "true"); startNewCharacter(); };
  if (!hasCharacters && isTourOpen) return <ServiceTour completeLabel="내 캐릭터 만들기" onBack={dismissServiceTour} onComplete={startCharacterCreation} />;
  return (
    <div className="al-phone">
      <div className={`al-home ${hasCharacters ? "" : "al-home-first"}`}>
        <div className="al-accountbar">
          <span>{hasBackendApiConfig ? (profileName || session?.user?.email || "로그인됨") : "로컬 모드"}</span>
          <b>{saveStatus}</b>
          {hasBackendApiConfig && <button onClick={signOut}>로그아웃</button>}
        </div>
        <div className="al-home-head">
          {hasCharacters && <span className="al-spark">★</span>}
          <h1>{hasCharacters ? "내 캐릭터들" : "내 캐릭터"}</h1>
          <p>{hasCharacters ? "캐릭터를 골라 들어가거나, 새로 깨워봐." : "0명의 캐릭터"}</p>
        </div>

        <div className="al-acclist">
          {!hasCharacters && (
            <section className="al-first-start" aria-labelledby="first-start-title">
              <span className="al-first-start-mark" aria-hidden="true">?</span>
              <span className="al-first-start-label">첫 번째 등장인물</span>
              <h2 id="first-start-title">누구의 이야기를<br />시작할까요?</h2>
              <p>그 아이에 대해 아는 것부터 적어 주세요.</p>
            </section>
          )}
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
          <button className={`al-accadd ${hasCharacters ? "" : "first"}`} onClick={hasCharacters ? startNewCharacter : startCharacterCreation}>{hasCharacters ? "+ 새 캐릭터 깨우기" : "+ 캐릭터 만들기"}</button>
          {!hasCharacters && <button className="al-first-demo-link" onClick={() => setIsTourOpen(true)}>데모 다시 보기</button>}
        </div>

        {USER_PERSONA_FEATURE_ENABLED && <div className="al-persona-mgr">
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
        </div>}
        {hasBackendApiConfig && (
          <div className="al-account-settings">
            <nav aria-label="법률 및 계정 안내">
              <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">개인정보처리방침</a>
              <a href={TERMS_URL} target="_blank" rel="noreferrer">이용약관</a>
              <a href={ACCOUNT_DELETION_URL} target="_blank" rel="noreferrer">계정 삭제 안내</a>
            </nav>
            <button onClick={deleteAccount}>계정 및 모든 데이터 삭제</button>
          </div>
        )}
      </div>
    </div>
  );
}
