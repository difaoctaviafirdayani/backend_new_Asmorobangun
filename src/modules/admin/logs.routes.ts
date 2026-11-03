// ===========================================================================
// NOTIFIKASI ERROR — Base URL: /api/logs
//   POST   /logs        kirim catatan error (dari admin / aplikasi user). Terbuka, dibatasi laju.
//   GET    /logs        daftar error + jumlah belum dibaca        (admin)
//   POST   /logs/read   tandai semua sudah dibaca                 (admin)
//   DELETE /logs        hapus semua catatan                       (admin)
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import { createLimiter } from "../../middleware/rateLimit";
import * as logs from "../../database/errorlog.repo";

const router = Router();
const limiter = createLimiter({ windowMs: 60 * 1000, max: 30 }); // maks 30 laporan / menit / IP

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const key = req.ip || "unknown";
    if (limiter.blockedFor(key)) {
      res.status(429).json({ error: "Terlalu banyak laporan." });
      return;
    }
    limiter.fail(key);

    const { source, message, path, status, detail } = req.body || {};
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message wajib diisi." });
      return;
    }
    // Dari luar hanya boleh "admin" atau "user"; "backend" hanya dicatat server sendiri.
    const src = source === "admin" ? "admin" : "user";
    await logs.add({ source: src, message, path, status, detail });
    res.status(201).json({ ok: true });
  })
);

router.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await logs.list(50));
  })
);

router.post(
  "/read",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    await logs.markAllRead();
    res.json({ message: "Semua notifikasi ditandai sudah dibaca." });
  })
);

router.delete(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    await logs.clear();
    res.json({ message: "Semua notifikasi dihapus." });
  })
);

export default router;