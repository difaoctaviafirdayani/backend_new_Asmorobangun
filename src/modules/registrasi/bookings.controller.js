const QRCode = require("qrcode");
const { nanoid } = require("nanoid");
const { facilities } = require("../../database/layanan.repo");
const { bookings, paymentSettings } = require("../../database/registrasi.repo");
const { httpError } = require("../../middleware/error");

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
async function findOwnedBooking(req, { adminAllowed = false } = {}) {
  const booking = await bookings.findById(req.params.id);
  if (!booking) throw httpError(404, "Booking tidak ditemukan.");
  const isOwner = booking.userId === req.user.id;
  if (!isOwner && !(adminAllowed && req.user.role === "admin")) throw httpError(403, "Tidak diizinkan.");
  return booking;
}

// POST /api/bookings
exports.create = async (req, res) => {
  const { facilityId, date, notes, paymentMethod, eventType, location, guestCount } = req.body;
  const facility = await facilities.findById(facilityId);
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

  await bookings.insert(booking);
  res.status(201).json({ booking: await bookings.findById(booking.id) });
};

// GET /api/bookings/mine
exports.listMine = async (req, res) => {
  res.json({ bookings: await bookings.list({ where: "user_id = ?", params: [req.user.id] }) });
};

// GET /api/bookings/:id/qris
exports.getQris = async (req, res) => {
  const booking = await findOwnedBooking(req, { adminAllowed: true });
  const facility = await facilities.findById(booking.facilityId);
  const settings = await paymentSettings.get();
  const cfg = facility && facility.paymentMethods && facility.paymentMethods.qris;
  if (cfg && cfg.enabled === false) throw httpError(400, "Metode QRIS tidak tersedia untuk layanan ini.");

  const note = "Scan QRIS sanggar, lalu unggah bukti pembayaran.";
  if (cfg && cfg.image) return res.json({ qris: cfg.image, amount: booking.amount, note });
  if (settings.qrisImage) return res.json({ qris: settings.qrisImage, amount: booking.amount, note });

  const payload = `ASMOROBANGUN|BOOKING:${booking.id}|NOMINAL:${booking.amount || 0}|${settings.qrisMerchantName || ""}`;
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  res.json({ qris: dataUrl, amount: booking.amount, note: "QRIS simulasi untuk keperluan demo/prototipe." });
};

// GET /api/bookings/:id/transfer
exports.getTransfer = async (req, res) => {
  const booking = await findOwnedBooking(req, { adminAllowed: true });
  const facility = await facilities.findById(booking.facilityId);
  const settings = await paymentSettings.get();
  const cfg = facility && facility.paymentMethods && facility.paymentMethods.transfer;
  if (cfg && cfg.enabled === false) throw httpError(400, "Transfer bank tidak tersedia untuk layanan ini.");
  res.json({ bank: settings, amount: booking.amount, note: (cfg && cfg.note) || "" });
};

// POST /api/bookings/:id/proof  (multipart, field: proof)
exports.uploadProof = async (req, res) => {
  const booking = await findOwnedBooking(req);
  if (!req.file) throw httpError(400, "File bukti pembayaran wajib diunggah.");

  const fileUrl = `/uploads/payment_proof/${req.file.filename}`;
  const method = VALID_PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : null;
  await bookings.patch(booking.id, {
    proofFile: fileUrl,
    ...(method ? { paymentMethod: method } : {}),
    status: "menunggu_verifikasi",
  });
  res.json({ message: "Bukti pembayaran berhasil diunggah, menunggu verifikasi admin.", proofFile: fileUrl });
};

// POST /api/bookings/:id/cash
exports.payCash = async (req, res) => {
  const booking = await findOwnedBooking(req);
  if (booking.proofFile) throw httpError(400, "Bukti pembayaran sudah diunggah untuk booking ini.");
  const facility = await facilities.findById(booking.facilityId);
  const cfg = facility && facility.paymentMethods && facility.paymentMethods.cash;
  if (cfg && cfg.enabled === false) throw httpError(400, "Pembayaran tunai tidak tersedia untuk layanan ini.");
  await bookings.patch(booking.id, { paymentMethod: "cash", status: "menunggu_kedatangan" });
  res.json({ message: "Pembayaran tunai dicatat. Silakan bayar langsung di lokasi.", status: "menunggu_kedatangan" });
};

// GET /api/bookings   (admin)
exports.listAll = async (req, res) => {
  res.json({ bookings: await bookings.list() });
};

// PATCH /api/bookings/:id/status   (admin)
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status)) throw httpError(400, "Status tidak valid.");
  if (!(await bookings.findById(req.params.id))) throw httpError(404, "Booking tidak ditemukan.");
  await bookings.patch(req.params.id, { status });
  res.json({ message: "Status booking diperbarui." });
};