// CONTROLLER PENGUMUMAN
import type { Request, Response } from "express";
import { announcements } from "../database/content.repo";
import { httpError } from "../middleware/error";
import { imageValue, newId, requiredText, text } from "./common";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await announcements.list());
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const item = await announcements.findById(req.params.id);
  if (!item) throw httpError(404, "Pengumuman tidak ditemukan.");
  res.json(item);
}

export async function create(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const item = await announcements.insert({
    id: newId("an"),
    title: requiredText(b.title, "Judul", 255),
    body: requiredText(b.body, "Isi pengumuman", 20000),
    type: text(b.type, 100) || "Pengumuman",
    color: text(b.color, 30) || "brown",
    image: imageValue(b.image) ?? null,
    date: b.date || new Date().toISOString(),
  });
  res.status(201).json(item);
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await announcements.findById(req.params.id))) throw httpError(404, "Pengumuman tidak ditemukan.");
  const b = req.body || {};
  const changes: Record<string, any> = {};
  if (b.title !== undefined) changes.title = requiredText(b.title, "Judul", 255);
  if (b.body !== undefined) changes.body = requiredText(b.body, "Isi pengumuman", 20000);
  if (b.type !== undefined) changes.type = text(b.type, 100) || "Pengumuman";
  if (b.color !== undefined) changes.color = text(b.color, 30) || "brown";
  if (b.image !== undefined) changes.image = imageValue(b.image);
  if (b.date !== undefined) changes.date = b.date;
  await announcements.patch(req.params.id, changes);
  res.json(await announcements.findById(req.params.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await announcements.findById(req.params.id))) throw httpError(404, "Pengumuman tidak ditemukan.");
  await announcements.remove(req.params.id);
  res.json({ message: "Pengumuman dihapus." });
}

