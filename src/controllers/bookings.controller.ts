import type { Request, Response } from "express";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { facilities } from "../database/layanan.repo";
import { bookings, paymentSettings } from "../database/registrasi.repo";
import { httpError } from "../middleware/error";
import { uploadedUrl } from "../utils/upload";
import { bookingStatusText, notify } from "../modules/notifications/notify.service";
import { sweepPayments } from "../modules/notifications/sweeper";
import {
  BOOKING_STATUS,
  canCancelBooking,
  dayLabel,
  daysUntil,
  needsRefund,
  parseDays,
  weekdayOf,
} from "../config/rules";
import type { AuthedRequest } from "../types/auth";
import { attachBookingReviews } from "./reviews.controller";
import { readCancelInput } from "./common";
import { phonesByIds } from "../database/users.repo";

const VALID_PAYMENT_METHODS = ["qris", "transfer", "cash"];
const VALID_STATUS: readonly string[] = BOOKING_STATUS;

// Ambil booking + pastikan yang membuka adalah pemiliknya (atau admin).
async function findOwnedBooking(
  req: Request,
  { adminAllowed = false } = {},
): Promise<Record<string, any>> {
  const { user } = req as AuthedRequest;
  await sweepPayments();
  const booking = await bookings.findById(req.params.id);
  if (!booking) throw httpError(404, "Booking tidak ditemukan.");
  const isOwner = booking.userId === user.id;
  if (!isOwner && !(adminAllowed && user.role === "admin"))
    throw httpError(403, "Tidak diizinkan.");
  return booking;
}

// POST /api/bookings
export async function create(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  const {
    facilityId,
    date,
    notes,
    paymentMethod,
    eventType,
    location,
    guestCount,
  } = req.body;
  const facility = await facilities.findById(facilityId);
  if (!facility) throw httpError(400, "Fasilitas tidak valid.");

  const method =
    paymentMethod && VALID_PAYMENT_METHODS.includes(paymentMethod)
      ? paymentMethod
      : null;

  const price = Number(facility.price);
  if (!Number.isFinite(price) || price <= 0)
    throw httpError(
      400,
      "Harga layanan ini belum diatur. Hubungi admin sanggar.",
    );
  let amount = price;

  const days = parseDays(facility.availableDays);
  const dateText = date ? String(date).trim() : "";
  if (days.length) {
    const weekday = weekdayOf(dateText);
    if (weekday === null)
      throw httpError(400, "Pilih tanggal kunjungan dengan format yang benar.");
    if (!days.includes(weekday))
      throw httpError(
        400,
        `Layanan ini hanya buka hari ${dayLabel(days)}. Pilih tanggal yang sesuai.`,
      );
  }
  // Pemesanan minimal H-1: hari H sudah tidak bisa dipesan (selaras dengan aturan batal H-1).
  const lead = daysUntil(dateText);
  if (lead !== null && lead < 1) {
    throw httpError(
      400,
      lead < 0
        ? "Tanggal tidak boleh sudah lewat."
        : "Pemesanan minimal H-1 sebelum jadwal. Pilih tanggal mulai besok.",
    );
  }

  let guests: any = guestCount;
  if (facility.bookingType === "wisata") {
    const qty = Math.floor(Number(guestCount));
    if (!Number.isFinite(qty) || qty < 1 || qty > 50)
      throw httpError(400, "Jumlah peserta harus 1 sampai 50.");
    guests = qty;
    amount = price * qty;
  }

  const booking = {
    id: `bk-${nanoid(8)}`,
    facilityId,
    facilityName: facility.name,
    bookingType: facility.bookingType,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    date: dateText || null,
    notes: notes || "",
    eventType: eventType || null,
    location: location || null,
    guestCount: guests || null,
    paymentMethod: method,
    amount,
    proofFile: null,
    status: method === "cash" ? "menunggu_kedatangan" : "menunggu_pembayaran",
    createdAt: new Date().toISOString(),
  };

  await bookings.insert(booking);
  res.status(201).json({ booking: await bookings.findById(booking.id) });
}

// GET /api/bookings/mine
export async function listMine(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  await sweepPayments();
  const list = await bookings.list({ where: "user_id = ?", params: [user.id] });
  res.json({ bookings: await attachBookingReviews(list) });
}

// GET /api/bookings/:id/qris
export async function getQris(req: Request, res: Response): Promise<void> {
  const booking = await findOwnedBooking(req, { adminAllowed: true });
  const facility = await facilities.findById(booking.facilityId);
  const settings = await paymentSettings.get();
  const cfg =
    facility && facility.paymentMethods && facility.paymentMethods.qris;
  if (cfg && cfg.enabled === false)
    throw httpError(400, "Metode QRIS tidak tersedia untuk layanan ini.");

  const note = "Scan QRIS sanggar, lalu unggah bukti pembayaran.";
  if (cfg && cfg.image) {
    res.json({ qris: cfg.image, amount: booking.amount, note });
    return;
  }
  if (settings.qrisImage) {
    res.json({ qris: settings.qrisImage, amount: booking.amount, note });
    return;
  }

  const payload = `ASMOROBANGUN|BOOKING:${booking.id}|NOMINAL:${booking.amount || 0}|${settings.qrisMerchantName || ""}`;
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  res.json({
    qris: dataUrl,
    amount: booking.amount,
    note: "QRIS simulasi untuk keperluan demo/prototipe.",
  });
}

// GET /api/bookings/:id/transfer
export async function getTransfer(req: Request, res: Response): Promise<void> {
  const booking = await findOwnedBooking(req, { adminAllowed: true });
  const facility = await facilities.findById(booking.facilityId);
  const settings = await paymentSettings.get();
  const cfg =
    facility && facility.paymentMethods && facility.paymentMethods.transfer;
  if (cfg && cfg.enabled === false)
    throw httpError(400, "Transfer bank tidak tersedia untuk layanan ini.");
  res.json({
    bank: settings,
    amount: booking.amount,
    note: (cfg && cfg.note) || "",
  });
}

// POST /api/bookings/:id/proof  (multipart, field: proof)
export async function uploadProof(req: Request, res: Response): Promise<void> {
  const booking = await findOwnedBooking(req);
  if (booking.status === "dibatalkan")
    throw httpError(
      400,
      "Pendaftaran sudah dibatalkan karena tidak dibayar dalam 24 jam. Silakan daftar ulang.",
    );
  if (
    booking.status !== "menunggu_pembayaran" &&
    booking.status !== "menunggu_verifikasi"
  ) {
    throw httpError(400, "Pembayaran pendaftaran ini sudah diverifikasi.");
  }
  if (!req.file) throw httpError(400, "File bukti pembayaran wajib diunggah.");

  const fileUrl = uploadedUrl(req.file, "payment_proof");
  const method = VALID_PAYMENT_METHODS.includes(req.body.paymentMethod)
    ? req.body.paymentMethod
    : null;
  await bookings.patch(booking.id, {
    proofFile: fileUrl,
    ...(method ? { paymentMethod: method } : {}),
    status: "menunggu_verifikasi",
  });
  res.json({
    message: "Bukti pembayaran berhasil diunggah, menunggu verifikasi admin.",
    proofFile: fileUrl,
  });
}

// POST /api/bookings/:id/cash
export async function payCash(req: Request, res: Response): Promise<void> {
  const booking = await findOwnedBooking(req);
  if (booking.status === "dibatalkan")
    throw httpError(
      400,
      "Pendaftaran sudah dibatalkan karena tidak dibayar dalam 24 jam. Silakan daftar ulang.",
    );
  if (booking.proofFile)
    throw httpError(400, "Bukti pembayaran sudah diunggah untuk booking ini.");
  const facility = await facilities.findById(booking.facilityId);
  const cfg =
    facility && facility.paymentMethods && facility.paymentMethods.cash;
  if (cfg && cfg.enabled === false)
    throw httpError(400, "Pembayaran tunai tidak tersedia untuk layanan ini.");
  await bookings.patch(booking.id, {
    paymentMethod: "cash",
    status: "menunggu_kedatangan",
  });
  res.json({
    message: "Pembayaran tunai dicatat. Silakan bayar langsung di lokasi.",
    status: "menunggu_kedatangan",
  });
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const booking = await findOwnedBooking(req);
  if (booking.status === "dibatalkan")
    throw httpError(400, "Pendaftaran ini sudah dibatalkan.");
  if (!canCancelBooking(booking as { status: string; date?: unknown })) {
    const left = daysUntil(booking.date);
    throw httpError(
      400,
      booking.status === "selesai"
        ? "Pendaftaran yang sudah selesai tidak bisa dibatalkan."
        : left !== null && left < 1
          ? "Pembatalan hanya bisa dilakukan paling lambat H-1 sebelum jadwal."
          : "Pendaftaran ini tidak bisa dibatalkan.",
    );
  }
  const refund = needsRefund(booking);
  const { reason, refundAccount } = readCancelInput(req.body, { refund });
  await bookings.patch(booking.id, {
    status: "dibatalkan",
    cancelReason: reason,
    refundAccount,
    cancelledAt: new Date().toISOString(),
  });
  await notify(booking.userId, {
    type: "order",
    title: "Pendaftaran dibatalkan",
    body: refund
      ? `Pendaftaran ${booking.facilityName} dibatalkan. Admin akan menghubungi kamu via Email/WhatsApp untuk pengembalian dana.`
      : `Pendaftaran ${booking.facilityName} dibatalkan.`,
    refId: String(booking.id),
    refType: "booking",
  });
  res.json({
    message: refund
      ? "Pendaftaran dibatalkan. Admin akan menghubungi kamu untuk pengembalian dana."
      : "Pendaftaran dibatalkan.",
    status: "dibatalkan",
  });
}

export async function listAll(_req: Request, res: Response): Promise<void> {
  await sweepPayments();
  const list = await bookings.list();
  const phones = await phonesByIds(list.map((b) => b.userId));
  res.json({ bookings: list.map((b) => ({ ...b, userPhone: phones.get(b.userId) || "" })) });
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status))
    throw httpError(400, "Status tidak valid.");
  const booking = await bookings.findById(req.params.id);
  if (!booking) throw httpError(404, "Booking tidak ditemukan.");
  if (booking.status === "dibatalkan" && booking.cancelReason && status !== "dibatalkan")
    throw httpError(409, "Pendaftaran ini sudah dibatalkan oleh pemesan, statusnya tidak bisa diubah lagi.");
  await bookings.patch(req.params.id, { status });
  if (status !== booking.status) {
    await notify(booking.userId, {
      type: "order",
      ...bookingStatusText(booking.facilityName, status),
      refId: String(booking.id),
      refType: "booking",
    });
  }
  res.json({ message: "Status booking diperbarui." });
}
