import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { announcements } from "../../database/content.repo";
import { httpError } from "../../middleware/error";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json({ announcements: await announcements.list() });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const item = await announcements.findById(req.params.id);
  if (!item) throw httpError(404, "Pengumuman tidak ditemukan.");
  res.json({ announcement: item });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { title, body, type, color, image } = req.body;
  if (!title || !body) throw httpError(400, "Judul dan isi pengumuman wajib diisi.");
  const item = await announcements.insert({
    id: `an-${nanoid(8)}`,
    title,
    body,
    type: type || "Pengumuman",
    color: color || "brown",
    image: image || null,
    date: new Date().toISOString(),
  });
  res.status(201).json({ announcement: item });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await announcements.findById(req.params.id))) throw httpError(404, "Pengumuman tidak ditemukan.");
  await announcements.patch(req.params.id, req.body);
  res.json({ message: "Pengumuman diperbarui." });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await announcements.remove(req.params.id);
  res.json({ message: "Pengumuman dihapus." });
}