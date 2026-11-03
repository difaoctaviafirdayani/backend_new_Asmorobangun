import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { facilities, reviews } from "../../database/layanan.repo";
import { httpError } from "../../middleware/error";
import { omit } from "../../utils/helpers";
import type { AuthedRequest } from "../../types/auth";

type Summary = Record<string, { count: number; avg: number | null }>;

function withRating(facility: Record<string, any>, summary: Summary): Record<string, any> {
  const s = summary[facility.id];
  return { ...facility, reviewCount: s ? s.count : 0, avgRating: s ? s.avg : null };
}

export async function list(_req: Request, res: Response): Promise<void> {
  const [items, summary] = await Promise.all([facilities.list(), reviews.summary()]);
  res.json({ facilities: items.map((f) => withRating(f, summary)) });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const facility = await facilities.findById(req.params.id);
  if (!facility) throw httpError(404, "Fasilitas tidak ditemukan.");
  const [items, summary] = await Promise.all([reviews.listByFacility(facility.id), reviews.summary()]);
  res.json({ facility: withRating(facility, summary), reviews: items });
}

// POST /api/facilities/:id/reviews
export async function addReview(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
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
    userId: user.id,
    userName: user.name,
    rating: Math.max(1, Math.min(5, Math.round(stars))),
    comment: String(comment).trim(),
    date: new Date().toISOString(),
  });
  res.status(201).json({ review: await reviews.findById(id) });
}

// PATCH /api/facilities/:id  (admin)
export async function update(req: Request, res: Response): Promise<void> {
  if (!(await facilities.findById(req.params.id))) throw httpError(404, "Fasilitas tidak ditemukan.");
  // field hitungan (reviewCount/avgRating) tidak ikut disimpan
  const body = omit(req.body, ["id", "reviewCount", "avgRating"]);
  await facilities.patch(req.params.id, body);
  res.json({ message: "Fasilitas diperbarui." });
}

// DELETE /api/facilities/:facilityId/reviews/:reviewId  (admin; ulasan tidak bisa diedit, hanya dihapus)
export async function removeReview(req: Request, res: Response): Promise<void> {
  const { facilityId, reviewId } = req.params;
  const review = await reviews.findById(reviewId);
  if (!review || review.facilityId !== facilityId) throw httpError(404, "Ulasan tidak ditemukan.");
  await reviews.remove(reviewId);
  res.json({ message: "Ulasan dihapus." });
}