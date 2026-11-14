import type { Request, Response } from "express";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { topeng } from "../database/layanan.repo";
import { orders, paymentSettings } from "../database/registrasi.repo";
import { httpError } from "../middleware/error";
import { uploadedUrl } from "../utils/upload";
import { notifyUser } from "../modules/notifications/push.service";
import type { AuthedRequest } from "../types/auth";
import { attachOrderReviews } from "./reviews.controller";

const VALID_PAYMENT_METHODS = ["qris", "transfer", "cash"];
const VALID_STATUS = ["menunggu_konfirmasi_admin", "menunggu_verifikasi", "dikonfirmasi", "diproses", "dikirim", "selesai", "ditolak", "dibatalkan"];

async function findOrder(req: Request, { adminAllowed = false } = {}): Promise<Record<string, any>> {
  const { user } = req as AuthedRequest;
  await orders.cancelExpiredUnpaid();
  const order = await orders.findById(req.params.orderId);
  if (!order) throw httpError(404, "Pesanan tidak ditemukan.");
  const isOwner = order.userId === user.id;
  if (!isOwner && !(adminAllowed && user.role === "admin")) throw httpError(403, "Tidak diizinkan.");
  return order;
}

// POST /api/topeng/:id/order
export async function create(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  const { qty, customName, customDesign, message, paymentMethod, buyerPhone } = req.body;
  const item = await topeng.findById(req.params.id);
  if (!item) throw httpError(404, "Topeng tidak ditemukan.");

  const quantity = Math.min(100, Math.max(1, Math.floor(Number(qty)) || 1));
  const method = VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : null;
  const now = new Date().toISOString();
  const order = {
    id: `ord-${nanoid(8)}`,
    topengId: item.id,
    topengName: item.name,
    topengImage: item.image,
    userId: user.id,
    userName: user.name,
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
  res.status(201).json({ order: await orders.create(order) });
}

// GET /api/topeng/orders/mine
export async function listMine(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  await orders.cancelExpiredUnpaid();
  res.json({ orders: await attachOrderReviews(await orders.listByUser(user.id)) });
}

// GET /api/topeng/orders/:orderId
export async function getOne(req: Request, res: Response): Promise<void> {
  res.json({ order: await findOrder(req, { adminAllowed: true }) });
}

// GET /api/topeng/orders/:orderId/qris
export async function getQris(req: Request, res: Response): Promise<void> {
  const order = await findOrder(req, { adminAllowed: true });
  const settings = await paymentSettings.get();
  if (settings.qrisImage) {
    res.json({
      qris: settings.qrisImage,
      amount: order.total,
      note: "Scan QRIS sanggar, lalu unggah bukti pembayaran.",
    });
    return;
  }
  const payload = `ASMOROBANGUN|ORDER:${order.id}|NOMINAL:${order.total}|${settings.qrisMerchantName || ""}`;
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  res.json({ qris: dataUrl, amount: order.total, note: "QRIS simulasi untuk keperluan demo/prototipe." });
}

// GET /api/topeng/orders/:orderId/transfer
export async function getTransfer(req: Request, res: Response): Promise<void> {
  const order = await findOrder(req, { adminAllowed: true });
  res.json({ bank: await paymentSettings.get(), amount: order.total });
}

// POST /api/topeng/orders/:orderId/proof  (multipart, field: proof)
export async function uploadProof(req: Request, res: Response): Promise<void> {
  const order = await findOrder(req);
  if (order.status === "dibatalkan") throw httpError(400, "Pesanan sudah dibatalkan karena tidak dibayar dalam 24 jam. Silakan buat pesanan baru.");
  if (!req.file) throw httpError(400, "File bukti pembayaran wajib diunggah.");
  const fileUrl = `/uploads/payment_proof/${req.file.filename}`;
  const method = VALID_PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : null;
  await orders.patch(order.id, {
    proofFile: fileUrl,
    ...(method ? { paymentMethod: method } : {}),
    status: "menunggu_verifikasi",
  });
  res.json({ message: "Bukti pembayaran diunggah.", proofFile: fileUrl });
}

// POST /api/topeng/orders/:orderId/cash
export async function payCash(req: Request, res: Response): Promise<void> {
  const order = await findOrder(req);
  if (order.status === "dibatalkan") throw httpError(400, "Pesanan sudah dibatalkan karena tidak dibayar dalam 24 jam. Silakan buat pesanan baru.");
  if (order.proofFile) throw httpError(400, "Bukti pembayaran sudah diunggah untuk pesanan ini.");
  await orders.patch(order.id, { paymentMethod: "cash" });
  await orders.addChat(order.id, {
    from: "system",
    text: "Pembeli memilih pembayaran tunai (bayar langsung di sanggar).",
    date: new Date().toISOString(),
  });
  res.json({ message: "Pembayaran tunai dicatat.", paymentMethod: "cash" });
}

// GET /api/topeng/admin/orders   (admin)
export async function listAll(_req: Request, res: Response): Promise<void> {
  await orders.cancelExpiredUnpaid();
  res.json({ orders: await orders.list() });
}

// PATCH /api/topeng/admin/orders/:orderId/status   (admin)
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status)) throw httpError(400, "Status tidak valid.");
  const order = await orders.findById(req.params.orderId);
  if (!order) throw httpError(404, "Pesanan tidak ditemukan.");
  await orders.patch(req.params.orderId, { status });
  // Beri tahu pembeli lewat push notification (tidak pernah melempar error)
  await notifyUser(order.userId, {
    title: "Status pesanan diperbarui",
    body: `Pesanan ${order.topengName}: ${String(status).replace(/_/g, " ")}`,
    data: { type: "order", orderId: String(order.id), status },
  });
  res.json({ message: "Status pesanan diperbarui." });
}
