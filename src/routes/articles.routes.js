const express = require("express");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const router = express.Router();

// GET /api/articles?q=&category=&limit=
router.get("/", (req, res) => {
  const { q, category, limit } = req.query;
  const db = readDB();
  let list = [...db.articles].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (category) list = list.filter((a) => a.category.toLowerCase() === String(category).toLowerCase());
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(needle) ||
        a.excerpt.toLowerCase().includes(needle) ||
        a.content.toLowerCase().includes(needle)
    );
  }
  const featured = list.find((a) => a.featured) || list[0] || null;
  if (limit) list = list.slice(0, Number(limit));
  res.json({ featured, articles: list });
});

router.get("/categories", (req, res) => {
  const db = readDB();
  const cats = [...new Set(db.articles.map((a) => a.category))];
  res.json({ categories: cats });
});

router.get("/:slug", (req, res) => {
  const db = readDB();
  const article = db.articles.find((a) => a.slug === req.params.slug || a.id === req.params.slug);
  if (!article) return res.status(404).json({ error: "Artikel tidak ditemukan." });
  res.json({ article });
});

// POST /api/articles (admin only, for writing new articles/berita from the admin dashboard)
router.post("/", requireAuth, requireAdmin, (req, res) => {
  const { title, excerpt, content, image, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Judul dan isi artikel wajib diisi." });
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const article = {
    id: `art-${nanoid(8)}`,
    slug: `${slug}-${nanoid(4)}`,
    title,
    excerpt: excerpt || content.slice(0, 140),
    content,
    image: image || "artikel-default.jpg",
    category: category || "Berita",
    author: req.user.name,
    date: new Date().toISOString(),
    featured: false,
  };
  update((data) => data.articles.push(article)).then(() => res.status(201).json({ article }));
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const db = readDB();
  const article = db.articles.find((a) => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: "Artikel tidak ditemukan." });
  await update((data) => {
    Object.assign(data.articles.find((a) => a.id === req.params.id), req.body);
  });
  res.json({ message: "Artikel diperbarui." });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await update((data) => {
    data.articles = data.articles.filter((a) => a.id !== req.params.id);
  });
  res.json({ message: "Artikel dihapus." });
});

module.exports = router;
