// ===========================================================================
// APLIKASI EXPRESS — pasang middleware, file statis, dan semua route.
// ===========================================================================
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";

import { CORS_ORIGINS, NODE_ENV } from "./config/appConfig";
import { absoluteUrls } from "./middleware/absoluteUrls";
import { notFound, errorHandler, asyncHandler } from "./middleware/error";
import * as media from "./database/media.repo";
import apiRoutes from "./routes";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1); // di balik proxy (hosting) supaya req.ip = IP asli pengguna

// Header keamanan (HSTS, nosniff, dll.)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // gambar /uploads harus bisa dimuat dari frontend lain
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
  }),
);

// Log setiap request: method, path, status, durasi (health check tidak dicatat)
app.use(
  morgan(NODE_ENV === "production" ? "combined" : "dev", {
    skip: (req) => req.originalUrl.startsWith("/api/health"),
  }),
);

if (NODE_ENV === "production" && CORS_ORIGINS.length === 0) {
  console.warn(
    "⚠️  CORS_ORIGINS kosong di production: semua website boleh memanggil API. Isi dengan alamat frontend kamu.",
  );
}
app.use(cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : undefined));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Batas umum untuk semua endpoint /api (login & AI punya batas sendiri yang lebih ketat).
// Disimpan di memori: reset kalau server restart.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600, // per IP per 15 menit. Naikkan kalau banyak pengguna berbagi satu IP (WiFi kampus)
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/health"),
  message: { error: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi." },
});

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
  }),
);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(
  "/app/assets",
  express.static(path.join(__dirname, "..", "public", "assets")),
);

// Semua endpoint ada di /api
app.use("/api", apiLimiter, absoluteUrls, apiRoutes);
app.use(notFound);
app.use(errorHandler);

export = app;