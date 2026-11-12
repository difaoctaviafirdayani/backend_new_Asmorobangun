// ===========================================================================
// MYSQL — koneksi ke MySQL di web, pembuatan tabel otomatis, dan migrasi akun lama.
// Database harus sudah dibuat dari panel hosting (phpMyAdmin / dashboard).
// ===========================================================================
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import { DB } from "../config/env";
import { readDB } from "./db";

// Bentuk koneksi yang dipakai repository. Hasil query dibuat longgar (any)
// supaya setiap repository tidak perlu menulis tipe baris satu per satu.
export interface Conn {
  query(sql: string, params?: unknown[]): Promise<[any, any]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}
export interface Db {
  query(sql: string, params?: unknown[]): Promise<[any, any]>;
  getConnection(): Promise<Conn>;
}

let pool: Pool | null = null;

// Error koneksi yang aman untuk diulang satu kali (koneksi putus sebelum query jalan)
const RETRYABLE = new Set(["ECONNRESET", "PROTOCOL_CONNECTION_LOST", "EPIPE"]);

export function getPool(): Db {
  if (!pool) throw new Error("MySQL belum terhubung. Pastikan initMysql() sudah dipanggil.");
  const p = pool;
  return {
    async query(sql: string, params?: unknown[]): Promise<[any, any]> {
      try {
        return (await p.query(sql, params as any)) as unknown as [any, any];
      } catch (e: any) {
        if (RETRYABLE.has(e?.code)) {
          // Koneksi mati dibuang pool, ulangi sekali dengan koneksi baru
          return (await p.query(sql, params as any)) as unknown as [any, any];
        }
        throw e;
      }
    },
    getConnection: () => p.getConnection() as unknown as Promise<Conn>,
  };
}

export async function initMysql(): Promise<void> {
  pool = mysql.createPool({
    host: DB.HOST,
    port: DB.PORT,
    user: DB.USER,
    password: DB.PASSWORD,
    database: DB.NAME,
    waitForConnections: true,
    connectionLimit: 10, // dinaikkan agar request Flutter yang paralel tidak berebut
    maxIdle: 10,
    idleTimeout: 30000, // buang koneksi idle sebelum MySQL memutusnya
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 15000,
    timezone: "Z", // simpan & baca waktu sebagai UTC
    charset: "utf8mb4",
    ssl: DB.SSL ? { rejectUnauthorized: false } : undefined,
  });
  const db = getPool();

  // Tes koneksi
  await db.query("SELECT 1");

  // Buat tabel kalau belum ada
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            VARCHAR(30)  NOT NULL PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      email         VARCHAR(190) NOT NULL,
      phone         VARCHAR(20)  NULL,
      password      VARCHAR(255) NOT NULL,
      role          ENUM('admin','member') NOT NULL DEFAULT 'member',
      avatar        VARCHAR(255) NULL,
      token_version INT          NOT NULL DEFAULT 0,
      created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Daftar token yang sudah logout (supaya token itu tidak bisa dipakai lagi)
  await db.query(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_hash CHAR(64)    NOT NULL PRIMARY KEY,
      expires_at DATETIME(3) NOT NULL,
      KEY idx_revoked_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await migrateUsersFromJson();
  await require("./content.repo").init();
  await require("./layanan.repo").init();
  await require("./registrasi.repo").init();
  await require("./forum.repo").init();
  await require("./media.repo").init();
  await require("./errorlog.repo").init();
  await require("./ai.repo").init(); // hasil AI (Gemini) + status verifikasi admin
  await require("./push.repo").init(); // token perangkat untuk push notification
  console.log(`MySQL terhubung: ${DB.USER}@${DB.HOST}:${DB.PORT}/${DB.NAME}`);
}

// Pindahkan akun dari data/db.json ke MySQL (hanya jika tabel users masih kosong).
async function migrateUsersFromJson(): Promise<void> {
  const db = getPool();
  const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM users");
  if (total > 0) return;

  let jsonUsers: any[] = [];
  try {
    jsonUsers = readDB().users || [];
  } catch {
    return;
  }

  let masuk = 0;
  for (const u of jsonUsers) {
    if (!u.email || !u.password) continue;
    const [result] = await db.query(
      `INSERT IGNORE INTO users
        (id, name, email, phone, password, role, avatar, token_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u.id,
        u.name || "Tanpa Nama",
        String(u.email).trim().toLowerCase(),
        u.phone || null,
        u.password,
        u.role === "admin" ? "admin" : "member",
        u.avatar || null,
        u.tokenVersion || 0,
        new Date(u.createdAt || Date.now()),
      ]
    );
    masuk += result.affectedRows;
  }
  console.log(`Migrasi akun dari db.json -> MySQL: ${masuk} akun dipindahkan.`);
}