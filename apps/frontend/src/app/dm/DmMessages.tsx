import React from "react";
import { mediaUrl } from "@/api/media";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";

export function DmMessages({ ctx }) {
  const { char, dm, dmEndRef, dmKey, dmSending, josa, peer, peerAvatar, peerName, setFixTarget, setFixText, setReportTarget, speakerName } = ctx;
  return (
    <div className="al-dmscroll">
      {dm.length === 0 && (
        <div className="al-dm-empty">
          <p>{peer.asOwner ? `${josa(peerName, "에게/에게")} 편하게 첫 말을 건네보세요.` : `${speakerName}와 ${peerName}의 첫 장면을 시작해보세요.`}</p>
        </div>
      )}
      {dm.map((message, index) => {
        const fromPeer = message.from === peerName;
        const mine = !fromPeer;
        const showLabel = mine && message.from !== (char.name || "나");
        const canFixDmLine = fromPeer && peer.asOwner && message.from === char.name;
        return (
          <div key={index} className={`al-bubble-row ${mine ? "me" : "char"}`}>
            {fromPeer && <div className="al-bubble-av"><CharacterAvatarImage src={peerAvatar} /></div>}
            <div className={`al-bubble ${mine ? "me" : "char"}`}>
              {showLabel && <span className="al-bubble-spk">{message.from}</span>}
              {message.img && <img className="al-bubble-img" src={mediaUrl(message.img, dmKey)} alt="" />}
              {message.text && !(message.img && message.text === "(사진)") && <span className="al-bubble-text">{message.text}</span>}
              {canFixDmLine && <button className="al-fixbtn-dm" onClick={() => { setFixTarget({ type: "dm", index, text: message.text, who: message.from }); setFixText(""); }}>캐릭터답지 않아요</button>}
              {fromPeer && <button className="al-fixbtn-dm safety" onClick={() => setReportTarget({
                targetType: peer.ownerId ? "dm_message" : "ai_content",
                targetOwnerId: peer.ownerId || undefined,
                targetReference: `${dmKey}:${index}`,
                snapshot: { from: message.from, text: message.text || "", image: Boolean(message.img) },
                label: `${message.from}의 DM`,
              })}>신고</button>}
            </div>
          </div>
        );
      })}
      {dmSending && (
        <div className="al-bubble-row char">
          <div className="al-bubble-av"><CharacterAvatarImage src={peerAvatar} /></div>
          <div className="al-bubble char typing"><span className="al-typing"><i/><i/><i/></span></div>
        </div>
      )}
      <div ref={dmEndRef} />
    </div>
  );
}
