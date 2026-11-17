// CONTROLLER FASILITAS / KELAS + ULASAN
// (ulasan ditulis lewat /api/bookings/:id/review, di reviews.controller.ts)
import type { Request, Response } from "express";
import { facilities, reviews } from "../database/layanan.repo";
import { httpError } from "../middleware/error";
import { imageValue, text } from "./common";

// GET /api/facilities  — daftar fasilitas + ringkasan rating
export async function list(_req: Request, res: Response): Promise<void> {
  const [items, summary] = await Promise.all([facilities.list(), reviews.summary()]);
  res.json(
    items.map((f) => ({
      ...f,
      reviewCount: summary[f.id]?.count ?? 0,
      avgRating: summary[f.id]?.avg ?? null,
    }))
  );
}

// GET /api/facilities/:id  — detail + semua ulasan
export async function getOne(req: Request, res: Response): Promise<void> {
  const facility = await facilities.findById(req.params.id);
  if (!facility) throw httpError(404, "Fasilitas tidak ditemukan.");
  const list = await reviews.listByFacility(facility.id);
  const avg = list.length ? Math.round((list.reduce((s, r) => s + Number(r.rating), 0) / list.length) * 10) / 10 : null;
  res.json({ ...facility, reviews: list, reviewCount: list.length, avgRating: avg });
}

// PATCH /api/facilities/:id  (admin — Kelola Kelas)
export async function update(req: Request, res: Response): Promise<void> {
  const current = await facilities.findById(req.params.id);
  if (!current) throw httpError(404, "Fasilitas tidak ditemukan.");
  const b = { ...(req.body || {}) };
  delete b.id;

  const changes: Record<string, any> = { ...b };
  if (b.name !== undefined) {
    changes.name = text(b.name, 255);
    if (!changes.name) throw httpError(400, "Nama fasilitas tidak boleh kosong.");
  }
  if (b.image !== undefined) changes.image = imageValue(b.image);
  if (b.price !== undefined) {
    if (b.price === null || b.price === "") changes.price = null;
    else {
      const n = Number(b.price);
      if (!Number.isFinite(n) || n < 0) throw httpError(400, "Harga tidak valid.");
      changes.price = Math.round(n);
    }
  }
  if (b.requiresLogin !== undefined) changes.requiresLogin = !!b.requiresLogin;
  // Ringkasan/rating dihitung server, bukan field yang disimpan.
  delete changes.reviews;
  delete changes.reviewCount;
  delete changes.avgRating;

  await facilities.patch(current.id, changes);
  res.json(await facilities.findById(current.id));
}

// DELETE /api/facilities/:facilityId/reviews/:reviewId  (admin — moderasi)
export async function removeReview(req: Request, res: Response): Promise<void> {
  const review = await reviews.findById(req.params.reviewId);
  if (!review || review.facilityId !== req.params.facilityId) throw httpError(404, "Ulasan tidak ditemukan.");
  await reviews.remove(review.id);
  res.json({ message: "Ulasan dihapus." });
}
