import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";

export function DiscoverScreen({
  activeId,
  activeSharedId,
  blockedUserIds,
  char,
  discoverPool,
  discoverQuery,
  following,
  hasBackendApiConfig,
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
  const mergedDiscover = (hasBackendApiConfig ? safeSharedCharacters : safeDiscoverPool)
    .filter((item) => !blockedUserIds?.includes(item.ownerId));
  const isActiveShared = (c) => Boolean(
    (activeSharedId && (c.sharedId === activeSharedId || c.id === `shared_${activeSharedId}`)) ||
    (session?.user?.id && activeId && c.ownerId === session.user.id && c.sourceAccountId === activeId)
  );
  const list = mergedDiscover.filter((c) => {
    if (sharedFocusId) return c.sharedId === sharedFocusId || c.id === sharedFocusId;
    if (isActiveShared(c)) return false;
    if (!q) return true;
    return [c.sharedId, c.name, c.handle, c.persona, c.owner, c.ownerName, ...(c.tags || [])].join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="al-phone al-theme-ready al-discover-theme-ready">
      <div className="al-dmhead">
        <button className="al-back-inline" onClick={() => setStep("feed")} aria-label="피드로 돌아가기"><AliveIcon name="chevron-left" size={22} /></button>
        <div className="al-dmhead-info">
          <span className="al-dmhead-name">새로운 캐릭터 만나기</span>
          <span className="al-dmhead-sub">추가하고 글을 보거나 바로 대화해요.</span>
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
      {hasBackendApiConfig && (
        <div className="al-disc-status">
          <span>
            {safeSharedLoadState.loading
              ? "사용자 캐릭터 불러오는 중"
              : `만날 수 있는 캐릭터 ${list.length}명${q ? " · 검색 결과" : ""}`}
          </span>
          {(q || sharedFocusId) && (
            <button type="button" onClick={() => { setDiscoverQuery(""); setSharedFocusId(""); }}>전체 보기</button>
          )}
          <button onClick={loadSharedCharacters} disabled={safeSharedLoadState.loading}>다시 불러오기</button>
        </div>
      )}
      {safeSharedLoadState.error && <p className="al-disc-error">탐색 로딩 실패: {safeSharedLoadState.error}</p>}
      <div className="al-disc-list">
        {list.length === 0 && (
          <div className="al-disc-none">
            <p>{sharedFocusId ? "이 공유 링크의 캐릭터를 찾지 못했어." : discoverQuery ? `"${discoverQuery}"에 맞는 새 캐릭터가 없어.` : safeSharedCharacters.length > 0 ? "아직 추가하지 않은 새 캐릭터가 없어." : "아직 공유된 사용자 캐릭터가 없어."}</p>
          </div>
        )}
        {list.map((c) => {
          const followed = isFollowing(c.id);
          return (
            <div key={c.id} className={`al-disc-card ${followed ? "on" : ""}`}>
              <button className="al-disc-av" onClick={() => setPublicProfile(c)} aria-label={`${c.name} 프로필 보기`}><CharacterAvatarImage src={c.avatarImg} /></button>
              <div className="al-disc-body">
                <div className="al-disc-top">
                  <button className="al-disc-name" onClick={() => setPublicProfile(c)}>{c.name}</button>
                  <WorldChip c={c} fallback={`disc-${c.id}`} />
                  <span className="al-disc-owner">{c.shared ? `${c.owner} · 공유됨` : c.owner}</span>
                  <span className="al-disc-fcount">팔로워 {publicFollowerCount(c).toLocaleString()}</span>
                </div>
                <p className="al-disc-persona">{c.persona}</p>
                <div className="al-disc-tags">
                  {(c.tags || []).slice(0, 2).map((t) => <span key={t} className="al-disc-tag">#{t}</span>)}
                </div>
              </div>
              <div className="al-disc-actions">
                <button className="al-disc-dm bg-accent text-white hover:bg-accent-strong" onClick={() => requestDmEntry(c, "char")}><AliveIcon name="mail" size={15} /> DM</button>
                <button className={`al-disc-follow ${followed ? "on border-accent bg-accent-soft text-accent-ink" : "border-line-strong bg-surface-raised text-soft hover:border-accent hover:bg-accent-soft hover:text-accent-ink"}`} onClick={() => toggleFollow(c)}>
                  {followed ? <><AliveIcon name="check" size={14} /> 추가됨</> : <><AliveIcon name="plus" size={14} /> 타임라인에 추가</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {safeFollowing.length > 0 && (
        <div className="al-disc-foot">
          타임라인에 추가한 캐릭터 {safeFollowing.length}명
        </div>
      )}
    </div>
  );
}
