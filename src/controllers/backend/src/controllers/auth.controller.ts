import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { Request, RequestHandler, Response } from "express";

import * as repo from "../database/users.repo";
import type { User } from "../database/users.repo";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/appConfig";
import { httpError } from "../middleware/error";
import { createLimiter, tooManyMessage } from "../middleware/rateLimit";
import { makeUploader, uploadedUrl } from "../utils/upload";
import { PASSWORD_MSG, PASSWORD_RULES, ONLY_ALNUM, passwordError } from "../utils/password";
import { normalizePhone, normalizeEmail, EMAIL_REGEX } from "../utils/helpers";
import type { AuthedRequest } from "../types/auth";

// Batas percobaan: 8x salah login / 5x salah lupa-password per 15 menit (per IP + email)
const loginLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const resetLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const limiterKey = (req: Request, email: string): string => `${req.ip}|${email}`;

// ---------- Helper ----------
function publicUser(u: User): Omit<User, "password" | "tokenVersion"> {
  const { password, tokenVersion, ...rest } = u;
  return rest;
}

function signToken(user: Pick<User, "id" | "name" | "email" | "role"> & { tokenVersion?: number }): string {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, tv: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ---------- Foto profil ----------
// Disimpan di MySQL (tabel media_files), BUKAN di disk -> aman untuk Vercel (disk read-only).
// Hanya JPG/PNG/WEBP, maksimal 8MB.
export const uploadAvatar: RequestHandler[] = makeUploader("avatars", /^\.(jpe?g|png|webp)$/i).single("avatar");

// ---------- Handler ----------

// GET /api/auth/password-policy
export function passwordPolicy(_req: Request, res: Response): void {
  res.json({ policy: PASSWORD_RULES, message: PASSWORD_MSG });
}

// POST /api/auth/register
export async function register(req: Request, res: Response): Promise<void> {
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
  const user: User = {
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

  // Email dijaga UNIQUE oleh MySQL, jadi dua pendaftaran bersamaan tidak bisa lolos dua-duanya.
  try {
    await repo.createUser(user);
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      throw httpError(409, "Email sudah terdaftar. Silakan login atau gunakan lupa password.");
    }
    throw err;
  }

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) throw httpError(400, "Email dan password wajib diisi.");

  const key = limiterKey(req, email);
  const wait = loginLimiter.blockedFor(key);
  if (wait) throw httpError(429, tooManyMessage(wait));

  const user = await repo.findByEmail(email);
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
}

// POST /api/auth/logout   — keluar (token yang dipakai langsung tidak berlaku lagi)
export async function logout(req: Request, res: Response): Promise<void> {
  await repo.revokeToken(req.token as string, req.tokenExp);
  res.json({ success: true, message: "Berhasil logout." });
}

// POST /api/auth/reset-password   — LUPA PASSWORD
// Body: { email, phone, newPassword, confirmPassword? }
// Akun hanya bisa direset kalau email DAN nomor HP cocok dengan data saat daftar.
export async function resetPassword(req: Request, res: Response): Promise<void> {
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
  const user = await repo.findByEmail(email);
  const savedPhone = user ? normalizePhone(user.phone) : "";
  if (!user || user.role === "admin" || !savedPhone || savedPhone !== normalizePhone(phone)) {
    resetLimiter.fail(key);
    throw httpError(400, GENERIC);
  }
  if (await bcrypt.compare(String(newPassword), user.password)) {
    throw httpError(400, "Password baru tidak boleh sama dengan password lama.");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  // Versi token dinaikkan -> semua sesi login lama otomatis keluar.
  await repo.updatePassword(user.id, hashed);
  resetLimiter.clear(key);
  res.json({
    success: true,
    message: "Password berhasil diganti. Silakan login dengan password baru.",
  });
}

// POST /api/auth/change-password   — ganti password saat sudah login
// Body: { currentPassword, newPassword, confirmPassword? }
export async function changePassword(req: Request, res: Response): Promise<void> {
  const { user: authUser } = req as AuthedRequest;
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw httpError(400, "Password lama dan password baru wajib diisi.");
  }
  const pwErr = passwordError(newPassword);
  if (pwErr) throw httpError(400, pwErr);
  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    throw httpError(400, "Konfirmasi password tidak sama dengan password baru.");
  }

  const key = limiterKey(req, `chg:${authUser.id}`);
  const wait = resetLimiter.blockedFor(key);
  if (wait) throw httpError(429, tooManyMessage(wait));

  const user = await repo.findById(authUser.id);
  if (!user) throw httpError(404, "User tidak ditemukan.");
  if (!(await bcrypt.compare(String(currentPassword), user.password))) {
    resetLimiter.fail(key);
    throw httpError(400, "Password lama salah.");
  }
  if (currentPassword === newPassword) {
    throw httpError(400, "Password baru tidak boleh sama dengan password lama.");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  const updated = await repo.updatePassword(user.id, hashed);
  if (!updated) throw httpError(404, "User tidak ditemukan.");
  resetLimiter.clear(key);
  // Token baru diberikan supaya perangkat ini tetap login, perangkat lain keluar.
  res.json({
    success: true,
    message: "Password berhasil diganti.",
    token: signToken(updated),
    user: publicUser(updated),
  });
}

// GET /api/auth/me
export async function me(req: Request, res: Response): Promise<void> {
  const { user: authUser } = req as AuthedRequest;
  const user = await repo.findById(authUser.id);
  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan." });
    return;
  }
  res.json({ user: publicUser(user) });
}

// POST /api/auth/me/avatar  (multipart, field: avatar)
export async function saveAvatar(req: Request, res: Response): Promise<void> {
  const { user: authUser } = req as AuthedRequest;
  if (!req.file) throw httpError(400, "File foto wajib dipilih.");
  const newUrl = uploadedUrl(req.file, "avatars");

  const current = await repo.findById(authUser.id);
  if (!current) throw httpError(404, "User tidak ditemukan.");
  await repo.setAvatar(authUser.id, newUrl);

  const user = (await repo.findById(authUser.id)) as User;
  res.json({ message: "Foto profil diperbarui.", user: publicUser(user) });
}

// DELETE /api/auth/me/avatar
export async function removeAvatar(req: Request, res: Response): Promise<void> {
  const { user: authUser } = req as AuthedRequest;
  const current = await repo.findById(authUser.id);
  if (!current) throw httpError(404, "User tidak ditemukan.");
  await repo.setAvatar(authUser.id, null);

  const user = (await repo.findById(authUser.id)) as User;
  res.json({ message: "Foto profil dihapus.", user: publicUser(user) });
}