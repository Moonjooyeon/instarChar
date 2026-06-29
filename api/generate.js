// ────────────────────────────────────────────────────────────
//  /api/generate  —  Vercel 서버리스 함수 (최종 수정본)
// ────────────────────────────────────────────────────────────

export const maxDuration = 60;

const FAST = process.env.GEMINI_MODEL_FAST || "gemini-2.5-flash";
const GOOD = process.env.GEMINI_MODEL_GOOD || "gemini-2.5-pro";
const DAILY_LIMIT = parseInt(process.env.API_DAILY_LIMIT || "50", 10);
const MONTHLY_COST_LIMIT_USD = parseFloat(process.env.API_MONTHLY_COST_LIMIT_USD || "60");
const ESTIMATED_CALL_COST_USD = parseFloat(process.env.API_ESTIMATED_CALL_COST_USD || "0.003");
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || "45000", 10);
const API_LIMIT_MESSAGE = "오늘 한정된 API는 다 사용했어요! 다음에 만나요.";
const usageStore = globalThis.__aliveUsageStore || (globalThis.__aliveUsageStore = {
  daily: new Map(),
  monthly: new Map(),
});

function pickGeminiModel(model) {
  const m = String(model || "");
  if (m.includes("sonnet") || m.includes("opus")) return GOOD;
  return FAST;
}

function dataUrlToInlineData(url) {
  const match = String(url || "").match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2],
  };
}

function contentPartToGeminiPart(part) {
  if (!part) return null;
  if (part.type === "text") return { text: part.text || "" };
  if (part.type === "image_url") {
    const url = typeof part.image_url === "string" ? part.image_url : part.image_url?.url;
    const inlineData = dataUrlToInlineData(url);
    return inlineData ? { inlineData } : null;
  }
  if (part.type === "image" || part.type === "input_image") {
    const inlineData = dataUrlToInlineData(part.dataUrl || part.url || part.image || part.image_url);
    return inlineData ? { inlineData } : null;
  }
  return { text: JSON.stringify(part) };
}

function toGeminiContents(messages) {
  return (messages || []).map((m) => {
    let parts = [];
    if (typeof m.content === "string") {
      parts = [{ text: m.content }];
    } else if (Array.isArray(m.content)) {
      parts = m.content.map(contentPartToGeminiPart).filter(Boolean);
    } else {
      parts = [{ text: JSON.stringify(m.content) }];
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: parts.length ? parts : [{ text: "" }],
    };
  });
}

function extractGeminiText(data) {
  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text || "").join("") || "";
  return { cand, text };
}

function periodKey(date, type) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return type === "month" ? `${y}-${m}` : `${y}-${m}-${d}`;
}

function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const firstIp = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "").split(",")[0];
  return firstIp.trim() || req.headers["x-real-ip"] || "local";
}

function checkUsageLimit(req) {
  const now = new Date();
  const day = periodKey(now, "day");
  const month = periodKey(now, "month");
  const key = clientKey(req);
  const dailyKey = `${day}:${key}`;
  const dailyCount = usageStore.daily.get(dailyKey) || 0;
  const monthlyCost = usageStore.monthly.get(month) || 0;

  if (dailyCount >= DAILY_LIMIT) {
    return {
      blocked: true,
      status: 429,
      body: { error: "DAILY_LIMIT_EXCEEDED", message: API_LIMIT_MESSAGE },
    };
  }

  if (monthlyCost + ESTIMATED_CALL_COST_USD > MONTHLY_COST_LIMIT_USD) {
    return {
      blocked: true,
      status: 429,
      body: { error: "MONTHLY_COST_LIMIT_EXCEEDED", message: API_LIMIT_MESSAGE },
    };
  }

  return { blocked: false, dailyKey, month, monthlyCost };
}

function recordUsage(usage) {
  usageStore.daily.set(usage.dailyKey, (usageStore.daily.get(usage.dailyKey) || 0) + 1);
  usageStore.monthly.set(usage.month, usage.monthlyCost + ESTIMATED_CALL_COST_USD);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJsonResponse(response) {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {
      error: "BAD_UPSTREAM_JSON",
      message: `Gemini가 JSON이 아닌 응답을 보냈습니다. HTTP ${response.status}`,
      raw: raw.slice(0, 500),
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "API_KEY_MISSING", message: "서버에 API 키가 설정되지 않았습니다." });
  }

  try {
    const usage = checkUsageLimit(req);
    if (usage.blocked) return res.status(usage.status).json(usage.body);

    const { model, system, messages, max_tokens } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "BAD_REQUEST",
        message: "messages 배열이 필요합니다.",
      });
    }

    const geminiModel = pickGeminiModel(model);
    const wantsJson = /JSON|json 객체|json으로|JSON으로|반드시 JSON/.test(system || "");

    const body = {
      contents: toGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: wantsJson ? Math.max(max_tokens || 2048, 2048) : (max_tokens || 2048),
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
    const callGemini = async (requestBody) => {
      let lastResponse = null;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          lastResponse = r;
          if (![429, 500, 503, 504].includes(r.status)) return r;
        } catch (e) {
          lastError = e;
          if (attempt >= 2) throw e;
        } finally {
          clearTimeout(timeout);
        }
        if (attempt < 2) {
          const retryAfter = Number(lastResponse?.headers?.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
          await wait(delay);
        }
      }
      if (!lastResponse && lastError) throw lastError;
      return lastResponse;
    };

    let r = await callGemini(body);

    let data = await readJsonResponse(r);

    // 🚨 여기서 200 OK인 척 하지 않고 확실하게 500 에러를 던지도록 수정했습니다.
    if (!r.ok) {
      console.error("Gemini API 통신 실패:", data);
      return res.status(500).json({ error: "API_ERROR", status: r.status, detail: data });
    }

    let { cand, text } = extractGeminiText(data);

    if (!text && (cand?.finishReason === "STOP" || cand?.finishReason === "MAX_TOKENS" || (wantsJson && body.generationConfig.responseMimeType))) {
      const retryBody = {
        ...body,
        generationConfig: {
          ...body.generationConfig,
          maxOutputTokens: Math.max(body.generationConfig.maxOutputTokens || 2048, 4096),
          temperature: wantsJson ? 0.2 : 0.75,
        },
      };
      if (wantsJson) delete retryBody.generationConfig.responseMimeType;
      retryBody.contents = [
        ...body.contents,
        {
          role: "user",
          parts: [{ text: "직전 응답이 비어 있었다. 위 지시를 그대로 따르되, 반드시 빈 문자열이 아닌 최종 답변 본문만 출력하라." }],
        },
      ];
      r = await callGemini(retryBody);
      data = await readJsonResponse(r);

      if (!r.ok) {
        console.error("Gemini API 재시도 실패:", data);
        return res.status(500).json({ error: "API_ERROR", status: r.status, detail: data });
      }

      ({ cand, text } = extractGeminiText(data));
    }

    if (!text) {
      const finishReason = cand?.finishReason || data?.promptFeedback?.blockReason || "unknown";
      return res.status(500).json({
        error: "EMPTY_RESPONSE",
        message: `Gemini가 빈 응답을 반환했습니다. finishReason: ${finishReason}`,
        finishReason,
        detail: {
          promptFeedback: data?.promptFeedback,
          candidate: cand ? {
            finishReason: cand.finishReason,
            safetyRatings: cand.safetyRatings,
          } : null,
        },
      });
    }

    recordUsage(usage);
    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    console.error("서버 내부 에러:", e);
    return res.status(500).json({ error: "SERVER_CRASH", message: String(e) });
  }
}
