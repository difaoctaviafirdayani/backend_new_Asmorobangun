const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");

const { readDB, update } = require("../../database/db");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../../config/env");
const { httpError } = require("../../middleware/error");
const { createLimiter, tooManyMessage } = require("../../middleware/rateLimit");
const { UPLOADS_ROOT, ensureDir } = require("../../utils/upload");
const { PASSWORD_MSG, PASSWORD_RULES, ONLY_ALNUM, passwordError } = require("../../utils/password");
const { normalizePhone, normalizeEmail, EMAIL_REGEX } = require("../../utils/helpers");

// Batas percobaan: 8x salah login / 5x salah lupa-password per 15 menit (per IP + email)
const loginLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const resetLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const limiterKey = (req, email) => `${req.ip}|${email}`;

// ---------- Helper ----------
function publicUser(u) {
  const { password, tokenVersion, ...rest } = u;
  return rest;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, tv: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ---------- Foto profil ----------
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
    else cb(httpError(400, "Foto profil harus berformat JPG, PNG, atau WEBP."));
  },
}).single("avatar");

// Hapus file foto lama (hanya yang memang ada di folder avatars, biar aman)
function removeOldAvatar(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith("/uploads/avatars/")) return;
  fs.unlink(path.join(AVATAR_DIR, path.basename(avatarUrl)), () => {});
}

// ---------- Handler ----------

// GET /api/auth/password-policy
exports.passwordPolicy = (req, res) => {
  res.json({ policy: PASSWORD_RULES, message: PASSWORD_MSG });
};

// POST /api/auth/register
exports.register = async (req, res) => {
  const { name, username, password, phone } = req.body;
  const displayName = String(name || username || "").trim();
  const email = normalizeEmail(req.body.email);
  const cleanPhone = normalizePhone(phone);

  if (!displayName || !email || !password) {
    throw httpError(400, "Nama, email, dan password wajib diisi.");
  }
  if (displayName.length < 2 || displayName.length > 60) {
    throw httpError(400, "Nama harus 2-60 karakter.");
  }
  if (!EMAIL_REGEX.test(email)) throw httpError(400, "Format email tidak valid.");
  if (cleanPhone.length < 9 || cleanPhone.length > 15) {
    throw httpError(400, "Nomor HP wajib diisi dengan benar (dipakai untuk verifikasi lupa password).");
  }
  const pwErr = passwordError(password);
  if (pwErr) throw httpError(400, pwErr);

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: `u-${nanoid(8)}`,
    name: displayName,
    email,
    phone: cleanPhone,
    password: hashed,
    role: "member",
    avatar: null,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
  };

  // Cek email ganda DI DALAM antrian penulisan supaya dua pendaftaran
  // bersamaan dengan email yang sama tidak bisa lolos dua-duanya.
  await update((data) => {
    if (data.users.some((u) => normalizeEmail(u.email) === email)) {
      throw httpError(409, "Email sudah terdaftar. Silakan login atau gunakan lupa password.");
    }
    data.users.push(user);
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) throw httpError(400, "Email dan password wajib diisi.");

  const key = limiterKey(req, email);
  const wait = loginLimiter.blockedFor(key);
  if (wait) throw httpError(429, tooManyMessage(wait));

  const user = readDB().users.find((u) => normalizeEmail(u.email) === email);
  if (!user) {
    loginLimiter.fail(key);
    throw httpError(401, "Email atau password salah.");
  }
  // Akun pengguna: password berisi karakter selain huruf/angka langsung ditolak.
  // (Akun admin dikecualikan supaya admin lama tidak terkunci.)
  if (user.role !== "admin" && !ONLY_ALNUM.test(String(password))) {
    throw httpError(400, PASSWORD_MSG);
  }
  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) {
    loginLimiter.fail(key);
    throw httpError(401, "Email atau password salah.");
  }
  loginLimiter.clear(key);
  res.json({ token: signToken(user), user: publicUser(user) });
};

// POST /api/auth/reset-password   — LUPA PASSWORD
// Body: { email, phone, newPassword, confirmPassword? }
// Akun hanya bisa direset kalau email DAN nomor HP cocok dengan data saat daftar.
exports.resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { phone, newPassword, confirmPassword } = req.body;
  if (!email || !phone || !newPassword) {
    throw httpError(400, "Email, nomor HP, dan password baru wajib diisi.");
  }
  const pwErr = passwordError(newPassword);
  if (pwErr) throw httpError(400, pwErr);
  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    throw httpError(400, "Konfirmasi password tidak sama dengan password baru.");
  }

  const key = limiterKey(req, email);
  const wait = resetLimiter.blockedFor(key);
  if (wait) throw httpError(429, tooManyMessage(wait));

  const GENERIC = "Email atau nomor HP tidak cocok dengan data akun.";
  const user = readDB().users.find((u) => normalizeEmail(u.email) === email);
  const savedPhone = user ? normalizePhone(user.phone) : "";
  if (!user || user.role === "admin" || !savedPhone || savedPhone !== normalizePhone(phone)) {
    resetLimiter.fail(key);
    throw httpError(400, GENERIC);
  }
  if (await bcrypt.compare(String(newPassword), user.password)) {
    throw httpError(400, "Password baru tidak boleh sama dengan password lama.");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await update((data) => {
    const u = data.users.find((x) => x.id === user.id);
    if (u) {
      u.password = hashed;
      // Naikkan versi token -> semua sesi login lama (termasuk milik orang lain) otomatis keluar.
      u.tokenVersion = (u.tokenVersion || 0) + 1;
    }
  });
  resetLimiter.clear(key);
  res.json({
    success: true,
    message: "Password berhasil diganti. Silakan login dengan password baru.",
  });
};

// POST /api/auth/change-password   — ganti password saat sudah login
// Body: { currentPassword, newPassword, confirmPassword? }
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw httpError(400, "Password lama dan password baru wajib diisi.");
  }
  const pwErr = passwordError(newPassword);
  if (pwErr) throw httpError(400, pwErr);
  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    throw httpError(400, "Konfirmasi password tidak sama dengan password baru.");
  }

  const key = limiterKey(req, `chg:${req.user.id}`);
  const wait = resetLimiter.blockedFor(key);
  if (wait) throw httpError(429, tooManyMessage(wait));

  const user = readDB().users.find((u) => u.id === req.user.id);
  if (!user) throw httpError(404, "User tidak ditemukan.");
  if (!(await bcrypt.compare(String(currentPassword), user.password))) {
    resetLimiter.fail(key);
    throw httpError(400, "Password lama salah.");
  }
  if (currentPassword === newPassword) {
    throw httpError(400, "Password baru tidak boleh sama dengan password lama.");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  let updated;
  await update((data) => {
    const u = data.users.find((x) => x.id === user.id);
    u.password = hashed;
    u.tokenVersion = (u.tokenVersion || 0) + 1;
    updated = { ...u };
  });
  resetLimiter.clear(key);
  // Token baru diberikan supaya perangkat ini tetap login, perangkat lain keluar.
  res.json({
    success: true,
    message: "Password berhasil diganti.",
    token: signToken(updated),
    user: publicUser(updated),
  });
};

// GET /api/auth/me
exports.me = (req, res) => {
  const user = readDB().users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan." });
  res.json({ user: publicUser(user) });
};

// POST /api/auth/me/avatar  (multipart, field: avatar)
exports.uploadAvatar = uploadAvatar;
exports.saveAvatar = async (req, res) => {
  if (!req.file) throw httpError(400, "File foto wajib dipilih.");
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
    throw httpError(404, "User tidak ditemukan.");
  }
  removeOldAvatar(oldUrl);
  const user = readDB().users.find((x) => x.id === req.user.id);
  res.json({ message: "Foto profil diperbarui.", user: publicUser(user) });
};

// DELETE /api/auth/me/avatar
exports.removeAvatar = async (req, res) => {
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
  if (!found) throw httpError(404, "User tidak ditemukan.");
  removeOldAvatar(oldUrl);
  const user = readDB().users.find((x) => x.id === req.user.id);
  res.json({ message: "Foto profil dihapus.", user: publicUser(user) });
};
