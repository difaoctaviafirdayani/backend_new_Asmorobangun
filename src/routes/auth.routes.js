const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../db");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");
const { UPLOADS_ROOT, ensureDir } = require("../upload");

const router = express.Router();

// ---------- Upload foto profil ----------
const AVATAR_DIR = path.join(UPLOADS_ROOT, "avatars");
ensureDir(AVATAR_DIR);

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
      cb(null, `${req.user.id}-${Date.now()}-${nanoid(6)}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    const okMime = /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
    const okExt = /\.(jpe?g|png|webp)$/i.test(file.originalname);
    if (okMime && okExt) cb(null, true);
    else cb(new Error("Foto profil harus berformat JPG, PNG, atau WEBP."));
  },
}).single("avatar");

// Hapus file foto lama (hanya yang memang ada di folder avatars, biar aman)
function removeOldAvatar(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith("/uploads/avatars/")) return;
  const file = path.join(AVATAR_DIR, path.basename(avatarUrl));
  fs.unlink(file, () => {});
}

// Kebijakan password: hanya huruf (A-Z, a-z) dan angka (0-9), tanpa spasi,
// titik, koma, strip, atau simbol/karakter aneh lainnya. Panjang 6-64 karakter.
const PASSWORD_REGEX = /^[A-Za-z0-9]{6,64}$/;
function passwordError(password) {
  if (typeof password !== "string" || !password) return "Password wajib diisi.";
  if (password.length < 6) return "Password minimal 6 karakter.";
  if (password.length > 64) return "Password maksimal 64 karakter.";
  if (!PASSWORD_REGEX.test(password)) {
    return "Password hanya boleh berisi huruf dan angka (tanpa spasi, titik, koma, strip, atau simbol lain).";
  }
  return null;
}

function publicUser(u) {
  const { password, ...rest } = u;
  return rest;
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { name, username, email, password, phone } = req.body;
  const displayName = name || username;
  if (!displayName || !email || !password) {
    return res.status(400).json({ error: "Nama, email, dan password wajib diisi." });
  }
  const pwErr = passwordError(password);
  if (pwErr) {
    return res.status(400).json({ error: pwErr });
  }
  const db = readDB();
  const exists = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: "Email sudah terdaftar. Silakan login." });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: `u-${nanoid(8)}`,
    name: displayName,
    email,
    phone: phone || "",
    password: hashed,
    role: "member",
    avatar: null,
    createdAt: new Date().toISOString(),
  };
  await update((data) => {
    data.users.push(user);
  });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email dan password wajib diisi." });
  const db = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(401).json({ error: "Email atau password salah." });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Email atau password salah." });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan." });
  res.json({ user: publicUser(user) });
});

// POST /api/auth/me/avatar  (multipart, field: avatar) -> ganti foto profil
router.post("/me/avatar", requireAuth, (req, res) => {
  uploadAvatar(req, res, async (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Ukuran foto maksimal 3MB." : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "File foto wajib dipilih." });

    const newUrl = `/uploads/avatars/${req.file.filename}`;
    let oldUrl = null;
    let found = true;
    await update((data) => {
      const u = data.users.find((x) => x.id === req.user.id);
      if (!u) {
        found = false;
        return;
      }
      oldUrl = u.avatar;
      u.avatar = newUrl;
    });
    if (!found) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "User tidak ditemukan." });
    }
    removeOldAvatar(oldUrl);
    const user = readDB().users.find((x) => x.id === req.user.id);
    res.json({ message: "Foto profil diperbarui.", user: publicUser(user) });
  });
});

// DELETE /api/auth/me/avatar -> hapus foto profil (kembali ke inisial nama)
router.delete("/me/avatar", requireAuth, async (req, res) => {
  let oldUrl = null;
  let found = true;
  await update((data) => {
    const u = data.users.find((x) => x.id === req.user.id);
    if (!u) {
      found = false;
      return;
    }
    oldUrl = u.avatar;
    u.avatar = null;
  });
  if (!found) return res.status(404).json({ error: "User tidak ditemukan." });
  removeOldAvatar(oldUrl);
  const user = readDB().users.find((x) => x.id === req.user.id);
  res.json({ message: "Foto profil dihapus.", user: publicUser(user) });
});

module.exports = router;