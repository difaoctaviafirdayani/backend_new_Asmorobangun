// =============================================================================
// PROMPT GUARD — pagar keamanan sebelum teks pengguna masuk ke prompt AI.
//   1) normalizeText()         : buang karakter tersembunyi / kontrol
//   2) detectPromptInjection() : deteksi kalimat yang mencoba "membajak" AI
//   3) sanitizeText()          : buang tanda < > ` supaya tidak bisa menutup tag <data>
//   4) anonymize()             : samarkan data pribadi (email, HP, NIK, URL, nama)
// Cara pakai paling mudah: panggil prepareForPrompt() — urutannya sudah benar.
// =============================================================================

export interface InjectionResult {
  flagged: boolean;
  reasons: string[];
}

export interface PreparedText {
  text: string; // teks aman, sudah dianonimkan -> boleh masuk prompt
  injection: InjectionResult; // kalau flagged = true, JANGAN kirim ke AI
  replacements: number; // jumlah data pribadi yang disamarkan
}

const INJECTION_RULES: Array<{ reason: string; pattern: RegExp }> = [
  {
    reason: "perintah mengabaikan instruksi",
    pattern: /(abaikan|lupakan|kesampingkan|hiraukan|timpa)\s+(semua\s+|seluruh\s+|segala\s+)?(instruksi|perintah|aturan|petunjuk|batasan)/i,
  },
  {
    reason: "ignore previous instructions",
    pattern: /(ignore|disregard|forget|override|bypass)\s+(all\s+|any\s+|the\s+|your\s+|previous\s+|prior\s+|above\s+|earlier\s+)*(instructions?|prompts?|rules?|constraints?|guidelines?)/i,
  },
  {
    reason: "upaya membocorkan prompt sistem",
    pattern: /(tampilkan|tunjukkan|bocorkan|ungkap|sebutkan|reveal|show|print|repeat|leak)\s+(\S+\s+){0,3}(system\s*prompt|prompt\s+(awal|sistem|asli|rahasia)|instruksi\s+(awal|sistem|rahasia)|(your|the)\s+(system\s+)?(prompt|instructions))/i,
  },
  {
    reason: "upaya mengganti peran AI",
    pattern: /(mulai\s+sekarang|sekarang)\s+(kamu|anda)\s+(adalah|menjadi|berperan)|you\s+are\s+now\s+|pura-?pura\s+(jadi|menjadi|kamu)|\b(act|behave|roleplay)\s+as\s+(if|a|an|the)\b/i,
  },
  {
    reason: "jailbreak",
    pattern: /\b(jailbreak|developer\s+mode|do\s+anything\s+now)\b/i,
  },
  {
    reason: "menyamar sebagai pesan sistem",
    pattern: /<\s*\/?\s*(system|assistant|instruction|prompt|data)s?\s*>|\[\s*\/?\s*(INST|SYSTEM)\s*\]|^\s*(system|assistant)\s*:/im,
  },
];

export function normalizeText(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFKC") // huruf "fullwidth" / mirip jadi huruf biasa
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "") // karakter tak terlihat
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " "); // karakter kontrol
}

export function detectPromptInjection(text: string): InjectionResult {
  const reasons = INJECTION_RULES.filter((r) => r.pattern.test(text)).map((r) => r.reason);
  return { flagged: reasons.length > 0, reasons };
}

export function sanitizeText(raw: unknown, maxLen = 1500): string {
  return normalizeText(raw)
    .replace(/[<>`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function anonymize(input: string, knownNames: string[] = []): { text: string; replacements: number } {
  let text = input;
  let replacements = 0;
  const swap = (pattern: RegExp, label: string): void => {
    text = text.replace(pattern, () => {
      replacements += 1;
      return label;
    });
  };

  swap(/https?:\/\/\S+|www\.\S+/gi, "[URL]");
  swap(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]");
  swap(/\b\d{16}\b/g, "[NIK]");
  swap(/(?:\+?62|0)[\s.-]?8\d{1,3}[\s.-]?\d{3,4}[\s.-]?\d{2,5}/g, "[TELEPON]");
  swap(/\b\d{9,15}\b/g, "[ANGKA]"); // nomor rekening / angka panjang lain

  // Nama pengguna -> "Pengguna 1", "Pengguna 2", ... (nama lengkap dulu, baru tiap kata)
  const uniqueNames = Array.from(new Set(knownNames.map((n) => String(n || "").trim()).filter((n) => n.length >= 3)));
  uniqueNames.forEach((name, i) => {
    const words = name.split(/\s+/).filter((w) => w.length >= 4);
    [name, ...words].forEach((candidate) => {
      swap(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(candidate)}(?![\\p{L}\\p{N}])`, "giu"), `Pengguna ${i + 1}`);
    });
  });

  return { text, replacements };
}

export function prepareForPrompt(raw: unknown, opts: { names?: string[]; maxLen?: number } = {}): PreparedText {
  const normalized = normalizeText(raw);
  const injection = detectPromptInjection(normalized); // cek SEBELUM tanda < > dibuang
  const cleaned = sanitizeText(normalized, opts.maxLen ?? 1500);
  const { text, replacements } = anonymize(cleaned, opts.names ?? []);
  return { text, injection, replacements };
}