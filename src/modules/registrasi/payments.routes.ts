// ===========================================================================
// REGISTRASI › PENGATURAN PEMBAYARAN (rekening bank, QRIS, WhatsApp)
// Base URL: /api/payments
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "./payments.controller";

const router = Router();

router.get("/settings", requireAuth, asyncHandler(c.getSettings));                    // pengguna login
router.patch("/settings", requireAuth, requireAdmin, asyncHandler(c.updateSettings)); // admin

export default router;