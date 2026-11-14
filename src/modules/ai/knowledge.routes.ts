// ===========================================================================
// AI › DOKUMEN PENGETAHUAN CHATBOT        Base URL: /api/knowledge
// Semua endpoint KHUSUS ADMIN.
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "../../controllers/knowledge.controller";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/status", asyncHandler(c.status));
router.post("/test", asyncHandler(c.test));
router.get("/", asyncHandler(c.list));
router.post("/", asyncHandler(c.create));
router.patch("/:id", asyncHandler(c.update));
router.delete("/:id", asyncHandler(c.remove));

export default router;