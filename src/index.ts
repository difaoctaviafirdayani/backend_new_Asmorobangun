// ===========================================================================
// TITIK MASUK (TypeScript) — jalankan dengan:  npm run dev   atau   npm start
// ===========================================================================
import { PORT, HOST, JWT_IS_DEFAULT } from "./config/appConfig";
import { initDb } from "./database/db";
import { initMysql } from "./database/mysql";

async function start(): Promise<void> {
  initDb(); // db.json hanya dipakai sebagai sumber migrasi satu kali ke MySQL
  await initMysql(); // semua data (akun, konten, layanan, registrasi, forum, hasil AI) di MySQL

  const app = require("./app"); // dimuat setelah database siap

  if (JWT_IS_DEFAULT) {
    console.warn("⚠️  JWT_SECRET masih lemah/placeholder! Ganti dengan teks acak minimal 32 karakter di .env.");
  }

  app.listen(PORT, HOST, () => {
    console.log(`Asmorobangun backend running on http://localhost:${PORT}`);
  });
}

start().catch((err: any) => {
  console.error("Gagal menjalankan server:", err.message);
  console.error(err.stack);
  if (err.code === "ENOTFOUND") console.error("-> DB_HOST salah / tidak ditemukan.");
  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") console.error("-> Tidak bisa terhubung ke MySQL. Cek DB_HOST, DB_PORT, dan pastikan MySQL menyala.");
  if (err.code === "ER_ACCESS_DENIED_ERROR") console.error("-> DB_USER / DB_PASSWORD salah.");
  if (err.code === "ER_BAD_DB_ERROR") console.error("-> DB_NAME salah / database belum dibuat.");
  if (String(err.message).includes("SSL")) console.error("-> Coba set DB_SSL=true di .env.");
  process.exit(1);
});

process.on("unhandledRejection", (err: unknown) => console.error("Unhandled rejection:", err));