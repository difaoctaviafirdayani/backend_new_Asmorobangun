// ===========================================================================
// TITIK MASUK — jalankan dengan:  npm start
// ===========================================================================
const { PORT, HOST, JWT_IS_DEFAULT, NODE_ENV } = require("./src/config/env");
const { initDb } = require("./src/database/db");
const { initMysql } = require("./src/database/mysql");

async function start() {
    initDb(); // db.json hanya dipakai sebagai sumber migrasi satu kali ke MySQL
  await initMysql(); // semua data (akun, konten, layanan, registrasi, forum) di MySQL
  const app = require("./src/app");

  if (JWT_IS_DEFAULT && NODE_ENV === "production") {
    console.warn("⚠️  JWT_SECRET masih bawaan! Ganti di file .env sebelum dipakai publik.");
  }

  app.listen(PORT, HOST, () => {
    console.log(`Asmorobangun backend running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Gagal menjalankan server:", err.message);
  if (err.code === "ENOTFOUND") console.error("-> DB_HOST salah / tidak ditemukan. Cek lagi alamat host di panel database.");
  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT")
    console.error("-> Tidak bisa terhubung ke server MySQL. Cek DB_HOST, DB_PORT, dan pastikan 'Remote MySQL' / akses dari luar sudah diizinkan untuk IP kamu.");
  if (err.code === "ER_ACCESS_DENIED_ERROR") console.error("-> DB_USER / DB_PASSWORD salah, atau user belum diizinkan akses dari IP kamu.");
  if (err.code === "ER_BAD_DB_ERROR") console.error("-> DB_NAME salah / database belum dibuat di panel.");
  if (String(err.message).includes("SSL")) console.error("-> Coba set DB_SSL=true di .env.");
  process.exit(1);
});

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));