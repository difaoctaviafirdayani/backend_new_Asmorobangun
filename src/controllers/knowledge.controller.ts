// ===========================================================================
// CONTROLLER DOKUMEN PENGETAHUAN CHATBOT (khusus admin) — /api/knowledge
// ===========================================================================
import type { Request, Response } from "express";
import * as model from "../models/knowledge.model";
import { httpError } from "../middleware/error";
import { activeModelLabel, activeProvider, isAiConfigured } from "../modules/ai/llm.service";
import { buildCorpus, clearKnowledgeCache, searchKnowledge } from "../modules/ai/knowledge.service";
import { newId, requiredText, text } from "./common";

// GET /api/knowledge/status
export async function status(_req: Request, res: Response): Promise<void> {
  const docs = await model.list();
  const passages = await buildCorpus(true);
  res.json({
    provider: activeProvider,
    model: activeModelLabel,
    aiConfigured: isAiConfigured(),
    documents: docs.length,
    activeDocuments: docs.filter((d) => d.active).length,
    passages: passages.length,
  });
}

// POST /api/knowledge/test  { question }
export async function test(req: Request, res: Response): Promise<void> {
  const question = requiredText(req.body?.question, "Pertanyaan", 500);
  const hits = await searchKnowledge(question, 4);
  res.json({ found: hits.length > 0, hits });
}

// GET /api/knowledge
export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await model.list());
}

// POST /api/knowledge  { title, content, category?, active? }
export async function create(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const doc = await model.create(newId("kd"), {
    title: requiredText(b.title, "Judul", 150),
    content: requiredText(b.content, "Isi dokumen", 200000),
    category: text(b.category, 60) || null,
    active: b.active === undefined ? true : !!b.active,
  });
  clearKnowledgeCache();
  res.status(201).json(doc);
}

// PATCH /api/knowledge/:id
export async function update(req: Request, res: Response): Promise<void> {
  if (!(await model.findById(req.params.id))) throw httpError(404, "Dokumen tidak ditemukan.");
  const b = req.body || {};
  const changes: Partial<model.KnowledgeInput> = {};
  if (b.title !== undefined) changes.title = requiredText(b.title, "Judul", 150);
  if (b.content !== undefined) changes.content = requiredText(b.content, "Isi dokumen", 200000);
  if (b.category !== undefined) changes.category = text(b.category, 60) || null;
  if (b.active !== undefined) changes.active = !!b.active;
  const doc = await model.update(req.params.id, changes);
  clearKnowledgeCache();
  res.json(doc);
}

// DELETE /api/knowledge/:id
export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await model.findById(req.params.id))) throw httpError(404, "Dokumen tidak ditemukan.");
  await model.remove(req.params.id);
  clearKnowledgeCache();
  res.json({ message: "Dokumen dihapus." });
}
