// ===========================================================================
// APP CONFIG — pengaturan aplikasi. Semua pembacaan file .env ada di sini (satu pintu).
// ===========================================================================
import "dotenv/config";

const DEFAULT_SECRET = "asmorobangun-dev-secret-change-me";

export const NODE_ENV: string = process.env.NODE_ENV || "development";

// Secret dianggap LEMAH kalau kosong, bawaan, terlalu pendek, atau masih placeholder "ISI_...".
const rawSecret = process.env.JWT_SECRET || "";
const JWT_IS_WEAK = !rawSecret || rawSecret === DEFAULT_SECRET || rawSecret.length < 32 || /^ISI_/i.test(rawSecret);
if (JWT_IS_WEAK && NODE_ENV === "production") {
  // Di produksi server SENGAJA tidak mau jalan kalau secret lemah (token bisa dipalsukan).
  throw new Error("JWT_SECRET belum aman. Isi dengan teks acak minimal 32 karakter di .env / Environment Variables.");
}

export const PORT: number = Number(process.env.PORT) || 4000;
// 0.0.0.0 = bisa diakses dari HP / emulator Flutter dalam jaringan yang sama
export const HOST: string = process.env.HOST || "0.0.0.0";

export const JWT_SECRET: string = process.env.JWT_SECRET || DEFAULT_SECRET;
export const JWT_IS_DEFAULT: boolean = JWT_IS_WEAK;
export const JWT_EXPIRES_IN = "7d";

// Koneksi MySQL
export const DB = {
  HOST: process.env.DB_HOST || "localhost",
  PORT: Number(process.env.DB_PORT) || 3306,
  USER: process.env.DB_USER || "root",
  PASSWORD: process.env.DB_PASSWORD || "",
  NAME: process.env.DB_NAME || "asmorobangun",
  SSL: process.env.DB_SSL === "true", // true kalau penyedia database mewajibkan SSL
};

// Kosong = semua origin boleh (cocok untuk development).
// Contoh produksi: CORS_ORIGINS=http://localhost:3000,https://situs-kamu.com
export const CORS_ORIGINS: string[] = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Alamat publik backend (dipakai kalau gambar diminta dalam bentuk URL lengkap).
export const PUBLIC_URL: string = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
// true = SEMUA respons selalu berisi URL gambar lengkap (http://...)
export const ABSOLUTE_URLS: boolean = process.env.ABSOLUTE_URLS === "true";

// ---------------------------------------------------------------------------
// AI — pilih SATU penyedia lewat AI_PROVIDER: "gemini" atau "groq".
// Alamat (URL) API sudah diatur otomatis di llm.service.ts, tidak perlu diisi di .env.
// Kalau AI_PROVIDER kosong, dipilih otomatis dari API key yang terisi (Groq dulu, lalu Gemini).
// ---------------------------------------------------------------------------
export type AiProvider = "gemini" | "groq";

export const GEMINI_API_KEY: string = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL: string = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const GROQ_API_KEY: string = process.env.GROQ_API_KEY || "";
export const GROQ_MODEL: string = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const requestedProvider = (process.env.AI_PROVIDER || "").trim().toLowerCase();
export const AI_PROVIDER: AiProvider =
  requestedProvider === "gemini" || requestedProvider === "groq"
    ? requestedProvider
    : GROQ_API_KEY
      ? "groq"
      : GEMINI_API_KEY
        ? "gemini"
        : "groq";

if (requestedProvider && requestedProvider !== "gemini" && requestedProvider !== "groq") {
  console.warn(`⚠️  AI_PROVIDER="${requestedProvider}" tidak dikenal. Isi dengan "gemini" atau "groq". Dipakai: ${AI_PROVIDER}.`);
}

// Cloud storage (Cloudinary). Kalau ketiganya diisi, foto & file upload dikirim ke cloud, bukan MySQL.
export const CLOUDINARY = {
  CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  API_KEY: process.env.CLOUDINARY_API_KEY || "",
  API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
};

// Push notification (Firebase). Isi JSON service account (boleh base64). Kosong = push dimatikan.
export const FIREBASE_SERVICE_ACCOUNT: string = process.env.FIREBASE_SERVICE_ACCOUNT || "";