// ===========================================================================
// LAYANAN › KATALOG TOPENG        Base URL: /api/topeng
// (pesanan topeng ada di modules/registrasi/orders.routes.ts)
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "./topeng.controller";

const router = Router();

router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));

router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

export default router;