require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./src/routes/auth.routes");
const articlesRoutes = require("./src/routes/articles.routes");
const facilitiesRoutes = require("./src/routes/facilities.routes");
const bookingsRoutes = require("./src/routes/bookings.routes");
const topengRoutes = require("./src/routes/topeng.routes");
const forumRoutes = require("./src/routes/forum.routes");
const announcementsRoutes = require("./src/routes/announcements.routes");
const searchRoutes = require("./src/routes/search.routes");
const aiRoutes = require("./src/routes/ai.routes");
const galleryRoutes = require("./src/routes/gallery.routes");
const cultureRoutes = require("./src/routes/culture.routes");
const adminRoutes = require("./src/routes/admin.routes");
const uploadsRoutes = require("./src/routes/uploads.routes");
const paymentsRoutes = require("./src/routes/payments.routes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (payment proofs, site images from the admin media library, etc.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Server ini murni JSON API. Frontend user & admin dijalankan terpisah (lihat zip masing-masing).

app.use("/api/auth", authRoutes);
app.use("/api/articles", articlesRoutes);
app.use("/api/facilities", facilitiesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/topeng", topengRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/culture", cultureRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/payments", paymentsRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, name: "Asmorobangun API" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Terjadi kesalahan pada server." });
});

app.listen(PORT, () => {
  console.log(`Asmorobangun backend running on http://localhost:${PORT}`);
});
