const { nanoid } = require("nanoid");
const { facilities, reviews } = require("../../database/layanan.repo");
const { httpError } = require("../../middleware/error");
const { omit } = require("../../utils/helpers");

function withRating(facility, summary) {
  const s = summary[facility.id];
  return { ...facility, reviewCount: s ? s.count : 0, avgRating: s ? s.avg : null };
}

exports.list = async (req, res) => {
  const [list, summary] = await Promise.all([facilities.list(), reviews.summary()]);
  res.json({ facilities: list.map((f) => withRating(f, summary)) });
};

exports.getOne = async (req, res) => {
  const facility = await facilities.findById(req.params.id);
  if (!facility) throw httpError(404, "Fasilitas tidak ditemukan.");
  const [list, summary] = await Promise.all([reviews.listByFacility(facility.id), reviews.summary()]);
  res.json({ facility: withRating(facility, summary), reviews: list });
};

// POST /api/facilities/:id/reviews
exports.addReview = async (req, res) => {
  const { rating, comment } = req.body;
  const stars = Number(rating);
  if (!Number.isFinite(stars) || !comment || !String(comment).trim()) {
    throw httpError(400, "Rating dan komentar wajib diisi.");
  }
  if (!(await facilities.findById(req.params.id))) throw httpError(404, "Fasilitas tidak ditemukan.");
  const id = `rv-${nanoid(8)}`;
  await reviews.insert({
    id,
    facilityId: req.params.id,
    userId: req.user.id,
    userName: req.user.name,
    rating: Math.max(1, Math.min(5, Math.round(stars))),
    comment: String(comment).trim(),
    date: new Date().toISOString(),
  });
  res.status(201).json({ review: await reviews.findById(id) });
};

// PATCH /api/facilities/:id  (admin)
exports.update = async (req, res) => {
  if (!(await facilities.findById(req.params.id))) throw httpError(404, "Fasilitas tidak ditemukan.");
  // field hitungan (reviewCount/avgRating) tidak ikut disimpan
  const body = omit(req.body, ["id", "reviewCount", "avgRating"]);
  await facilities.patch(req.params.id, body);
  res.json({ message: "Fasilitas diperbarui." });
};

// DELETE /api/facilities/:facilityId/reviews/:reviewId  (admin; ulasan tidak bisa diedit, hanya dihapus)
exports.removeReview = async (req, res) => {
  const { facilityId, reviewId } = req.params;
  const review = await reviews.findById(reviewId);
  if (!review || review.facilityId !== facilityId) throw httpError(404, "Ulasan tidak ditemukan.");
  await reviews.remove(reviewId);
  res.json({ message: "Ulasan dihapus." });
};