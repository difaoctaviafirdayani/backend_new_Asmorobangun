// CONTROLLER ARTIKEL / BERITA
import type { Request, Response } from "express";
import { articles } from "../database/content.repo";
import { httpError } from "../middleware/error";
import { lower } from "../utils/helpers";
import { currentUser, imageValue, newId, optionalText, requiredText, slugify, text } from "./common";

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const all = await articles.list();
  const taken = new Set(all.filter((a) => a.id !== exceptId).map((a) => a.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i += 1) slug = `${base}-${i}`;
  return slug;
}

// GET /api/articles?q=&category=&limit=
export async function list(req: Request, res: Response): Promise<void> {
  const q = lower(req.query.q).trim();
  const category = lower(req.query.category).trim();
  const limit = Number(req.query.limit);
  let items = await articles.list();
  if (q) items = items.filter((a) => [a.title, a.excerpt, a.category].some((f) => lower(f).includes(q)));
  if (category) items = items.filter((a) => lower(a.category) === category);
  if (Number.isInteger(limit) && limit > 0) items = items.slice(0, limit);
  res.json(items);
}

// GET /api/articles/categories
export async function categories(_req: Request, res: Response): Promise<void> {
  const items = await articles.list();
  res.json(Array.from(new Set(items.map((a) => a.category).filter(Boolean))).sort());
}

// GET /api/articles/:slug  (slug atau id)
export async function getOne(req: Request, res: Response): Promise<void> {
  const key = req.params.slug;
  const item = (await articles.list()).find((a) => a.slug === key || a.id === key);
  if (!item) throw httpError(404, "Artikel tidak ditemukan.");
  res.json(item);
}

// POST /api/articles (admin)
export async function create(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const title = requiredText(b.title, "Judul", 255);
  const content = requiredText(b.content, "Isi artikel", 200000);
  const id = newId("art");
  const item = await articles.insert({
    id,
    slug: await uniqueSlug(slugify(text(b.slug, 150) || title)),
    title,
    excerpt: text(b.excerpt, 2000) || content.slice(0, 200),
    content,
    image: imageValue(b.image) ?? null,
    category: text(b.category, 100) || "Berita",
    author: text(b.author, 100) || currentUser(req.user).name,
    date: b.date || new Date().toISOString(),
    featured: !!b.featured,
  });
  res.status(201).json(item);
}

// PATCH /api/articles/:id (admin)
export async function update(req: Request, res: Response): Promise<void> {
  const current = await articles.findById(req.params.id);
  if (!current) throw httpError(404, "Artikel tidak ditemukan.");
  const b = req.body || {};
  const changes: Record<string, any> = {};
  if (b.title !== undefined) changes.title = requiredText(b.title, "Judul", 255);
  if (b.content !== undefined) changes.content = requiredText(b.content, "Isi artikel", 200000);
  if (b.excerpt !== undefined) changes.excerpt = optionalText(b.excerpt, 2000);
  if (b.category !== undefined) changes.category = text(b.category, 100) || "Berita";
  if (b.author !== undefined) changes.author = optionalText(b.author, 100);
  if (b.image !== undefined) changes.image = imageValue(b.image);
  if (b.featured !== undefined) changes.featured = !!b.featured;
  if (b.date !== undefined) changes.date = b.date;
  if (b.slug !== undefined) changes.slug = await uniqueSlug(slugify(text(b.slug, 150)), current.id);
  await articles.patch(current.id, changes);
  res.json(await articles.findById(current.id));
}

// DELETE /api/articles/:id (admin)
export async function remove(req: Request, res: Response): Promise<void> {
  if (!(await articles.findById(req.params.id))) throw httpError(404, "Artikel tidak ditemukan.");
  await articles.remove(req.params.id);
  res.json({ message: "Artikel dihapus." });
}
