// =============================================================================
// DOKUMEN PENGETAHUAN (admin)
//   GET    /api/knowledge          daftar dokumen
//   POST   /api/knowledge          tambah dokumen   { title, content, category?, active? }
//   PATCH  /api/knowledge/:id      ubah dokumen
//   DELETE /api/knowledge/:id      hapus dokumen
//   GET    /api/knowledge/status   info AI yang aktif + jumlah potongan dokumen
//   POST   /api/knowledge/test     uji pencarian  { question }
// =============================================================================
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import * as model from "../../models/knowledge.model";
import { httpError } from "../../middleware/error";
import { activeModelLabel, activeProvider, isAiConfigured } from "./llm.service";
import { buildCorpus, clearKnowledgeCache, searchKnowledge } from "./knowledge.service";

const MAX_CONTENT = 50000;

function readInput(body: any, partial: boolean): Partial<model.KnowledgeInput> {
  const out: Partial<model.KnowledgeInput> = {};
  if (!partial || body?.title !== undefined) {
    const title = String(body?.title ?? "").trim();
    if (!title || title.length > 150) throw httpError(400, "Judul wajib diisi (maksimal 150 karakter).");
    out.title = title;
  }
  if (!partial || body?.content !== undefined) {
    const content = String(body?.content ?? "").trim();
    if (!content) throw httpError(400, "Isi dokumen wajib diisi.");
    if (content.length > MAX_CONTENT) throw httpError(400, `Isi dokumen terlalu panjang (maksimal ${MAX_CONTENT} karakter).`);
    out.content = content;
  }
  if (body?.category !== undefined) out.category = body.category ? String(body.category).trim().slice(0, 60) : null;
  if (body?.active !== undefined) out.active = !!body.active;
  return out;
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.json({ documents: await model.list(false) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = readInput(req.body, false) as model.KnowledgeInput;
  const doc = await model.create(`kd-${nanoid(10)}`, data);
  clearKnowledgeCache();
  res.status(201).json({ document: doc });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await model.findById(req.params.id))) throw httpError(404, "Dokumen tidak ditemukan.");
  const doc = await model.update(req.params.id, readInput(req.body, true));
  clearKnowledgeCache();
  res.json({ document: doc });
}

export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await model.findById(req.params.id))) throw httpError(404, "Dokumen tidak ditemukan.");
  await model.remove(req.params.id);
  clearKnowledgeCache();
  res.json({ message: "Dokumen dihapus." });
}

export async function status(_req: Request, res: Response): Promise<void> {
  const passages = await buildCorpus(true);
  res.json({
    provider: activeProvider,
    model: activeModelLabel,
    aiConfigured: isAiConfigured(),
    passages: passages.length,
    documents: new Set(passages.map((p) => p.source)).size,
  });
}

export async function test(req: Request, res: Response): Promise<void> {
  const question = String(req.body?.question || "").trim().slice(0, 500);
  if (!question) throw httpError(400, "question wajib diisi.");
  const hits = await searchKnowledge(question);
  res.json({ found: hits.length > 0, hits: hits.map((h) => ({ source: h.source, score: Number(h.score.toFixed(2)), text: h.text })) });
}