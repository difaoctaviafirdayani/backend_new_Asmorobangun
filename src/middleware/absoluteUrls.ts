// ===========================================================================
// URL GAMBAR LENGKAP — untuk Flutter / HP.
// Default gambar dikirim relatif ("/uploads/site_images/a.png"). Flutter butuh URL lengkap.
// Cara minta: header  X-Absolute-Urls: 1  (atau  ?absoluteUrls=1), atau ABSOLUTE_URLS=true di .env.
// ===========================================================================
import type { NextFunction, Request, Response } from "express";
import { PUBLIC_URL, ABSOLUTE_URLS } from "../config/env";

const PREFIXES = ["/uploads/", "/app/assets/"];

function absolutize(value: unknown, base: string): unknown {
  if (typeof value === "string") {
    return PREFIXES.some((p) => value.startsWith(p)) ? base + value : value;
  }
  if (Array.isArray(value)) return value.map((v) => absolutize(v, base));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value)) out[k] = absolutize((value as Record<string, unknown>)[k], base);
    return out;
  }
  return value;
}

export function absoluteUrls(req: Request, res: Response, next: NextFunction): void {
  const wanted = ABSOLUTE_URLS || req.headers["x-absolute-urls"] === "1" || req.query.absoluteUrls === "1";
  if (!wanted) return next();
  const base = PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const original = res.json.bind(res);
  res.json = (body?: unknown) => original(absolutize(body, base));
  next();
}