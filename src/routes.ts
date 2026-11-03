// ===========================================================================
// PETA SEMUA ENDPOINT — mulai cari dari sini.
// Setiap kelompok punya foldernya sendiri di src/modules/<kelompok>/
// ===========================================================================
import { Router } from "express";

import authRoutes from "./modules/auth/auth.routes";
import bookingsRoutes from "./modules/registrasi/bookings.routes";
import ordersRoutes from "./modules/registrasi/orders.routes";
import paymentsRoutes from "./modules/registrasi/payments.routes";
import facilitiesRoutes from "./modules/layanan/facilities.routes";
import topengRoutes from "./modules/layanan/topeng.routes";
import articlesRoutes from "./modules/informasi/articles.routes";
import announcementsRoutes from "./modules/informasi/announcements.routes";
import galleryRoutes from "./modules/informasi/gallery.routes";
import cultureRoutes from "./modules/informasi/culture.routes";
import faqsRoutes from "./modules/informasi/faqs.routes";
import forumRoutes from "./modules/komunitas/forum.routes";
import searchRoutes from "./modules/komunitas/search.routes";
import chatbotRoutes from "./modules/komunitas/ai.routes";
import analysisRoutes from "./modules/ai/analysis.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import statsRoutes from "./modules/admin/stats.routes";
import uploadsRoutes from "./modules/admin/uploads.routes";
import logsRoutes from "./modules/admin/logs.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, name: "Asmorobangun API" });
});

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

// 6. NOTIFIKASI .......... src/modules/notifications
router.use("/notifications", notificationsRoutes);

// 7. ADMIN ............... src/modules/admin
router.use("/admin", statsRoutes);
router.use("/uploads", uploadsRoutes);
router.use("/logs", logsRoutes);

export default router;