// ===========================================================================
// ERROR LOG — catatan error dari backend, admin, dan aplikasi user (Flutter).
// Dibaca admin lewat lonceng notifikasi di navbar.
// source: "backend" (dicatat otomatis oleh server) | "admin" | "user"
// ===========================================================================
const { getPool } = require("./mysql");
const { TABLE_OPTS, toIso } = require("./table");

const SOURCES = ["backend", "admin", "user"];
const KEEP = 200; // simpan 200 catatan terakhir saja

async function init() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      source     VARCHAR(10)  NOT NULL,
      message    VARCHAR(500) NOT NULL,
      path       VARCHAR(255) NULL,
      status     INT          NULL,
      detail     TEXT         NULL,
      is_read    TINYINT(1)   NOT NULL DEFAULT 0,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_error_logs_created (created_at)
    ) ${TABLE_OPTS}
  `);
}

const cut = (v, n) => (v === undefined || v === null ? null : String(v).slice(0, n));

async function add({ source, message, path, status, detail }) {
  const src = SOURCES.includes(source) ? source : "user";
  const msg = cut(message, 500) || "Terjadi kesalahan.";
  const st = Number.isFinite(Number(status)) && status !== null && status !== "" ? Number(status) : null;
  const pool = getPool();
  await pool.query(
    "INSERT INTO error_logs (source, message, path, status, detail) VALUES (?, ?, ?, ?, ?)",
    [src, msg, cut(path, 255), st, cut(detail, 4000)]
  );
  // Buang catatan lama supaya tabel tidak membengkak.
  const [old] = await pool.query("SELECT id FROM error_logs ORDER BY id DESC LIMIT 1 OFFSET ?", [KEEP - 1]);
  if (old[0]) await pool.query("DELETE FROM error_logs WHERE id < ?", [old[0].id]);
}

async function list(limit = 50) {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM error_logs ORDER BY id DESC LIMIT ?", [Number(limit) || 50]);
  const [[{ unread }]] = await pool.query("SELECT COUNT(*) AS unread FROM error_logs WHERE is_read = 0");
  return {
    unread: Number(unread) || 0,
    logs: rows.map((r) => ({
      id: r.id,
      source: r.source,
      message: r.message,
      path: r.path,
      status: r.status,
      detail: r.detail,
      read: !!r.is_read,
      createdAt: toIso(r.created_at),
    })),
  };
}

async function markAllRead() {
  await getPool().query("UPDATE error_logs SET is_read = 1 WHERE is_read = 0");
}

async function clear() {
  await getPool().query("DELETE FROM error_logs");
}

module.exports = { init, add, list, markAllRead, clear, SOURCES };