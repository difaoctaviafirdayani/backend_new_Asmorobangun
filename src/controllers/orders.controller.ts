// ===========================================================================
// CONTROLLER PESANAN TOPENG — pembeli + admin.
// Alur status:
//   dibuat -> menunggu_konfirmasi_admin (batal otomatis kalau tidak dibayar dalam 24 jam)
//   bukti bayar atau bayar tunai -> menunggu_verifikasi -> admin: diproses / selesai / ditolak / dibatalkan
// ===========================================================================
import type { Request, Response } from "express";
import { topeng, topengReviews } from "../database/layanan.repo";
import { orders, paymentSettings } from "../database/registrasi.repo";
import { httpError } from "../middleware/error";
import { notifyUser } from "../modules/notifications/push.service";
import { normalizePhone } from "../utils/helpers";
import { uploadedUrl } from "../utils/upload";
import { FINAL_STATUSES, STATUSES, STATUS_LABEL, assertOwnerOrAdmin, currentUser, newId, text, toNumber } from "./common";

type Row = Record<string, any>;

async function loadOrder(req: Request): Promise<Row> {
  const me = currentUser(req.user);
  await orders.cancelExpiredUnpaid();
  const order = await orders.findById(req.params.orderId);
  if (!order) throw httpError(404, "Pesanan tidak ditemukan.");
  assertOwnerOrAdmin(me, order.userId);
  return order;
}

function assertPayable(order: Row): void {
  if (FINAL_STATUSES.includes(order.status)) throw httpError(400, `Pesanan sudah ${STATUS_LABEL[order.status] || order.status}.`);
}

// POST /api/topeng/:id/order  { qty?, buyerPhone?, customName?, customDesign?, message? }
export async function create(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  const item = await topeng.findById(req.params.id);
  if (!item) throw httpError(404, "Topeng tidak ditemukan.");

  const b = req.body || {};
  const qty = b.qty === undefined || b.qty === "" ? 1 : toNumber(b.qty, "Jumlah", { min: 1, max: 100 });
  const unitPrice = Number(item.price);
  const phone = normalizePhone(b.buyerPhone);
  if (b.buyerPhone && !/^0\d{8,14}$/.test(phone)) throw httpError(400, "Nomor HP tidak valid.");

  const id = newId("ord");
  const now = new Date().toISOString();
  const order = await orders.create({
    id,
    topengId: item.id,
    topengName: item.name,
    topengImage: item.image,
    userId: me.id,
    userName: me.name,
    buyerPhone: phone || null,
    qty,
    unitPrice,
    total: unitPrice * qty,
    customName: text(b.customName, 255) || null,
    customDesign: text(b.customDesign, 5000) || null,
    message: text(b.message, 5000) || null,
    paymentMethod: null,
    proofFile: null,
    status: "menunggu_konfirmasi_admin",
    createdAt: now,
    chatLog: [
      {
        from: "system",
        text: `Pesanan dibuat untuk ${item.name} x${qty}. Admin sanggar akan segera merespons di sini.`,
        date: now,
      },
    ],
  });
  res.status(201).json(order);
}

// GET /api/topeng/orders/mine
export async function listMine(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  await orders.cancelExpiredUnpaid();
  const mine = await orders.listByUser(me.id);
  const reviewList = await topengReviews.listByOrders(mine.map((o) => o.id));
  const byOrder = new Map(reviewList.map((r: Row) => [r.orderId, r]));
  res.json(mine.map((o) => ({ ...o, review: byOrder.get(o.id) || null })));
}

// GET /api/topeng/orders/:orderId
export async function getOne(req: Request, res: Response): Promise<void> {
  const order = await loadOrder(req);
  res.json({ ...order, review: await topengReviews.findByOrder(order.id) });
}

// GET /api/topeng/orders/:orderId/qris
export async function getQris(req: Request, res: Response): Promise<void> {
  const order = await loadOrder(req);
  assertPayable(order);
  const s = await paymentSettings.get();
  if (!s.qrisImage) throw httpError(503, "QRIS belum diatur admin. Gunakan transfer bank atau hubungi sanggar.");
  if (!order.paymentMethod) await orders.patch(order.id, { paymentMethod: "qris" });
  res.json({
    method: "qris",
    orderId: order.id,
    amount: Number(order.total),
    merchantName: s.qrisMerchantName,
    qrisImage: s.qrisImage,
    whatsapp: s.whatsapp,
  });
}

// GET /api/topeng/orders/:orderId/transfer
export async function getTransfer(req: Request, res: Response): Promise<void> {
  const order = await loadOrder(req);
  assertPayable(order);
  const s = await paymentSettings.get();
  if (!s.accountNumber) throw httpError(503, "Rekening belum diatur admin. Hubungi sanggar.");
  if (!order.paymentMethod) await orders.patch(order.id, { paymentMethod: "transfer" });
  res.json({
    method: "transfer",
    orderId: order.id,
    amount: Number(order.total),
    bankName: s.bankName,
    accountNumber: s.accountNumber,
    accountName: s.accountName,
    whatsapp: s.whatsapp,
  });
}

// POST /api/topeng/orders/:orderId/proof  (field form-data: proof)
export async function uploadProof(req: Request, res: Response): Promise<void> {
  const order = await loadOrder(req);
  assertPayable(order);
  if (!req.file) throw httpError(400, "Bukti pembayaran wajib diunggah (field: proof).");
  await orders.patch(order.id, {
    proofFile: uploadedUrl(req.file, "payment_proof"),
    paymentMethod: order.paymentMethod && order.paymentMethod !== "cash" ? order.paymentMethod : "transfer",
    status: "menunggu_verifikasi",
  });
  await orders.addChat(order.id, { from: "system", text: "Bukti pembayaran diunggah. Menunggu verifikasi admin." });
  res.json(await orders.findById(order.id));
}

// POST /api/topeng/orders/:orderId/cash
export async function payCash(req: Request, res: Response): Promise<void> {
  const order = await loadOrder(req);
  assertPayable(order);
  await orders.patch(order.id, { paymentMethod: "cash", status: "menunggu_verifikasi" });
  await orders.addChat(order.id, { from: "system", text: "Pembeli memilih bayar tunai di lokasi." });
  res.json(await orders.findById(order.id));
}

// GET /api/topeng/admin/orders (admin) — ?status=
export async function listAll(req: Request, res: Response): Promise<void> {
  await orders.cancelExpiredUnpaid();
  const status = text(req.query.status as string, 40);
  res.json(await orders.list(status ? { where: "status = ?", params: [status] } : undefined));
}

// PATCH /api/topeng/admin/orders/:orderId/status  { status, message? } (admin)
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const order = await orders.findById(req.params.orderId);
  if (!order) throw httpError(404, "Pesanan tidak ditemukan.");
  const status = text(req.body?.status, 40);
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw httpError(400, `Status tidak valid. Pilihan: ${STATUSES.join(", ")}.`);
  }
  await orders.patch(order.id, { status });

  const note = text(req.body?.message, 1000);
  await orders.addChat(order.id, { from: "system", text: `Status pesanan: ${STATUS_LABEL[status] || status}.` });
  if (note) await orders.addChat(order.id, { from: "admin", text: note });

  await notifyUser(order.userId, {
    title: "Status pesanan diperbarui",
    body: `${order.topengName}: ${STATUS_LABEL[status] || status}.`,
    data: { type: "order", id: order.id, status },
  });
  res.json(await orders.findById(order.id));
}
