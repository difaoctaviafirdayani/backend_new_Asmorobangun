// ===========================================================================
// CONTROLLER ULASAN — dipakai bersama oleh booking kelas dan pesanan topeng.
//   bookingReview -> /api/bookings/:id/review          (ulasan fasilitas)
//   orderReview   -> /api/topeng/orders/:orderId/review (ulasan topeng)
// Aturan: hanya pemilik, hanya setelah status "selesai", satu ulasan per booking/pesanan.
// ===========================================================================
import type { Request, Response } from "express";
import { reviews, topengReviews } from "../database/layanan.repo";
import { bookings, orders } from "../database/registrasi.repo";
import { httpError } from "../middleware/error";
import { uploadedUrl } from "../utils/upload";
import { currentUser, newId, text, toNumber } from "./common";

type Row = Record<string, any>;

// Perbedaan antara dua jenis ulasan dirangkum di sini.
interface Kind {
  param: string; // nama parameter URL
  label: string; // "booking" / "pesanan"
  loadSource(id: string): Promise<Row | null>;
  findReview(id: string): Promise<Row | null>;
  insert(row: Row): Promise<void>;
  patch(id: string, changes: Row): Promise<void>;
  remove(id: string): Promise<void>;
  build(source: Row, id: string, userName: string, rating: number, comment: string): Row;
}

const bookingKind: Kind = {
  param: "id",
  label: "booking",
  loadSource: (id) => bookings.findById(id),
  findReview: (id) => reviews.findByBooking(id),
  insert: (row) => reviews.insert(row),
  patch: (id, c) => reviews.patch(id, c),
  remove: (id) => reviews.remove(id),
  build: (b, id, userName, rating, comment) => ({
    id,
    facilityId: b.facilityId,
    bookingId: b.id,
    userId: b.userId,
    userName,
    rating,
    comment,
    date: new Date().toISOString(),
  }),
};

const orderKind: Kind = {
  param: "orderId",
  label: "pesanan",
  loadSource: (id) => orders.findById(id),
  findReview: (id) => topengReviews.findByOrder(id),
  insert: (row) => topengReviews.insert(row),
  patch: (id, c) => topengReviews.patch(id, c),
  remove: (id) => topengReviews.remove(id),
  build: (o, id, userName, rating, comment) => ({
    id,
    topengId: o.topengId,
    orderId: o.id,
    userId: o.userId,
    userName,
    rating,
    comment,
    date: new Date().toISOString(),
  }),
};

function parseRating(v: unknown): number {
  return toNumber(v, "Rating (1-5)", { min: 1, max: 5 });
}

function makeHandlers(kind: Kind) {
  async function loadOwned(req: Request): Promise<Row> {
    const me = currentUser(req.user);
    const source = await kind.loadSource(req.params[kind.param]);
    if (!source || source.userId !== me.id) throw httpError(404, `Data ${kind.label} tidak ditemukan.`);
    return source;
  }

  async function loadReview(req: Request): Promise<{ source: Row; review: Row }> {
    const source = await loadOwned(req);
    const review = await kind.findReview(source.id);
    if (!review) throw httpError(404, "Kamu belum menulis ulasan.");
    return { source, review };
  }

  return {
    // GET .../review — ulasan milik saya (null kalau belum ada)
    async get(req: Request, res: Response): Promise<void> {
      const source = await loadOwned(req);
      res.json({ review: await kind.findReview(source.id), canReview: source.status === "selesai" });
    },

    // POST .../review  { rating, comment }
    async create(req: Request, res: Response): Promise<void> {
      const me = currentUser(req.user);
      const source = await loadOwned(req);
      if (source.status !== "selesai") throw httpError(400, `Ulasan hanya bisa ditulis setelah ${kind.label} selesai.`);
      if (await kind.findReview(source.id)) throw httpError(409, "Kamu sudah menulis ulasan. Silakan edit ulasan yang ada.");

      const rating = parseRating(req.body?.rating);
      const comment = text(req.body?.comment, 1000);
      if (!comment) throw httpError(400, "Komentar wajib diisi.");

      const id = newId("rv");
      await kind.insert(kind.build(source, id, me.name, rating, comment));
      res.status(201).json({ review: await kind.findReview(source.id) });
    },

    // PUT .../review  { rating?, comment? }
    async update(req: Request, res: Response): Promise<void> {
      const { source, review } = await loadReview(req);
      const changes: Row = {};
      if (req.body?.rating !== undefined) changes.rating = parseRating(req.body.rating);
      if (req.body?.comment !== undefined) {
        const comment = text(req.body.comment, 1000);
        if (!comment) throw httpError(400, "Komentar tidak boleh kosong.");
        changes.comment = comment;
      }
      if (Object.keys(changes).length) await kind.patch(review.id, changes);
      res.json({ review: await kind.findReview(source.id) });
    },

    // DELETE .../review
    async remove(req: Request, res: Response): Promise<void> {
      const { review } = await loadReview(req);
      await kind.remove(review.id);
      res.json({ message: "Ulasan dihapus." });
    },

    // POST .../review/image  (field form-data: image)
    async setImage(req: Request, res: Response): Promise<void> {
      const { source, review } = await loadReview(req);
      if (!req.file) throw httpError(400, "File gambar wajib diunggah (field: image).");
      await kind.patch(review.id, { image: uploadedUrl(req.file, "review") });
      res.json({ review: await kind.findReview(source.id) });
    },

    // DELETE .../review/image
    async clearImage(req: Request, res: Response): Promise<void> {
      const { source, review } = await loadReview(req);
      await kind.patch(review.id, { image: null });
      res.json({ review: await kind.findReview(source.id) });
    },
  };
}

export const bookingReview = makeHandlers(bookingKind);
export const orderReview = makeHandlers(orderKind);
