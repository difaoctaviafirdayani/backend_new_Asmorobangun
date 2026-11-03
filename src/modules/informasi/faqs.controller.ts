import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { faqs } from "../../database/content.repo";
import { httpError } from "../../middleware/error";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json({ faqs: await faqs.list() });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { question, answer } = req.body;
  if (!question || !answer) throw httpError(400, "Pertanyaan dan jawaban wajib diisi.");
  const faq = await faqs.insert({ id: `faq-${nanoid(6)}`, question, answer });
  res.status(201).json({ faq });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { question, answer } = req.body;
  if (!(await faqs.findById(req.params.id))) throw httpError(404, "FAQ tidak ditemukan.");
  await faqs.patch(req.params.id, { question, answer });
  res.json({ message: "FAQ diperbarui." });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await faqs.remove(req.params.id);
  res.json({ message: "FAQ dihapus." });
}