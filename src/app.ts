// ===========================================================================
// APLIKASI EXPRESS — pasang middleware, file statis, dan semua route.
// ===========================================================================
import express from "express";
import cors from "cors";
import path from "path";
import type { NextFunction, Request, Response } from "express";

import { CORS_ORIGINS, NODE_ENV } from "./config/appConfig";
import { absoluteUrls } from "./middleware/absoluteUrls";
import { notFound, errorHandler, asyncHandler } from "./middleware/error";
import * as media from "./database/media.repo";
import apiRoutes from "./routes";

const app = express();

app.disable("x-powered-by"); // jangan beri tahu penyerang bahwa ini Express
app.set("trust proxy", 1); // di balik proxy (Vercel/hosting) supaya req.ip = IP asli pengguna

// Header keamanan dasar
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  next();
});

if (NODE_ENV === "production" && CORS_ORIGINS.length === 0) {
  console.warn("⚠️  CORS_ORIGINS kosong di production: semua website boleh memanggil API. Isi dengan alamat frontend kamu.");
}
app.use(cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : undefined));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Foto/file upload: dibaca dari MySQL dulu. Kalau tidak ada di MySQL, baru dari folder uploads/.
app.get(
  "/uploads/:folder/:filename",
  asyncHandler(async (req, res, next) => {
    const { folder, filename } = req.params;
    if (!media.FOLDERS.includes(folder)) return next();
    const row = await media.find(folder, filename);
    if (!row) return next();
    res.set({
      "Content-Type": row.mime,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(row.data);
  })
);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/app/assets", express.static(path.join(__dirname, "..", "public", "assets")));

// Semua endpoint ada di /api
app.use("/api", absoluteUrls, apiRoutes);
app.use(notFound);
app.use(errorHandler);

export = app;