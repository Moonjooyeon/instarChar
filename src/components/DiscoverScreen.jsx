import React from "react";

export function DiscoverScreen({
  activeId,
  activeSharedId,
  char,
  discoverPool,
  discoverQuery,
  following,
  hasSupabaseConfig,
  isFollowing,
  loadSharedCharacters,
  publicFollowerCount,
  requestDmEntry,
  session,
  setDiscoverQuery,
  setPublicProfile,
  setSharedFocusId,
  setStep,
  sharedCharacters,
  sharedFocusId,
  sharedLoadState,
  toggleFollow,
  WorldChip,
}) {
  const q = (discoverQuery || "").trim().toLowerCase();
  const safeSharedCharacters = Array.isArray(sharedCharacters) ? sharedCharacters : [];
  const safeDiscoverPool = Array.isArray(discoverPool) ? discoverPool : [];
  const safeFollowing = Array.isArray(following) ? following : [];
  const safeSharedLoadState = sharedLoadState || {};
  const mergedDiscover = hasSupabaseConfig ? safeSharedCharacters : safeDiscoverPool;
  const isActiveShared = (c) => Boolean(
    (activeSharedId && (c.sharedId === activeSharedId || c.id === `shared_${activeSharedId}`)) ||
    (session?.user?.id && activeId && c.ownerId === session.user.id && c.sourceAccountId === activeId)
  );
  const hiddenActive = mergedDiscover.filter((c) => isActiveShared(c)).length;
  const hiddenFollowed = mergedDiscover.filter((c) => !isActiveShared(c) && isFollowing(c.id)).length;
  const list = mergedDiscover.filter((c) => {
    if (sharedFocusId) return c.sharedId === sharedFocusId || c.id === sharedFocusId;
    if (isActiveShared(c)) return false;
    if (!q) return true;
    return [c.sharedId, c.name, c.handle, c.persona, c.owner, c.ownerName, ...(c.tags || [])].join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="al-phone">
      <div className="al-dmhead">
        <button className="al-back-inline" onClick={() => setStep("feed")}>‹</button>
        <div className="al-dmhead-info">
          <span className="al-dmhead-name">🔍 캐릭터 탐색</span>
          <span className="al-dmhead-sub">다른 사용자와 캐릭터를 찾아 팔로우해봐</span>
        </div>
      </div>
      <div className="al-disc-search">
        <input
          value={discoverQuery}
          onChange={(e) => { setSharedFocusId(""); setDiscoverQuery(e.target.value); }}
          placeholder="사용자·이름·성격·태그 검색"
        />
      </div>
      {sharedFocusId && (
        <div className="al-disc-focus">
          공유 링크로 들어온 캐릭터
          <button onClick={() => setSharedFocusId("")}>전체 탐색 보기</button>
        </div>
      )}
      {hasSupabaseConfig && (
        <div className="al-disc-status">
          <span>
            {safeSharedLoadState.loading
              ? "사용자 캐릭터 불러오는 중"
              : `DB 불러옴 ${mergedDiscover.length}개 · 표시 ${list.length}개${q ? " · 검색 적용" : ""}${hiddenFollowed ? ` · 팔로잉 ${hiddenFollowed}개 포함` : ""}${hiddenActive ? ` · 현재 캐릭터 제외 ${hiddenActive}개` : ""}`}
          </span>
          {(q || sharedFocusId) && (
            <button type="button" onClick={() => { setDiscoverQuery(""); setSharedFocusId(""); }}>전체 보기</button>
          )}
          <button onClick={loadSharedCharacters} disabled={safeSharedLoadState.loading}>새로고침</button>
        </div>
      )}
      {safeSharedLoadState.error && <p className="al-disc-error">탐색 로딩 실패: {safeSharedLoadState.error}</p>}
      <div className="al-disc-list">
        {list.length === 0 && (
          <div className="al-disc-none">
            <p>{sharedFocusId ? "이 공유 링크의 캐릭터를 찾지 못했어." : discoverQuery ? `"${discoverQuery}"에 맞는 새 캐릭터가 없어.` : safeSharedCharacters.length > 0 ? "팔로우하지 않은 새 캐릭터가 없어." : "아직 공유된 사용자 캐릭터가 없어."}</p>
          </div>
        )}
        {list.map((c) => {
          const followed = isFollowing(c.id);
          return (
            <div key={c.id} className={`al-disc-card ${followed ? "on" : ""}`}>
              <button className="al-disc-av" onClick={() => setPublicProfile(c)} aria-label={`${c.name} 프로필 보기`}>{c.name.trim()[0]}</button>
              <div className="al-disc-body">
                <div className="al-disc-top">
                  <button className="al-disc-name" onClick={() => setPublicProfile(c)}>{c.name}</button>
                  <WorldChip c={c} fallback={`disc-${c.id}`} />
                  <span className="al-disc-owner">{c.shared ? `${c.owner} · 공유됨` : c.owner}</span>
                  <span className="al-disc-fcount">팔로워 {publicFollowerCount(c).toLocaleString()}</span>
                </div>
                <p className="al-disc-persona">{c.persona}</p>
                <div className="al-disc-tags">
                  {(c.tags || []).map((t) => <span key={t} className="al-disc-tag">#{t}</span>)}
                </div>
              </div>
              <div className="al-disc-actions">
                <button className="al-disc-dm" onClick={() => requestDmEntry(c, "char")}>✉ DM</button>
                <button className={`al-disc-follow ${followed ? "on" : ""}`} onClick={() => toggleFollow(c)}>
                  {followed ? "팔로잉 ✓" : "+ 팔로우"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {safeFollowing.length > 0 && (
        <div className="al-disc-foot">
          팔로잉 {safeFollowing.length} · DM에서 {char.name}(으)로 말 걸 수 있어
        </div>
      )}
    </div>
  );
}
