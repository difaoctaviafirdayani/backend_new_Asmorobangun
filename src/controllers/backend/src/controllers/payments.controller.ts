import type { Request, Response } from "express";
import { paymentSettings } from "../database/registrasi.repo";

// GET /api/payments/settings
export async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json({ settings: await paymentSettings.get() });
}

// PATCH /api/payments/settings
export async function updateSettings(req: Request, res: Response): Promise<void> {
  await paymentSettings.update(req.body || {});
  res.json({ message: "Pengaturan pembayaran diperbarui." });
}