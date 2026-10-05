const express = require("express");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

function withRating(facility, db) {
  const reviews = db.reviews.filter((r) => r.facilityId === facility.id);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  return { ...facility, reviewCount: reviews.length, avgRating: avg ? Math.round(avg * 10) / 10 : null };
}

router.get("/", (req, res) => {
  const db = readDB();
  res.json({ facilities: db.facilities.map((f) => withRating(f, db)) });
});

router.get("/:id", (req, res) => {
  const db = readDB();
  const facility = db.facilities.find((f) => f.id === req.params.id);
  if (!facility) return res.status(404).json({ error: "Fasilitas tidak ditemukan." });
  const reviews = db.reviews
    .filter((r) => r.facilityId === facility.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ facility: withRating(facility, db), reviews });
});

// POST /api/facilities/:id/reviews  (must be logged in -> "mengikat" requirement)
router.post("/:id/reviews", requireAuth, async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || !comment) return res.status(400).json({ error: "Rating dan komentar wajib diisi." });
  const db = readDB();
  const facility = db.facilities.find((f) => f.id === req.params.id);
  if (!facility) return res.status(404).json({ error: "Fasilitas tidak ditemukan." });
  const review = {
    id: `rv-${nanoid(8)}`,
    facilityId: req.params.id,
    userId: req.user.id,
    userName: req.user.name,
    rating: Math.max(1, Math.min(5, Number(rating))),
    comment,
    date: new Date().toISOString(),
  };
  await update((data) => data.reviews.push(review));
  res.status(201).json({ review });
});

// PATCH /api/facilities/:id (admin only) - edit price info, description, schedule notes, etc. (Kelola Kelas)
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const db = readDB();
  const facility = db.facilities.find((f) => f.id === req.params.id);
  if (!facility) return res.status(404).json({ error: "Fasilitas tidak ditemukan." });
  await update((data) => {
    Object.assign(data.facilities.find((f) => f.id === req.params.id), req.body);
  });
  res.json({ message: "Fasilitas diperbarui." });
});

// ---- Admin: kelola ulasan pendaftar -- ulasan TIDAK bisa diedit, admin hanya bisa menghapus ----
// DELETE /api/facilities/:facilityId/reviews/:reviewId
router.delete("/:facilityId/reviews/:reviewId", requireAuth, requireAdmin, async (req, res) => {
  const db = readDB();
  const review = db.reviews.find((r) => r.id === req.params.reviewId && r.facilityId === req.params.facilityId);
  if (!review) return res.status(404).json({ error: "Ulasan tidak ditemukan." });
  await update((data) => {
    data.reviews = data.reviews.filter((r) => r.id !== req.params.reviewId);
  });
  res.json({ message: "Ulasan dihapus." });
});

module.exports = router;