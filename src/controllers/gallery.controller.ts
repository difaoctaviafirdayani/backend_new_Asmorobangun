// CONTROLLER GALERI
import type { Request, Response } from "express";
import { gallery } from "../database/content.repo";
import { httpError } from "../middleware/error";
import { imageValue, newId, requiredText, text } from "./common";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await gallery.list());
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const item = await gallery.findById(req.params.id);
  if (!item) throw httpError(404, "Foto galeri tidak ditemukan.");
  res.json(item);
}

export async function create(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const image = imageValue(b.image);
  if (!image) throw httpError(400, "Gambar wajib diisi.");
  const item = await gallery.insert({
    id: newId("gal"),
    title: requiredText(b.title, "Judul", 255),
    caption: text(b.caption, 5000),
    image,
    date: b.date || new Date().toISOString(),
  });
  res.status(201).json(item);
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await gallery.findById(req.params.id))) throw httpError(404, "Foto galeri tidak ditemukan.");
  const b = req.body || {};
  const changes: Record<string, any> = {};
  if (b.title !== undefined) changes.title = requiredText(b.title, "Judul", 255);
  if (b.caption !== undefined) changes.caption = text(b.caption, 5000);
  if (b.image !== undefined) {
    const image = imageValue(b.image);
    if (!image) throw httpError(400, "Gambar tidak boleh kosong.");
    changes.image = image;
  }
  if (b.date !== undefined) changes.date = b.date;
  await gallery.patch(req.params.id, changes);
  res.json(await gallery.findById(req.params.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await gallery.findById(req.params.id))) throw httpError(404, "Foto galeri tidak ditemukan.");
  await gallery.remove(req.params.id);
  res.json({ message: "Foto galeri dihapus." });
}
