// ────────────────────────────────────────────────────────────
//  /api/generate  —  Vercel 서버리스 함수 (최종 수정본)
// ────────────────────────────────────────────────────────────

export const maxDuration = 80; // 🚨 핵심 추가: Vercel 서버 10초 강제 종료 방지 (60초 연장)

// 환경변수: Vercel 대시보드에 설정된 값을 우선 사용하고, 없으면 기본값 사용
const FAST = process.env.GEMINI_MODEL_FAST || "gemini-3.1-flash-lite";
const GOOD = process.env.GEMINI_MODEL_GOOD || "gemini-2.5-pro";

// 프론트가 보내는 model 문자열을 Gemini 모델로 매핑.
function pickGeminiModel(model) {
  const m = String(model || "");
  if (m.includes("sonnet") || m.includes("opus")) return GOOD;
  return FAST;
}

function toGeminiContents(messages) {
  return (messages || []).map((m) => {
    let extractedText = "";

    if (typeof m.content === "string") {
      extractedText = m.content;
    } else if (Array.isArray(m.content)) {
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
    return res.status(200).json({ content: [{ type: "text", text: '{"name": "API_ERROR", "persona": "서버에 API 키가 없습니다."}' }] });
  }

  try {
    const { model, system, messages, max_tokens } = req.body || {};
    const geminiModel = pickGeminiModel(model);
    const wantsJson = /JSON|json 객체|json으로|JSON으로|반드시 JSON/.test(system || "");

    const body = {
      contents: toGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: max_tokens || 2048,
        temperature: wantsJson ? 0.3 : 0.9,
      },
    };

    if (wantsJson) {
      body.generationConfig.responseMimeType = "application/json";
    }

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

    // 🚨 404, 429 등 통신 에러 발생 시 프론트가 터지지 않게 방어하고 화면에 에러를 보여줌
    if (!r.ok) {
      console.error("Gemini API Error:", data);
      const errMsg = `{"name": "API_에러발생", "persona": "상태코드: ${r.status}. 상세: ${JSON.stringify(data.error?.message || data)}", "aff_a_to_b": 0, "aff_b_to_a": 0, "mem_a": [], "mem_b": []}`;
      return res.status(200).json({ content: [{ type: "text", text: errMsg }] });
    }

    const cand = data?.candidates?.[0];
    let text = cand?.content?.parts?.map((p) => p.text || "").join("") || "";

    if (!text) {
      const emptyMsg = `{"name": "응답_없음", "persona": "Gemini가 빈 응답을 줬습니다. 사유: ${cand?.finishReason}", "aff_a_to_b": 0, "aff_b_to_a": 0, "mem_a": [], "mem_b": []}`;
      return res.status(200).json({ content: [{ type: "text", text: emptyMsg }] });
    }

    if (wantsJson) {
      text = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    }

    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (e) {
    const fatalMsg = `{"name": "서버_오류", "persona": "Vercel 서버 내부 오류: ${e.message}", "aff_a_to_b": 0, "aff_b_to_a": 0, "mem_a": [], "mem_b": []}`;
    return res.status(200).json({ content: [{ type: "text", text: fatalMsg }] });
  }
}