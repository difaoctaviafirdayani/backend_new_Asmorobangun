// ===========================================================================
// TITIK MASUK — jalankan dengan:  npm start
// ===========================================================================
const { PORT, HOST, JWT_IS_DEFAULT, NODE_ENV } = require("./src/config/env");
const { initDb } = require("./src/database/db");

initDb();
const app = require("./src/app");

if (JWT_IS_DEFAULT && NODE_ENV === "production") {
  console.warn("⚠️  JWT_SECRET masih bawaan! Ganti di file .env sebelum dipakai publik.");
}

app.listen(PORT, HOST, () => {
  console.log(`Asmorobangun backend running on http://localhost:${PORT}`);
});

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
