// CONTROLLER FAQ
import type { Request, Response } from "express";
import { faqs } from "../database/content.repo";
import { httpError } from "../middleware/error";
import { newId, requiredText } from "./common";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await faqs.list());
}

export async function create(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const item = await faqs.insert({
    id: newId("faq"),
    question: requiredText(b.question, "Pertanyaan", 500),
    answer: requiredText(b.answer, "Jawaban", 20000),
  });
  res.status(201).json(item);
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await faqs.findById(req.params.id))) throw httpError(404, "FAQ tidak ditemukan.");
  const b = req.body || {};
  const changes: Record<string, any> = {};
  if (b.question !== undefined) changes.question = requiredText(b.question, "Pertanyaan", 500);
  if (b.answer !== undefined) changes.answer = requiredText(b.answer, "Jawaban", 20000);
  await faqs.patch(req.params.id, changes);
  res.json(await faqs.findById(req.params.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await faqs.findById(req.params.id))) throw httpError(404, "FAQ tidak ditemukan.");
  await faqs.remove(req.params.id);
  res.json({ message: "FAQ dihapus." });
}
