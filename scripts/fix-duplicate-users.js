// ===========================================================================
// Rapikan akun dengan EMAIL GANDA di data/db.json.
// Jalankan SEKALI:   npm run fix:users
// - Akun tertua dipertahankan, akun ganda dihapus.
// - Pesanan / booking / ulasan / forum milik akun ganda dipindah ke akun yang dipertahankan.
// - Backup otomatis dibuat di data/db.backup-<waktu>.json
// ===========================================================================
const fs = require("fs");
const path = require("path");
const { readDB, writeDB, DB_PATH } = require("../src/database/db");

const db = readDB();
const backup = path.join(path.dirname(DB_PATH), `db.backup-${Date.now()}.json`);
fs.copyFileSync(DB_PATH, backup);

const byEmail = new Map();
const idMap = new Map(); // id lama -> id yang dipertahankan
const keep = [];

[...db.users]
  .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
  .forEach((u) => {
    const key = String(u.email || "").trim().toLowerCase();
    if (byEmail.has(key)) {
      idMap.set(u.id, byEmail.get(key).id);
    } else {
      u.email = key;
      if (u.tokenVersion === undefined) u.tokenVersion = 0;
      byEmail.set(key, u);
      keep.push(u);
    }
  });

if (idMap.size === 0) {
  console.log("Tidak ada email ganda. Tidak ada yang diubah.");
  fs.unlinkSync(backup);
  process.exit(0);
}

const remap = (obj) => {
  if (obj && idMap.has(obj.userId)) obj.userId = idMap.get(obj.userId);
};
db.bookings.forEach(remap);
db.topengOrders.forEach(remap);
db.reviews.forEach(remap);
db.forumThreads.forEach((t) => {
  remap(t);
  (t.replies || []).forEach(remap);
});

db.users = keep;
writeDB(db);
console.log(`Selesai. ${idMap.size} akun ganda digabung. Backup: ${path.basename(backup)}`);
