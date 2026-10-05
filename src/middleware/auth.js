const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "asmorobangun-dev-secret-change-me";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Kamu harus login untuk melakukan ini." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sesi login tidak valid atau sudah kedaluwarsa." });
  }
}

// Attaches req.user if a valid token is present, but doesn't block the request otherwise.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // ignore invalid token, just continue unauthenticated
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

module.exports = { requireAuth, optionalAuth, requireAdmin, JWT_SECRET };
