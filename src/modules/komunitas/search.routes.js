// ===========================================================================
// KOMUNITAS › PENCARIAN GLOBAL        Base URL: /api/search?q=kata
// ===========================================================================
const express = require("express");
const { readDB } = require("../../database/db");
const { lower } = require("../../utils/helpers");

const router = express.Router();

router.get("/", (req, res) => {
  const q = lower(req.query.q).trim();
  if (!q) return res.json({ articles: [], facilities: [], topeng: [], forum: [] });
  const db = readDB();
  const has = (...fields) => fields.some((f) => lower(f).includes(q));

  res.json({
    articles: db.articles
      .filter((a) => has(a.title, a.excerpt, a.category))
      .map((a) => ({ id: a.id, slug: a.slug, title: a.title, type: "Artikel", image: a.image })),
    facilities: db.facilities
      .filter((f) => has(f.name, f.category, f.shortDesc))
      .map((f) => ({ id: f.id, title: f.name, type: "Fasilitas", image: f.image })),
    topeng: db.topeng
      .filter((t) => has(t.name, t.character))
      .map((t) => ({ id: t.id, title: t.name, type: "Topeng", image: t.image })),
    forum: db.forumThreads
      .filter((t) => has(t.title, t.content))
      .map((t) => ({ id: t.id, title: t.title, type: "Forum" })),
  });
});

module.exports = router;
