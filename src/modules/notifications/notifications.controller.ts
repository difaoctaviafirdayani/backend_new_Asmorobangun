// =============================================================================
// NOTIFIKASI — mobile mendaftarkan token perangkat (FCM) ke backend.
//   POST   /api/notifications/token   body: { token, platform? }
//   DELETE /api/notifications/token   body: { token }   (dipanggil saat logout di HP)
// =============================================================================
import type { Request, Response } from "express";
import * as pushRepo from "../../database/push.repo";
import { httpError } from "../../middleware/error";
import type { AuthedRequest } from "../../types/auth";

const readToken = (req: Request): string => {
  const token = String(req.body?.token ?? "").trim();
  if (token.length < 20 || token.length > 512) throw httpError(400, "Token perangkat tidak valid.");
  return token;
};

export async function registerToken(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  const platform = String(req.body?.platform ?? "android").slice(0, 20);
  await pushRepo.saveToken(user.id, readToken(req), platform);
  res.status(201).json({ success: true, message: "Token notifikasi tersimpan." });
}

export async function unregisterToken(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  await pushRepo.removeToken(user.id, readToken(req));
  res.json({ success: true, message: "Token notifikasi dihapus." });
}