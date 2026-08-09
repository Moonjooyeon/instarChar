import { postGenerateContent, type GenerateMessage } from "@/api/generate";
import { ANTI_REPEAT_RULES, worldBridgeBlock } from "@/domain/app/textUtils";
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

export function useAliveFeedGeneration({
  affOf,
  bumpAffinity,
  canAutoComment,
  char,
  commentAs,
  commentText,
  findPeerChar,
  following,
  generateServerPost,
  loadingRef,
  myFollowers,
  personas,
  posts,
  relLabelFor,
  setCommentOn,
  setCommentText,
  setLoading,
  setMoodOpen,
  mutatePosts,
  setSaveStatus,
  submitExternalComment,
}) {
  async function generatePost(mood: string): Promise<void> {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setMoodOpen(false);
    setSaveStatus("글 생성 중");
    try {
      const post = await generateServerPost(mood);
      if (!post) throw new Error("생성된 글이 없습니다.");
      setSaveStatus("저장됨");
      if (post && following.length > 0) setTimeout(() => followersReactTo(post.id, post.text), 1800 + Math.random() * 2000);
    } catch (error) {
      console.error("게시글 생성 실패:", error);
      setSaveStatus(`글 생성 실패: ${generationFailureMessage(error)}`);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }
  async function addCommentFrom(postId, postText, postAuthorName, commenter, priorComments = [], replyTo = postAuthorName) {
    if (!canAutoComment(commenter.name, postAuthorName)) return null;
    const targetPost = posts.find((post) => post.id === postId);
    const targetImage = targetPost?.img || null;
    const relBlock = commentRelationshipBlock({ affOf, commenter, postAuthorName, relLabelFor });
    const postAuthorChar = findPeerChar(postAuthorName) || (postAuthorName === char.name ? char : { name: postAuthorName });
    const sys = commentSystemPrompt({ commenter, postAuthorChar, postAuthorName, postText, priorComments, relBlock, replyTo, targetImage });
    try {
      const text = stripQuotes(await postGenerateContent({ flow: "assist_social", model: MODEL_AUTO, max_tokens: 150, system: sys, messages: [{ role: "user", content: commentUserContent(commenter, targetImage) }] }, "댓글 생성 API"));
      if (!text) return null;
      appendGeneratedComment(mutatePosts, postId, commenter, text, replyTo);
      return text;
    } catch (e) {
      return null;
    }
  }
  async function submitUserComment(post) {
    const postId = post.id;
    const postAuthorName = post.author || null;
    const txt = commentText.trim();
    if (!txt) return;
    const persona = commentAs.startsWith("p:") ? personas.find((item) => `p:${item.id}` === commentAs) : null;
    const name = persona ? persona.name : char.name;
    const handle = persona ? name : (char.handle || char.name);
    const rootAuthor = postAuthorName || char.name;
    if (postAuthorName) {
      await submitRemoteComment({ bumpAffinity, comment: { handle, name, replyTo: rootAuthor, text: txt }, post, postAuthorName, setCommentOn, setCommentText, setSaveStatus, submitExternalComment });
      return;
    }
    const target = posts.find((item) => item.id === postId);
    const priorComments = [...((target && target.comments) || []), { name, text: txt, replyTo: rootAuthor }];
    appendUserComment(mutatePosts, postId, { handle, name, rootAuthor, txt });
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
      text = stripQuotes(await postGenerateContent({ flow: "assist_social", model: MODEL_AUTO, max_tokens: 200, system: sys, messages: [{ role: "user", content: followerPostUserContent(char, posterImg, quoteTarget) }] }, "팔로잉 글 생성 API"));
    } catch (e) {
      text = "";
    }
    setLoading(false);
    loadingRef.current = false;
    if (!text) return;
    const postId = Date.now();
    mutatePosts((items) => [followerPostFromText({ char, postId, poster, posterImg, quoteTarget, text }), ...items]);
    if (quoteTarget) bumpAffinity(poster.name, char.name, 1, []);
  }
  return { addCommentFrom, followerPost, followersReactTo, generatePost, submitUserComment };
}

async function submitRemoteComment({ bumpAffinity, comment, post, postAuthorName, setCommentOn, setCommentText, setSaveStatus, submitExternalComment }) {
  try {
    await submitExternalComment(post, comment);
    bumpAffinity(postAuthorName, comment.name, 1, []);
    setCommentText("");
    setCommentOn(null);
  } catch (error) {
    setSaveStatus(`댓글 저장 실패: ${generationFailureMessage(error)}`);
  }
}

function generationFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message === API_LIMIT_MESSAGE) return API_LIMIT_MESSAGE;
  return "잠시 후 다시 시도해주세요.";
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

function commentUserContent(commenter, targetImage): GenerateMessage["content"] {
  if (!targetImage) return `(${commenter.name}가 댓글을 단다.)`;
  return [{ type: "text", text: `(${commenter.name}가 첨부 이미지가 있는 글에 댓글을 단다. 이미지를 보고 반응한다.)` }, { type: "image_url", image_url: { url: targetImage } }];
}

function appendGeneratedComment(mutatePosts, postId, commenter, text, replyTo) {
  mutatePosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...(post.comments || []), { name: commenter.name, handle: commenter.handle || commenter.name, text, replyTo }] } : post));
}

function appendUserComment(mutatePosts, postId, { handle, name, rootAuthor, txt }) {
  mutatePosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...(post.comments || []), { name, handle, text: txt, byUser: true, replyTo: rootAuthor }] } : post));
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

function followerPostUserContent(char, posterImg, quoteTarget): GenerateMessage["content"] {
  if (!posterImg) return quoteTarget ? `(${char.name}의 글을 인용하며 글을 올린다.)` : "지금 떠오른 걸 한 줄 올려줘.";
  const text = quoteTarget ? `(${char.name}의 글을 인용하며, 첨부된 네 이미지에 어울리는 글을 올린다.)` : "첨부된 네 이미지를 보고 지금 떠오른 걸 한 줄 올려줘.";
  return [{ type: "text", text }, { type: "image_url", image_url: { url: posterImg } }];
}

function followerPostFromText({ char, postId, poster, posterImg, quoteTarget, text }) {
  return { id: postId, text, mood: "팔로잉", time: new Date(), likes: Math.floor(Math.random() * 30) + 2, liked: false, author: poster.name, authorHandle: poster.handle || poster.name, authorCharacterId: poster.characterId || "", authorSharedId: poster.sharedId || "", isAuto: true, img: posterImg, quoted: quoteTarget ? { name: char.name, handle: char.handle || char.name, text: quoteTarget.text } : null };
}

function stripQuotes(text) {
  return text.replace(/^["'"']|["'"']$/g, "");
}
