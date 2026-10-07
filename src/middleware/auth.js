// ===========================================================================
// MIDDLEWARE AUTH — cek token login (JWT) dan hak akses admin.
// ===========================================================================
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { readDB } = require("../database/db");

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Verifikasi token DAN pastikan akunnya masih ada + token belum dicabut
// (token lama otomatis tidak berlaku setelah password diganti).
function resolveUser(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  const user = readDB().users.find((u) => u.id === payload.id);
  if (!user) return null;
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Kamu harus login untuk melakukan ini." });
  try {
    const user = resolveUser(token);
    if (!user) return res.status(401).json({ error: "Sesi login sudah tidak berlaku. Silakan login ulang." });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sesi login tidak valid atau sudah kedaluwarsa." });
  }
}

// Menempelkan req.user kalau token valid, tapi tidak memblokir kalau tidak login.
function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (token) {
    try {
      const user = resolveUser(token);
      if (user) req.user = user;
    } catch (err) {
      // token tidak valid -> dianggap belum login
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Khusus admin sanggar." });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
