import React from "react";

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
        <div className="al-modal-bg" onClick={() => setEditingDmTitle(null)}>
          <div className="al-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="al-modal-title">채팅방 이름 수정</h3>
            <p className="al-modal-sub">비워두면 기본 이름으로 돌아가.</p>
            <input className="al-pd-input" value={editingDmTitle.title} onChange={(event) => setEditingDmTitle((value) => ({ ...value, title: event.target.value }))} placeholder="채팅방 이름" autoFocus onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) saveRenameDm(); }} />
            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setEditingDmTitle(null)}>취소</button>
              <button className="al-modal-save" onClick={saveRenameDm}>저장</button>
            </div>
          </div>
        </div>
      )}
      {canUseApp && onboardingOpen && (
        <div className="al-modal-bg">
          <div className="al-modal al-onboard" onClick={(event) => event.stopPropagation()}>
            <h3 className="al-modal-title">처음 왔구나</h3>
            <p className="al-modal-sub">저장에 쓸 이름만 정하면 바로 캐릭터를 만들 수 있어.</p>
            <input className="al-pd-input" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="내 이름 또는 닉네임" autoFocus />
            <div className="al-pd-btns"><button className="al-pd-save" onClick={completeOnboarding}>시작하기</button></div>
          </div>
        </div>
      )}
      {canUseApp && deleteTarget && (
        <div className="al-modal-bg" onClick={() => setDeleteTarget(null)}>
          <div className="al-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="al-modal-title">캐릭터 삭제</h3>
            <p className="al-modal-sub">{deleteTarget.char?.name || "이 캐릭터"}를 삭제할까요? 피드, 그림, 팔로잉까지 이 계정 저장값에서 함께 지워져.</p>
            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="al-modal-danger" onClick={confirmDeleteCharacter}>삭제</button>
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
