// ===========================================================================
// INFORMASI › ARTIKEL / BERITA        Base URL: /api/articles
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "./articles.controller";

const router = Router();

router.get("/", asyncHandler(c.list));                    // daftar artikel (?q= &category= &limit=)
router.get("/categories", asyncHandler(c.categories));    // daftar kategori
router.get("/:slug", asyncHandler(c.getOne));             // detail (slug atau id)

router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

export default router;