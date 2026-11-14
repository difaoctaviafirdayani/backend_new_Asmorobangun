// ===========================================================================
// DATABASE JSON — data/db.json. Sekarang hanya dipakai sebagai sumber migrasi
// satu kali ke MySQL (akun, konten, dll). Data utama ada di MySQL.
// ===========================================================================
import fs from "fs";
import path from "path";

export const DB_PATH = path.join(__dirname, "..", "..", "data", "db.json");

// Koleksi yang wajib ada supaya route tidak error kalau db.json kosong / kurang lengkap.
const DEFAULT_ARRAYS = [
  "users", "facilities", "reviews", "bookings", "eventRequests", "topeng",
  "topengOrders", "articles", "announcements", "gallery", "faqs", "forumThreads",
];

export function readDB(): any {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

// Tulis ke file sementara dulu lalu di-rename, supaya db.json tidak rusak
// kalau server mati di tengah proses menulis.
export function writeDB(data: unknown): void {
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, DB_PATH);
}

// Antrian supaya penulisan tidak saling menimpa.
// PENTING: kalau satu proses gagal, antrian tetap lanjut — tidak macet selamanya.
let queue: Promise<unknown> = Promise.resolve();
export function update<T>(mutatorFn: (data: any) => T): Promise<T> {
  const run = queue.then(() => {
    const data = readDB();
    const result = mutatorFn(data);
    writeDB(data);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

// Dipanggil sekali saat server start: pastikan struktur data lengkap.
export function initDb(): void {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    writeDB({});
  }
  const data = readDB();
  let changed = false;
  DEFAULT_ARRAYS.forEach((key) => {
    if (!Array.isArray(data[key])) {
      data[key] = [];
      changed = true;
    }
  });
  if (!data.cultureInfo || typeof data.cultureInfo !== "object") {
    data.cultureInfo = { timeline: [], paragraph: "" };
    changed = true;
  }
  if (!Array.isArray(data.cultureInfo.timeline)) {
    data.cultureInfo.timeline = [];
    changed = true;
  }
  if (!data.paymentSettings || typeof data.paymentSettings !== "object") {
    data.paymentSettings = {};
    changed = true;
  }
  if (changed) writeDB(data);
}