const QRCode = require("qrcode");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { sortNewest } = require("../../utils/helpers");

const VALID_PAYMENT_METHODS = ["qris", "transfer", "cash"];
const VALID_STATUS = [
  "menunggu_pembayaran",
  "menunggu_verifikasi",
  "menunggu_kedatangan",
  "menunggu_konfirmasi_admin",
  "dikonfirmasi",
  "ditolak",
  "selesai",
];

// Ambil booking + pastikan yang membuka adalah pemiliknya (atau admin).
function findOwnedBooking(db, req, { adminAllowed = false } = {}) {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) throw httpError(404, "Booking tidak ditemukan.");
  const isOwner = booking.userId === req.user.id;
  if (!isOwner && !(adminAllowed && req.user.role === "admin")) throw httpError(403, "Tidak diizinkan.");
  return booking;
}

// POST /api/bookings
exports.create = async (req, res) => {
  const { facilityId, date, notes, paymentMethod, eventType, location, guestCount } = req.body;
  const db = readDB();
  const facility = db.facilities.find((f) => f.id === facilityId);
  if (!facility) throw httpError(400, "Fasilitas tidak valid.");

  const method = paymentMethod && VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : null;
  // Kelas wisata & sewa kostum langsung bayar; event (panggilan tari/kunjungan) lewat review admin dulu.
  const needsPaymentNow = facility.bookingType === "wisata" || facility.bookingType === "rental";
  if (needsPaymentNow && !method) throw httpError(400, "Silakan pilih metode pembayaran.");

  // Nominal: tidak boleh lebih murah dari harga resmi fasilitas.
  let amount = Number(req.body.amount);
  amount = Number.isFinite(amount) && amount > 0 ? amount : null;
  if (facility.price && (amount === null || amount < facility.price)) amount = facility.price;

  const booking = {
    id: `bk-${nanoid(8)}`,
    facilityId,
    facilityName: facility.name,
    bookingType: facility.bookingType,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    date: date || null,
    notes: notes || "",
    eventType: eventType || null,
    location: location || null,
    guestCount: guestCount || null,
    paymentMethod: method,
    amount,
    proofFile: null,
    status: needsPaymentNow
      ? method === "cash" ? "menunggu_kedatangan" : "menunggu_pembayaran"
      : "menunggu_konfirmasi_admin",
    createdAt: new Date().toISOString(),
  };

  await update((data) => data.bookings.push(booking));
  res.status(201).json({ booking });
};

// GET /api/bookings/mine
exports.listMine = (req, res) => {
  const mine = readDB().bookings.filter((b) => b.userId === req.user.id);
  res.json({ bookings: sortNewest(mine, "createdAt") });
};

// GET /api/bookings/:id/qris
exports.getQris = async (req, res) => {
  const db = readDB();
  const booking = findOwnedBooking(db, req, { adminAllowed: true });
  const facility = db.facilities.find((f) => f.id === booking.facilityId);
  const cfg = facility && facility.paymentMethods && facility.paymentMethods.qris;
  if (cfg && cfg.enabled === false) throw httpError(400, "Metode QRIS tidak tersedia untuk layanan ini.");

  const note = "Scan QRIS sanggar, lalu unggah bukti pembayaran.";
  if (cfg && cfg.image) return res.json({ qris: cfg.image, amount: booking.amount, note });
  if (db.paymentSettings.qrisImage) return res.json({ qris: db.paymentSettings.qrisImage, amount: booking.amount, note });

  const payload = `ASMOROBANGUN|BOOKING:${booking.id}|NOMINAL:${booking.amount || 0}|${db.paymentSettings.qrisMerchantName || ""}`;
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  res.json({ qris: dataUrl, amount: booking.amount, note: "QRIS simulasi untuk keperluan demo/prototipe." });
};

// GET /api/bookings/:id/transfer
exports.getTransfer = (req, res) => {
  const db = readDB();
  const booking = findOwnedBooking(db, req, { adminAllowed: true });
  const facility = db.facilities.find((f) => f.id === booking.facilityId);
  const cfg = facility && facility.paymentMethods && facility.paymentMethods.transfer;
  if (cfg && cfg.enabled === false) throw httpError(400, "Transfer bank tidak tersedia untuk layanan ini.");
  res.json({ bank: db.paymentSettings, amount: booking.amount, note: (cfg && cfg.note) || "" });
};

// POST /api/bookings/:id/proof  (multipart, field: proof)
exports.uploadProof = async (req, res) => {
  const booking = findOwnedBooking(readDB(), req);
  if (!req.file) throw httpError(400, "File bukti pembayaran wajib diunggah.");

  const fileUrl = `/uploads/payment_proof/${req.file.filename}`;
  const method = VALID_PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : null;
  await update((data) => {
    const b = data.bookings.find((x) => x.id === booking.id);
    b.proofFile = fileUrl;
    if (method) b.paymentMethod = method;
    b.status = "menunggu_verifikasi";
  });
  res.json({ message: "Bukti pembayaran berhasil diunggah, menunggu verifikasi admin.", proofFile: fileUrl });
};

// POST /api/bookings/:id/cash
exports.payCash = async (req, res) => {
  const db = readDB();
  const booking = findOwnedBooking(db, req);
  if (booking.proofFile) throw httpError(400, "Bukti pembayaran sudah diunggah untuk booking ini.");
  const facility = db.facilities.find((f) => f.id === booking.facilityId);
  const cfg = facility && facility.paymentMethods && facility.paymentMethods.cash;
  if (cfg && cfg.enabled === false) throw httpError(400, "Pembayaran tunai tidak tersedia untuk layanan ini.");
  await update((data) => {
    const b = data.bookings.find((x) => x.id === booking.id);
    b.paymentMethod = "cash";
    b.status = "menunggu_kedatangan";
  });
  res.json({ message: "Pembayaran tunai dicatat. Silakan bayar langsung di lokasi.", status: "menunggu_kedatangan" });
};

// GET /api/bookings   (admin)
exports.listAll = (req, res) => {
  res.json({ bookings: sortNewest(readDB().bookings, "createdAt") });
};

// PATCH /api/bookings/:id/status   (admin)
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status)) throw httpError(400, "Status tidak valid.");
  if (!readDB().bookings.find((b) => b.id === req.params.id)) throw httpError(404, "Booking tidak ditemukan.");
  await update((data) => {
    data.bookings.find((b) => b.id === req.params.id).status = status;
  });
  res.json({ message: "Status booking diperbarui." });
};
