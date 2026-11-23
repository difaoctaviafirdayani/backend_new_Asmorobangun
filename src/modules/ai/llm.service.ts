// =============================================================================
// LLM SERVICE — satu pintu untuk memanggil AI. Penyedia utama dipilih lewat AI_PROVIDER
// di .env ("gemini" atau "groq"). Kalau penyedia utama gagal (timeout, key salah, kuota,
// model tidak ada) dan penyedia lain punya API key, otomatis dicoba penyedia cadangan.
// Kode lain cukup panggil generateText().
// =============================================================================
import { AI_PROVIDER, GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL, type AiProvider } from "../../config/appConfig";
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

const hasKey = (p: AiProvider): boolean => (p === "gemini" ? !!GEMINI_API_KEY : !!GROQ_API_KEY);
// AI dianggap siap kalau SALAH SATU penyedia punya key.
export const isAiConfigured = (): boolean => hasKey("groq") || hasKey("gemini");

async function postJson(
  provider: AiProvider,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  fetchFn: typeof fetch
): Promise<any> {
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
      // Isi error dicatat di log server (bukan dikirim ke klien) supaya mudah dicari penyebabnya.
      console.error(`[AI] ${provider} error status:`, res.status, JSON.stringify(data?.error ?? data).slice(0, 500));
      throw httpError(502, `Layanan AI menolak permintaan (kode ${res.status}).`);
    }
    return data;
  } catch (err: any) {
    if (err?.status) throw err;
    if (err?.name === "AbortError") {
      console.error(`[AI] ${provider} timeout setelah ${TIMEOUT_MS / 1000} detik.`);
      throw httpError(504, "AI terlalu lama merespons.");
    }
    console.error(`[AI] ${provider} gagal dihubungi:`, err?.cause?.code || err?.message);
    throw httpError(502, "Gagal menghubungi layanan AI.");
  } finally {
    clearTimeout(timer);
  }
}

async function callGroq(req: LlmRequest, fetchFn: typeof fetch): Promise<string> {
  if (!GROQ_API_KEY) throw httpError(503, "GROQ_API_KEY belum diisi di file .env.");
  const isReasoning = /gpt-oss|qwen3/i.test(GROQ_MODEL);
  const data = await postJson(
    "groq",
    GROQ_URL,
    { Authorization: `Bearer ${GROQ_API_KEY}` },
    {
      model: GROQ_MODEL,
      messages: [{ role: "system", content: req.system }, ...req.messages],
      temperature: req.temperature ?? 0.2,
      // Model "berpikir" memakai sebagian token untuk berpikir, jadi jatahnya dinaikkan.
      max_tokens: Math.max(req.maxTokens ?? 1024, isReasoning ? 2048 : 0),
      // Batasi usaha berpikir supaya cepat dan jawabannya tidak kosong.
      ...(/gpt-oss/i.test(GROQ_MODEL) ? { reasoning_effort: "low" } : {}),
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

  // Model 2.5-flash memakai token untuk "berpikir" yang ikut mengurangi jatah jawaban.
  // Dimatikan supaya jawaban tidak kosong/kepotong.
  const thinkingConfig = /2\.5-flash/.test(GEMINI_MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {};

  const data = await postJson(
    "gemini",
    `${GEMINI_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    { "x-goog-api-key": GEMINI_API_KEY },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxTokens ?? 1024,
        ...thinkingConfig,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
        ...(req.json && req.geminiSchema ? { responseSchema: req.geminiSchema } : {}),
      },
    },
    fetchFn
  );

  // Gabungkan semua bagian teks (bukan hanya parts[0]) dan lewati bagian "thought".
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .filter((p: any) => typeof p?.text === "string" && !p.thought)
        .map((p: any) => p.text)
        .join("")
    : "";
  if (!text.trim()) throw httpError(502, "AI tidak memberikan jawaban.");
  return text;
}

const call = (p: AiProvider, req: LlmRequest, fetchFn: typeof fetch): Promise<string> =>
  p === "gemini" ? callGemini(req, fetchFn) : callGroq(req, fetchFn);

export async function generateText(req: LlmRequest, fetchFn: typeof fetch = fetch): Promise<string> {
  const backup: AiProvider = AI_PROVIDER === "gemini" ? "groq" : "gemini";
  try {
    return await call(AI_PROVIDER, req, fetchFn);
  } catch (err: any) {
    // Coba penyedia cadangan hanya kalau key-nya ada dan kegagalan bukan salah input pengguna.
    if (hasKey(backup) && (err?.status === 502 || err?.status === 503 || err?.status === 504)) {
      console.warn(`[AI] ${AI_PROVIDER} gagal (${err.status}), mencoba cadangan: ${backup}.`);
      return call(backup, req, fetchFn);
    }
    throw err;
  }
}