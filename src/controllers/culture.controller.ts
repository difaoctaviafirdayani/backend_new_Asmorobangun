// CONTROLLER EDUKASI BUDAYA (linimasa sejarah + paragraf)
import type { Request, Response } from "express";
import { culture } from "../database/content.repo";
import { httpError } from "../middleware/error";
import { requiredText } from "./common";

// GET /api/culture
export async function get(_req: Request, res: Response): Promise<void> {
  res.json(await culture.get());
}

// PUT /api/culture  { paragraph?, timeline?: [{ id?, year, text }] }  (admin)
export async function update(req: Request, res: Response): Promise<void> {
  const { paragraph, timeline } = req.body || {};
  if (paragraph !== undefined && typeof paragraph !== "string") throw httpError(400, "Paragraf harus berupa teks.");
  if (timeline !== undefined && !Array.isArray(timeline)) throw httpError(400, "Linimasa harus berupa daftar.");
  const cleanTimeline = Array.isArray(timeline)
    ? timeline.map((t: any) => ({
        id: typeof t?.id === "string" && t.id ? t.id.slice(0, 30) : undefined,
        year: requiredText(String(t?.year ?? ""), "Tahun", 100),
        text: requiredText(String(t?.text ?? ""), "Keterangan linimasa", 5000),
      }))
    : undefined;
  await culture.update({ paragraph: paragraph?.slice(0, 20000), timeline: cleanTimeline });
  res.json(await culture.get());
}

// POST /api/culture/timeline  { year, text }  (admin)
export async function addTimeline(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const point = await culture.addTimeline({
    year: requiredText(String(b.year ?? ""), "Tahun", 100),
    text: requiredText(String(b.text ?? ""), "Keterangan linimasa", 5000),
  });
  res.status(201).json(point);
}

// DELETE /api/culture/timeline/:id  (admin)
export async function removeTimeline(req: Request, res: Response): Promise<void> {
  await culture.removeTimeline(req.params.id);
  res.json({ message: "Titik linimasa dihapus." });
}

