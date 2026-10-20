// ===========================================================================
// MIDDLEWARE AUTH — cek token login (JWT) dan hak akses admin.
// Data akun sekarang dibaca dari MySQL.
// ===========================================================================
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { findById, isTokenRevoked } = require("../database/users.repo");

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Verifikasi token, pastikan belum logout, akunnya masih ada, dan token belum dicabut
// (token lama otomatis tidak berlaku setelah password diganti).
async function resolveUser(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (await isTokenRevoked(token)) return null; // sudah logout
  const user = await findById(payload.id);
  if (!user) return null;
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) return null;
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    exp: payload.exp,
  };
}

async function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Kamu harus login untuk melakukan ini." });
  try {
    const resolved = await resolveUser(token);
    if (!resolved) {
      return res.status(401).json({ error: "Sesi login sudah tidak berlaku. Silakan login ulang." });
    }
    req.user = resolved.user;
    req.token = token;
    req.tokenExp = resolved.exp;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" || err.name === "NotBeforeError") {
      return res.status(401).json({ error: "Sesi login tidak valid atau sudah kedaluwarsa." });
    }
    next(err); // error lain (misal MySQL mati) -> errorHandler
  }
}

// Menempelkan req.user kalau token valid, tapi tidak memblokir kalau tidak login.
async function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (token) {
    try {
      const resolved = await resolveUser(token);
      if (resolved) {
        req.user = resolved.user;
        req.token = token;
        req.tokenExp = resolved.exp;
      }
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