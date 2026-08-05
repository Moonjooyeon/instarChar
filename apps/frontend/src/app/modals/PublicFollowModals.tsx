import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";

export function PublicFollowModals({ ctx }) {
  const {
    activeSharedId,
    blockUser,
    canUseApp,
    followPanel,
    following,
    isFollowing,
    myFollowers,
    publicFollowerCount,
    publicFollowingCount,
    publicProfile,
    requestDmEntry,
    setFollowPanel,
    setPublicProfile,
    setReportTarget,
    setFollowing,
    setWorldModal,
    sharedFollowers,
    toggleFollow,
    WorldChip,
    worldModal,
  } = ctx;
  return (
    <>
      {canUseApp && publicProfile && (
        <div className="al-modal-bg al-theme-ready al-public-modal-theme-ready" onClick={() => setPublicProfile(null)}>
          <div className="al-public-profile" onClick={(event) => event.stopPropagation()}>
            <button className="al-public-back" onClick={() => setPublicProfile(null)} aria-label="프로필 닫기"><AliveIcon name="chevron-left" size={21} /></button>
            <div className="al-public-banner">{publicProfile.headerImg && <img src={publicProfile.headerImg} alt="" />}</div>
            <div className="al-public-avatar"><CharacterAvatarImage src={publicProfile.avatarImg} /></div>
            <div className="al-public-body">
              <div className="al-public-main">
                <div className="al-name-line">
                  <h3>{publicProfile.name}</h3>
                  <WorldChip character={publicProfile} fallback="public-profile" onOpen={setWorldModal} />
                </div>
                <span>@{publicProfile.handle || publicProfile.name?.replace(/\s/g, "").toLowerCase()}</span>
              </div>
              <p className="al-public-age">{publicProfile.age || "설정 비공개"}</p>
              {publicProfile.surface && <span className="al-public-tag">{publicProfile.surface}</span>}
              <div className="al-public-stats"><b>{publicFollowingCount(publicProfile)}</b> 팔로잉 <b>{publicFollowerCount(publicProfile).toLocaleString()}</b> 팔로워</div>
              <div className="al-public-actions">
                <button className="al-public-dm border-line-strong bg-surface-raised text-accent-ink hover:border-accent hover:bg-accent-soft" onClick={() => { setPublicProfile(null); requestDmEntry(publicProfile, "char"); }}><AliveIcon name="mail" size={15} /> 바로 DM</button>
                <button className={`al-public-follow ${publicFollowClass(isFollowing(publicProfile.id))}`} onClick={() => toggleFollow(publicProfile)}>{isFollowing(publicProfile.id) ? <><AliveIcon name="minus" size={15} /> 타임라인에서 빼기</> : <><AliveIcon name="plus" size={15} /> 타임라인에 추가</>}</button>
                <button className="al-public-safety" onClick={() => setReportTarget({
                  targetType: "character",
                  targetOwnerId: publicProfile.ownerId,
                  targetReference: publicProfile.sharedId || publicProfile.characterId || publicProfile.id,
                  snapshot: { name: publicProfile.name, handle: publicProfile.handle, persona: publicProfile.persona },
                  label: `${publicProfile.name} 캐릭터`,
                })}>신고</button>
                <button className="al-public-safety danger" onClick={() => {
                  if (!publicProfile.ownerId || !window.confirm(`${publicProfile.name}의 운영 사용자를 차단할까요? 관련 캐릭터와 콘텐츠가 모두 숨겨집니다.`)) return;
                  void blockUser(publicProfile.ownerId).then((blocked) => {
                    if (!blocked) return;
                    setFollowing((items) => items.filter((item) => item.ownerId !== publicProfile.ownerId));
                    setPublicProfile(null);
                  });
                }}>차단</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {canUseApp && worldModal && (
        <div className="al-modal-bg al-theme-ready al-public-modal-theme-ready" onClick={() => setWorldModal(null)}>
          <div className="al-world-view-modal" onClick={(event) => event.stopPropagation()}>
            <div className="al-world-view-head">
              <div>
                <h3>{worldModal.name}의 세계관</h3>
                {worldModal.handle && <span>@{worldModal.handle}</span>}
              </div>
              <button onClick={() => setWorldModal(null)}>닫기</button>
            </div>
            <p>{worldModal.world}</p>
          </div>
        </div>
      )}
      {canUseApp && followPanel && !publicProfile && (
        <div className="al-modal-bg al-theme-ready al-public-modal-theme-ready" onClick={() => setFollowPanel(null)}>
          <div className="al-follow-modal" onClick={(event) => event.stopPropagation()}>
            <div className="al-follow-modal-head">
              <h3>{followPanel === "following" ? "추가한 캐릭터" : "팔로워"}</h3>
              <button onClick={() => setFollowPanel(null)}>닫기</button>
            </div>
            <FollowModalList ctx={{ activeSharedId, followPanel, following, isFollowing, myFollowers, setPublicProfile, setWorldModal, sharedFollowers, WorldChip }} />
          </div>
        </div>
      )}
    </>
  );
}

function publicFollowClass(followed: boolean): string {
  return followed ? "on border-danger bg-danger-soft text-danger hover:bg-danger hover:text-white" : "border-accent bg-accent text-white hover:bg-accent-strong";
}

function FollowModalList({ ctx }) {
  const { activeSharedId, followPanel, following, isFollowing, myFollowers, setPublicProfile, setWorldModal, sharedFollowers, WorldChip } = ctx;
  const list = followPanel === "following" ? following : (activeSharedId ? sharedFollowers.rows : myFollowers());
  if (followPanel === "followers" && activeSharedId && sharedFollowers.loading) return <p className="al-follow-empty">팔로워 불러오는 중...</p>;
  if (followPanel === "followers" && activeSharedId && sharedFollowers.error) return <p className="al-follow-empty">팔로워 로딩 실패: {sharedFollowers.error}</p>;
  if (list.length === 0) return <p className="al-follow-empty">{followPanel === "following" ? "아직 팔로우한 캐릭터가 없어." : "아직 팔로워가 없어."}</p>;
  return (
    <div className="al-follow-modal-list">
      {list.map((item) => (
        <div key={item.id} className="al-follow-modal-row">
          <div className="al-follow-modal-item">
            <button className="al-follow-modal-main" onClick={() => setPublicProfile(item)}>
              <span className="al-follow-modal-av"><CharacterAvatarImage src={item.avatarImg} /></span>
              <span className="al-follow-modal-info"><b>{item.name}</b><small>@{item.handle || item.name.replace(/\s/g, "").toLowerCase()} · {item.owner || "공유 캐릭터"}</small></span>
            </button>
            <WorldChip character={item} fallback={`follow-${item.id}`} onOpen={setWorldModal} />
            <i>{followPanel === "followers" ? "팔로워" : (isFollowing(item.id) ? "팔로잉" : "보기")}</i>
          </div>
        </div>
      ))}
    </div>
  );
}
