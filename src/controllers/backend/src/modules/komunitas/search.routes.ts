// ===========================================================================
// KOMUNITAS › PENCARIAN        Base URL: /api/search?q=
// ===========================================================================
import { Router } from "express";
import { facilities, topeng } from "../../database/layanan.repo";
import { threads } from "../../database/forum.repo";
import { articles } from "../../database/content.repo";
import { asyncHandler } from "../../middleware/error";
import { lower } from "../../utils/helpers";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = lower(req.query.q).trim();
    if (!q) {
      res.json({ articles: [], facilities: [], topeng: [], forum: [] });
      return;
    }
    const [facilityList, topengList, threadList, articleList] = await Promise.all([
      facilities.list(),
      topeng.list(),
      threads.list(),
      articles.list(),
    ]);
    const has = (...fields: unknown[]): boolean => fields.some((f) => lower(f).includes(q));

    res.json({
      articles: articleList
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

export default router;