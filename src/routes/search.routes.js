const express = require("express");
const { readDB } = require("../db");

const router = express.Router();

// GET /api/search?q=keyword
router.get("/", (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const db = readDB();
  if (!q) {
    return res.json({ articles: [], facilities: [], topeng: [], forum: [] });
  }
  const articles = db.articles
    .filter((a) => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
    .map((a) => ({ id: a.id, slug: a.slug, title: a.title, type: "Artikel", image: a.image }));

  const facilities = db.facilities
    .filter((f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q) || f.shortDesc.toLowerCase().includes(q))
    .map((f) => ({ id: f.id, title: f.name, type: "Fasilitas", image: f.image }));

  const topeng = db.topeng
    .filter((t) => t.name.toLowerCase().includes(q) || t.character.toLowerCase().includes(q))
    .map((t) => ({ id: t.id, title: t.name, type: "Topeng", image: t.image }));

  const forum = db.forumThreads
    .filter((t) => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q))
    .map((t) => ({ id: t.id, title: t.title, type: "Forum" }));

  res.json({ articles, facilities, topeng, forum });
});

module.exports = router;
