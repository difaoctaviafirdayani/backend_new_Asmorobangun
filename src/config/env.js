// ===========================================================================
// KONFIGURASI  — semua pembacaan .env ada di sini (satu pintu).
// ===========================================================================
require("dotenv").config();

const DEFAULT_SECRET = "asmorobangun-dev-secret-change-me";

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 4000,
  // 0.0.0.0 = bisa diakses dari HP / emulator Flutter dalam jaringan yang sama
  HOST: process.env.HOST || "0.0.0.0",

  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_SECRET,
  JWT_IS_DEFAULT: !process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET,
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

  // Chatbot topeng (opsional)
  AI_API_KEY: process.env.AI_API_KEY || "",
  AI_BASE_URL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  AI_MODEL: process.env.AI_MODEL || "gpt-4o-mini",
};