const QRCode = require("qrcode");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { sortNewest } = require("../../utils/helpers");

const VALID_PAYMENT_METHODS = ["qris", "transfer", "cash"];
const VALID_STATUS = ["menunggu_konfirmasi_admin", "menunggu_verifikasi", "dikonfirmasi", "diproses", "dikirim", "selesai", "ditolak"];

function findOrder(db, req, { adminAllowed = false } = {}) {
  const order = db.topengOrders.find((o) => o.id === req.params.orderId);
  if (!order) throw httpError(404, "Pesanan tidak ditemukan.");
  const isOwner = order.userId === req.user.id;
  if (!isOwner && !(adminAllowed && req.user.role === "admin")) throw httpError(403, "Tidak diizinkan.");
  return order;
}

// POST /api/topeng/:id/order
exports.create = async (req, res) => {
  const { qty, customName, customDesign, message, paymentMethod, buyerPhone } = req.body;
  const item = readDB().topeng.find((t) => t.id === req.params.id);
  if (!item) throw httpError(404, "Topeng tidak ditemukan.");

  const quantity = Math.min(100, Math.max(1, Math.floor(Number(qty)) || 1));
  const method = VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : null;
  const now = new Date().toISOString();
  const order = {
    id: `ord-${nanoid(8)}`,
    topengId: item.id,
    topengName: item.name,
    topengImage: item.image,
    userId: req.user.id,
    userName: req.user.name,
    buyerPhone: buyerPhone || "",
    qty: quantity,
    unitPrice: item.price,
    total: item.price * quantity,
    customName: customName || null,
    customDesign: customDesign || null,
    message: message || "",
    paymentMethod: method,
    proofFile: null,
    status: "menunggu_konfirmasi_admin",
    createdAt: now,
    chatLog: [
      {
        from: "system",
        text: `Pesanan dibuat untuk ${item.name} x${quantity}. Admin sanggar akan segera merespons di sini.`,
        date: now,
      },
    ],
  };
  await update((data) => data.topengOrders.push(order));
  res.status(201).json({ order });
};

// GET /api/topeng/orders/mine
exports.listMine = (req, res) => {
  const mine = readDB().topengOrders.filter((o) => o.userId === req.user.id);
  res.json({ orders: sortNewest(mine, "createdAt") });
};

// GET /api/topeng/orders/:orderId
exports.getOne = (req, res) => {
  res.json({ order: findOrder(readDB(), req, { adminAllowed: true }) });
};

// GET /api/topeng/orders/:orderId/qris
exports.getQris = async (req, res) => {
  const db = readDB();
  const order = findOrder(db, req, { adminAllowed: true });
  if (db.paymentSettings.qrisImage) {
    return res.json({
      qris: db.paymentSettings.qrisImage,
      amount: order.total,
      note: "Scan QRIS sanggar, lalu unggah bukti pembayaran.",
    });
  }
  const payload = `ASMOROBANGUN|ORDER:${order.id}|NOMINAL:${order.total}|${db.paymentSettings.qrisMerchantName || ""}`;
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  res.json({ qris: dataUrl, amount: order.total, note: "QRIS simulasi untuk keperluan demo/prototipe." });
};

// GET /api/topeng/orders/:orderId/transfer
exports.getTransfer = (req, res) => {
  const db = readDB();
  const order = findOrder(db, req, { adminAllowed: true });
  res.json({ bank: db.paymentSettings, amount: order.total });
};

// POST /api/topeng/orders/:orderId/proof  (multipart, field: proof)
exports.uploadProof = async (req, res) => {
  const order = findOrder(readDB(), req);
  if (!req.file) throw httpError(400, "File bukti pembayaran wajib diunggah.");
  const fileUrl = `/uploads/payment_proof/${req.file.filename}`;
  const method = VALID_PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : null;
  await update((data) => {
    const o = data.topengOrders.find((x) => x.id === order.id);
    o.proofFile = fileUrl;
    if (method) o.paymentMethod = method;
    o.status = "menunggu_verifikasi";
  });
  res.json({ message: "Bukti pembayaran diunggah.", proofFile: fileUrl });
};

// POST /api/topeng/orders/:orderId/cash
exports.payCash = async (req, res) => {
  const order = findOrder(readDB(), req);
  if (order.proofFile) throw httpError(400, "Bukti pembayaran sudah diunggah untuk pesanan ini.");
  await update((data) => {
    const o = data.topengOrders.find((x) => x.id === order.id);
    o.paymentMethod = "cash";
    o.chatLog = o.chatLog || [];
    o.chatLog.push({
      from: "system",
      text: "Pembeli memilih pembayaran tunai (bayar langsung di sanggar).",
      date: new Date().toISOString(),
    });
  });
  res.json({ message: "Pembayaran tunai dicatat.", paymentMethod: "cash" });
};

// GET /api/topeng/admin/orders   (admin)
exports.listAll = (req, res) => {
  res.json({ orders: sortNewest(readDB().topengOrders, "createdAt") });
};

// PATCH /api/topeng/admin/orders/:orderId/status   (admin)
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status)) throw httpError(400, "Status tidak valid.");
  if (!readDB().topengOrders.find((o) => o.id === req.params.orderId)) throw httpError(404, "Pesanan tidak ditemukan.");
  await update((data) => {
    data.topengOrders.find((o) => o.id === req.params.orderId).status = status;
  });
  res.json({ message: "Status pesanan diperbarui." });
};
