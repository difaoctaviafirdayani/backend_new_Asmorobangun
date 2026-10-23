// ===========================================================================
// UPLOAD FILE (multer) — foto topeng, galeri, bukti pembayaran, dll.
// File diterima di memori lalu DISIMPAN KE MySQL (lihat database/media.repo.js).
// Hasilnya sama seperti sebelumnya: req.file.filename berisi nama file, dan
// URL-nya tetap /uploads/<subfolder>/<nama file>.
// ===========================================================================
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");
const media = require("../database/media.repo");

const UPLOADS_ROOT = path.join(__dirname, "..", "..", "uploads");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeUploader(subfolder) {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    fileFilter: (req, file, cb) => {
      const allowed = /^\.(jpe?g|png|webp|gif|pdf)$/i;
      if (allowed.test(path.extname(file.originalname))) cb(null, true);
      else {
        const err = new Error("Format file tidak didukung (gunakan JPG/PNG/WEBP/GIF/PDF).");
        err.status = 400;
        cb(err);
      }
    },
  });

  // Setelah multer membaca file, simpan ke MySQL dan isi req.file.filename.
  const persist = async (req, res, next) => {
    if (!req.file) return next();
    try {
      const ext = (path.extname(req.file.originalname) || "").toLowerCase();
      const filename = `${Date.now()}-${nanoid(8)}${ext}`;
      await media.save(subfolder, filename, req.file.buffer);
      req.file.filename = filename;
      next();
    } catch (err) {
      if (err.code === "ER_NET_PACKET_TOO_LARGE") {
        err.status = 413;
        err.message = "File terlalu besar untuk MySQL (max_allowed_packet). Perkecil ukuran foto.";
      }
      next(err);
    }
  };

  // Dipakai di route seperti sebelumnya: uploader.single("image")
  return { single: (field) => [parser.single(field), persist] };
}

module.exports = { makeUploader, UPLOADS_ROOT, ensureDir };