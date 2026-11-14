// ===========================================================================
// CONTROLLER AUTH — daftar, login, logout, lupa/ganti password, profil, foto profil.
// ===========================================================================
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/appConfig";
import * as users from "../database/users.repo";
import type { User } from "../database/users.repo";
import { httpError } from "../middleware/error";
import { createLimiter, tooManyMessage } from "../middleware/rateLimit";
import { EMAIL_REGEX, normalizeEmail, normalizePhone } from "../utils/helpers";
import { ONLY_ALNUM, PASSWORD_RULES, passwordError } from "../utils/password";
import { makeUploader, uploadedUrl } from "../utils/upload";
import { currentUser, newId, requiredText } from "./common";

const loginLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const resetLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

const BAD_LOGIN = "Email atau password salah.";

function signToken(user: User): string {
  return jwt.sign({ id: user.id, tv: user.tokenVersion || 0 }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Data akun yang aman dikirim ke klien (tanpa password).
function publicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, avatar: u.avatar, createdAt: u.createdAt };
}

function validatePhone(raw: unknown): string {
  const phone = normalizePhone(raw);
  if (!/^0\d{8,14}$/.test(phone)) throw httpError(400, "Nomor HP tidak valid (contoh: 081234567890).");
  return phone;
}

// GET /api/auth/password-policy
export function passwordPolicy(_req: Request, res: Response): void {
  res.json(PASSWORD_RULES);
}

// POST /api/auth/register  { name, email, phone, password, confirmPassword? }
export async function register(req: Request, res: Response): Promise<void> {
  const body = req.body || {};
  const name = requiredText(body.name, "Nama", 100);
  const email = normalizeEmail(body.email);
  if (!EMAIL_REGEX.test(email) || email.length > 190) throw httpError(400, "Format email tidak valid.");
  const phone = validatePhone(body.phone);

  const pwError = passwordError(body.password);
  if (pwError) throw httpError(400, pwError);
  if (body.confirmPassword !== undefined && body.confirmPassword !== body.password) {
    throw httpError(400, "Konfirmasi password tidak sama.");
  }

  if (await users.findByEmail(email)) throw httpError(409, "Email sudah terdaftar.");

  const user: User = {
    id: newId("u"),
    name,
    email,
    phone,
    password: await bcrypt.hash(body.password, 10),
    role: "member", // admin tidak bisa dibuat lewat pendaftaran
    avatar: null,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
  };
  try {
    await users.createUser(user);
  } catch (e: any) {
    if (e.code === "ER_DUP_ENTRY") throw httpError(409, "Email sudah terdaftar.");
    throw e;
  }
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

// POST /api/auth/login  { email, password }
export async function login(req: Request, res: Response): Promise<void> {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || typeof password !== "string" || !password) throw httpError(400, "Email dan password wajib diisi.");

  const key = `${req.ip}|${email}`;
  const wait = loginLimiter.blockedFor(key);
  if (wait) throw httpError(429, tooManyMessage(wait));

  const user = await users.findByEmail(email);
  // Akun pengguna biasa: password berisi simbol pasti salah (aturan password hanya huruf & angka).
  const formatOk = !user || user.role === "admin" || ONLY_ALNUM.test(password);
  const valid = !!user && formatOk && (await bcrypt.compare(password, user.password));
  if (!user || !valid) {
    loginLimiter.fail(key);
    throw httpError(401, BAD_LOGIN);
  }
  loginLimiter.clear(key);
  res.json({ token: signToken(user), user: publicUser(user) });
}

// POST /api/auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  if (req.token) await users.revokeToken(req.token, req.tokenExp);
  res.json({ message: "Kamu sudah keluar." });
}

// POST /api/auth/reset-password  { email, phone, newPassword, confirmPassword? }
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  if (!email || !phone) throw httpError(400, "Email dan nomor HP wajib diisi.");

  const key = `${req.ip}|reset`;
  const wait = resetLimiter.blockedFor(key);
  if (wait) throw httpError(429, tooManyMessage(wait));

  const pwError = passwordError(body.newPassword);
  if (pwError) throw httpError(400, pwError);
  if (body.confirmPassword !== undefined && body.confirmPassword !== body.newPassword) {
    throw httpError(400, "Konfirmasi password tidak sama.");
  }

  const user = await users.findByEmail(email);
  if (!user || normalizePhone(user.phone) !== phone) {
    resetLimiter.fail(key);
    throw httpError(400, "Email atau nomor HP tidak cocok dengan data saat mendaftar.");
  }
  resetLimiter.clear(key);
  await users.updatePassword(user.id, await bcrypt.hash(body.newPassword, 10));
  res.json({ message: "Password berhasil diganti. Silakan login dengan password baru." });
}

// POST /api/auth/change-password  { currentPassword, newPassword, confirmPassword? }
export async function changePassword(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  const body = req.body || {};
  const user = await users.findById(me.id);
  if (!user) throw httpError(404, "Akun tidak ditemukan.");

  if (typeof body.currentPassword !== "string" || !(await bcrypt.compare(body.currentPassword, user.password))) {
    throw httpError(400, "Password saat ini salah.");
  }
  const pwError = passwordError(body.newPassword);
  if (pwError) throw httpError(400, pwError);
  if (body.confirmPassword !== undefined && body.confirmPassword !== body.newPassword) {
    throw httpError(400, "Konfirmasi password tidak sama.");
  }
  if (body.newPassword === body.currentPassword) throw httpError(400, "Password baru harus berbeda dari yang lama.");

  const updated = await users.updatePassword(user.id, await bcrypt.hash(body.newPassword, 10));
  if (!updated) throw httpError(404, "Akun tidak ditemukan.");
  // Token lama sudah tidak berlaku (versi token naik); beri token baru supaya pengguna tetap masuk.
  res.json({ message: "Password berhasil diganti.", token: signToken(updated), user: publicUser(updated) });
}

// GET /api/auth/me
export async function me(req: Request, res: Response): Promise<void> {
  const user = await users.findById(currentUser(req.user).id);
  if (!user) throw httpError(404, "Akun tidak ditemukan.");
  res.json({ user: publicUser(user) });
}

// Middleware upload foto profil (field form-data: avatar)
export const uploadAvatar = makeUploader("avatars", /^\.(jpe?g|png|webp|gif)$/i).single("avatar");

// POST /api/auth/me/avatar
export async function saveAvatar(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  if (!req.file) throw httpError(400, "File foto wajib diunggah (field: avatar).");
  await users.setAvatar(me.id, uploadedUrl(req.file, "avatars"));
  const user = await users.findById(me.id);
  res.json({ user: publicUser(user as User) });
}

// DELETE /api/auth/me/avatar
export async function removeAvatar(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  await users.setAvatar(me.id, null);
  const user = await users.findById(me.id);
  res.json({ user: publicUser(user as User) });
}
