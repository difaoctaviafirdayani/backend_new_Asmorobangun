// ===========================================================================
// CONTROLLER ANALISIS FORUM (khusus admin) — hasil AI harus diverifikasi admin.
//   POST  /api/ai/analyze/thread/:id   analisis satu diskusi
//   GET   /api/ai/results?status=      daftar hasil
//   PATCH /api/ai/results/:id/verify   { status: "approved" | "rejected", note? }
// ===========================================================================
import type { Request, Response } from "express";
import * as aiRepo from "../database/ai.repo";
import { threads } from "../database/forum.repo";
import { httpError } from "../middleware/error";
import { analyzeText } from "../modules/ai/ai.service";
import { activeModelLabel, isAiConfigured } from "../modules/ai/llm.service";
import { prepareForPrompt } from "../security/promptGuard";
import { currentUser, newId, text } from "./common";

const KIND = "forum_analysis";

// POST /api/ai/analyze/thread/:id
export async function analyzeThread(req: Request, res: Response): Promise<void> {
  const thread = await threads.getWithReplies(req.params.id);
  if (!thread) throw httpError(404, "Diskusi tidak ditemukan.");

  const replies: Array<Record<string, any>> = thread.replies || [];
  const names = [thread.userName, ...replies.map((r) => r.userName)].filter(Boolean);
  const combined = [`Judul: ${thread.title}`, `Isi: ${thread.content}`, ...replies.map((r, i) => `Balasan ${i + 1}: ${r.content}`)].join("\n");

  const prepared = prepareForPrompt(combined, { names, maxLen: 6000 });
  const base = { id: newId("ai"), kind: KIND, sourceId: thread.id, sourceTitle: String(thread.title).slice(0, 255) };

  // Ada upaya prompt injection -> JANGAN kirim ke AI, catat sebagai "blocked".
  if (prepared.injection.flagged) {
    const item = await aiRepo.create({
      ...base,
      model: null,
      output: null,
      status: "blocked",
      blockedReason: prepared.injection.reasons.join("; ").slice(0, 255),
    });
    res.status(201).json(item);
    return;
  }

  if (!isAiConfigured()) throw httpError(503, "Penyedia AI belum dikonfigurasi (isi API key di file .env).");
  const { value } = await analyzeText(prepared.text);
  const item = await aiRepo.create({
    ...base,
    model: activeModelLabel.slice(0, 60),
    output: value,
    status: "pending",
  });
  res.status(201).json(item);
}

// GET /api/ai/results?status=pending|approved|rejected|blocked
export async function listResults(req: Request, res: Response): Promise<void> {
  res.json(await aiRepo.list(text(req.query.status as string, 20) || undefined));
}

// PATCH /api/ai/results/:id/verify
export async function verifyResult(req: Request, res: Response): Promise<void> {
  const me = currentUser(req.user);
  const status = req.body?.status;
  if (status !== "approved" && status !== "rejected") throw httpError(400, 'Status harus "approved" atau "rejected".');

  const current = await aiRepo.findById(req.params.id);
  if (!current) throw httpError(404, "Hasil AI tidak ditemukan.");
  if (current.status !== "pending") throw httpError(409, "Hasil ini sudah diverifikasi atau diblokir.");

  const note = text(req.body?.note, 255) || null;
  res.json(await aiRepo.verify(current.id, { status, adminId: me.id, note }));
}
