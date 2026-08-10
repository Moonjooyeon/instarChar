import React from "react";
import { mediaUrl } from "@/api/media";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";

export function DmMessages({ ctx }) {
  const { char, currentWorldPref, dm, dmEndRef, dmKey, dmSending, josa, openCredits, peer, peerAvatar, peerName, restoreFailedDmDraft, setDmInput, setFixTarget, setFixText, setReportTarget, speakerName } = ctx;
  return (
    <div className="al-dmscroll">
      {dm.length === 0 && (
        <div className="al-dm-empty">
          <p>{peer.asOwner ? `${josa(peerName, "에게/에게")} 편하게 첫 말을 건네보세요.` : `${speakerName}와 ${peerName}의 첫 장면을 시작해보세요.`}</p>
          {currentWorldPref?.note && <span className="al-dm-scene-cue">지금의 장면 · {currentWorldPref.note}</span>}
          <DmStarters peer={peer} peerName={peerName} setDmInput={setDmInput} />
        </div>
      )}
      {dm.map((message, index) => {
        if (message.deliveryState === "failed") return <DmDeliveryFailure key={index} message={message} onOpenCredits={openCredits} onRestore={() => restoreFailedDmDraft(index)} />;
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
        <div className="al-bubble-row char" role="status" aria-live="polite">
          <div className="al-bubble-av"><CharacterAvatarImage src={peerAvatar} /></div>
          <div className="al-bubble char typing"><span className="al-typing"><i/><i/><i/></span><span className="al-typing-label">{peerName}가 답장을 쓰고 있어요</span></div>
        </div>
      )}
      <div ref={dmEndRef} />
    </div>
  );
}

function DmStarters({ peer, peerName, setDmInput }) {
  const prompts = peer.asOwner
    ? ["지금 잠깐 이야기할 수 있어?", "오늘은 어떤 하루였어?", "요즘 네가 가장 신경 쓰는 건 뭐야?"]
    : [`${peerName}에게 가볍게 인사한다.`, `${peerName}의 오늘 이야기를 조심스럽게 묻는다.`, `이 장면에서 ${peerName}와 함께할 일을 제안한다.`];
  return <div className="al-dm-starters"><span>첫 장면의 단서</span><div>{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setDmInput(prompt)}>{prompt}</button>)}</div></div>;
}

function DmDeliveryFailure({ message, onOpenCredits, onRestore }) {
  const needsCredits = /크레딧|무료 사용량/.test(message.text || "");
  return <div className="al-dm-delivery-failure" role="alert"><b>답장을 받지 못했어요</b><p>{message.text}</p><div><button type="button" onClick={onRestore}>입력창에 다시 담기</button>{needsCredits && <button type="button" onClick={onOpenCredits}>크레딧 확인</button>}</div></div>;
}
