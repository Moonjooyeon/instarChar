// ────────────────────────────────────────────────────────────
//  /api/generate  —  Vercel 서버리스 함수 (최종 수정본)
// ────────────────────────────────────────────────────────────

// 환경변수: Vercel 대시보드에 설정된 값을 우선 사용하고, 없으면 기본값 사용
const FAST = process.env.GEMINI_MODEL_FAST || "gemini-3.1-flash-lite";
const GOOD = process.env.GEMINI_MODEL_GOOD || "gemini-2.5-pro";

// 프론트가 보내는 model 문자열을 Gemini 모델로 매핑.
function pickGeminiModel(model) {
  const m = String(model || "");
  if (m.includes("sonnet") || m.includes("opus")) return GOOD;
  return FAST;
}

// Claude messages[] → Gemini contents[] 변환 및 텍스트 평탄화(파싱 에러 방지)
function toGeminiContents(messages) {
  return (messages || []).map((m) => {
    let extractedText = "";

    if (typeof m.content === "string") {
      extractedText = m.content;
    } else if (Array.isArray(m.content)) {
      // 배열로 올 경우 순수 텍스트만 추출
      extractedText = m.content
          .filter((c) => c.type === "text")
          .map((c) => c.text || "")
          .join("\n");
    } else {
      extractedText = JSON.stringify(m.content);
    }

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: extractedText }],
    };
  });
}

export default async function handler(req, res) {
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

    // JSON 응답 요구 감지
    const wantsJson = /JSON|json 객체|json으로|JSON으로|반드시 JSON/.test(system || "");

    const body = {
      contents: toGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: max_tokens || 800,
        temperature: wantsJson ? 0.3 : 0.9,
      },
    };

    if (wantsJson) {
      body.generationConfig.responseMimeType = "application/json";
    }

    // 핵심 수정 1: system_instruction(X) -> systemInstruction(O)
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
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

    const cand = data?.candidates?.[0];
    let text = cand?.content?.parts?.map((p) => p.text || "").join("") || "";

    if (!text) {
      return res.status(200).json({
        content: [{ type: "text", text: "" }],
        _debug: {
          finishReason: cand?.finishReason || "unknown",
        },
      });
    }

    // 핵심 수정 2: JSON 모드일 경우 프론트 파서를 망가뜨리는 마크다운 백틱 찌꺼기 제거
    if (wantsJson) {
      text = text.replace(/^\s*