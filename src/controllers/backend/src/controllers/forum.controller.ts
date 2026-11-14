// ===========================================================================
// KOMUNITAS › FORUM — membaca/menulis ke MySQL (lewat forum.repo.ts).
// ===========================================================================
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { threads } from "../database/forum.repo";
import { httpError } from "../middleware/error";
import type { AuthedRequest } from "../types/auth";

const DEFAULT_CATEGORIES = ["Diskusi Umum", "Kelas Tari", "Karawitan", "Topeng", "Acara & Booking"];

// GET /api/forum?category=&q=
export async function list(req: Request, res: Response): Promise<void> {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  res.json({ threads: await threads.listSummary({ category, q }) });
}

// GET /api/forum/categories
export async function categories(_req: Request, res: Response): Promise<void> {
  const cats = await threads.categories();
  res.json({ categories: cats.length ? cats : DEFAULT_CATEGORIES });
}

// GET /api/forum/:id
export async function getOne(req: Request, res: Response): Promise<void> {
  const thread = await threads.getWithReplies(req.params.id);
  if (!thread) throw httpError(404, "Thread tidak ditemukan.");
  res.json({ thread });
}

// POST /api/forum
export async function create(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  const { title, content, category } = req.body;
  if (!title || !content || !String(title).trim() || !String(content).trim()) {
    throw httpError(400, "Judul dan isi diskusi wajib diisi.");
  }
  const thread = await threads.create({
    id: `th-${nanoid(8)}`,
    category: category || "Diskusi Umum",
    title: String(title).trim(),
    userName: user.name,
    userId: user.id,
    content: String(content).trim(),
    date: new Date().toISOString(),
  });
  res.status(201).json({ thread });
}

// POST /api/forum/:id/replies
export async function reply(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  const content = String(req.body.content || "").trim();
  if (!content) throw httpError(400, "Balasan tidak boleh kosong.");
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Thread tidak ditemukan.");
  const newReply = await threads.addReply(req.params.id, {
    id: `r-${nanoid(8)}`,
    userName: user.name,
    userId: user.id,
    content,
    date: new Date().toISOString(),
  });
  res.status(201).json({ reply: newReply });
}

// PATCH /api/forum/:id   (admin)
export async function update(req: Request, res: Response): Promise<void> {
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Thread tidak ditemukan.");
  const { title, content, category } = req.body;
  if ((title !== undefined && !String(title).trim()) || (content !== undefined && !String(content).trim())) {
    throw httpError(400, "Judul dan isi diskusi tidak boleh kosong.");
  }
  await threads.patch(req.params.id, { title, content, category });
  res.json({ message: "Diskusi diperbarui." });
}

// DELETE /api/forum/:id   (admin)
export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Thread tidak ditemukan.");
  await threads.remove(req.params.id);
  res.json({ message: "Thread dihapus." });
}