// ===========================================================================
// KOMUNITAS › FORUM DISKUSI        Base URL: /api/forum
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "../../controllers/forum.controller";

const router = Router();

router.get("/", asyncHandler(c.list));
router.get("/categories", asyncHandler(c.categories));
router.get("/:id", asyncHandler(c.getOne));

router.post("/", requireAuth, asyncHandler(c.create));                      // buat diskusi (login)
router.post("/:id/replies", requireAuth, asyncHandler(c.reply));            // balas (login)
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));    // moderasi (admin)
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove));   // hapus (admin)

export default router;