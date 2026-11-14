// CONTROLLER FORUM DISKUSI
import type { Request, Response } from "express";
import { threads } from "../database/forum.repo";
import { httpError } from "../middleware/error";
import { currentUser, newId, requiredText, text } from "./common";

// GET /api/forum?category=&q=
export async function list(req: Request, res: Response): Promise<void> {
  res.json(await threads.listSummary({ category: text(req.query.category as string, 100) || undefined, q: text(req.query.q as string, 100) || undefined }));
}

// GET /api/forum/categories
export async function categories(_req: Request, res: Response): Promise<void> {
  res.json(await threads.categories());
}

// GET /api/forum/:id — diskusi + balasan
export async function getOne(req: Request, res: Response): Promise<void> {
  const thread = await threads.getWithReplies(req.params.id);
  if (!thread) throw httpError(404, "Diskusi tidak ditemukan.");
  res.json(thread);
}

// POST /api/forum  { title, content, category? }
export async function create(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  const b = req.body || {};
  const thread = await threads.create({
    id: newId("th"),
    category: text(b.category, 100) || "Diskusi Umum",
    title: requiredText(b.title, "Judul", 255),
    userId: me.id,
    userName: me.name,
    content: requiredText(b.content, "Isi diskusi", 10000),
    date: new Date().toISOString(),
  });
  res.status(201).json(thread);
}

// POST /api/forum/:id/replies  { content }
export async function reply(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Diskusi tidak ditemukan.");
  const item = await threads.addReply(req.params.id, {
    id: newId("r"),
    userId: me.id,
    userName: me.name,
    content: requiredText(req.body?.content, "Balasan", 10000),
    date: new Date().toISOString(),
  });
  res.status(201).json(item);
}

// PATCH /api/forum/:id  { title?, content?, category? } (admin — moderasi)
export async function update(req: Request, res: Response): Promise<void> {
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Diskusi tidak ditemukan.");
  const b = req.body || {};
  const changes: Record<string, any> = {};
  if (b.title !== undefined) changes.title = requiredText(b.title, "Judul", 255);
  if (b.content !== undefined) changes.content = requiredText(b.content, "Isi diskusi", 10000);
  if (b.category !== undefined) changes.category = text(b.category, 100) || "Diskusi Umum";
  await threads.patch(req.params.id, changes);
  res.json(await threads.getWithReplies(req.params.id));
}

// DELETE /api/forum/:id (admin) — balasan ikut terhapus
export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Diskusi tidak ditemukan.");
  await threads.remove(req.params.id);
  res.json({ message: "Diskusi dihapus." });
}
