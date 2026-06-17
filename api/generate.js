// ────────────────────────────────────────────────────────────
//  /api/generate  —  Vercel 서버리스 함수 (최종 수정본)
// ────────────────────────────────────────────────────────────

export const maxDuration = 60;

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
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "API_KEY_MISSING", message: "서버에 API 키가 설정되지 않았습니다." });
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

    // 🚨 여기서 200 OK인 척 하지 않고 확실하게 500 에러를 던지도록 수정했습니다.
    if (!r.ok) {
      console.error("Gemini API 통신 실패:", data);
      return res.status(500).json({ error: "API_ERROR", status: r.status, detail: data });
    }

    const cand = data?.candidates?.[0];
    let text = cand?.content?.parts?.map((p) => p.text || "").join("") || "";

    if (!text) {
      return res.status(500).json({ error: "EMPTY_RESPONSE", finishReason: cand?.finishReason });
    }

    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    console.error("서버 내부 에러:", e);
    return res.status(500).json({ error: "SERVER_CRASH", message: String(e) });
  }
}