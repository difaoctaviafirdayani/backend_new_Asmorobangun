// ===========================================================================
// PETA SEMUA ENDPOINT — mulai cari dari sini.
// Setiap kelompok punya foldernya sendiri di src/modules/<kelompok>/
// ===========================================================================
import { Router } from "express";

import authRoutes from "./auth.routes";
import bookingsRoutes from "./bookings.routes";
import ordersRoutes from "./orders.routes";
import paymentsRoutes from "./payments.routes";
import facilitiesRoutes from "./facilities.routes";
import topengRoutes from "./topeng.routes";
import articlesRoutes from "./articles.routes";
import announcementsRoutes from "./announcements.routes";
import galleryRoutes from "./gallery.routes";
import cultureRoutes from "./culture.routes";
import faqsRoutes from "./faqs.routes";
import forumRoutes from "./forum.routes";
import searchRoutes from "./search.routes";
import chatbotRoutes from "./ai.routes";
import analysisRoutes from "./analysis.routes";
import notificationsRoutes from "./notifications.routes";
import statsRoutes from "./stats.routes";
import uploadsRoutes from "./uploads.routes";
import logsRoutes from "./logs.routes";
import knowledgeRoutes from "./knowledge.routes";
import { asyncHandler } from "../middleware/error";
import { getPool } from "../database/mysql";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, name: "Asmorobangun API" });
});

router.get(
  "/health/db",
  asyncHandler(async (_req, res) => {
    await getPool().query("SELECT 1");
    res.json({ ok: true, db: "up", uptimeSeconds: Math.round(process.uptime()) });
  }),
);

// 1. AKUN ................ src/modules/auth
router.use("/auth", authRoutes);

// 2. REGISTRASI .......... src/modules/registrasi
router.use("/bookings", bookingsRoutes);
router.use("/topeng", ordersRoutes); // pesanan topeng (harus sebelum katalog)
router.use("/payments", paymentsRoutes);

// 3. LAYANAN ............. src/modules/layanan
router.use("/facilities", facilitiesRoutes);
router.use("/topeng", topengRoutes); // katalog topeng

// 4. INFORMASI ........... src/modules/informasi
router.use("/articles", articlesRoutes);
router.use("/announcements", announcementsRoutes);
router.use("/gallery", galleryRoutes);
router.use("/culture", cultureRoutes);
router.use("/faqs", faqsRoutes);

// 5. KOMUNITAS ........... src/modules/komunitas
router.use("/forum", forumRoutes);
router.use("/search", searchRoutes);
router.use("/ai", chatbotRoutes); // chatbot topeng
router.use("/ai", analysisRoutes); // analisis forum (Gemini) + verifikasi admin
router.use("/knowledge", knowledgeRoutes); // dokumen sumber jawaban chatbot (admin)

// 6. NOTIFIKASI .......... src/modules/notifications
router.use("/notifications", notificationsRoutes);

// 7. ADMIN ............... src/modules/admin
router.use("/admin", statsRoutes);
router.use("/uploads", uploadsRoutes);
router.use("/logs", logsRoutes);

export default router;