// ===========================================================================
// KONFIGURASI — semua pembacaan .env ada di sini (satu pintu).
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

// AI utama (Gemini) — analisis forum yang hasilnya diverifikasi admin
export const GEMINI_API_KEY: string = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL: string = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Cloud storage (Cloudinary). Kalau ketiganya diisi, foto & file upload dikirim ke cloud, bukan MySQL.
export const CLOUDINARY = {
  CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  API_KEY: process.env.CLOUDINARY_API_KEY || "",
  API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
};
// Push notification (Firebase). Isi JSON service account (boleh base64). Kosong = push dimatikan.
export const FIREBASE_SERVICE_ACCOUNT: string = process.env.FIREBASE_SERVICE_ACCOUNT || "";

// Chatbot topeng (opsional)
export const AI_API_KEY: string = process.env.AI_API_KEY || "";
export const AI_BASE_URL: string = process.env.AI_BASE_URL || "https://api.openai.com/v1";
export const AI_MODEL: string = process.env.AI_MODEL || "gpt-4o-mini";