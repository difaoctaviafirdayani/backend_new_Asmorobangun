import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { articles } from "../database/content.repo";
import { httpError } from "../middleware/error";
import { notifyAllMembers } from "../modules/notifications/notify.service";
import { ARTICLE_CATEGORIES, exactCategory } from "../config/rules";
import { buildMeta, parsePaging } from "./common";
import type { AuthedRequest } from "../types/auth";

// GET /api/articles?q=&category=&sort=date|title|category&order=asc|desc&page=&limit=
export async function list(req: Request, res: Response): Promise<void> {
  const paging = parsePaging(req.query, { defaultLimit: 10, maxLimit: 100 });
  const str = (v: unknown, max = 100): string =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const sort = ["date", "title", "category"].includes(str(req.query.sort))
    ? str(req.query.sort)
    : undefined;
  const dir = str(req.query.order).toLowerCase() === "asc" ? "ASC" : "DESC";

  const { items, total } = await articles.query({
    search: str(req.query.q),
    searchCols: ["title", "excerpt", "content"],
    filters: { category: str(req.query.category) },
    sort,
    dir,
    limit: paging?.limit,
    offset: paging?.offset,
  });
  const featured = items.find((a) => a.featured) || items[0] || null;
  res.json({ featured, articles: items, meta: buildMeta(paging, total) });
}

export async function categories(_req: Request, res: Response): Promise<void> {
  res.json({ categories: [...ARTICLE_CATEGORIES] });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { items } = await articles.query({
    filters: { slug: req.params.slug },
    limit: 1,
  });
  const article = items[0] || (await articles.findById(req.params.slug));
  if (!article) throw httpError(404, "Artikel tidak ditemukan.");
  res.json({ article });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthedRequest;
  const { title, excerpt, content, image, category } = req.body;
  if (!title || !content)
    throw httpError(400, "Judul dan isi artikel wajib diisi.");
  const cat =
    category === undefined || category === null || category === ""
      ? "Budaya"
      : exactCategory(category, ARTICLE_CATEGORIES);
  if (!cat)
    throw httpError(
      400,
      `Kategori harus salah satu dari: ${ARTICLE_CATEGORIES.join(", ")}.`,
    );
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
    category: cat,
    author: user.name,
    date: new Date().toISOString(),
    featured: false,
  });
  if (!article) throw httpError(500, "Artikel gagal disimpan.");
  await notifyAllMembers({
    type: "article",
    title: `Berita baru: ${String(title).slice(0, 80)}`,
    body: String(article.excerpt || "").slice(0, 120),
    refId: String(article.slug),
    refType: "article",
    dedupeKey: `article:${article.id}`,
  });
  res.status(201).json({ article });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!(await articles.findById(req.params.id)))
    throw httpError(404, "Artikel tidak ditemukan.");
  const changes = { ...req.body };
  if (changes.category !== undefined) {
    const cat = exactCategory(changes.category, ARTICLE_CATEGORIES);
    if (!cat)
      throw httpError(
        400,
        `Kategori harus salah satu dari: ${ARTICLE_CATEGORIES.join(", ")}.`,
      );
    changes.category = cat;
  }
  await articles.patch(req.params.id, changes);
  res.json({ message: "Artikel diperbarui." });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await articles.remove(req.params.id);
  res.json({ message: "Artikel dihapus." });
}
