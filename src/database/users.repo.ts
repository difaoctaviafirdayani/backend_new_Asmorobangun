// ===========================================================================
// REPOSITORY USER — semua query MySQL untuk akun + token logout.
// ===========================================================================
import crypto from "crypto";
import { getPool } from "./mysql";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password: string;
  role: "admin" | "member";
  avatar: string | null;
  tokenVersion: number;
  createdAt: string;
}

export type NewUser = Omit<User, "tokenVersion"> & { tokenVersion?: number };

function rowToUser(r: any): User | null {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    password: r.password,
    role: r.role,
    avatar: r.avatar,
    tokenVersion: r.token_version,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

export async function findByEmail(email: string): Promise<User | null> {
  const [rows] = await getPool().query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rowToUser(rows[0]);
}

export async function findById(id: string): Promise<User | null> {
  const [rows] = await getPool().query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return rowToUser(rows[0]);
}

// Lempar error dengan code "ER_DUP_ENTRY" kalau email sudah terdaftar.
export async function createUser(u: NewUser): Promise<void> {
  await getPool().query(
    `INSERT INTO users (id, name, email, phone, password, role, avatar, token_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [u.id, u.name, u.email, u.phone, u.password, u.role, u.avatar, u.tokenVersion || 0, new Date(u.createdAt)]
  );
}

// Ganti password + naikkan versi token (semua sesi lama otomatis keluar).
export async function updatePassword(id: string, hashedPassword: string): Promise<User | null> {
  await getPool().query(
    "UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?",
    [hashedPassword, id]
  );
  return findById(id);
}

export async function setAvatar(id: string, avatarUrl: string | null): Promise<void> {
  await getPool().query("UPDATE users SET avatar = ? WHERE id = ?", [avatarUrl, id]);
}

// Untuk dashboard admin
export async function getMemberStats(startOfMonth: Date | string): Promise<{ total: number; newThisMonth: number }> {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(created_at >= ?), 0) AS new_this_month
       FROM users WHERE role <> 'admin'`,
    [startOfMonth]
  );
  return { total: Number(rows[0].total), newThisMonth: Number(rows[0].new_this_month) };
}

// ---------- Logout: token yang dicabut ----------
const hashToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

export async function revokeToken(token: string, expSeconds?: number): Promise<void> {
  const pool = getPool();
  const expiresAt = new Date((expSeconds || Math.floor(Date.now() / 1000) + 7 * 86400) * 1000);
  await pool.query("INSERT IGNORE INTO revoked_tokens (token_hash, expires_at) VALUES (?, ?)", [
    hashToken(token),
    expiresAt,
  ]);
  // Bersihkan token yang memang sudah kedaluwarsa
  await pool.query("DELETE FROM revoked_tokens WHERE expires_at < UTC_TIMESTAMP(3)");
}

export async function isTokenRevoked(token: string): Promise<boolean> {
  const [rows] = await getPool().query("SELECT 1 FROM revoked_tokens WHERE token_hash = ? LIMIT 1", [
    hashToken(token),
  ]);
  return rows.length > 0;
}