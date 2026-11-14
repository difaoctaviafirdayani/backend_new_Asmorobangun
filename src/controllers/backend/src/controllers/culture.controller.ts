import type { Request, Response } from "express";
import { culture } from "../database/content.repo";
import { httpError } from "../middleware/error";

export async function get(_req: Request, res: Response): Promise<void> {
  res.json({ cultureInfo: await culture.get() });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { timeline, paragraph } = req.body;
  await culture.update({ timeline, paragraph });
  res.json({ message: "Konten edukasi budaya diperbarui." });
}

export async function addTimeline(req: Request, res: Response): Promise<void> {
  const { year, text } = req.body;
  if (!year || !text) throw httpError(400, "Tahun dan keterangan wajib diisi.");
  const point = await culture.addTimeline({ year, text });
  res.status(201).json({ point });
}

export async function removeTimeline(req: Request, res: Response): Promise<void> {
  await culture.removeTimeline(req.params.id);
  res.json({ message: "Poin linimasa dihapus." });
}