import React from "react";

export function PublicFollowModals({ ctx }) {
  const {
    activeSharedId,
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
    setWorldModal,
    sharedFollowers,
    toggleFollow,
    WorldChip,
    worldModal,
  } = ctx;
  return (
    <>
      {canUseApp && publicProfile && (
        <div className="al-modal-bg" onClick={() => setPublicProfile(null)}>
          <div className="al-public-profile" onClick={(event) => event.stopPropagation()}>
            <button className="al-public-back" onClick={() => setPublicProfile(null)}>‹</button>
            <div className="al-public-banner">{publicProfile.headerImg && <img src={publicProfile.headerImg} alt="" />}</div>
            <div className="al-public-avatar">{publicProfile.avatarImg ? <img src={publicProfile.avatarImg} alt="" /> : (publicProfile.name?.trim()[0] || "?")}</div>
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
                <button className="al-public-dm" onClick={() => { setPublicProfile(null); requestDmEntry(publicProfile, "char"); }}>✉ 바로 DM</button>
                <button className={`al-public-follow ${isFollowing(publicProfile.id) ? "on" : ""}`} onClick={() => toggleFollow(publicProfile)}>{isFollowing(publicProfile.id) ? "팔로잉 취소" : "+ 팔로우"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {canUseApp && worldModal && (
        <div className="al-modal-bg" onClick={() => setWorldModal(null)}>
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
        <div className="al-modal-bg" onClick={() => setFollowPanel(null)}>
          <div className="al-follow-modal" onClick={(event) => event.stopPropagation()}>
            <div className="al-follow-modal-head">
              <h3>{followPanel === "following" ? "팔로잉" : "팔로워"}</h3>
              <button onClick={() => setFollowPanel(null)}>닫기</button>
            </div>
            <FollowModalList ctx={{ activeSharedId, followPanel, following, isFollowing, myFollowers, setPublicProfile, setWorldModal, sharedFollowers, WorldChip }} />
          </div>
        </div>
      )}
    </>
  );
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
              <span className="al-follow-modal-av">{item.name.trim()[0] || "?"}</span>
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
