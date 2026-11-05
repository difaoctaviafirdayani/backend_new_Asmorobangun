// ===========================================================================
// ULASAN DARI "PESANAN SAYA"
// Ulasan hanya boleh dibuat oleh pemilik booking/pesanan yang berstatus "selesai".
// Satu ulasan per booking/pesanan. Pemilik boleh mengubah dan menghapus ulasannya.
// Ulasan tampil di halaman layanan (booking) dan katalog topeng (pesanan).
// ===========================================================================
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { reviews, topengReviews } from "../../database/layanan.repo";
import { bookings, orders } from "../../database/registrasi.repo";
import { httpError } from "../../middleware/error";
import type { AuthedRequest } from "../../types/auth";

type Row = Record<string, any>;

interface Adapter {
  /** nama untuk pesan error, mis. "booking" */
  label: string;
  /** nama parameter id di URL */
  param: string;
  loadSource(id: string): Promise<Row | null>;
  findReview(sourceId: string): Promise<Row | null>;
  insert(review: Row): Promise<void>;
  patch(id: string, changes: Row): Promise<void>;
  remove(id: string): Promise<void>;
  newRecord(source: Row, user: { id: string; name: string }, data: { rating: number; comment: string }): Row;
}

const bookingAdapter: Adapter = {
  label: "booking",
  param: "id",
  loadSource: (id) => bookings.findById(id),
  findReview: (id) => reviews.findByBooking(id),
  insert: (r) => reviews.insert(r),
  patch: (id, c) => reviews.patch(id, c),
  remove: (id) => reviews.remove(id),
  newRecord: (src, user, d) => ({
    id: `rv-${nanoid(8)}`,
    facilityId: src.facilityId,
    bookingId: src.id,
    userId: user.id,
    userName: user.name,
    rating: d.rating,
    comment: d.comment,
    date: new Date().toISOString(),
  }),
};

const orderAdapter: Adapter = {
  label: "pesanan",
  param: "orderId",
  loadSource: (id) => orders.findById(id),
  findReview: (id) => topengReviews.findByOrder(id),
  insert: (r) => topengReviews.insert(r),
  patch: (id, c) => topengReviews.patch(id, c),
  remove: (id) => topengReviews.remove(id),
  newRecord: (src, user, d) => ({
    id: `trv-${nanoid(8)}`,
    topengId: src.topengId,
    orderId: src.id,
    userId: user.id,
    userName: user.name,
    rating: d.rating,
    comment: d.comment,
    date: new Date().toISOString(),
  }),
};

function parseInput(body: Row): { rating: number; comment: string } {
  const rating = Math.round(Number(body.rating));
  const comment = String(body.comment ?? "").trim();
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw httpError(400, "Pilih rating 1 sampai 5 bintang.");
  if (comment.length < 3) throw httpError(400, "Komentar minimal 3 karakter.");
  if (comment.length > 500) throw httpError(400, "Komentar maksimal 500 karakter.");
  return { rating, comment };
}

// Ambil booking/pesanan milik user yang login (admin tidak ikut menulis ulasan atas nama user).
async function ownedSource(a: Adapter, req: Request): Promise<Row> {
  const { user } = req as AuthedRequest;
  const src = await a.loadSource(req.params[a.param]);
  if (!src) throw httpError(404, `${cap(a.label)} tidak ditemukan.`);
  if (src.userId !== user.id) throw httpError(403, "Tidak diizinkan.");
  return src;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function make(a: Adapter) {
  return {
    // GET .../review  -> ulasan milik saya untuk item ini (atau null)
    async get(req: Request, res: Response): Promise<void> {
      const src = await ownedSource(a, req);
      res.json({ review: await a.findReview(src.id) });
    },

    // POST .../review  { rating, comment }
    async create(req: Request, res: Response): Promise<void> {
      const { user } = req as AuthedRequest;
      const src = await ownedSource(a, req);
      if (src.status !== "selesai") {
        throw httpError(400, `Ulasan hanya bisa ditulis setelah ${a.label} berstatus selesai.`);
      }
      if (await a.findReview(src.id)) throw httpError(409, "Kamu sudah mengulas ini. Silakan edit ulasanmu.");
      const record = a.newRecord(src, user, parseInput(req.body));
      await a.insert(record);
      res.status(201).json({ review: await a.findReview(src.id) });
    },

    // PUT .../review  { rating, comment }
    async update(req: Request, res: Response): Promise<void> {
      const src = await ownedSource(a, req);
      const existing = await a.findReview(src.id);
      if (!existing) throw httpError(404, "Ulasan belum ada.");
      const { rating, comment } = parseInput(req.body);
      await a.patch(existing.id, { rating, comment });
      res.json({ review: await a.findReview(src.id) });
    },

    // DELETE .../review
    async remove(req: Request, res: Response): Promise<void> {
      const src = await ownedSource(a, req);
      const existing = await a.findReview(src.id);
      if (!existing) throw httpError(404, "Ulasan belum ada.");
      await a.remove(existing.id);
      res.json({ message: "Ulasan dihapus." });
    },

    // POST .../review/image  (multipart, field: image)  -> foto opsional untuk ulasan
    async setImage(req: Request, res: Response): Promise<void> {
      const src = await ownedSource(a, req);
      const existing = await a.findReview(src.id);
      if (!existing) throw httpError(404, "Kirim ulasan dulu sebelum menambah foto.");
      if (!(req as any).file) throw httpError(400, "File foto wajib diunggah.");
      const image = `/uploads/review/${(req as any).file.filename}`;
      await a.patch(existing.id, { image });
      res.json({ review: await a.findReview(src.id) });
    },

    // DELETE .../review/image
    async clearImage(req: Request, res: Response): Promise<void> {
      const src = await ownedSource(a, req);
      const existing = await a.findReview(src.id);
      if (!existing) throw httpError(404, "Ulasan belum ada.");
      await a.patch(existing.id, { image: null });
      res.json({ review: await a.findReview(src.id) });
    },
  };
}

export const bookingReview = make(bookingAdapter);
export const orderReview = make(orderAdapter);

/** Tempelkan ulasan milik user ke daftar booking/pesanan (field `review`, atau null). */
export async function attachBookingReviews(list: Row[]): Promise<Row[]> {
  const found = await reviews.listByBookings(list.map((b) => b.id));
  const byId = new Map(found.map((r) => [r.bookingId, r]));
  return list.map((b) => ({ ...b, review: byId.get(b.id) || null }));
}

export async function attachOrderReviews(list: Row[]): Promise<Row[]> {
  const found = await topengReviews.listByOrders(list.map((o) => o.id));
  const byId = new Map(found.map((r) => [r.orderId, r]));
  return list.map((o) => ({ ...o, review: byId.get(o.id) || null }));
}
