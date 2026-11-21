// ===========================================================================
// INFORMASI › ARTIKEL / BERITA        Base URL: /api/articles
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import * as c from "../controllers/articles.controller";
import { validate } from "../middleware/validate";
import { articleCreateSchema, articleUpdateSchema } from "../schemas/content.schema";

const router = Router();

router.get("/", asyncHandler(c.list));                    // daftar artikel (?q= &category= &limit=)
router.get("/categories", asyncHandler(c.categories));    // daftar kategori
router.get("/:slug", asyncHandler(c.getOne));             // detail (slug atau id)

router.post("/", requireAuth, requireAdmin, validate(articleCreateSchema), asyncHandler(c.create));
router.patch("/:id", requireAuth, requireAdmin, validate(articleUpdateSchema), asyncHandler(c.update));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

export default router;