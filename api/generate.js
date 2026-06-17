// ────────────────────────────────────────────────────────────
//  /api/generate  —  Vercel 서버리스 함수
//  브라우저는 이 함수만 부른다. 진짜 Gemini 키는 서버(여기)에만 있다.
//  프론트는 기존 Claude 형식({ model, system, messages })으로 보내고,
//  이 함수가 Gemini 형식으로 바꿔 호출한 뒤, 다시 Claude 형식({ content })으로 돌려준다.
//  → 그래서 프론트(jsx)는 호출 주소만 바꾸면 되고 응답 처리 코드는 그대로 쓸 수 있다.
// ────────────────────────────────────────────────────────────

// 환경변수 (Vercel 대시보드 → Settings → Environment Variables 에 넣는다)
//  GEMINI_API_KEY    : Google AI Studio에서 발급한 키 (절대 코드에 직접 쓰지 말 것)
//  GEMINI_MODEL_FAST : 자동 생성용 모델 (기본 gemini-2.5-flash)
//  GEMINI_MODEL_GOOD : 직접 대화용 모델 (기본 gemini-2.5-flash, 품질 올리려면 pro 계열로)

const FAST = process.env.GEMINI_MODEL_FAST || "gemini-3.1-flash-lite";
const GOOD = process.env.GEMINI_MODEL_GOOD || "gemini-3.1-flash-lite";

// 프론트가 보내는 model 문자열을 Gemini 모델로 매핑.
//  기존 코드가 "claude-sonnet-*"(직접) / "claude-haiku-*"(자동)로 구분해 보내므로 그걸 그대로 활용.
function pickGeminiModel(model) {
  const m = String(model || "");
  if (m.includes("sonnet") || m.includes("opus")) return GOOD; // 직접 대화 = 좋은 모델
  return FAST;                                                  // 자동 생성 = 빠른 모델
}

// Claude messages[] → Gemini contents[] 변환
//  Claude role "assistant" → Gemini role "model". user는 그대로.
function toGeminiContents(messages) {
  return (messages || []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
  }));
}

export default async function handler(req, res) {
  // POST만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "GEMINI_API_KEY not set on server" });
  }

  try {
    const { model, system, messages, max_tokens } = req.body || {};
    const geminiModel = pickGeminiModel(model);

    // 이 호출이 JSON 응답을 원하는지 감지.
    //  분석(parseDump)·호감도/기억 판정 프롬프트는 "JSON으로만 답하라"고 지시하므로 그 신호를 본다.
    //  JSON 모드를 켜면 Gemini가 코드펜스·설명 없이 순수 JSON만 뱉어 → 파싱 실패가 사라진다.
    const wantsJson = /JSON|json 객체|json으로|JSON으로|반드시 JSON/.test(system || "");

    // Gemini 요청 본문 구성
    const body = {
      contents: toGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: max_tokens || 800,
        temperature: wantsJson ? 0.3 : 0.9, // JSON은 낮게(정확히), 대화는 높게(개성)
      },
    };
    if (wantsJson) {
      body.generationConfig.responseMimeType = "application/json"; // 순수 JSON 강제
    }
    if (system) {
      body.system_instruction = { parts: [{ text: system }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "gemini_error", detail: data });
    }

    // Gemini 응답 → 텍스트 추출
    const cand = data?.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text || "").join("") || "";

    // 빈 응답이면 이유를 함께 반환 (safety 차단, 토큰 초과 등 디버깅용)
    if (!text) {
      return res.status(200).json({
        content: [{ type: "text", text: "" }],
        _debug: {
          finishReason: cand?.finishReason || "unknown",
          safety: cand?.safetyRatings || null,
          promptFeedback: data?.promptFeedback || null,
          note: "Gemini가 빈 응답을 반환함. finishReason 확인 (SAFETY=차단, MAX_TOKENS=토큰초과)",
        },
      });
    }

    // Claude 형식({ content: [{type:"text", text}] })으로 변환해서 반환
    //  → 프론트의 기존 `data.content.map(i => i.type==="text" ? i.text : "")` 코드가 그대로 작동
    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (e) {
    return res.status(500).json({ error: "server_error", detail: String(e) });
  }
}