// ===========================================================================
// UPLOAD FILE (multer) — foto topeng, galeri, bukti pembayaran, dll.
// File diterima di memori lalu DISIMPAN KE MySQL (lihat database/media.repo.ts).
// req.file.filename berisi nama file, URL-nya /uploads/<subfolder>/<nama file>.
// ===========================================================================
import multer from "multer";
import path from "path";
import { nanoid } from "nanoid";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import * as media from "../database/media.repo";
import { httpError } from "../middleware/error";

export function makeUploader(
  subfolder: string,
  allowed: RegExp = /^\.(jpe?g|png|webp|gif|pdf)$/i
): { single: (field: string) => RequestHandler[] } {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    fileFilter: (_req, file, cb) => {
      if (allowed.test(path.extname(file.originalname))) cb(null, true);
      else cb(httpError(400, "Format file tidak didukung."));
    },
  });

  // Setelah multer membaca file, simpan ke MySQL dan isi req.file.filename.
  const persist = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) return next();
    try {
      const ext = (path.extname(req.file.originalname) || "").toLowerCase();
      const filename = `${Date.now()}-${nanoid(8)}${ext}`;
      await media.save(subfolder, filename, req.file.buffer);
      req.file.filename = filename;
      next();
    } catch (err: any) {
      if (err.code === "ER_NET_PACKET_TOO_LARGE") {
        err.status = 413;
        err.message = "File terlalu besar untuk MySQL (max_allowed_packet). Perkecil ukuran foto.";
      }
      next(err);
    }
  };

  // Dipakai di route seperti sebelumnya: uploader.single("image")
  return { single: (field) => [parser.single(field), persist as RequestHandler] };
}