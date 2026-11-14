// ===========================================================================
// MIDDLEWARE ERROR — satu tempat untuk menangani semua error.
// ===========================================================================
import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface HttpError extends Error {
  status?: number;
}

// Bungkus handler async supaya error-nya masuk ke errorHandler (tidak bikin server crash).
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Buat error dengan kode HTTP, contoh: throw httpError(404, "Data tidak ditemukan.")
export function httpError(status: number, message: string): HttpError {
  const err: HttpError = new Error(message);
  err.status = status;
  return err;
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.` });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  if (err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Ukuran file terlalu besar (maksimal 8MB)." : err.message;
    res.status(400).json({ error: msg });
    return;
  }
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: "Format JSON yang dikirim tidak valid." });
    return;
  }

  const status: number = err.status || 500;
  if (status >= 500) {
    console.error(err);
    // Catat ke tabel error_logs supaya muncul di lonceng notifikasi admin.
    // Kalau pencatatan gagal (mis. database mati), abaikan saja agar tidak berantai.
    try {
      require("../database/errorlog.repo")
        .add({
          source: "backend",
          message: err.message || "Terjadi kesalahan pada server.",
          path: `${req.method} ${req.originalUrl}`,
          status,
          detail: err.stack,
        })
        .catch(() => {});
    } catch (_) {
      /* abaikan */
    }
  }
  res.status(status).json({ error: err.message || "Terjadi kesalahan pada server." });
}