import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { articles } from "../../database/content.repo";
import { httpError } from "../../middleware/error";
import { lower } from "../../utils/helpers";
import type { AuthedRequest } from "../../types/auth";

export async function list(req: Request, res: Response): Promise<void> {
  const { q, category, limit } = req.query;
  let items = await articles.list();
  if (category) items = items.filter((a) => lower(a.category) === lower(category));
  if (q) {
    const needle = lower(q);
    items = items.filter((a) => [a.title, a.excerpt, a.content].some((f) => lower(f).includes(needle)));
  }
  const featured = items.find((a) => a.featured) || items[0] || null;
  if (limit && Number(limit) > 0) items = items.slice(0, Number(limit));
  res.json({ featured, articles: items });
}

export async function categories(_req: Request, res: Response): Promise<void> {
  const items = await articles.list();
  res.json({ categories: [...new Set(items.map((a) => a.category))] });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const items = await articles.list();
  const article = items.find((a) => a.slug === req.params.slug || a.id === req.params.slug);
  if (!article) throw httpError(404, "Artikel tidak ditemukan.");
  res.json({ article });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  const { title, excerpt, content, image, category } = req.body;
  if (!title || !content) throw httpError(400, "Judul dan isi artikel wajib diisi.");
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const article = await articles.insert({
    id: `art-${nanoid(8)}`,
    slug: `${slug || "artikel"}-${nanoid(4)}`,
    title,
    excerpt: excerpt || String(content).slice(0, 140),
    content,
    image: image || "artikel-default.jpg",
    category: category || "Berita",
    author: user.name,
    date: new Date().toISOString(),
    featured: false,
  });
  res.status(201).json({ article });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await articles.findById(req.params.id))) throw httpError(404, "Artikel tidak ditemukan.");
  await articles.patch(req.params.id, req.body);
  res.json({ message: "Artikel diperbarui." });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await articles.remove(req.params.id);
  res.json({ message: "Artikel dihapus." });
}