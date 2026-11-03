// ===========================================================================
// Rapikan akun dengan EMAIL GANDA di data/db.json.
// Jalankan SEKALI:   npm run fix:users
// - Akun tertua dipertahankan, akun ganda dihapus.
// - Pesanan / booking / ulasan / forum milik akun ganda dipindah ke akun yang dipertahankan.
// - Backup otomatis dibuat di data/db.backup-<waktu>.json
// ===========================================================================
import fs from "fs";
import path from "path";
import { readDB, writeDB, DB_PATH } from "../src/database/db";

interface UserJson {
  id: string;
  email?: string;
  createdAt?: string;
  tokenVersion?: number;
  [key: string]: any;
}

interface HasUserId {
  userId?: string;
}

const db = readDB();
const backup = path.join(path.dirname(DB_PATH), `db.backup-${Date.now()}.json`);
fs.copyFileSync(DB_PATH, backup);

const byEmail = new Map<string, UserJson>();
const idMap = new Map<string, string>(); // id lama -> id yang dipertahankan
const keep: UserJson[] = [];

[...(db.users as UserJson[])]
  .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
  .forEach((u) => {
    const key = String(u.email || "").trim().toLowerCase();
    const existing = byEmail.get(key);
    if (existing) {
      idMap.set(u.id, existing.id);
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

const remap = (obj: HasUserId | null | undefined): void => {
  if (obj && obj.userId && idMap.has(obj.userId)) obj.userId = idMap.get(obj.userId);
};
(db.bookings as HasUserId[]).forEach(remap);
(db.topengOrders as HasUserId[]).forEach(remap);
(db.reviews as HasUserId[]).forEach(remap);
(db.forumThreads as Array<HasUserId & { replies?: HasUserId[] }>).forEach((t) => {
  remap(t);
  (t.replies || []).forEach(remap);
});

db.users = keep;
writeDB(db);
console.log(`Selesai. ${idMap.size} akun ganda digabung. Backup: ${path.basename(backup)}`);