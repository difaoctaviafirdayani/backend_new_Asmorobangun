// ===========================================================================
// APLIKASI EXPRESS — pasang middleware, file statis, dan semua route.
// ===========================================================================
const express = require("express");
const cors = require("cors");
const path = require("path");

const { CORS_ORIGINS } = require("./config/env");
const { absoluteUrls } = require("./middleware/absoluteUrls");
const { notFound, errorHandler, asyncHandler } = require("./middleware/error");
const media = require("./database/media.repo");
const apiRoutes = require("./routes");

const app = express();

app.use(cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : undefined));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Foto/file upload: dibaca dari MySQL dulu (supaya sama di semua laptop yang
// memakai database yang sama). Kalau tidak ada di MySQL, baru dari folder uploads/
// (mis. foto profil).
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

module.exports = app;