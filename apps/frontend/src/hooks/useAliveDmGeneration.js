import { postGenerateContent } from "@/api/generate";
import { chatSafetyRules, worldBridgeBlock } from "@/domain/app/textUtils";
import {
  MODEL_AUTO,
  MODEL_DIRECT,
  relationshipMatchRuleLine,
  selfSettingPriorityBlock,
  speechGuideLine,
} from "@/domain/app/aliveCore";
import { intimacyBoundaryRules } from "@/domain/relationships/affinityUtils";

export function useAliveDmGeneration({
  activePersona,
  affOf,
  autoChatRef,
  bumpAffinity,
  bumpMutual,
  bumpRoomAffinity,
  bumpRoomMutual,
  char,
  chatMode,
  cleanApiFailureMessage,
  correctionBlockFor,
  currentWorldPref,
  dm,
  dmAffOf,
  dmImageDraft,
  dmInput,
  dmKey,
  dmKeyRef,
  dmRequestSeqRef,
  dmSendingRef,
  findPeerChar,
  gallery,
  loreBlockFor,
  meName,
  ownerLabel,
  ownerPersona,
  peer,
  processSession,
  proposalRef,
  proposingRef,
  relationHintFor,
  relationMatched,
  roomAffOf,
  roomLoreBlockFor,
  setAutoChatting,
  setDmImageDraft,
  setDmInput,
  setDmSending,
  setDmThread,
  setSaveStatus,
  speakAs,
}) {
  async function sendDM() {
    const msg = dmInput.trim();
    const image = dmImageDraft;
    if ((!msg && !image) || dmSendingRef.current || !peer) return;
    const requestId = dmRequestSeqRef.current + 1;
    dmRequestSeqRef.current = requestId;
    const requestKey = dmKey;
    dmSendingRef.current = true;
    if (autoChatRef.current) { autoChatRef.current = false; setAutoChatting(false); }
    setDmInput("");
    setDmImageDraft(null);
    const newHist = [...dm, { from: meName, text: msg || "(사진)", img: image || null }];
    setDmThread(newHist);
    setDmSending(true);
    const context = dmReplyContext({ activePersona, affOf, char, currentWorldPref, dmAffOf, gallery, meName, ownerLabel, ownerPersona, peer, relationMatched, roomAffOf, speakAs, requestKey, newHist, findPeerChar });
    context.sys = dmSystemPrompt({ context, correctionBlockFor, currentWorldPref, loreBlockFor, meName, ownerPersona, peer, roomLoreBlockFor });
    const apiMsgs = dmApiMessages({ meName, newHist, peerName: context.peerName, peerReferenceImage: context.peerReferenceImage });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 55000);
    try {
      const text = await postGenerateContent({ model: MODEL_DIRECT, max_tokens: 2048, system: context.sys, messages: apiMsgs }, "DM 답장 API", { signal: controller.signal });
      if (dmRequestSeqRef.current !== requestId || dmKeyRef.current !== requestKey) return;
      setDmThread((items) => [...items, { from: context.peerName, text }]);
      applyDmAffinity({ bumpAffinity, bumpMutual, bumpRoomAffinity, bumpRoomMutual, context, meName, newHist, ownerLabel, peer, relationHintFor, requestKey, text });
      maybeProcessDmSession({ context, dmKeyRef, meName, newHist, peer, processSession, requestKey, text });
    } catch (e) {
      console.error("DM 답장 생성 실패:", e);
      if (dmRequestSeqRef.current !== requestId || dmKeyRef.current !== requestKey) return;
      const message = cleanApiFailureMessage(e, "답장이 잠깐 끊겼어. 같은 말을 다시 보내줘.");
      setDmThread((items) => [...items, { from: context.peerName, text: `(…${message})` }]);
    } finally {
      window.clearTimeout(timeout);
      if (dmRequestSeqRef.current === requestId && dmKeyRef.current === requestKey) {
        dmSendingRef.current = false;
        setDmSending(false);
      }
    }
  }
  async function genLine(speaker, listener, history, relationHint, mode, worldPref = null, roomKey = "") {
    const sys = autoLineSystemPrompt({ correctionBlockFor, dmAffOf, history, listener, loreBlockFor, mode, relationHint, roomAffOf, roomKey, roomLoreBlockFor, speaker, worldPref });
    const apiMsgs = autoLineMessages(history, speaker, listener);
    try {
      return await postGenerateContent({ model: MODEL_AUTO, max_tokens: 2048, system: sys, messages: apiMsgs }, "자동대화 API");
    } catch (e) {
      console.error("자동대화 생성 실패:", e);
      return null;
    }
  }
  async function startAutoChat() {
    if (!peer) return;
    const partner = findPeerChar(peer.name) || { name: peer.name, persona: peer.persona || "" };
    const meChar = activePersona || char;
    const relForPartner = relationMatched(partner, { name: meChar.name });
    const relForMe = relationMatched(meChar, { name: peer.name });
    autoChatRef.current = true;
    setAutoChatting(true);
    let hist = dm.map((message) => ({ who: message.from, text: message.text }));
    const sessionStart = hist.length;
    const firstSpeaker = firstAutoSpeaker(hist, meChar, partner);
    for (let turn = 0; turn < 6; turn += 1) {
      const result = await runAutoTurn({ bumpMutual, chatMode, currentWorldPref, dmKey, firstSpeaker, genLine, hist, meChar, partner, proposalRef, proposingRef, relForMe, relForPartner, setDmThread, setSaveStatus, turn, autoChatRef });
      if (!result.keepGoing) break;
      hist = result.hist;
    }
    autoChatRef.current = false;
    setAutoChatting(false);
    if (!proposalRef.current) processSession(meChar.name, partner.name, hist.slice(sessionStart));
  }
  function stopAutoChat() {
    autoChatRef.current = false;
    setAutoChatting(false);
  }
  return { genLine, sendDM, startAutoChat, stopAutoChat };
}

function dmReplyContext({ activePersona, affOf, char, currentWorldPref, dmAffOf, gallery, meName, ownerLabel, ownerPersona, peer, relationMatched, roomAffOf, speakAs, requestKey, newHist, findPeerChar }) {
  const peerChar = peer.asOwner ? char : (findPeerChar(peer.name) || null);
  const peerName = peer.asOwner ? char.name : peer.name;
  const npcRoom = requestKey?.startsWith("local::");
  const peerGallery = peer.asOwner ? gallery : (Array.isArray(peer?.gallery) ? peer.gallery : []);
  const senderIsOwner = peer.asOwner || speakAs === "owner";
  const senderChar = senderIsOwner ? null : (activePersona || char);
  const relForPeer = peerChar ? relationMatched(peerChar, { name: meName, relation: peer.relation }) : (peer.relation ? `${meName} — ${peer.relation}` : "");
  const responderAff = responderAffinity({ affOf, dmAffOf, meName, npcRoom, ownerLabel, peer, peerName, relForPeer, requestKey, roomAffOf });
  const intimacyRules = intimacyBoundaryRules({ speakerName: peerName, listenerName: meName, affinityValue: responderAff, relationHint: relForPeer, messageCount: newHist.length });
  const peerReferenceImage = peerGallery.length ? peerGallery[peerGallery.length - 1] : null;
  return { intimacyRules, npcRoom, peerChar, peerName, peerReferenceImage, relForPeer, senderChar, senderDesc: senderDescription({ activePersona, char, meName, ownerPersona, peer, peerName, senderIsOwner }), senderIsOwner, sys: "" };
}

function responderAffinity({ affOf, dmAffOf, meName, npcRoom, ownerLabel, peer, peerName, relForPeer, requestKey, roomAffOf }) {
  if (npcRoom) return roomAffOf(requestKey, peerName, meName, relForPeer);
  if (peer.asOwner) return affOf(peerName, ownerLabel);
  return dmAffOf(peerName, meName, relForPeer);
}

function senderDescription({ activePersona, char, meName, ownerPersona, peer, peerName, senderIsOwner }) {
  if (senderIsOwner) return ownerPersona.trim() ? `"${meName}"은(는) 이 SNS의 오너(나)이며 ${peerName}를 만든 사람이다. 자기소개: ${ownerPersona.trim()}` : `"${meName}"은(는) 이 SNS의 오너(나)이며 ${peerName}를 만든 사람이다.`;
  if (activePersona) return `"${meName}"은(는) 다음 인물이다 — ${activePersona.age ? `${activePersona.age}, ` : ""}${activePersona.persona || activePersona.name}.${activePersona.speech ? ` ${speechGuideLine(activePersona.speech, "말투")}.` : ""} (오너가 연기하는 페르소나)`;
  return `"${meName}"은(는) 다음 캐릭터다 — ${char.persona || char.name}.${char.world ? ` 세계관: ${char.world}.` : ""}${char.speech ? ` ${speechGuideLine(char.speech, "말투")}.` : ""}`;
}

function dmSystemPrompt({ context, correctionBlockFor, currentWorldPref, loreBlockFor, meName, ownerPersona, peer, roomLoreBlockFor }) {
  const identityBlock = context.peerChar
    ? `[너는 "${context.peerChar.name}"이다]\n${selfSettingPriorityBlock(context.peerChar, `${context.peerChar.name} 자기 설정`)}`
    : `[너는 "${context.peerName}"이다]\n${peer.persona ? `설정: ${peer.persona}` : "이 캐릭터에 대한 정보는 제한적이다. 자연스럽게 반응하라."}`;
  const relNote = dmRelationshipNote({ meName, peer, peerName: context.peerName, relForPeer: context.relForPeer });
  return `너는 "${context.peerName}" 본인이다. 지금 "${meName}"와 DM으로 1:1 대화 중이다.
절대 ${meName}를 다른 이름으로 부르거나 다른 사람으로 착각하지 마라. 상대는 오직 "${meName}"다.

${identityBlock}

[지금 너에게 말 거는 상대]
${context.senderDesc}${relNote}${worldBridgeBlock(context.peerChar || { name: context.peerName, persona: peer?.persona }, context.senderChar || { name: meName, persona: ownerPersona }, currentWorldPref)}

[규칙]
- 너는 "${context.peerName}"로서만 1인칭으로 답한다. 위 자기 설정을 먼저 따른 뒤, 말투 참고 메모를 복붙하지 말고 ${context.peerName}답게 새로 말하라. 메타발언 금지.
- 상대를 "${meName}"로 인식하고 거기에 맞게 답하라.
- 자기 설정에 금지된 호칭·어미·태도는 절대 쓰지 마라. 관계/호감도/최근 대화보다 자기 설정의 금지 규칙이 우선한다.
- **반드시 상대의 마지막 말에 직접 이어서 답하라.** 흐름을 무시하고 갑자기 다른 화제로 튀지 마라. 지금까지의 대화 맥락을 기억하고 자연스럽게 이어간다.
- 받아치고 끝내지 마라. 상대 말에 반응하되 네 생각·감정·되묻는 질문을 얹어 대화가 굴러가게 하라. "...어." "...뭘." 같은 영혼 없는 단답·맞장구만 반복하지 마라. 무뚝뚝한 캐릭터여도 속내나 디테일이 한 줄은 묻어나게.
- DM 대화체로. 보통 1~3문장. 한두 단어 단답으로 끝내지 말 것. 똑같은 표현 반복은 피하되 맥락은 절대 놓치지 마라.
- 상대가 사진을 보냈다면 이미지를 실제로 보고, 이미지 속 표정·시선·상황·분위기에 직접 반응하라. 사진 설명문이 아니라 DM 답장처럼 말하라.
- 참고 이미지가 함께 제공되면 그것은 너 자신의 캐릭터 사진/그림이다. 외형·분위기 기준으로 참고하되, 상대가 보낸 사진으로 착각하지 마라.
- 지문(괄호 안 행동)은 역극에 쓸 법하면 약간만.${context.intimacyRules}${chatSafetyRules(currentWorldPref)}${roomLoreBlockFor(currentWorldPref, context.peerName, meName)}${context.peerChar && !context.npcRoom ? loreBlockFor(context.peerChar, meName) : ""}${context.peerChar ? correctionBlockFor(context.peerChar) : ""}`;
}

function dmRelationshipNote({ meName, peer, peerName, relForPeer }) {
  if (peer.asOwner) return `\n\n[관계 — 중요]\n"${meName}"은(는) 너를 만든 오너(창조주)다. 너는 그 사실을 알 수도, 모를 수도 있다(설정대로). 친근하게, 네 성격 그대로 반응하라.`;
  if (relForPeer) return `\n\n[관계 — 중요]\n상대 "${meName}"은(는) 너(${peerName})와 "${relForPeer}" 관계다. 이 관계에 맞게 반응하라.\n${relationshipMatchRuleLine(meName, relForPeer)}`;
  return `\n\n[관계]\n상대 "${meName}"과(와) 특별히 등록된 관계는 없다. 처음 보거나 잘 모르는 상대로 대하되, 네 성격대로 반응하라. 절대 다른 사람으로 착각하지 마라.`;
}

function dmApiMessages({ meName, newHist, peerName, peerReferenceImage }) {
  const apiMsgs = [];
  for (const message of newHist) {
    const role = message.from === peerName ? "assistant" : "user";
    const line = role === "user" && message.from && message.from !== meName ? `${message.from}: ${message.text}` : message.text;
    const content = message.img ? [{ type: "text", text: `${line}\n(첨부된 이미지를 보고 답해.)` }, { type: "image_url", image_url: { url: message.img } }] : line;
    mergeApiMessage(apiMsgs, role, content, line);
  }
  if (apiMsgs.length && apiMsgs[0].role === "assistant") apiMsgs.shift();
  if (peerReferenceImage) apiMsgs.unshift({ role: "user", content: [{ type: "text", text: `(참고 이미지: ${peerName} 자신의 캐릭터 사진/그림이다. 외형과 분위기만 참고하고, 방금 상대가 보낸 사진처럼 취급하지 마라.)` }, { type: "image_url", image_url: { url: peerReferenceImage } }] });
  return apiMsgs;
}

function mergeApiMessage(apiMsgs, role, content, line) {
  if (!apiMsgs.length || apiMsgs[apiMsgs.length - 1].role !== role) {
    apiMsgs.push({ role, content });
    return;
  }
  const last = apiMsgs[apiMsgs.length - 1];
  if (Array.isArray(last.content) || Array.isArray(content)) {
    const prev = Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }];
    const next = Array.isArray(content) ? content : [{ type: "text", text: content }];
    last.content = [...prev, ...next];
    return;
  }
  last.content += `\n${line}`;
}

function applyDmAffinity({ bumpAffinity, bumpMutual, bumpRoomAffinity, bumpRoomMutual, context, meName, newHist, ownerLabel, peer, relationHintFor, requestKey, text }) {
  const ctx = [...newHist, { from: context.peerName, text }].slice(-6).map((message) => `${message.from}: ${message.text}`);
  if (context.npcRoom) {
    if (peer.asOwner) bumpRoomAffinity(requestKey, context.peerName, ownerLabel, 1 + Math.floor(Math.random() * 2));
    else if (!context.senderIsOwner) {
      const meToPeerRel = relationHintFor(meName, context.peerName, peer.relation || "");
      const peerToMeRel = relationHintFor(context.peerName, meName, "", context.peerChar || peer);
      bumpRoomMutual(requestKey, meName, context.peerName, 1 + Math.floor(Math.random() * 2), meToPeerRel, peerToMeRel);
    }
    return;
  }
  if (peer.asOwner) bumpAffinity(context.peerName, ownerLabel, 1 + Math.floor(Math.random() * 2), ctx);
  else if (!context.senderIsOwner) bumpMutual(meName, context.peerName, 1 + Math.floor(Math.random() * 2), ctx);
}

function maybeProcessDmSession({ context, meName, newHist, peer, processSession, requestKey, text }) {
  if (peer.asOwner || context.senderIsOwner) return;
  const full = [...newHist, { from: context.peerName, text }];
  if (full.length >= 10 && full.length % 10 === 0) {
    processSession(meName, context.peerName, full.slice(-18).map((message) => ({ who: message.from, text: message.text })), true, requestKey);
  }
}

function autoLineSystemPrompt({ correctionBlockFor, dmAffOf, history, listener, loreBlockFor, mode, relationHint, roomAffOf, roomKey, roomLoreBlockFor, speaker, worldPref }) {
  const speakerAff = roomKey?.startsWith("local::") ? roomAffOf(roomKey, speaker.name, listener.name, relationHint) : dmAffOf(speaker.name, listener.name, relationHint);
  const intimacyRules = intimacyBoundaryRules({ speakerName: speaker.name, listenerName: listener.name, affinityValue: speakerAff, relationHint, messageCount: history.length });
  const styleRule = mode === "novel"
    ? "- 소설 모드: 행동·표정·분위기 묘사를 지문으로 섞어라. (예: \"(시선을 피하며) …그런 건 묻지 마.\") 2~4문장으로 깊이 있게."
    : "- 대화 모드: 순수하게 말로만. 지문·묘사 없이, 실제 카톡하듯 자연스럽게. 보통 1~3문장. 한두 단어 단답으로 끝내지 말 것.";
  return `너는 "${speaker.name}" 본인이다. "${listener.name}"와 DM 중. 상대는 오직 "${listener.name}".

[너는 "${speaker.name}"]
${selfSettingPriorityBlock(speaker, `${speaker.name} 자기 설정`)}
${relationHint ? `${listener.name}와의 관계: ${relationHint}\n${relationshipMatchRuleLine(listener.name, relationHint)}` : `${listener.name}와 특별한 관계 없음.`}${worldBridgeBlock(speaker, listener, worldPref)}

[규칙]
- 철저히 ${speaker.name}로서 1인칭으로 답한다. 위 자기 설정을 먼저 따르고, 말투 참고 메모를 그대로 쓰지 말고 새 문장으로 말한다. 메타발언 금지.
- 자기 설정에 금지된 호칭·어미·태도는 절대 쓰지 마라. 관계/호감도/최근 대화보다 자기 설정의 금지 규칙이 우선한다.
${styleRule}
- 상대 마지막 말을 받아 이어가되 단답으로 끝내지 마라. 네 생각·감정을 얹어 대화를 굴려라. 무뚝뚝해도 속내가 한 줄 묻어나게.
- 같은 논점을 계속 주고받으며 맴돌지 마라. 받았으면 새 얘기·다른 화제·행동으로 한 발 진전시켜라.
- 본문만 출력.${intimacyRules}${chatSafetyRules(worldPref)}${roomLoreBlockFor(worldPref, speaker.name, listener.name)}${roomKey?.startsWith("local::") ? "" : loreBlockFor(speaker, listener.name)}${correctionBlockFor(speaker)}`;
}

function autoLineMessages(history, speaker, listener) {
  if (!history.length) return [{ role: "user", content: `(${speaker.name}가 ${listener.name}에게 ${randomOpener()} 먼저 말을 건다. 관계와 성격에 맞게, 자기소개 없이 자연스럽게 운을 떼라. 첫 말부터 고백·키스·강한 스킨십·성적 접촉으로 관계를 급진전시키지 마라.)` }];
  const apiMsgs = [];
  for (const message of history) {
    const role = message.who === speaker.name ? "assistant" : "user";
    if (apiMsgs.length && apiMsgs[apiMsgs.length - 1].role === role) apiMsgs[apiMsgs.length - 1].content += `\n${message.text}`;
    else apiMsgs.push({ role, content: message.text });
  }
  if (apiMsgs.length && apiMsgs[0].role === "assistant") apiMsgs.shift();
  return apiMsgs.length ? apiMsgs : [{ role: "user", content: `(${listener.name}에게 자연스럽게 말을 건다.)` }];
}

function randomOpener() {
  const openers = ["지금 막 떠오른 일상적인 한마디로", "방금 뭔가 보거나 겪은 것처럼", "갑자기 생각난 질문이나 투정으로", "별일 아닌 듯 툭 던지는 말로", "오랜만에 연락하듯"];
  return openers[Math.floor(Math.random() * openers.length)];
}

function firstAutoSpeaker(hist, meChar, partner) {
  const lastSpeaker = hist[hist.length - 1]?.who || "";
  if (lastSpeaker === meChar.name) return partner;
  return meChar;
}

async function runAutoTurn({ bumpMutual, chatMode, currentWorldPref, dmKey, firstSpeaker, genLine, hist, meChar, partner, proposalRef, proposingRef, relForMe, relForPartner, setDmThread, setSaveStatus, turn, autoChatRef }) {
  if (!autoChatRef.current) return { hist, keepGoing: false };
  const speaker = turn % 2 === 0 ? firstSpeaker : (firstSpeaker.name === meChar.name ? partner : meChar);
  const listener = speaker.name === meChar.name ? partner : meChar;
  const rel = speaker.name === meChar.name ? relForMe : relForPartner;
  const line = await genLine(speaker, listener, hist, rel, chatMode, currentWorldPref, dmKey);
  if (!autoChatRef.current) return { hist, keepGoing: false };
  if (!line) {
    setSaveStatus("자동대화 응답이 잠깐 비었어");
    return { hist, keepGoing: false };
  }
  const nextHist = [...hist, { who: speaker.name, text: line }];
  setDmThread((items) => [...items, { from: speaker.name, text: line, autoChat: true }]);
  bumpMutual(meChar.name, partner.name, 1 + Math.floor(Math.random() * 2), nextHist.slice(-6).map((message) => `${message.who}: ${message.text}`));
  if (proposingRef.current || proposalRef.current) return { hist: nextHist, keepGoing: false };
  await new Promise((resolve) => setTimeout(resolve, Math.min(1800 + line.length * 45, 5000)));
  return { hist: nextHist, keepGoing: true };
}
