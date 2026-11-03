// ===========================================================================
// KONFIGURASI  — semua pembacaan .env ada di sini (satu pintu).
// ===========================================================================
require("dotenv").config();

const DEFAULT_SECRET = "asmorobangun-dev-secret-change-me";
const NODE_ENV = process.env.NODE_ENV || "development";

// Secret dianggap LEMAH kalau kosong, bawaan, terlalu pendek, atau masih placeholder "ISI_...".
const rawSecret = process.env.JWT_SECRET || "";
const JWT_IS_WEAK = !rawSecret || rawSecret === DEFAULT_SECRET || rawSecret.length < 32 || /^ISI_/i.test(rawSecret);
if (JWT_IS_WEAK && NODE_ENV === "production") {
  // Di produksi server SENGAJA tidak mau jalan kalau secret lemah (token bisa dipalsukan).
  throw new Error("JWT_SECRET belum aman. Isi dengan teks acak minimal 32 karakter di .env / Environment Variables.");
}

module.exports = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 4000,
  // 0.0.0.0 = bisa diakses dari HP / emulator Flutter dalam jaringan yang sama
  HOST: process.env.HOST || "0.0.0.0",

  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_SECRET,
  JWT_IS_DEFAULT: JWT_IS_WEAK,
  JWT_EXPIRES_IN: "7d",

  // Koneksi MySQL (MySQL di web / hosting)
  DB: {
    HOST: process.env.DB_HOST || "localhost",
    PORT: Number(process.env.DB_PORT) || 3306,
    USER: process.env.DB_USER || "root",
    PASSWORD: process.env.DB_PASSWORD || "",
    NAME: process.env.DB_NAME || "asmorobangun",
    SSL: process.env.DB_SSL === "true", // true kalau penyedia database mewajibkan SSL
  },

  // Kosong = semua origin boleh (cocok untuk development).
  // Isi dengan daftar dipisah koma untuk produksi, contoh:
  // CORS_ORIGINS=http://localhost:3000,http://localhost:3001
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Alamat publik backend (dipakai kalau gambar diminta dalam bentuk URL lengkap).
  // Contoh: PUBLIC_URL=http://192.168.1.10:4000
  PUBLIC_URL: (process.env.PUBLIC_URL || "").replace(/\/$/, ""),
  // true = SEMUA respons selalu berisi URL gambar lengkap (http://...)
  ABSOLUTE_URLS: process.env.ABSOLUTE_URLS === "true",

  // AI utama (Gemini) — dipakai untuk analisis forum yang hasilnya diverifikasi admin
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.8-flash",

  // Push notification (Firebase Cloud Messaging). Isi dengan JSON service account
  // (boleh dalam bentuk base64 supaya muat di satu baris .env). Kosong = push dimatikan.
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || "",

  // Chatbot topeng (opsional)
  AI_API_KEY: process.env.AI_API_KEY || "",
  AI_BASE_URL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  AI_MODEL: process.env.AI_MODEL || "gpt-4o-mini",
};