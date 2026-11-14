// ===========================================================================
// CONTROLLER BOOKING — kelas, sewa, dan event.
// Alur status:
//   dibuat -> menunggu_pembayaran (berbayar) / menunggu_konfirmasi_admin (gratis / harga dari admin)
//   bukti bayar atau bayar tunai -> menunggu_verifikasi -> admin: dikonfirmasi / selesai / ditolak / dibatalkan
// ===========================================================================
import type { Request, Response } from "express";
import { facilities, reviews } from "../database/layanan.repo";
import { bookings, paymentSettings } from "../database/registrasi.repo";
import { httpError } from "../middleware/error";
import { notifyUser } from "../modules/notifications/push.service";
import { uploadedUrl } from "../utils/upload";
import { FINAL_STATUSES, STATUSES, STATUS_LABEL, assertOwnerOrAdmin, currentUser, newId, text, toNumber } from "./common";

type Row = Record<string, any>;

async function loadBooking(req: Request): Promise<Row> {
  const me = currentUser(req.user);
  const booking = await bookings.findById(req.params.id);
  if (!booking) throw httpError(404, "Booking tidak ditemukan.");
  assertOwnerOrAdmin(me, booking.userId);
  return booking;
}

function assertPayable(booking: Row): void {
  if (FINAL_STATUSES.includes(booking.status)) throw httpError(400, `Booking sudah ${STATUS_LABEL[booking.status] || booking.status}.`);
  if (!booking.amount || Number(booking.amount) <= 0) {
    throw httpError(400, "Booking ini belum memiliki tagihan. Tunggu admin menentukan biaya.");
  }
}

// POST /api/bookings  { facilityId, date?, notes?, eventType?, location?, guestCount? }
export async function create(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  const b = req.body || {};
  const facility = await facilities.findById(text(b.facilityId, 60));
  if (!facility) throw httpError(404, "Fasilitas tidak ditemukan.");

  const bookingType = facility.bookingType || null;
  const date = text(b.date, 100);
  if ((bookingType === "wisata" || bookingType === "rental" || bookingType === "event") && !date) {
    throw httpError(400, "Tanggal wajib diisi.");
  }
  if (bookingType === "event" && !text(b.location, 255)) throw httpError(400, "Lokasi acara wajib diisi.");

  // Tagihan otomatis hanya kalau fasilitas punya harga tetap. Wisata dihitung per orang.
  let amount: number | null = null;
  if (facility.price && Number(facility.price) > 0) {
    const people = bookingType === "wisata" ? toNumber(b.guestCount ?? 1, "Jumlah peserta", { min: 1, max: 1000 }) : 1;
    amount = Number(facility.price) * people;
  }

  const id = newId("bk");
  await bookings.insert({
    id,
    facilityId: facility.id,
    facilityName: facility.name,
    bookingType,
    userId: me.id,
    userName: me.name,
    userEmail: me.email,
    date: date || null,
    notes: text(b.notes, 5000) || null,
    eventType: text(b.eventType, 100) || null,
    location: text(b.location, 255) || null,
    guestCount: b.guestCount !== undefined && b.guestCount !== "" ? text(String(b.guestCount), 50) : null,
    paymentMethod: null,
    amount,
    proofFile: null,
    status: amount ? "menunggu_pembayaran" : "menunggu_konfirmasi_admin",
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(await bookings.findById(id));
}

// GET /api/bookings/mine
export async function listMine(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  const mine = await bookings.list({ where: "user_id = ?", params: [me.id] });
  const reviewList = await reviews.listByBookings(mine.map((b) => b.id));
  const byBooking = new Map(reviewList.map((r: Row) => [r.bookingId, r]));
  res.json(mine.map((b) => ({ ...b, review: byBooking.get(b.id) || null })));
}

// GET /api/bookings (admin) — ?status=
export async function listAll(req: Request, res: Response): Promise<void> {
  const status = text(req.query.status as string, 40);
  res.json(await bookings.list(status ? { where: "status = ?", params: [status] } : undefined));
}

// GET /api/bookings/:id/qris
export async function getQris(req: Request, res: Response): Promise<void> {
  const booking = await loadBooking(req);
  assertPayable(booking);
  const s = await paymentSettings.get();
  if (!s.qrisImage) throw httpError(503, "QRIS belum diatur admin. Gunakan transfer bank atau hubungi sanggar.");
  if (!booking.paymentMethod) await bookings.patch(booking.id, { paymentMethod: "qris" });
  res.json({
    method: "qris",
    bookingId: booking.id,
    amount: Number(booking.amount),
    merchantName: s.qrisMerchantName,
    qrisImage: s.qrisImage,
    whatsapp: s.whatsapp,
  });
}

// GET /api/bookings/:id/transfer
export async function getTransfer(req: Request, res: Response): Promise<void> {
  const booking = await loadBooking(req);
  assertPayable(booking);
  const s = await paymentSettings.get();
  if (!s.accountNumber) throw httpError(503, "Rekening belum diatur admin. Hubungi sanggar.");
  if (!booking.paymentMethod) await bookings.patch(booking.id, { paymentMethod: "transfer" });
  res.json({
    method: "transfer",
    bookingId: booking.id,
    amount: Number(booking.amount),
    bankName: s.bankName,
    accountNumber: s.accountNumber,
    accountName: s.accountName,
    whatsapp: s.whatsapp,
  });
}

// POST /api/bookings/:id/proof  (field form-data: proof)
export async function uploadProof(req: Request, res: Response): Promise<void> {
  const booking = await loadBooking(req);
  assertPayable(booking);
  if (!req.file) throw httpError(400, "Bukti pembayaran wajib diunggah (field: proof).");
  await bookings.patch(booking.id, {
    proofFile: uploadedUrl(req.file, "payment_proof"),
    paymentMethod: booking.paymentMethod && booking.paymentMethod !== "cash" ? booking.paymentMethod : "transfer",
    status: "menunggu_verifikasi",
  });
  res.json(await bookings.findById(booking.id));
}

// POST /api/bookings/:id/cash
export async function payCash(req: Request, res: Response): Promise<void> {
  const booking = await loadBooking(req);
  assertPayable(booking);
  await bookings.patch(booking.id, { paymentMethod: "cash", status: "menunggu_verifikasi" });
  res.json(await bookings.findById(booking.id));
}

// PATCH /api/bookings/:id/status  { status, amount? } (admin)
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const booking = await bookings.findById(req.params.id);
  if (!booking) throw httpError(404, "Booking tidak ditemukan.");
  const status = text(req.body?.status, 40);
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw httpError(400, `Status tidak valid. Pilihan: ${STATUSES.join(", ")}.`);
  }
  const changes: Row = { status };
  // Admin boleh menetapkan biaya (mis. event / sewa yang harganya menyesuaikan).
  if (req.body?.amount !== undefined && req.body.amount !== null && req.body.amount !== "") {
    changes.amount = toNumber(req.body.amount, "Biaya", { min: 0 });
  }
  await bookings.patch(booking.id, changes);

  await notifyUser(booking.userId, {
    title: "Status booking diperbarui",
    body: `${booking.facilityName}: ${STATUS_LABEL[status] || status}.`,
    data: { type: "booking", id: booking.id, status },
  });
  res.json(await bookings.findById(booking.id));
}
