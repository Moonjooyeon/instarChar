import { postGenerateContent } from "@/api/generate";
import { ANTI_REPEAT_RULES, recentLinesBlock, worldBridgeBlock } from "@/domain/app/textUtils";
import {
  API_LIMIT_MESSAGE,
  MODEL_AUTO,
  catchphraseGuideLine,
  relationshipBoundaryLine,
  relationshipMatchRuleLine,
  selfSettingPriorityBlock,
  speechGuideLine,
} from "@/domain/app/aliveCore";
import { affinityStage } from "@/domain/relationships/affinityUtils";

const AUTO_MOODS = ["일상 / 방금 있었던 일", "혼잣말 / 생각", "지금 기분", "푸념 / 투정", "셀카 찍은 척 (사진 묘사)", "랜덤 / 알아서"];

export function useAliveFeedGeneration({
  affOf,
  bumpAffinity,
  canAutoComment,
  char,
  commentAs,
  commentText,
  correctionBlock,
  findPeerChar,
  following,
  gallery,
  loadingRef,
  myFollowers,
  personas,
  posts,
  relLabelFor,
  setCommentOn,
  setCommentText,
  setLoading,
  setMoodOpen,
  setPosts,
  setSaveStatus,
}) {
  async function generatePost(mood, isAuto = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setMoodOpen(false);
    const attachedImg = gallery.length > 0 ? gallery[Math.floor(Math.random() * gallery.length)] : null;
    const formatRule = postFormatRule(mood, attachedImg);
    const sys = postSystemPrompt({ char, correctionBlock, formatRule, posts });
    const userMsg = mood === "랜덤 / 알아서" ? "지금 이 순간 떠오른 걸 자유롭게 한 줄 올려줘." : `다음 느낌으로 글을 올려줘: ${mood}`;
    const userContent = attachedImg ? [{ type: "text", text: `${userMsg}\n첨부된 이미지를 보고 이미지 속 상황과 시선, 표정, 분위기에 맞춰 써.` }, { type: "image_url", image_url: { url: attachedImg } }] : userMsg;
    try {
      const parsed = parseGeneratedPost(await postGenerateContent({ model: MODEL_AUTO, max_tokens: 400, system: sys, messages: [{ role: "user", content: userContent }] }, "게시글 생성 API"), mood, attachedImg);
      const newPostId = Date.now();
      setPosts((items) => [generatedPostFromParsed(parsed, mood, attachedImg, isAuto, newPostId), ...items]);
      if (following.length > 0) setTimeout(() => followersReactTo(newPostId, parsed.text), 1800 + Math.random() * 2000);
    } catch (e) {
      console.error("게시글 생성 실패:", e);
      setSaveStatus(e.message === API_LIMIT_MESSAGE ? API_LIMIT_MESSAGE : "게시글 생성 실패");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }
  function autoPost() {
    if (loadingRef.current) return;
    if (following.length > 0 && Math.random() < 0.3) { followerPost(); return; }
    const mood = AUTO_MOODS[Math.floor(Math.random() * AUTO_MOODS.length)];
    generatePost(mood, true);
  }
  async function addCommentFrom(postId, postText, postAuthorName, commenter, priorComments = [], replyTo = postAuthorName) {
    if (!canAutoComment(commenter.name, postAuthorName)) return null;
    const targetPost = posts.find((post) => post.id === postId);
    const targetImage = targetPost?.img || null;
    const relBlock = commentRelationshipBlock({ affOf, commenter, postAuthorName, relLabelFor });
    const postAuthorChar = findPeerChar(postAuthorName) || (postAuthorName === char.name ? char : { name: postAuthorName });
    const sys = commentSystemPrompt({ commenter, postAuthorChar, postAuthorName, postText, priorComments, relBlock, replyTo, targetImage });
    try {
      const text = stripQuotes(await postGenerateContent({ model: MODEL_AUTO, max_tokens: 150, system: sys, messages: [{ role: "user", content: commentUserContent(commenter, targetImage) }] }, "댓글 생성 API"));
      if (!text) return null;
      appendGeneratedComment(setPosts, postId, commenter, text, replyTo);
      return text;
    } catch (e) {
      return null;
    }
  }
  function submitUserComment(postId, postAuthorName) {
    const txt = commentText.trim();
    if (!txt) return;
    const persona = commentAs.startsWith("p:") ? personas.find((item) => `p:${item.id}` === commentAs) : null;
    const name = persona ? persona.name : char.name;
    const handle = persona ? name : (char.handle || char.name);
    const rootAuthor = postAuthorName || char.name;
    const target = posts.find((post) => post.id === postId);
    const priorComments = [...((target && target.comments) || []), { name, text: txt, replyTo: rootAuthor }];
    appendUserComment(setPosts, postId, { handle, name, rootAuthor, txt });
    if (postAuthorName && postAuthorName !== name) bumpAffinity(postAuthorName, name, 1, []);
    setCommentText("");
    setCommentOn(null);
    scheduleAuthorReply({ addCommentFrom, char, findPeerChar, name, postAuthorName, postId, priorComments, rootAuthor, target });
  }
  async function followersReactTo(postId, postText) {
    const allowed = myFollowers();
    if (allowed.length === 0) return;
    const reactors = [...allowed].sort(() => Math.random() - 0.5).slice(0, Math.min(reactorCount(), allowed.length));
    for (let i = 0; i < reactors.length; i += 1) {
      const reactor = reactors[i];
      if (i > 0 && Math.random() > 0.7) continue;
      const text = await addCommentFrom(postId, postText, char.name, reactor, [], char.name);
      bumpAffinity(reactor.name, char.name, 1, []);
      if (text) await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  async function followerPost() {
    if (following.length === 0 || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const poster = following[Math.floor(Math.random() * following.length)];
    const posterImg = randomGalleryImage(poster);
    const quoteTarget = quoteTargetFrom(posts);
    const sys = followerPostSystemPrompt({ char, poster, posterImg, quoteTarget });
    let text = "";
    try {
      text = stripQuotes(await postGenerateContent({ model: MODEL_AUTO, max_tokens: 200, system: sys, messages: [{ role: "user", content: followerPostUserContent(char, posterImg, quoteTarget) }] }, "팔로잉 글 생성 API"));
    } catch (e) {
      text = "";
    }
    setLoading(false);
    loadingRef.current = false;
    if (!text) return;
    const postId = Date.now();
    setPosts((items) => [followerPostFromText({ char, postId, poster, posterImg, quoteTarget, text }), ...items]);
    if (quoteTarget) bumpAffinity(poster.name, char.name, 1, []);
  }
  return { AUTO_MOODS, addCommentFrom, autoPost, followerPost, followersReactTo, generatePost, submitUserComment };
}

function postFormatRule(mood, attachedImg) {
  if (attachedImg) return `- 이번 글에는 사용자가 업로드해둔 캐릭터 그림/사진 1장이 함께 첨부된다. 이미지를 실제로 보고, 이미지 속 표정·시선·포즈·분위기와 맞는 캡션을 쓴다.
- 예를 들어 캐릭터가 빤히 보는 사진이면, "뭘 그렇게 봐", "계속 볼 거야?", "눈 마주쳤네"처럼 그 시선 맥락을 캐릭터 말투로 자연스럽게 반영한다.
- 사진 설명문처럼 길게 묘사하지 말고, 이미지에 붙는 SNS 짧은 말로 쓴다.
- [PHOTO] 태그는 쓰지 말고 본문만 출력.`;
  if (mood.includes("셀카")) return `- 이번 글은 "방금 찍은 셀카"에 붙이는 글이다. 사진을 직접 묘사하는 한 줄(예: "창가 역광, 머리 부스스")을 먼저 [PHOTO] 태그 뒤에 쓰고, 줄바꿈 후 캐릭터의 코멘트를 쓴다.
형식:
[PHOTO] (사진 장면 묘사 한 줄)
(캐릭터의 코멘트 한두 줄)`;
  if (mood.includes("무드")) return `- 이번 글은 "오늘의 무드" 카드다. [MOOD] 태그 뒤에 BGM/풍경/색감/사물 중 하나를 한 줄로 쓰고, 줄바꿈 후 캐릭터의 코멘트를 쓴다.
형식:
[MOOD] (예: 오늘의 BGM — ○○○ / 지금 보는 풍경 — ○○○)
(캐릭터의 코멘트 한두 줄)`;
  return "- 따옴표로 감싸지 말고 본문만 출력.";
}

function postSystemPrompt({ char, correctionBlock, formatRule, posts }) {
  return `너는 지금부터 아래 캐릭터 본인이 되어, 그 캐릭터의 SNS(트위터/스레드 같은) 계정에 올릴 짧은 글 하나를 쓴다.

[캐릭터]
이름: ${char.name}
${char.age ? `나이/설정: ${char.age}` : ""}
페르소나: ${char.persona}
${char.surface ? `겉모습/첫인상: ${char.surface}` : ""}
${char.inner ? `속마음(겉과 다른 면): ${char.inner}` : ""}
${char.situational ? `상황별 반응: ${char.situational}` : ""}
${char.triggers ? `무너지거나 발끈하는 점: ${char.triggers}` : ""}
${char.interests ? `좋아하는 것/관심사: ${char.interests}` : ""}
${char.world ? `세계관/배경: ${char.world}` : ""}
${relationshipBoundaryLine(char, "public")}
${speechGuideLine(char.speech, "말투 특징")}
${catchphraseGuideLine(char.catchphrase)}
${selfSettingPriorityBlock(char, `${char.name} 자기 설정`)}

[규칙]
- 이 캐릭터 본인이 직접 쓴 SNS 게시글처럼 1인칭으로 쓴다. 설명문 아님.
- 위 "말투 특징"은 참고 메모다. 거기에 적힌 문장·예시·키워드를 그대로 내뱉지 말고, 캐릭터답게 새 문장으로 말하라.
- 말투는 어미·호흡·거리감·문장 길이로 은근하게 반영한다. 설정표를 읽는 듯한 설명문이나 복붙한 예문이면 실패다.
- 짧게. 한두 문장, 길어야 세 문장. 실제 트윗 길이.
- 겉모습만이 아니라 속마음·상황을 입체적으로 드러내라. 가끔은 겉과 속의 간극이 보이게.
- 해시태그는 캐릭터가 쓸 법하면 1개 정도만, 아니면 생략.
- 이모지는 캐릭터 성격에 맞으면 약간, 아니면 쓰지 않는다.
- 메타발언 금지("AI로서" 등). 그냥 그 캐릭터로 존재할 것.
${formatRule}${ANTI_REPEAT_RULES}${recentLinesBlock(posts.slice(0, 6).map((post) => post.text))}${correctionBlock()}`;
}

function parseGeneratedPost(rawText, mood, attachedImg) {
  let text = stripQuotes(rawText);
  let photoDesc = null;
  let moodDesc = null;
  const photoMatch = text.match(/\[PHOTO\]\s*(.+)/);
  const moodMatch = text.match(/\[MOOD\]\s*(.+)/);
  if (photoMatch) { photoDesc = photoMatch[1].split("\n")[0].trim(); text = text.replace(/\[PHOTO\]\s*.+(\n|$)/, "").trim(); }
  if (moodMatch) { moodDesc = moodMatch[1].split("\n")[0].trim(); text = text.replace(/\[MOOD\]\s*.+(\n|$)/, "").trim(); }
  if (attachedImg && mood.includes("셀카")) photoDesc = null;
  return { moodDesc, photoDesc, text };
}

function generatedPostFromParsed(parsed, mood, attachedImg, isAuto, id) {
  return { id, text: parsed.text, mood, time: new Date(), likes: Math.floor(Math.random() * 40) + 3, liked: false, photoDesc: parsed.photoDesc, moodDesc: parsed.moodDesc, img: attachedImg, isAuto, comments: [] };
}

function commentRelationshipBlock({ affOf, commenter, postAuthorName, relLabelFor }) {
  if (!postAuthorName || commenter.name === postAuthorName) return "";
  const relLabel = relLabelFor(commenter, postAuthorName);
  const aff = affOf(commenter.name, postAuthorName);
  const stage = affinityStage(aff);
  const rule = relLabel ? relationshipMatchRuleLine(postAuthorName, `${postAuthorName} — ${relLabel}`) : "";
  return `\n[${postAuthorName}와의 관계] ${relLabel ? `${relLabel} · ` : ""}${stage}(호감도 ${aff})\n→ 이 관계가 "${postAuthorName}"에게 직접 해당될 때만 관계 전용 태도를 사용한다. ${rule} 연인/특별한 대상에게만 보이는 다정함이나 약한 모습은 다른 댓글 상대에게 흘리지 마라. 댓글은 지금 답하는 상대를 향해야 한다.`;
}

function commentSystemPrompt({ commenter, postAuthorChar, postAuthorName, postText, priorComments, relBlock, replyTo, targetImage }) {
  const thread = commentThread(priorComments, replyTo, commenter.name);
  return `너는 "${commenter.name}"이다. SNS 타임라인에서 "${postAuthorName}"의 글에 달린 댓글창에 참여한다.
${selfSettingPriorityBlock(commenter, `${commenter.name} 자기 설정`)}
${relationshipBoundaryLine(commenter, "direct")}
${speechGuideLine(commenter.speech, "말투")}
${catchphraseGuideLine(commenter.catchphrase)}

[원글 — ${postAuthorName}]
${postText}${targetImage ? "\n원글에는 이미지가 첨부되어 있다. 이미지를 실제로 보고 댓글에 반영하라." : ""}${relBlock}${worldBridgeBlock(commenter, postAuthorChar)}
${thread ? `\n[이 답글과 직접 이어지는 짧은 맥락]\n${thread}` : ""}

[규칙]
- 너의 말투로 짧게. 1문장, 길어야 2문장.
- 말투 메모에 들어 있는 문구나 예문을 그대로 쓰지 말고, 댓글 상황에 맞는 새 반응을 만든다.
${thread ? `- 댓글창 전체에 끼어들지 말고, "${replyTo || postAuthorName}"에게 답하는 느낌으로 쓴다.
- 위 직접 맥락을 받되 같은 논점을 반복하지 마라. 이미 나온 말("허전하다/아니다" 식 핑퐁)을 또 주고받지 말고, 새 얘기로 넘기거나(딴지·농담·다른 화제·행동 제안) 한마디 툭 던지고 끝내라.
- "너 ~라고 했잖아" 식으로 상대 말 꼬투리 잡아 따지지 마라. 분석·캐묻기 금지.
- 대화가 충분히 돌았으면 굳이 길게 끌지 말고 가볍게 마무리해도 된다.` : "- 원글에 즉흥적으로 반응하는 첫 댓글. 한마디 툭."}
- 자기소개·설정 설명 금지. AI 상담사처럼 위로·분석·되묻기 하지 마라. 진짜 댓글처럼.
- 본문만 출력.${ANTI_REPEAT_RULES}`;
}

function commentThread(priorComments, replyTo, commenterName) {
  return (priorComments || []).filter((comment) => !replyTo || comment.name === replyTo || comment.replyTo === commenterName).map((comment) => `${comment.name}: ${comment.text}`).join("\n");
}

function commentUserContent(commenter, targetImage) {
  if (!targetImage) return `(${commenter.name}가 댓글을 단다.)`;
  return [{ type: "text", text: `(${commenter.name}가 첨부 이미지가 있는 글에 댓글을 단다. 이미지를 보고 반응한다.)` }, { type: "image_url", image_url: { url: targetImage } }];
}

function appendGeneratedComment(setPosts, postId, commenter, text, replyTo) {
  setPosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...(post.comments || []), { name: commenter.name, handle: commenter.handle || commenter.name, text, replyTo }] } : post));
}

function appendUserComment(setPosts, postId, { handle, name, rootAuthor, txt }) {
  setPosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...(post.comments || []), { name, handle, text: txt, byUser: true, replyTo: rootAuthor }] } : post));
}

function scheduleAuthorReply({ addCommentFrom, char, findPeerChar, name, postAuthorName, postId, priorComments, rootAuthor, target }) {
  const responder = postAuthorName ? findPeerChar(postAuthorName) : (name !== char.name ? char : null);
  if (!responder || responder.name === name) return;
  setTimeout(() => addCommentFrom(postId, target ? target.text : "", rootAuthor, responder, priorComments, name), 1200 + Math.random() * 1500);
}

function reactorCount() {
  if (Math.random() < 0.35) return 3;
  return Math.random() < 0.6 ? 2 : 1;
}

function randomGalleryImage(poster) {
  const posterGallery = Array.isArray(poster.gallery) ? poster.gallery : [];
  return posterGallery.length ? posterGallery[Math.floor(Math.random() * posterGallery.length)] : null;
}

function quoteTargetFrom(posts) {
  const myPosts = posts.filter((post) => !post.author);
  return myPosts.length > 0 && Math.random() < 0.3 ? myPosts[0] : null;
}

function followerPostSystemPrompt({ char, poster, posterImg, quoteTarget }) {
  return `너는 "${poster.name}"이다. 네 SNS에 짧은 글 하나를 올린다.
${selfSettingPriorityBlock(poster, `${poster.name} 자기 설정`)}
${relationshipBoundaryLine(poster, "public")}
${speechGuideLine(poster.speech, "말투")}
${poster.interests ? `관심사: ${poster.interests}` : ""}
${catchphraseGuideLine(poster.catchphrase)}
${quoteTarget ? `\n[너는 지금 "${char.name}"의 다음 글을 인용해서(보고 반응하며) 네 글을 올린다]\n"${char.name}": ${quoteTarget.text}\n→ 이 글에 대한 네 생각·반응·받아치기를 네 말투로. 인용 리트윗처럼.${worldBridgeBlock(poster, char)}` : ""}
${posterImg ? "\n[첨부 이미지]\n네가 올리는 글에는 네 캐릭터 사진/그림이 함께 붙는다. 이미지를 실제로 보고 표정·시선·분위기를 글에 반영하라. 사진 설명문처럼 쓰지 말고 SNS 캡션처럼 쓴다." : ""}

[규칙]
- 1인칭 SNS 글. 한두 문장, 트윗 길이. 자기소개·설정 설명 금지. 즉흥적으로.
- 공개 타임라인 글이다. 특정 인물에게만 다정하거나 약한 설정이 있어도, 그 인물을 직접 부르는 상황이 아니면 모두에게 다정하게 말하지 마라.
- 말투 메모에 들어 있는 설명·예시 문장을 그대로 출력하지 말고, 그 스타일만 반영해 새 글을 쓴다.
- AI 상담사처럼 위로·분석·되묻기 하지 마라. 네 캐릭터답게.
- 본문만 출력.${ANTI_REPEAT_RULES}`;
}

function followerPostUserContent(char, posterImg, quoteTarget) {
  if (!posterImg) return quoteTarget ? `(${char.name}의 글을 인용하며 글을 올린다.)` : "지금 떠오른 걸 한 줄 올려줘.";
  const text = quoteTarget ? `(${char.name}의 글을 인용하며, 첨부된 네 이미지에 어울리는 글을 올린다.)` : "첨부된 네 이미지를 보고 지금 떠오른 걸 한 줄 올려줘.";
  return [{ type: "text", text }, { type: "image_url", image_url: { url: posterImg } }];
}

function followerPostFromText({ char, postId, poster, posterImg, quoteTarget, text }) {
  return { id: postId, text, mood: "팔로잉", time: new Date(), likes: Math.floor(Math.random() * 30) + 2, liked: false, author: poster.name, authorHandle: poster.handle || poster.name, authorSharedId: poster.sharedId || "", isAuto: true, img: posterImg, quoted: quoteTarget ? { name: char.name, handle: char.handle || char.name, text: quoteTarget.text } : null };
}

function stripQuotes(text) {
  return text.replace(/^["'"']|["'"']$/g, "");
}
