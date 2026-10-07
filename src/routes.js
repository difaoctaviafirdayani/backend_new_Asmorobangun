// ===========================================================================
// PETA SEMUA ENDPOINT — mulai cari dari sini.
// Setiap kelompok punya foldernya sendiri di src/modules/<kelompok>/
// ===========================================================================
const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => res.json({ ok: true, name: "Asmorobangun API" }));

// 1. AKUN ................ src/modules/auth
router.use("/auth", require("./modules/auth/auth.routes"));

// 2. REGISTRASI .......... src/modules/registrasi
router.use("/bookings", require("./modules/registrasi/bookings.routes"));
router.use("/topeng", require("./modules/registrasi/orders.routes")); // pesanan topeng (harus sebelum katalog)
router.use("/payments", require("./modules/registrasi/payments.routes"));

// 3. LAYANAN ............. src/modules/layanan
router.use("/facilities", require("./modules/layanan/facilities.routes"));
router.use("/topeng", require("./modules/layanan/topeng.routes")); // katalog topeng

// 4. INFORMASI ........... src/modules/informasi
router.use("/articles", require("./modules/informasi/articles.routes"));
router.use("/announcements", require("./modules/informasi/announcements.routes"));
router.use("/gallery", require("./modules/informasi/gallery.routes"));
router.use("/culture", require("./modules/informasi/culture.routes"));
router.use("/faqs", require("./modules/informasi/faqs.routes"));

// 5. KOMUNITAS ........... src/modules/komunitas
router.use("/forum", require("./modules/komunitas/forum.routes"));
router.use("/search", require("./modules/komunitas/search.routes"));
router.use("/ai", require("./modules/komunitas/ai.routes"));

// 6. ADMIN ............... src/modules/admin
router.use("/admin", require("./modules/admin/stats.routes"));
router.use("/uploads", require("./modules/admin/uploads.routes"));

module.exports = router;
