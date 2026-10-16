const { nanoid } = require("nanoid");
const { articles } = require("../../database/content.repo");
const { httpError } = require("../../middleware/error");
const { lower } = require("../../utils/helpers");

exports.list = async (req, res) => {
  const { q, category, limit } = req.query;
  let list = await articles.list();
  if (category) list = list.filter((a) => lower(a.category) === lower(category));
  if (q) {
    const needle = lower(q);
    list = list.filter((a) => [a.title, a.excerpt, a.content].some((f) => lower(f).includes(needle)));
  }
  const featured = list.find((a) => a.featured) || list[0] || null;
  if (limit && Number(limit) > 0) list = list.slice(0, Number(limit));
  res.json({ featured, articles: list });
};

exports.categories = async (req, res) => {
  const list = await articles.list();
  res.json({ categories: [...new Set(list.map((a) => a.category))] });
};

exports.getOne = async (req, res) => {
  const list = await articles.list();
  const article = list.find((a) => a.slug === req.params.slug || a.id === req.params.slug);
  if (!article) throw httpError(404, "Artikel tidak ditemukan.");
  res.json({ article });
};

exports.create = async (req, res) => {
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
    author: req.user.name,
    date: new Date().toISOString(),
    featured: false,
  });
  res.status(201).json({ article });
};

exports.update = async (req, res) => {
  if (!(await articles.findById(req.params.id))) throw httpError(404, "Artikel tidak ditemukan.");
  await articles.patch(req.params.id, req.body);
  res.json({ message: "Artikel diperbarui." });
};

exports.remove = async (req, res) => {
  await articles.remove(req.params.id);
  res.json({ message: "Artikel dihapus." });
};