// ===========================================================================
// REPOSITORY USER — semua query MySQL untuk akun + token logout.
// ===========================================================================
const crypto = require("crypto");
const { getPool } = require("./mysql");

function rowToUser(r) {
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

async function findByEmail(email) {
  const [rows] = await getPool().query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rowToUser(rows[0]);
}

async function findById(id) {
  const [rows] = await getPool().query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return rowToUser(rows[0]);
}

// Lempar error dengan code "ER_DUP_ENTRY" kalau email sudah terdaftar.
async function createUser(u) {
  await getPool().query(
    `INSERT INTO users (id, name, email, phone, password, role, avatar, token_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [u.id, u.name, u.email, u.phone, u.password, u.role, u.avatar, u.tokenVersion || 0, new Date(u.createdAt)]
  );
}

// Ganti password + naikkan versi token (semua sesi lama otomatis keluar).
async function updatePassword(id, hashedPassword) {
  await getPool().query(
    "UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?",
    [hashedPassword, id]
  );
  return findById(id);
}

async function setAvatar(id, avatarUrl) {
  await getPool().query("UPDATE users SET avatar = ? WHERE id = ?", [avatarUrl, id]);
}

// Untuk dashboard admin
async function getMemberStats(startOfMonth) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(created_at >= ?), 0) AS new_this_month
       FROM users WHERE role <> 'admin'`,
    [startOfMonth]
  );
  return { total: Number(rows[0].total), newThisMonth: Number(rows[0].new_this_month) };
}

// ---------- Logout: token yang dicabut ----------
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

async function revokeToken(token, expSeconds) {
  const pool = getPool();
  const expiresAt = new Date((expSeconds || Math.floor(Date.now() / 1000) + 7 * 86400) * 1000);
  await pool.query("INSERT IGNORE INTO revoked_tokens (token_hash, expires_at) VALUES (?, ?)", [
    hashToken(token),
    expiresAt,
  ]);
  // Bersihkan token yang memang sudah kedaluwarsa
  await pool.query("DELETE FROM revoked_tokens WHERE expires_at < UTC_TIMESTAMP(3)");
}

async function isTokenRevoked(token) {
  const [rows] = await getPool().query("SELECT 1 FROM revoked_tokens WHERE token_hash = ? LIMIT 1", [
    hashToken(token),
  ]);
  return rows.length > 0;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updatePassword,
  setAvatar,
  getMemberStats,
  revokeToken,
  isTokenRevoked,
};