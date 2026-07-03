import { API_LIMIT_MESSAGE } from "@/domain/app/aliveCore";

export function useAliveAiGeneration() {
  async function readApiJson(res, label) {
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(`${label} 응답이 비어 있습니다. HTTP ${res.status}. 로컬 개발 서버에서 /api/generate 연결이 끊겼을 수 있습니다.`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`${label}가 JSON이 아닌 응답을 보냈습니다. HTTP ${res.status}. 응답 앞부분: ${text.slice(0, 120)}`);
    }
  }

  function apiErrorText(data) {
    if (data?.error === "DAILY_LIMIT_EXCEEDED" || data?.error === "MONTHLY_COST_LIMIT_EXCEEDED") return API_LIMIT_MESSAGE;
    if (data?.error === "EMPTY_RESPONSE") return "AI 응답이 잠깐 비었어. 같은 말을 다시 보내줘.";
    return data?.message
      || data?.detail?.error?.message
      || (data?.finishReason ? `${data.error || "API_ERROR"}: ${data.finishReason}` : "")
      || (data?.error ? `${data.error}${data.status ? ` (${data.status})` : ""}` : "")
      || JSON.stringify(data || {});
  }

  function apiContentText(data) {
    return (data?.content || []).map((i) => (i.type === "text" ? i.text : "")).join("").trim();
  }

  function cleanApiFailureMessage(error, fallback = "응답이 잠깐 끊겼어. 다시 시도해줘.") {
    const message = error?.name === "AbortError" ? "응답 시간이 길어져서 중단됐어. 다시 시도해줘." : String(error?.message || "");
    if (!message) return fallback;
    if (/Gemini|finishReason|EMPTY_RESPONSE|API_ERROR|SERVER_CRASH|응답에 텍스트|빈 응답/i.test(message)) return fallback;
    return message;
  }

  async function readApiContent(res, label) {
    const data = await readApiJson(res, label);
    if (!res.ok || data.error) {
      throw new Error(apiErrorText(data));
    }
    const text = apiContentText(data);
    if (!text) throw new Error(`${label} 응답에 텍스트가 없습니다.`);
    return text;
  }

  return {
    apiContentText,
    apiErrorText,
    cleanApiFailureMessage,
    readApiContent,
    readApiJson,
  };
}
