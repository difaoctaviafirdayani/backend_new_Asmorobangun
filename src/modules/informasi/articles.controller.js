const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { sortNewest, omit, lower } = require("../../utils/helpers");

// GET /api/articles?q=&category=&limit=
exports.list = (req, res) => {
  const { q, category, limit } = req.query;
  let list = sortNewest(readDB().articles);
  if (category) list = list.filter((a) => lower(a.category) === lower(category));
  if (q) {
    const needle = lower(q);
    list = list.filter((a) => [a.title, a.excerpt, a.content].some((f) => lower(f).includes(needle)));
  }
  const featured = list.find((a) => a.featured) || list[0] || null;
  if (limit && Number(limit) > 0) list = list.slice(0, Number(limit));
  res.json({ featured, articles: list });
};

// GET /api/articles/categories
exports.categories = (req, res) => {
  res.json({ categories: [...new Set(readDB().articles.map((a) => a.category))] });
};

// GET /api/articles/:slug
exports.getOne = (req, res) => {
  const article = readDB().articles.find((a) => a.slug === req.params.slug || a.id === req.params.slug);
  if (!article) throw httpError(404, "Artikel tidak ditemukan.");
  res.json({ article });
};

// POST /api/articles
exports.create = async (req, res) => {
  const { title, excerpt, content, image, category } = req.body;
  if (!title || !content) throw httpError(400, "Judul dan isi artikel wajib diisi.");
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const article = {
    id: `art-${nanoid(8)}`,
    slug: `${slug || "artikel"}-${nanoid(4)}`,
    title,
    excerpt: excerpt || String(content).slice(0, 140),
    content,
    image: image || "artikel-default.jpg",
    category: category || "Berita",
    author: req.user.name,
    date: new Date().toISOString(),
    featured: false,
  };
  await update((data) => data.articles.push(article));
  res.status(201).json({ article });
};

// PATCH /api/articles/:id
exports.update = async (req, res) => {
  if (!readDB().articles.find((a) => a.id === req.params.id)) throw httpError(404, "Artikel tidak ditemukan.");
  await update((data) => {
    Object.assign(data.articles.find((a) => a.id === req.params.id), omit(req.body, ["id"]));
  });
  res.json({ message: "Artikel diperbarui." });
};

// DELETE /api/articles/:id
exports.remove = async (req, res) => {
  await update((data) => {
    data.articles = data.articles.filter((a) => a.id !== req.params.id);
  });
  res.json({ message: "Artikel dihapus." });
};
