// ===========================================================================
// MYSQL — koneksi ke MySQL di web, pembuatan tabel otomatis, dan migrasi akun lama.
// Database harus sudah dibuat dari panel hosting (phpMyAdmin / dashboard).
// ===========================================================================
const mysql = require("mysql2/promise");
const { DB } = require("../config/env");

let pool = null;

function getPool() {
  if (!pool) throw new Error("MySQL belum terhubung. Pastikan initMysql() sudah dipanggil.");
  return pool;
}

async function initMysql() {
  pool = mysql.createPool({
    host: DB.HOST,
    port: DB.PORT,
    user: DB.USER,
    password: DB.PASSWORD,
    database: DB.NAME,
    waitForConnections: true,
    connectionLimit: 5, // hosting gratis biasanya membatasi jumlah koneksi
    connectTimeout: 15000,
    timezone: "Z", // simpan & baca waktu sebagai UTC
    charset: "utf8mb4",
    ssl: DB.SSL ? { rejectUnauthorized: false } : undefined,
  });

  // Tes koneksi
  await pool.query("SELECT 1");

  // Buat tabel kalau belum ada
  await pool.query(`
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
  await pool.query(`
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
  console.log(`MySQL terhubung: ${DB.USER}@${DB.HOST}:${DB.PORT}/${DB.NAME}`);
}

// Pindahkan akun dari data/db.json ke MySQL (hanya jika tabel users masih kosong).
async function migrateUsersFromJson() {
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM users");
  if (total > 0) return;

  const { readDB } = require("./db");
  let jsonUsers = [];
  try {
    jsonUsers = readDB().users || [];
  } catch (e) {
    return;
  }

  let masuk = 0;
  for (const u of jsonUsers) {
    if (!u.email || !u.password) continue;
    const [result] = await pool.query(
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

module.exports = { initMysql, getPool };