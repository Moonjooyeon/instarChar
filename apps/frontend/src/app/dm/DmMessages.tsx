import React from "react";

export function DmMessages({ ctx }) {
  const { char, dm, dmEndRef, dmKey, dmSending, josa, peer, peerInitial, peerName, setFixTarget, setFixText, setReportTarget, speakerName } = ctx;
  return (
    <div className="al-dmscroll">
      {dm.length === 0 && (
        <div className="al-dm-empty">
          <p>{peer.asOwner ? `${josa(peerName, "에게/에게")} 나(오너)로서 말을 걸어봐.` : `${josa(peerName, "에게/에게")} ${josa(speakerName, "으로/로")} 말을 걸어봐.`}</p>
        </div>
      )}
      {dm.map((message, index) => {
        const fromPeer = message.from === peerName;
        const mine = !fromPeer;
        const showLabel = mine && message.from !== (char.name || "나");
        const canFixDmLine = fromPeer && peer.asOwner && message.from === char.name;
        return (
          <div key={index} className={`al-bubble-row ${mine ? "me" : "char"}`}>
            {fromPeer && <div className="al-bubble-av">{peerInitial}</div>}
            <div className={`al-bubble ${mine ? "me" : "char"}`}>
              {showLabel && <span className="al-bubble-spk">{message.from}</span>}
              {message.img && <img className="al-bubble-img" src={message.img} alt="" />}
              {message.text && !(message.img && message.text === "(사진)") && <span className="al-bubble-text">{message.text}</span>}
              {canFixDmLine && <button className="al-fixbtn-dm" onClick={() => { setFixTarget({ type: "dm", index, text: message.text, who: message.from }); setFixText(""); }}>⚠ 캐해 아님</button>}
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
          <div className="al-bubble-av">{peerInitial}</div>
          <div className="al-bubble char typing"><span className="al-typing"><i/><i/><i/></span></div>
        </div>
      )}
      <div ref={dmEndRef} />
    </div>
  );
}
