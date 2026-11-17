import type { Request, Response } from "express";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { topeng } from "../database/layanan.repo";
import { orders, paymentSettings } from "../database/registrasi.repo";
import { httpError } from "../middleware/error";
import { uploadedUrl } from "../utils/upload";
import { notify, topengStatusText } from "../modules/notifications/notify.service";
import { sweepPayments } from "../modules/notifications/sweeper";
import { TOPENG_STATUS } from "../config/rules";
import type { AuthedRequest } from "../types/auth";
import { attachOrderReviews } from "./reviews.controller";

// Pesanan topeng hanya dibayar lewat QRIS atau transfer (butuh bukti bayar).
const VALID_PAYMENT_METHODS = ["qris", "transfer"];
const VALID_STATUS: readonly string[] = TOPENG_STATUS;

// Alamat tujuan pengiriman (dalam negeri).
interface ShippingInput {
  recipientName: string;
  recipientPhone: string;
  address: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
}

function readShipping(raw: any): ShippingInput {
  if (!raw || typeof raw !== "object")
    throw httpError(400, "Alamat pengiriman wajib diisi.");
  const text = (
    v: unknown,
    label: string,
    min: number,
    max: number,
  ): string => {
    const t = String(v ?? "")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .trim();
    if (t.length < min)
      throw httpError(400, `${label} wajib diisi (minimal ${min} karakter).`);
    if (t.length > max)
      throw httpError(400, `${label} maksimal ${max} karakter.`);
    return t;
  };
  const phone = String(raw.recipientPhone ?? "").replace(/[\s-]/g, "");
  if (!/^(?:\+62|62|0)8[1-9][0-9]{7,11}$/.test(phone))
    throw httpError(
      400,
      "Nomor HP penerima tidak valid. Gunakan format 08xxxxxxxxxx.",
    );
  const postalCode = String(raw.postalCode ?? "").trim();
  if (!/^\d{5}$/.test(postalCode))
    throw httpError(400, "Kode pos harus 5 angka.");
  return {
    recipientName: text(raw.recipientName, "Nama penerima", 2, 60),
    recipientPhone: phone,
    address: text(raw.address, "Alamat lengkap", 8, 200),
    village: text(raw.village, "Kelurahan/desa", 3, 80),
    district: text(raw.district, "Kecamatan", 3, 80),
    city: text(raw.city, "Kota/kabupaten", 3, 80),
    province: text(raw.province, "Provinsi", 3, 60),
    postalCode,
  };
}

async function findOrder(
  req: Request,
  { adminAllowed = false } = {},
): Promise<Record<string, any>> {
  const { user } = req as AuthedRequest;
  await sweepPayments();
  const order = await orders.findById(req.params.orderId);
  if (!order) throw httpError(404, "Pesanan tidak ditemukan.");
  const isOwner = order.userId === user.id;
  if (!isOwner && !(adminAllowed && user.role === "admin"))
    throw httpError(403, "Tidak diizinkan.");
  return order;
}

// POST /api/topeng/:id/order
export async function create(req: Request, res: Response): Promise<void> {
  // Topeng hanya dari katalog: input custom dari pelanggan diabaikan.
  req.body.customName = undefined;
  req.body.customDesign = undefined;
  req.body.message = undefined;
  const { user } = req as AuthedRequest;
  const { qty, customName, customDesign, message, paymentMethod, buyerPhone } =
    req.body;
  const item = await topeng.findById(req.params.id);
  if (!item) throw httpError(404, "Topeng tidak ditemukan.");
  const shipping = readShipping(req.body.shipping);

  const quantity = Math.min(100, Math.max(1, Math.floor(Number(qty)) || 1));
  const method = VALID_PAYMENT_METHODS.includes(paymentMethod)
    ? paymentMethod
    : null;
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
    shipping,
    status: "menunggu_pembayaran",
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
  await sweepPayments();
  res.json({
    orders: await attachOrderReviews(await orders.listByUser(user.id)),
  });
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
  res.json({
    qris: dataUrl,
    amount: order.total,
    note: "QRIS simulasi untuk keperluan demo/prototipe.",
  });
}

// GET /api/topeng/orders/:orderId/transfer
export async function getTransfer(req: Request, res: Response): Promise<void> {
  const order = await findOrder(req, { adminAllowed: true });
  res.json({ bank: await paymentSettings.get(), amount: order.total });
}

// POST /api/topeng/orders/:orderId/proof  (multipart, field: proof)
export async function uploadProof(req: Request, res: Response): Promise<void> {
  const order = await findOrder(req);
  if (order.status === "dibatalkan")
    throw httpError(
      400,
      "Pesanan sudah dibatalkan karena tidak dibayar dalam 24 jam. Silakan buat pesanan baru.",
    );
  if (
    order.status !== "menunggu_pembayaran" &&
    order.status !== "menunggu_verifikasi"
  ) {
    throw httpError(400, "Pembayaran pesanan ini sudah diverifikasi.");
  }
  if (!req.file) throw httpError(400, "File bukti pembayaran wajib diunggah.");
  const fileUrl = uploadedUrl(req.file, "payment_proof");
  const method = VALID_PAYMENT_METHODS.includes(req.body.paymentMethod)
    ? req.body.paymentMethod
    : null;
  await orders.patch(order.id, {
    proofFile: fileUrl,
    ...(method ? { paymentMethod: method } : {}),
    status: "menunggu_verifikasi",
  });
  res.json({ message: "Bukti pembayaran diunggah.", proofFile: fileUrl });
}

// POST /api/topeng/orders/:orderId/cash  -> tidak tersedia: topeng dibayar di muka lewat QRIS atau transfer
export async function payCash(_req: Request, _res: Response): Promise<void> {
  throw httpError(
    400,
    "Pesanan topeng hanya bisa dibayar lewat QRIS atau transfer bank.",
  );
}

// GET /api/topeng/admin/orders   (admin)
export async function listAll(_req: Request, res: Response): Promise<void> {
  await sweepPayments();
  res.json({ orders: await orders.list() });
}

// PATCH /api/topeng/admin/orders/:orderId/status   (admin)
// body: { status, courier?, trackingNumber? }  — resi wajib saat status "dikirim".
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status))
    throw httpError(400, "Status tidak valid.");
  const order = await orders.findById(req.params.orderId);
  if (!order) throw httpError(404, "Pesanan tidak ditemukan.");

  const changes: Record<string, any> = { status };
  const courier = String(req.body.courier ?? "")
    .trim()
    .slice(0, 80);
  const trackingNumber = String(req.body.trackingNumber ?? "")
    .trim()
    .slice(0, 80);
  if (courier) changes.courier = courier;
  if (trackingNumber) changes.trackingNumber = trackingNumber;

  if (status === "dikirim") {
    if (!(trackingNumber || order.trackingNumber))
      throw httpError(
        400,
        "Isi nomor resi sebelum mengubah status menjadi Dikirim.",
      );
    if (!(courier || order.courier))
      throw httpError(
        400,
        "Isi nama ekspedisi sebelum mengubah status menjadi Dikirim.",
      );
  }

  await orders.patch(req.params.orderId, changes);
  if (status !== order.status) {
    await orders.addChat(order.id, {
      from: "system",
      text: `Status pesanan: ${String(status).replace(/_/g, " ")}.`,
    });
    const text = topengStatusText(order.topengName, status, {
      courier: courier || order.courier,
      trackingNumber: trackingNumber || order.trackingNumber,
    });
    await notify(order.userId, {
      type: "order",
      ...text,
      refId: String(order.id),
      refType: "topeng",
    });
  }
  res.json({ message: "Status pesanan diperbarui." });
}
