// CONTROLLER PENGATURAN PEMBAYARAN (rekening bank, QRIS, WhatsApp)
import type { Request, Response } from "express";
import { paymentSettings } from "../database/registrasi.repo";
import { httpError } from "../middleware/error";

const FIELDS: Record<string, number> = {
  bankName: 100,
  accountNumber: 60,
  accountName: 150,
  qrisMerchantName: 150,
  qrisImage: 16_000_000, // boleh URL gambar atau data URL
  whatsapp: 30,
};

// GET /api/payments/settings (pengguna login)
export async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json(await paymentSettings.get());
}

// PATCH /api/payments/settings (admin)
export async function updateSettings(req: Request, res: Response): Promise<void> {
  const body = req.body || {};
  const changes: Record<string, string> = {};
  for (const [key, max] of Object.entries(FIELDS)) {
    if (body[key] === undefined) continue;
    if (body[key] !== null && typeof body[key] !== "string") throw httpError(400, `${key} harus berupa teks.`);
    const value = String(body[key] ?? "").trim();
    if (value.length > max) throw httpError(400, `${key} terlalu panjang.`);
    changes[key] = key === "whatsapp" ? value.replace(/[^\d]/g, "") : value;
  }
  await paymentSettings.update(changes);
  res.json(await paymentSettings.get());
}
