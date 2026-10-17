const express = require("express");
const { facilities, topeng } = require("../../database/layanan.repo");
const { threads } = require("../../database/forum.repo");
const { articles } = require("../../database/content.repo");
const { asyncHandler } = require("../../middleware/error");
const { lower } = require("../../utils/helpers");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = lower(req.query.q).trim();
    if (!q) return res.json({ articles: [], facilities: [], topeng: [], forum: [] });
    const [facilityList, topengList, threadList] = await Promise.all([facilities.list(), topeng.list(), threads.list()]);
    const has = (...fields) => fields.some((f) => lower(f).includes(q));

    res.json({
      articles: (await articles.list())
        .filter((a) => has(a.title, a.excerpt, a.category))
        .map((a) => ({ id: a.id, slug: a.slug, title: a.title, type: "Artikel", image: a.image })),
      facilities: facilityList
        .filter((f) => has(f.name, f.category, f.shortDesc))
        .map((f) => ({ id: f.id, title: f.name, type: "Fasilitas", image: f.image })),
      topeng: topengList
        .filter((t) => has(t.name, t.character))
        .map((t) => ({ id: t.id, title: t.name, type: "Topeng", image: t.image })),
      forum: threadList
        .filter((t) => has(t.title, t.content))
        .map((t) => ({ id: t.id, title: t.title, type: "Forum" })),
    });
  })
);

module.exports = router;