import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { gallery } from "../database/content.repo";
import { httpError } from "../middleware/error";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json({ gallery: await gallery.list() });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const item = await gallery.findById(req.params.id);
  if (!item) throw httpError(404, "Item galeri tidak ditemukan.");
  res.json({ item });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { title, caption, image } = req.body;
  if (!title || !image) throw httpError(400, "Judul dan gambar wajib diisi.");
  const item = await gallery.insert({
    id: `gal-${nanoid(8)}`,
    title,
    caption: caption || "",
    image,
    date: new Date().toISOString(),
  });
  res.status(201).json({ item });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await gallery.findById(req.params.id))) throw httpError(404, "Item galeri tidak ditemukan.");
  await gallery.patch(req.params.id, req.body);
  res.json({ message: "Item galeri diperbarui." });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await gallery.remove(req.params.id);
  res.json({ message: "Item galeri dihapus." });
}