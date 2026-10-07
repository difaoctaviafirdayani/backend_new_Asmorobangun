// ===========================================================================
// MIDDLEWARE ERROR — satu tempat untuk menangani semua error.
// ===========================================================================

// Bungkus handler async supaya error-nya masuk ke errorHandler (tidak bikin server crash).
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Buat error dengan kode HTTP, contoh: throw httpError(404, "Data tidak ditemukan.")
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function notFound(req, res) {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Ukuran file terlalu besar (maksimal 8MB)." : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Format JSON yang dikirim tidak valid." });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Terjadi kesalahan pada server." });
}

module.exports = { asyncHandler, httpError, notFound, errorHandler };
