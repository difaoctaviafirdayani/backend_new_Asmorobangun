// ===========================================================================
// MEDIA — foto & file hasil upload disimpan DI DALAM MySQL (tabel media_files),
// bukan hanya di folder uploads/. Jadi foto ikut terbawa saat database
// dibagikan (export/import .sql) dan tidak hilang karena folder uploads/
// tidak ikut di-push ke GitHub.
// URL tetap sama seperti dulu: /uploads/<folder>/<namafile>
// ===========================================================================
const fs = require("fs");
const path = require("path");
const { getPool } = require("./mysql");

const UPLOADS_ROOT = path.join(__dirname, "..", "..", "uploads");
// Folder yang disimpan di MySQL. (avatars tetap di disk, dikelola auth.controller)
const FOLDERS = ["site_images", "payment_proof", "chat_attachment"];

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};
const mimeOf = (filename) => MIME[path.extname(filename).toLowerCase()] || "application/octet-stream";

async function save(folder, filename, buffer) {
  await getPool().query(
    `INSERT INTO media_files (folder, filename, mime, size, data) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), size = VALUES(size), data = VALUES(data)`,
    [folder, filename, mimeOf(filename), buffer.length, buffer]
  );
}

async function find(folder, filename) {
  const [rows] = await getPool().query(
    "SELECT mime, data FROM media_files WHERE folder = ? AND filename = ? LIMIT 1",
    [folder, filename]
  );
  return rows[0] || null;
}

// Pindahkan file lama di folder uploads/ ke MySQL (sekali jalan; yang sudah ada dilewati).
async function importExistingFiles() {
  let masuk = 0;
  for (const folder of FOLDERS) {
    const dir = path.join(UPLOADS_ROOT, folder);
    if (!fs.existsSync(dir)) continue;
    for (const filename of fs.readdirSync(dir)) {
      if (filename.startsWith(".")) continue;
      const full = path.join(dir, filename);
      if (!fs.statSync(full).isFile()) continue;
      if (await find(folder, filename)) continue;
      try {
        await save(folder, filename, fs.readFileSync(full));
        masuk += 1;
      } catch (e) {
        console.warn(`Gagal memindahkan ${folder}/${filename} ke MySQL: ${e.message}`);
      }
    }
  }
  if (masuk) console.log(`Migrasi file upload -> MySQL: ${masuk} file dipindahkan.`);
}

async function init() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS media_files (
      folder     VARCHAR(40)  NOT NULL,
      filename   VARCHAR(120) NOT NULL,
      mime       VARCHAR(100) NOT NULL,
      size       INT          NOT NULL,
      data       LONGBLOB     NOT NULL,
      created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (folder, filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await importExistingFiles();
}

module.exports = { init, save, find, FOLDERS };