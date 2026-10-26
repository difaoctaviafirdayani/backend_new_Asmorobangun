// ===========================================================================
// TITIK MASUK (TypeScript) — jalankan dengan:  npm run dev
// Isinya sama dengan server.js; modul lama (.js) dipanggil lewat require.
// ===========================================================================
const { PORT, HOST, JWT_IS_DEFAULT, NODE_ENV } = require("./config/env");
const { initDb } = require("./database/db");
const { initMysql } = require("./database/mysql");
  import sequelize from "./db/config/database";

async function start(): Promise<void> {
  initDb(); // db.json hanya dipakai sebagai sumber migrasi satu kali ke MySQL
  await initMysql(); // semua data (akun, konten, layanan, registrasi, forum) di MySQL
    await sequelize.authenticate();
  console.log("Database connected successfully");
  const app = require("./app");

  if (JWT_IS_DEFAULT && NODE_ENV === "production") {
    console.warn("⚠️  JWT_SECRET masih bawaan! Ganti di file .env sebelum dipakai publik.");
  }

  app.listen(PORT, HOST, () => {
    console.log(`Asmorobangun backend running on http://localhost:${PORT}`);
  });
}

start().catch((err: any) => {
  console.error("Gagal menjalankan server:", err.message);
  if (err.code === "ENOTFOUND") console.error("-> DB_HOST salah / tidak ditemukan.");
  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT")
    console.error("-> Tidak bisa terhubung ke MySQL. Cek DB_HOST, DB_PORT, dan pastikan MySQL menyala.");
  if (err.code === "ER_ACCESS_DENIED_ERROR") console.error("-> DB_USER / DB_PASSWORD salah.");
  if (err.code === "ER_BAD_DB_ERROR") console.error("-> DB_NAME salah / database belum dibuat.");
  if (String(err.message).includes("SSL")) console.error("-> Coba set DB_SSL=true di .env.");
  process.exit(1);
});

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

export {};