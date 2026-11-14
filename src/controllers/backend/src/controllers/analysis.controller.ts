// =============================================================================
// AI › ANALISIS FORUM
//   POST  /api/ai/analyze/thread/:id   (admin)  jalankan analisis AI untuk 1 thread
//   GET   /api/ai/results?status=      (admin)  daftar hasil AI
//   PATCH /api/ai/results/:id/verify   (admin)  setujui / tolak hasil AI (verifikasi manual)
// =============================================================================
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { threads } from "../database/forum.repo";
import * as aiRepo from "../database/ai.repo";
import { httpError } from "../middleware/error";
import { createLimiter, tooManyMessage } from "../middleware/rateLimit";
import { prepareForPrompt } from "../security/promptGuard";
import type { AuthedRequest } from "../types/auth";
import { analyzeText } from "../modules/ai/ai.service";

// Bentuk data thread forum yang dikembalikan forum.repo.js (file JS, jadi tipenya kita tulis sendiri).
interface ForumReply {
  userName: string;
  content: string;
}
interface ForumThread {
  id: string;
  title: string;
  content: string;
  userName: string;
  replies?: ForumReply[];
}

// Maksimal 15 analisis per admin per 10 menit (hemat kuota API + cegah penyalahgunaan).
const analyzeLimiter = createLimiter({ windowMs: 10 * 60 * 1000, max: 15 });

export async function analyzeThread(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;

  const key = `ai:${user.id}`;
  const wait = analyzeLimiter.blockedFor(key);
  if (wait) throw httpError(429, tooManyMessage(wait));
  analyzeLimiter.fail(key); // limiter dipakai sebagai penghitung pemakaian

  const thread = (await threads.getWithReplies(req.params.id)) as ForumThread | null;
  if (!thread) throw httpError(404, "Thread tidak ditemukan.");

  // 1) Kumpulkan teks (judul, isi, maks. 5 balasan) lalu lewatkan ke pagar keamanan.
  const replies: ForumReply[] = (thread.replies || []).slice(0, 5);
  const names: string[] = [thread.userName, ...replies.map((r) => r.userName)].filter(Boolean);
  const parts: Array<[string, unknown, number]> = [
    ["Judul", thread.title, 200],
    ["Isi", thread.content, 1500],
    ...replies.map((r, i): [string, unknown, number] => [`Balasan ${i + 1}`, r.content, 500]),
  ];

  const reasons = new Set<string>();
  const lines: string[] = [];
  let replacements = 0;
  for (const [label, raw, maxLen] of parts) {
    const prepared = prepareForPrompt(raw, { names, maxLen });
    prepared.injection.reasons.forEach((r) => reasons.add(r));
    replacements += prepared.replacements;
    lines.push(`${label}: ${prepared.text}`);
  }

  const base = {
    id: `ai-${nanoid(10)}`,
    kind: "forum_thread",
    sourceId: thread.id,
    sourceTitle: String(thread.title).slice(0, 255),
  };

  // 2) Terindikasi prompt injection -> TIDAK dikirim ke AI, dicatat sebagai "blocked".
  if (reasons.size > 0) {
    const blocked = await aiRepo.create({
      ...base,
      model: null,
      output: null,
      status: "blocked",
      blockedReason: Array.from(reasons).join("; ").slice(0, 255),
    });
    res.status(422).json({ error: "Teks diskusi terindikasi prompt injection, tidak dikirim ke AI.", result: blocked });
    return;
  }

  // 3) Panggil Gemini + validasi JSON, lalu simpan sebagai "pending" (menunggu verifikasi admin).
  const { value, model } = await analyzeText(lines.join("\n"));
  const saved = await aiRepo.create({ ...base, model, output: value, status: "pending" });
  res.status(201).json({ result: saved, anonymizedItems: replacements });
}

export async function listResults(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json({ results: await aiRepo.list(status) });
}

export async function verifyResult(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  const decision = req.body?.decision;
  if (decision !== "approved" && decision !== "rejected") {
    throw httpError(400, 'decision harus "approved" atau "rejected".');
  }
  const note = req.body?.note ? String(req.body.note).trim().slice(0, 255) : null;

  const current = await aiRepo.findById(req.params.id);
  if (!current) throw httpError(404, "Hasil AI tidak ditemukan.");
  if (current.status !== "pending") throw httpError(409, "Hasil ini sudah diverifikasi atau diblokir.");

  const updated = await aiRepo.verify(req.params.id, { status: decision, adminId: user.id, note });
  res.json({ message: decision === "approved" ? "Hasil AI disetujui." : "Hasil AI ditolak.", result: updated });
}