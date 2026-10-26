import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { nanoid } from 'nanoid';

// GANTI kalau nama kolom password di tabel users-mu berbeda (cek tab Structure).
const PASSWORD_COL = 'password';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string;
  password?: string;
  created_at?: Date;
}

export interface UserRow extends RowDataPacket, User {}

/** Cari user berdasarkan email (untuk login). Mengembalikan hash password. */
export const findUserByEmail = async (email: string): Promise<User | null> => {
  const query = `SELECT id, name, email, phone, role, ${PASSWORD_COL} AS password FROM users WHERE email = ? LIMIT 1`;
  const [rows] = await pool.execute<UserRow[]>(query, [email]);
  if (!rows || rows.length === 0) return null;
  return rows[0];
};

/** Cari user berdasarkan ID, tanpa password. */
export const findUserById = async (id: string): Promise<Omit<User, 'password'> | null> => {
  const query = 'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1';
  const [rows] = await pool.execute<UserRow[]>(query, [id]);
  if (!rows || rows.length === 0) return null;
  const { password, ...userWithoutPassword } = rows[0];
  return userWithoutPassword;
};

/** Simpan user baru. `password` HARUS sudah di-hash dengan bcrypt sebelum dipanggil. */
export const createUser = async (
  user: Omit<User, 'id' | 'created_at'> & { password: string }
): Promise<string> => {
  const id = `u-${nanoid(8)}`;
  const query = `INSERT INTO users (id, name, email, phone, role, ${PASSWORD_COL}) VALUES (?, ?, ?, ?, ?, ?)`;
  await pool.execute<ResultSetHeader>(query, [
    id,
    user.name,
    user.email,
    user.phone ?? null,
    user.role ?? 'member',
    user.password,
  ]);
  return id;
};