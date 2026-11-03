import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { topeng } from "../../database/layanan.repo";
import { httpError } from "../../middleware/error";
import { omit } from "../../utils/helpers";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json({ topeng: await topeng.list() });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const item = await topeng.findById(req.params.id);
  if (!item) throw httpError(404, "Topeng tidak ditemukan.");
  res.json({ topeng: item });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { name, character, color, price, image, desc } = req.body;
  if (!name || !price) throw httpError(400, "Nama dan harga wajib diisi.");
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) throw httpError(400, "Harga harus berupa angka lebih dari 0.");
  const item = {
    id: `tp-${nanoid(6)}`,
    name,
    character: character || "",
    color: color || "",
    price: Number(price),
    image: image || "topeng-default.jpg",
    desc: desc || "",
  };
  await topeng.insert(item);
  res.status(201).json({ topeng: item });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await topeng.findById(req.params.id))) throw httpError(404, "Topeng tidak ditemukan.");
  const body: Record<string, any> = omit(req.body, ["id"]);
  if (body.price !== undefined) {
    body.price = Number(body.price);
    if (!Number.isFinite(body.price) || body.price <= 0) throw httpError(400, "Harga harus berupa angka lebih dari 0.");
  }
  if (body.stock !== undefined) body.stock = Number(body.stock) || 0;
  // PERBAIKAN: versi JS lama lupa menyimpan perubahan ke database.
  await topeng.patch(req.params.id, body);
  res.json({ message: "Topeng diperbarui." });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await topeng.remove(req.params.id);
  res.json({ message: "Topeng dihapus dari katalog." });
}