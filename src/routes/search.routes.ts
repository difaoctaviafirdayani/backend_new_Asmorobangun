// ===========================================================================
// KOMUNITAS › PENCARIAN        Base URL: /api/search?q=
// Pencarian dilakukan di SQL (LIKE) dan dibatasi 10 hasil per kelompok.
// ===========================================================================
import { Router } from "express";
import { facilities, topeng } from "../database/layanan.repo";
import { threads } from "../database/forum.repo";
import { articles } from "../database/content.repo";
import { asyncHandler } from "../middleware/error";

const router = Router();
const PER_GROUP = 10;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const term = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (!term) {
      res.json({ articles: [], facilities: [], topeng: [], forum: [] });
      return;
    }
    const [artRes, facRes, topRes, threadList] = await Promise.all([
      articles.query({ search: term, searchCols: ["title", "excerpt", "category"], limit: PER_GROUP }),
      facilities.query({ search: term, searchFields: ["name", "category", "shortDesc"], limit: PER_GROUP }),
      topeng.query({ search: term, searchFields: ["name", "character"], limit: PER_GROUP }),
      threads.listSummary({ q: term }),
    ]);

    res.json({
      articles: artRes.items.map((a) => ({ id: a.id, slug: a.slug, title: a.title, type: "Artikel", image: a.image })),
      facilities: facRes.items.map((f) => ({ id: f.id, title: f.name, type: "Fasilitas", image: f.image })),
      topeng: topRes.items.map((t) => ({ id: t.id, title: t.name, type: "Topeng", image: t.image })),
      forum: threadList.slice(0, PER_GROUP).map((t) => ({ id: t.id, title: t.title, type: "Forum" })),
    });
  }),
);

export default router;