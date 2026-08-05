import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";
import { ServiceTour } from "@/features/onboarding/ServiceTour";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  ACCOUNT_DELETION_URL,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} from "@/domain/app/legal";

const HOME_SIGN_OUT_CLASS = "border-line bg-surface-raised text-accent-ink hover:border-line-strong hover:text-accent-strong";
const HOME_ADD_CLASS = "al-cast-add border-line text-ink hover:border-line-strong";
const FIRST_CHARACTER_CLASS = "al-accadd first border-accent bg-accent text-white hover:border-accent-strong hover:bg-accent-strong";
const HOME_TOUR_CLASS = "al-first-demo-link border-line bg-surface text-ink hover:border-accent hover:bg-accent-soft";

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
  theme,
}) {
  const hasCharacters = accounts.length > 0;
  const saveMessage = /중$|실패|오류/.test(saveStatus) ? saveStatus : "";
  const [isTourOpen, setIsTourOpen] = React.useState(false);
  if (!hasCharacters && isTourOpen) return <ServiceTour completeLabel="내 캐릭터 만들기" onBack={() => setIsTourOpen(false)} onComplete={startNewCharacter} />;
  return (
    <div className="al-phone al-theme-ready">
      <div className={`al-home ${hasCharacters ? "" : "al-home-first"}`}>
        <div className="al-accountbar">
          <span>{hasBackendApiConfig ? (profileName || session?.user?.email || "로그인됨") : "로컬 모드"}</span>
          {saveMessage && <b role="status">{saveMessage}</b>}
          <ThemeToggle {...theme} />
          {hasBackendApiConfig && <button className={HOME_SIGN_OUT_CLASS} onClick={signOut}>로그아웃</button>}
        </div>
        {hasCharacters ? <CharacterShelf accounts={accounts} editAccount={editAccount} onDelete={setDeleteTarget} onOpen={switchAccount} onStartNew={startNewCharacter} /> : <FirstCharacterEntry onStart={startNewCharacter} onTour={() => setIsTourOpen(true)} />}

        {USER_PERSONA_FEATURE_ENABLED && <div className="al-persona-mgr">
          <div className="al-pm-head"><AliveIcon name="masks" size={17} /> 내 페르소나 <span>{personas.length > 0 && `(${personas.length})`}</span></div>
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
            <button className="al-pm-add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}><AliveIcon name="plus" size={15} /> 페르소나 만들기</button>
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

function CharacterShelf({ accounts, editAccount, onDelete, onOpen, onStartNew }) {
  return <><header className="al-cast-head"><span className="al-flow-eyebrow">이어지는 이야기</span><div><h1>내 캐릭터들</h1><b>{String(accounts.length).padStart(2, "0")}명</b></div></header><section className="al-cast-list" aria-label="내 캐릭터 목록">{accounts.map((account, index) => <CharacterEntry account={account} editAccount={editAccount} index={index} key={account.id} onDelete={onDelete} onOpen={onOpen} />)}<button className={HOME_ADD_CLASS} onClick={onStartNew}><span><AliveIcon name="plus" size={18} /></span><div><b>새 캐릭터</b><small>또 다른 이야기 시작하기</small></div><i>만들기 <AliveIcon name="arrow-up-right" size={12} /></i></button></section></>;
}

function CharacterEntry({ account, editAccount, index, onDelete, onOpen }) {
  const name = account.char.name || "이름 없는 인물";
  const handle = account.char.handle || name.replace(/\s/g, "").toLowerCase();
  const description = account.char.persona || account.char.surface || "아직 이 인물의 이야기를 시작하지 않았어요.";
  const postCount = (account.posts || []).length;
  return <article className="al-cast-entry"><button aria-label={`${name} 계정 열기`} className="al-cast-main" onClick={() => onOpen(account.id)}><span className="al-cast-avatar"><CharacterAvatarImage src={account.char.avatarImg} /></span><span className="al-cast-copy"><small>{String(index + 1).padStart(2, "0")} · @{handle}</small><b>{name}</b><em>{description}</em></span><i>열기 <AliveIcon name="arrow-up-right" size={12} /></i></button><footer><span>{postCount > 0 ? `${postCount}개의 기록` : "아직 첫 기록 전"}</span><div><button onClick={() => editAccount(account.id)}>프로필 수정</button><button className="danger" onClick={() => onDelete(account)}>삭제</button></div></footer></article>;
}

function FirstCharacterEntry({ onStart, onTour }) {
  return <><header className="al-home-head"><span className="al-flow-eyebrow">첫 번째 이야기</span><h1>한 줄만 남기면<br />캐릭터가 이어가요.</h1><p>첫 글과 대화는 ALIVE가 이어갑니다.</p></header><div className="al-acclist"><section className="al-first-sequence" aria-label="캐릭터 이야기가 시작되는 과정"><div className="al-first-scene"><span>01</span><div><small>당신의 설정</small><p>“리안, 21세. 마법학교 야간 조교.”</p></div></div><div className="al-first-scene"><span>02</span><div><small>캐릭터의 첫 기록</small><p>오늘도 마지막 순찰은 혼자였다.</p></div></div><div className="al-first-scene"><span>03</span><div><small>이어지는 대화</small><p><b>카엘</b> 오늘 밤도 교실에 있어?</p></div></div></section><button aria-label="첫 캐릭터 만들기" className={FIRST_CHARACTER_CLASS} onClick={onStart}><span>첫 캐릭터 만들기</span><i>01 <AliveIcon name="arrow-up-right" size={11} /></i></button><button className={HOME_TOUR_CLASS} onClick={onTour}><span className="al-first-demo-icon"><AliveIcon name="play" size={11} /></span><span><b>서비스 먼저 둘러보기</b><small>3개의 실제 장면으로 미리 보기</small></span><i><AliveIcon name="arrow-right" size={15} /></i></button></div></>;
}
