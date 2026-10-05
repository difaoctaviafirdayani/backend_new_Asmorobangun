const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeUploader(subfolder) {
  const dest = path.join(UPLOADS_ROOT, subfolder);
  ensureDir(dest);
  const storage = multer.diskStorage({
    destination: dest,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      cb(null, `${Date.now()}-${nanoid(8)}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|webp|gif|pdf/i;
      if (allowed.test(path.extname(file.originalname))) cb(null, true);
      else cb(new Error("Format file tidak didukung (gunakan JPG/PNG/WEBP/GIF/PDF)."));
    },
  });
}

module.exports = { makeUploader, UPLOADS_ROOT, ensureDir };
