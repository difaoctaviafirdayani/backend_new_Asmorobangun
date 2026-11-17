// CONTROLLER KATALOG TOPENG (+ moderasi ulasan)
import type { Request, Response } from "express";
import { topeng, topengReviews } from "../database/layanan.repo";
import { httpError } from "../middleware/error";
import { imageValue, newId, requiredText, text, toNumber } from "./common";

// GET /api/topeng
export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await topeng.list());
}

// GET /api/topeng/:id — detail + ulasan
export async function getOne(req: Request, res: Response): Promise<void> {
  const item = await topeng.findById(req.params.id);
  if (!item) throw httpError(404, "Topeng tidak ditemukan.");
  const [list, summary] = await Promise.all([topengReviews.listByTopeng(item.id), topengReviews.summaryOf(item.id)]);
  res.json({ ...item, reviews: list, reviewCount: summary.count, avgRating: summary.avg });
}

// POST /api/topeng (admin)
export async function create(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const item = {
    id: newId("tp"),
    name: requiredText(b.name, "Nama topeng", 255),
    character: text(b.character, 255),
    color: text(b.color, 100),
    price: toNumber(b.price, "Harga", { min: 0 }),
    stock: b.stock === undefined || b.stock === "" ? 0 : toNumber(b.stock, "Stok", { min: 0, max: 1_000_000 }),
    image: imageValue(b.image) ?? null,
    desc: text(b.desc, 5000),
  };
  await topeng.insert(item);
  res.status(201).json(await topeng.findById(item.id));
}

// PATCH /api/topeng/:id (admin)
export async function update(req: Request, res: Response): Promise<void> {
  if (!(await topeng.findById(req.params.id))) throw httpError(404, "Topeng tidak ditemukan.");
  const b = req.body || {};
  const changes: Record<string, any> = {};
  if (b.name !== undefined) changes.name = requiredText(b.name, "Nama topeng", 255);
  if (b.character !== undefined) changes.character = text(b.character, 255);
  if (b.color !== undefined) changes.color = text(b.color, 100);
  if (b.price !== undefined) changes.price = toNumber(b.price, "Harga", { min: 0 });
  if (b.stock !== undefined) changes.stock = toNumber(b.stock, "Stok", { min: 0, max: 1_000_000 });
  if (b.image !== undefined) changes.image = imageValue(b.image);
  if (b.desc !== undefined) changes.desc = text(b.desc, 5000);
  await topeng.patch(req.params.id, changes);
  res.json(await topeng.findById(req.params.id));
}

// DELETE /api/topeng/:id (admin)
export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await topeng.findById(req.params.id))) throw httpError(404, "Topeng tidak ditemukan.");
  await topeng.remove(req.params.id);
  res.json({ message: "Topeng dihapus." });
}

// DELETE /api/topeng/:id/reviews/:reviewId (admin)
export async function removeReview(req: Request, res: Response): Promise<void> {
  const review = await topengReviews.findById(req.params.reviewId);
  if (!review || review.topengId !== req.params.id) throw httpError(404, "Ulasan tidak ditemukan.");
  await topengReviews.remove(review.id);
  res.json({ message: "Ulasan dihapus." });
}
