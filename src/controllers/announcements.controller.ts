import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { announcements } from "../database/content.repo";
import { httpError } from "../middleware/error";
import { notifyAllMembers } from "../modules/notifications/notify.service";
import { ANNOUNCEMENT_CATEGORIES, exactCategory } from "../config/rules";

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
  if (!title || !body)
    throw httpError(400, "Judul dan isi pengumuman wajib diisi.");
  const cat =
    type === undefined || type === null || type === ""
      ? "Umum"
      : exactCategory(type, ANNOUNCEMENT_CATEGORIES);
  if (!cat)
    throw httpError(
      400,
      `Kategori harus salah satu dari: ${ANNOUNCEMENT_CATEGORIES.join(", ")}.`,
    );
  const item = await announcements.insert({
    id: `an-${nanoid(8)}`,
    title,
    body,
    type: cat,
    color: color || "brown",
    image: image || null,
    date: new Date().toISOString(),
  });
  if (!item) throw httpError(500, "Pengumuman gagal disimpan.");
  await notifyAllMembers({
    type: "announcement",
    title: `Pengumuman baru: ${String(title).slice(0, 80)}`,
    body: String(body).slice(0, 120),
    refId: String(item.id),
    refType: "announcement",
    dedupeKey: `announcement:${item.id}`,
  });
  res.status(201).json({ announcement: item });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await announcements.findById(req.params.id)))
    throw httpError(404, "Pengumuman tidak ditemukan.");
  const changes = { ...req.body };
  if (changes.type !== undefined) {
    const cat = exactCategory(changes.type, ANNOUNCEMENT_CATEGORIES);
    if (!cat)
      throw httpError(
        400,
        `Kategori harus salah satu dari: ${ANNOUNCEMENT_CATEGORIES.join(", ")}.`,
      );
    changes.type = cat;
  }
  await announcements.patch(req.params.id, changes);
  res.json({ message: "Pengumuman diperbarui." });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await announcements.remove(req.params.id);
  res.json({ message: "Pengumuman dihapus." });
}
