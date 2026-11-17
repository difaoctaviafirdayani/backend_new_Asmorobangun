// =============================================================================
// LLM SERVICE — satu pintu untuk memanggil AI. Penyedia dipilih lewat AI_PROVIDER
// di .env ("gemini" atau "groq"). Kode lain cukup panggil generateText().
// =============================================================================
import { AI_PROVIDER, GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL } from "../../config/appConfig";
import { httpError } from "../../middleware/error";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  // Minta jawaban berbentuk JSON. geminiSchema (opsional) memaksa bentuk JSON di Gemini.
  json?: boolean;
  geminiSchema?: object;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20000;

export const activeProvider = AI_PROVIDER;
export const activeModel: string = AI_PROVIDER === "gemini" ? GEMINI_MODEL : GROQ_MODEL;
export const activeModelLabel: string = `${AI_PROVIDER}:${activeModel}`;
export const isAiConfigured = (): boolean => (AI_PROVIDER === "gemini" ? !!GEMINI_API_KEY : !!GROQ_API_KEY);

async function postJson(url: string, headers: Record<string, string>, body: unknown, fetchFn: typeof fetch): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`${AI_PROVIDER} error status:`, res.status); // isi error tidak dikirim ke klien
      throw httpError(502, `Layanan AI menolak permintaan (kode ${res.status}).`);
    }
    return data;
  } catch (err: any) {
    if (err?.status) throw err;
    if (err?.name === "AbortError") throw httpError(504, "AI terlalu lama merespons.");
    throw httpError(502, "Gagal menghubungi layanan AI.");
  } finally {
    clearTimeout(timer);
  }
}

async function callGroq(req: LlmRequest, fetchFn: typeof fetch): Promise<string> {
  if (!GROQ_API_KEY) throw httpError(503, "GROQ_API_KEY belum diisi di file .env.");
  const data = await postJson(
    GROQ_URL,
    { Authorization: `Bearer ${GROQ_API_KEY}` },
    {
      model: GROQ_MODEL,
      messages: [{ role: "system", content: req.system }, ...req.messages],
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 600,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    },
    fetchFn
  );
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw httpError(502, "AI tidak memberikan jawaban.");
  return text;
}

async function callGemini(req: LlmRequest, fetchFn: typeof fetch): Promise<string> {
  if (!GEMINI_API_KEY) throw httpError(503, "GEMINI_API_KEY belum diisi di file .env.");
  const data = await postJson(
    `${GEMINI_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    { "x-goog-api-key": GEMINI_API_KEY },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxTokens ?? 600,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
        ...(req.json && req.geminiSchema ? { responseSchema: req.geminiSchema } : {}),
      },
    },
    fetchFn
  );
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) throw httpError(502, "AI tidak memberikan jawaban.");
  return text;
}

export function generateText(req: LlmRequest, fetchFn: typeof fetch = fetch): Promise<string> {
  return AI_PROVIDER === "gemini" ? callGemini(req, fetchFn) : callGroq(req, fetchFn);
}