// ===========================================================================
// KOMUNITAS › FORUM — membaca/menulis ke MySQL (lewat forum.repo.ts).
// ===========================================================================
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { threads } from "../database/forum.repo";
import { httpError } from "../middleware/error";
import { notify } from "../modules/notifications/notify.service";
import { FORUM_CATEGORIES, exactCategory } from "../config/rules";
import type { AuthedRequest } from "../types/auth";

// GET /api/forum?category=&q=
export async function list(req: Request, res: Response): Promise<void> {
  const category =
    typeof req.query.category === "string" ? req.query.category : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  res.json({ threads: await threads.listSummary({ category, q }) });
}

// GET /api/forum/categories
export async function categories(_req: Request, res: Response): Promise<void> {
  res.json({ categories: [...FORUM_CATEGORIES] }); // kategori tetap: Umum dan Layanan
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
  const cat =
    category === undefined || category === null || category === ""
      ? "Umum"
      : exactCategory(category, FORUM_CATEGORIES);
  if (!cat)
    throw httpError(
      400,
      `Kategori harus salah satu dari: ${FORUM_CATEGORIES.join(", ")}.`,
    );
  const thread = await threads.create({
    id: `th-${nanoid(8)}`,
    category: cat,
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
  const thread = await threads.findById(req.params.id);
  if (!thread) throw httpError(404, "Thread tidak ditemukan.");
  const newReply = await threads.addReply(req.params.id, {
    id: `r-${nanoid(8)}`,
    userName: user.name,
    userId: user.id,
    content,
    date: new Date().toISOString(),
  });
  if (thread.userId && thread.userId !== user.id) {
    await notify(thread.userId, {
      type: "forum_reply",
      title: "Pertanyaanmu dijawab",
      body: `${user.name} membalas diskusi "${String(thread.title).slice(0, 80)}".`,
      refId: String(thread.id),
      refType: "forum",
    });
  }
  res.status(201).json({ reply: newReply });
}

// PATCH /api/forum/:id   (admin)
export async function update(req: Request, res: Response): Promise<void> {
  if (!(await threads.findById(req.params.id)))
    throw httpError(404, "Thread tidak ditemukan.");
  const { title, content, category } = req.body;
  if (
    (title !== undefined && !String(title).trim()) ||
    (content !== undefined && !String(content).trim())
  ) {
    throw httpError(400, "Judul dan isi diskusi tidak boleh kosong.");
  }
  let cat = category;
  if (category !== undefined) {
    cat = exactCategory(category, FORUM_CATEGORIES);
    if (!cat)
      throw httpError(
        400,
        `Kategori harus salah satu dari: ${FORUM_CATEGORIES.join(", ")}.`,
      );
  }
  await threads.patch(req.params.id, { title, content, category: cat });
  res.json({ message: "Diskusi diperbarui." });
}

// DELETE /api/forum/:id   (admin)
export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await threads.findById(req.params.id)))
    throw httpError(404, "Thread tidak ditemukan.");
  await threads.remove(req.params.id);
  res.json({ message: "Thread dihapus." });
}
