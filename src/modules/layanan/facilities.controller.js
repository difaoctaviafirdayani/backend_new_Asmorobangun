const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { sortNewest, omit } = require("../../utils/helpers");

function withRating(facility, db) {
  const reviews = db.reviews.filter((r) => r.facilityId === facility.id);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  return { ...facility, reviewCount: reviews.length, avgRating: avg ? Math.round(avg * 10) / 10 : null };
}

exports.list = (req, res) => {
  const db = readDB();
  res.json({ facilities: db.facilities.map((f) => withRating(f, db)) });
};

exports.getOne = (req, res) => {
  const db = readDB();
  const facility = db.facilities.find((f) => f.id === req.params.id);
  if (!facility) throw httpError(404, "Fasilitas tidak ditemukan.");
  const reviews = sortNewest(db.reviews.filter((r) => r.facilityId === facility.id));
  res.json({ facility: withRating(facility, db), reviews });
};

// POST /api/facilities/:id/reviews
exports.addReview = async (req, res) => {
  const { rating, comment } = req.body;
  const stars = Number(rating);
  if (!Number.isFinite(stars) || !comment || !String(comment).trim()) {
    throw httpError(400, "Rating dan komentar wajib diisi.");
  }
  if (!readDB().facilities.find((f) => f.id === req.params.id)) throw httpError(404, "Fasilitas tidak ditemukan.");
  const review = {
    id: `rv-${nanoid(8)}`,
    facilityId: req.params.id,
    userId: req.user.id,
    userName: req.user.name,
    rating: Math.max(1, Math.min(5, Math.round(stars))),
    comment: String(comment).trim(),
    date: new Date().toISOString(),
  };
  await update((data) => data.reviews.push(review));
  res.status(201).json({ review });
};

// PATCH /api/facilities/:id  (admin)
exports.update = async (req, res) => {
  if (!readDB().facilities.find((f) => f.id === req.params.id)) throw httpError(404, "Fasilitas tidak ditemukan.");
  // field hitungan (reviewCount/avgRating) tidak ikut disimpan
  const body = omit(req.body, ["id", "reviewCount", "avgRating"]);
  await update((data) => {
    Object.assign(data.facilities.find((f) => f.id === req.params.id), body);
  });
  res.json({ message: "Fasilitas diperbarui." });
};

// DELETE /api/facilities/:facilityId/reviews/:reviewId  (admin; ulasan tidak bisa diedit, hanya dihapus)
exports.removeReview = async (req, res) => {
  const { facilityId, reviewId } = req.params;
  if (!readDB().reviews.find((r) => r.id === reviewId && r.facilityId === facilityId)) {
    throw httpError(404, "Ulasan tidak ditemukan.");
  }
  await update((data) => {
    data.reviews = data.reviews.filter((r) => r.id !== reviewId);
  });
  res.json({ message: "Ulasan dihapus." });
};
