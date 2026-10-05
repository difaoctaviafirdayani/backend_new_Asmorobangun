const express = require("express");
const QRCode = require("qrcode");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { makeUploader } = require("../upload");

const router = express.Router();
const uploadProof = makeUploader("payment_proof");

router.get("/", (req, res) => {
  const db = readDB();
  res.json({ topeng: db.topeng });
});

router.get("/:id", (req, res) => {
  const db = readDB();
  const item = db.topeng.find((t) => t.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Topeng tidak ditemukan." });
  res.json({ topeng: item });
});

// POST /api/topeng/:id/order  -- "pesan lewat chat" flow, supports custom name/design request
router.post("/:id/order", requireAuth, async (req, res) => {
  const { qty, customName, customDesign, message, paymentMethod, buyerPhone } = req.body;
  const db = readDB();
  const item = db.topeng.find((t) => t.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Topeng tidak ditemukan." });

  const quantity = Math.max(1, Number(qty) || 1);
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
    paymentMethod: paymentMethod || null,
    proofFile: null,
    status: "menunggu_konfirmasi_admin",
    createdAt: new Date().toISOString(),
    chatLog: [
      {
        from: "system",
        text: `Pesanan dibuat untuk ${item.name} x${quantity}. Admin sanggar akan segera merespons di sini.`,
        date: new Date().toISOString(),
      },
    ],
  };
  await update((data) => data.topengOrders.push(order));
  res.status(201).json({ order });
});

router.get("/orders/:orderId/qris", requireAuth, async (req, res) => {
  const db = readDB();
  const order = db.topengOrders.find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
  if (order.userId !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Tidak diizinkan." });
  if (db.paymentSettings.qrisImage) {
    return res.json({ qris: db.paymentSettings.qrisImage, amount: order.total, note: "Scan QRIS sanggar, lalu unggah bukti pembayaran." });
  }
  const payload = `ASMOROBANGUN|ORDER:${order.id}|NOMINAL:${order.total}|${db.paymentSettings.qrisMerchantName}`;
  try {
    const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
    res.json({ qris: dataUrl, amount: order.total, note: "QRIS simulasi untuk keperluan demo/prototipe." });
  } catch (err) {
    res.status(500).json({ error: "Gagal membuat QRIS." });
  }
});

// GET /api/topeng/orders/:orderId/transfer -- bank account details, only after phone verification
router.get("/orders/:orderId/transfer", requireAuth, (req, res) => {
  const db = readDB();
  const order = db.topengOrders.find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
  if (order.userId !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Tidak diizinkan." });
  res.json({ bank: db.paymentSettings, amount: order.total });
});

router.post("/orders/:orderId/proof", requireAuth, uploadProof.single("proof"), async (req, res) => {
  const db = readDB();
  const order = db.topengOrders.find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
  if (order.userId !== req.user.id) return res.status(403).json({ error: "Tidak diizinkan." });
  if (!req.file) return res.status(400).json({ error: "File bukti pembayaran wajib diunggah." });
  const fileUrl = `/uploads/payment_proof/${req.file.filename}`;
  const { paymentMethod } = req.body;
  await update((data) => {
    const o = data.topengOrders.find((x) => x.id === req.params.orderId);
    o.proofFile = fileUrl;
    if (paymentMethod) o.paymentMethod = paymentMethod;
    o.status = "menunggu_verifikasi";
  });
  res.json({ message: "Bukti pembayaran diunggah.", proofFile: fileUrl });
});

// POST /api/topeng/orders/:orderId/cash -- pilih bayar tunai (tanpa bukti pembayaran)
router.post("/orders/:orderId/cash", requireAuth, async (req, res) => {
  const db = readDB();
  const order = db.topengOrders.find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
  if (order.userId !== req.user.id) return res.status(403).json({ error: "Tidak diizinkan." });
  if (order.proofFile) return res.status(400).json({ error: "Bukti pembayaran sudah diunggah untuk pesanan ini." });
  await update((data) => {
    const o = data.topengOrders.find((x) => x.id === req.params.orderId);
    o.paymentMethod = "cash";
    o.chatLog.push({ from: "system", text: "Pembeli memilih pembayaran tunai (bayar langsung di sanggar).", date: new Date().toISOString() });
  });
  res.json({ message: "Pembayaran tunai dicatat.", paymentMethod: "cash" });
});

router.get("/orders/mine", requireAuth, (req, res) => {
  const db = readDB();
  const mine = db.topengOrders
    .filter((o) => o.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders: mine });
});

router.get("/orders/:orderId", requireAuth, (req, res) => {
  const db = readDB();
  const order = db.topengOrders.find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
  if (order.userId !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Tidak diizinkan." });
  res.json({ order });
});

// ---- Admin ----
router.get("/admin/orders", requireAuth, requireAdmin, (req, res) => {
  const db = readDB();
  res.json({ orders: [...db.topengOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

router.patch("/admin/orders/:orderId/status", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const allowed = ["menunggu_konfirmasi_admin", "menunggu_verifikasi", "dikonfirmasi", "diproses", "dikirim", "selesai", "ditolak"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Status tidak valid." });
  const db = readDB();
  const order = db.topengOrders.find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
  await update((data) => {
    data.topengOrders.find((o) => o.id === req.params.orderId).status = status;
  });
  res.json({ message: "Status pesanan diperbarui." });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, character, color, price, stock, image, desc } = req.body;
  if (!name || !price) return res.status(400).json({ error: "Nama dan harga wajib diisi." });
  const item = {
    id: `tp-${nanoid(6)}`,
    name,
    character: character || "",
    color: color || "",
    price: Number(price),
    stock: Number(stock) || 0,
    image: image || "topeng-default.jpg",
    desc: desc || "",
  };
  await update((data) => data.topeng.push(item));
  res.status(201).json({ topeng: item });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const db = readDB();
  const item = db.topeng.find((t) => t.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Topeng tidak ditemukan." });
  await update((data) => {
    const body = { ...req.body };
    if (body.price !== undefined) body.price = Number(body.price);
    if (body.stock !== undefined) body.stock = Number(body.stock) || 0;
    Object.assign(data.topeng.find((t) => t.id === req.params.id), body);
  });
  res.json({ message: "Topeng diperbarui." });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await update((data) => {
    data.topeng = data.topeng.filter((t) => t.id !== req.params.id);
  });
  res.json({ message: "Topeng dihapus dari katalog." });
});

module.exports = router;
