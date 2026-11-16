import type { Request, Response } from "express";
import * as inbox from "../../database/notifications.repo";
import * as pushRepo from "../../database/push.repo";
import { httpError } from "../../middleware/error";
import type { AuthedRequest } from "../../types/auth";
import { sweepPayments } from "./sweeper";

const readToken = (req: Request): string => {
  const token = String(req.body?.token ?? "").trim();
  if (token.length < 20 || token.length > 512) throw httpError(400, "Token perangkat tidak valid.");
  return token;
};

export async function list(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  await sweepPayments();
  const [notifications, unreadCount] = await Promise.all([inbox.listByUser(user.id), inbox.unreadCount(user.id)]);
  res.json({ notifications, unreadCount });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  await inbox.markRead(user.id, req.params.id);
  res.json({ success: true });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  await inbox.markAllRead(user.id);
  res.json({ success: true });
}

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
