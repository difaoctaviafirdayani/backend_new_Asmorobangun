// CONTROLLER TOKEN PERANGKAT (push notification)
import type { Request, Response } from "express";
import * as pushRepo from "../database/push.repo";
import { httpError } from "../middleware/error";
import { currentUser, text } from "./common";

// POST /api/notifications/token  { token, platform? }
export async function registerToken(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  const token = text(req.body?.token, 512);
  if (!token) throw httpError(400, "Token perangkat wajib diisi.");
  const platform = text(req.body?.platform, 20) || "android";
  await pushRepo.saveToken(me.id, token, platform);
  res.status(201).json({ message: "Token perangkat disimpan." });
}

// DELETE /api/notifications/token  { token }
export async function unregisterToken(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  const token = text(req.body?.token ?? req.query.token, 512);
  if (!token) throw httpError(400, "Token perangkat wajib diisi.");
  await pushRepo.removeToken(me.id, token);
  res.json({ message: "Token perangkat dihapus." });
}
