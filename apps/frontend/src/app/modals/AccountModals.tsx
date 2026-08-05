import React from "react";

const MODAL_INPUT_CLASS = "al-pd-input border-line bg-surface-raised text-ink placeholder:text-faint focus:border-accent";
const MODAL_CANCEL_CLASS = "al-modal-cancel border-line bg-surface-raised text-soft hover:border-line-strong hover:bg-surface-muted hover:text-ink";
const MODAL_SAVE_CLASS = "al-modal-save bg-accent text-white hover:bg-accent-strong";
const MODAL_DANGER_CLASS = "al-modal-danger bg-danger-soft text-danger hover:bg-danger hover:text-white";

export function AccountModals({ ctx }) {
  const {
    authLoading,
    authMessage,
    canUseApp,
    completeOnboarding,
    confirmDeleteCharacter,
    deleteTarget,
    editingDmTitle,
    onboardingOpen,
    profileName,
    recoverAuthScreen,
    RecoveryScreen,
    saveRenameDm,
    setDeleteTarget,
    setEditingDmTitle,
    setPeer,
    setProfileName,
    setStateReady,
    setStep,
    showRecoveryScreen,
  } = ctx;
  return (
    <>
      {canUseApp && editingDmTitle && (
        <div className="al-modal-bg al-theme-ready al-common-modal-theme-ready" onClick={() => setEditingDmTitle(null)}>
          <div className="al-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="al-modal-title">채팅방 이름 수정</h3>
            <p className="al-modal-sub">비워두면 기본 이름으로 돌아가.</p>
            <input className={MODAL_INPUT_CLASS} value={editingDmTitle.title} onChange={(event) => setEditingDmTitle((value) => ({ ...value, title: event.target.value }))} placeholder="채팅방 이름" autoFocus onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) saveRenameDm(); }} />
            <div className="al-modal-actions">
              <button className={MODAL_CANCEL_CLASS} onClick={() => setEditingDmTitle(null)}>취소</button>
              <button className={MODAL_SAVE_CLASS} onClick={saveRenameDm}>저장</button>
            </div>
          </div>
        </div>
      )}
      {canUseApp && onboardingOpen && (
        <div className="al-modal-bg al-theme-ready al-common-modal-theme-ready">
          <div className="al-modal al-onboard" onClick={(event) => event.stopPropagation()}>
            <h3 className="al-modal-title">처음 왔구나</h3>
            <p className="al-modal-sub">저장에 쓸 이름만 정하면 바로 캐릭터를 만들 수 있어.</p>
            <input className={MODAL_INPUT_CLASS} value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="내 이름 또는 닉네임" autoFocus />
            <div className="al-pd-btns"><button className="al-pd-save bg-accent text-white hover:bg-accent-strong" onClick={completeOnboarding}>시작하기</button></div>
          </div>
        </div>
      )}
      {canUseApp && deleteTarget && (
        <div className="al-modal-bg al-theme-ready al-common-modal-theme-ready" onClick={() => setDeleteTarget(null)}>
          <div className="al-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="al-modal-title">캐릭터 삭제</h3>
            <p className="al-modal-sub">{deleteTarget.char?.name || "이 캐릭터"}를 삭제할까요? 피드, 그림, 팔로잉까지 이 계정 저장값에서 함께 지워져.</p>
            <div className="al-modal-actions">
              <button className={MODAL_CANCEL_CLASS} onClick={() => setDeleteTarget(null)}>취소</button>
              <button className={MODAL_DANGER_CLASS} onClick={confirmDeleteCharacter}>삭제</button>
            </div>
          </div>
        </div>
      )}
      {showRecoveryScreen && (
        <RecoveryScreen
          authMessage={authMessage}
          onHome={() => { setPeer(null); setStep("home"); setStateReady(true); }}
          onRecoverAuth={recoverAuthScreen}
        />
      )}
    </>
  );
}
