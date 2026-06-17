// ────────────────────────────────────────────────────────────
//  /api/generate  —  Vercel 서버리스 함수 (최종 수정본)
// ────────────────────────────────────────────────────────────

export const maxDuration = 60; // Vercel 서버 강제 종료 방지 (60초 연장)

const FAST = process.env.GEMINI_MODEL_FAST || "gemini-3.1-flash-lite";
const GOOD = process.env.GEMINI_MODEL_GOOD || "gemini-2.5-pro";

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
    const err = { name: "API_ERROR", persona: "서버에 API 키가 없습니다.", aff_a_to_b: 0, aff_b_to_a: 0, mem_a: [], mem_b: [] };
    return res.status(200).json({ content: [{ type: "text", text: JSON.stringify(err) }] });
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
      // 🚨 주의: thinkingConfig는 지원하지 않는 모델에서 400 에러를 유발하므로 완전히 삭제했습니다.
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

    // 🚨 쌍따옴표 충돌 없이 완벽한 객체로 만들어 안전하게 에러 반환
    if (!r.ok) {
      console.error("Gemini API Error:", data);
      const errObj = {
        name: "API_에러발생",
        persona: `상태코드 ${r.status}: ${data.error?.message || "알 수 없는 에러"}`,
        aff_a_to_b: 0, aff_b_to_a: 0, mem_a: [], mem_b: []
      };
      return res.status(200).json({ content: [{ type: "text", text: JSON.stringify(errObj) }] });
    }

    const cand = data?.candidates?.[0];
    let text = cand?.content?.parts?.map((p) => p.text || "").join("") || "";

    if (!text) {
      const emptyObj = {
        name: "응답_없음",
        persona: `Gemini 빈 응답. 사유: ${cand?.finishReason || "unknown"}`,
        aff_a_to_b: 0, aff_b_to_a: 0, mem_a: [], mem_b: []
      };
      return res.status(200).json({ content: [{ type: "text", text: JSON.stringify(emptyObj) }] });
    }

    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (e) {
    const fatalObj = {
      name: "서버_오류",
      persona: `서버 내부 오류: ${e.message}`,
      aff_a_to_b: 0, aff_b_to_a: 0, mem_a: [], mem_b: []
    };
    return res.status(200).json({ content: [{ type: "text", text: JSON.stringify(fatalObj) }] });
  }
}