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

type Kind = "jpg" | "png" | "gif" | "webp" | "pdf";

/** Kenali jenis file dari ISI-nya (beberapa byte pertama) */
function sniff(buf: Buffer): Kind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  const head6 = buf.toString("latin1", 0, 6);
  if (head6 === "GIF87a" || head6 === "GIF89a") return "gif";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (buf.toString("latin1", 0, 4) === "%PDF") return "pdf";
  return null;
}

const KINDS: Kind[] = ["jpg", "png", "webp", "gif", "pdf"];

export function makeUploader(
  subfolder: string,
  allowed: RegExp = /^\.(jpe?g|png|webp|gif|pdf)$/i
): { single: (field: string) => RequestHandler[] } {
  const formatMessage = (): string => {
    const names = KINDS.filter((k) => allowed.test("." + k)).map((k) => k.toUpperCase());
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")}, atau ${names[names.length - 1]}` : names.join("");
    return `Gagal upload: format file tidak didukung. Gunakan ${list}.`;
  };

  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (allowed.test(path.extname(file.originalname))) cb(null, true);
      else cb(httpError(400, formatMessage()));
    },
  });

  // Setelah multer membaca file, simpan ke MySQL dan isi req.file.filename.
  const persist = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) return next();
    try {
      // Isi file harus benar-benar format yang diizinkan. Kalau tidak, TOLAK dan jangan simpan.
      const kind = sniff(req.file.buffer);
      if (!kind || !allowed.test("." + kind)) throw httpError(400, formatMessage());

      const filename = `${Date.now()}-${nanoid(8)}.${kind}`;
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