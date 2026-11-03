// ===========================================================================
// ADMIN › UPLOAD GAMBAR (topeng, galeri, artikel, pengumuman, QRIS, dll)
// Base URL: /api/uploads        field form-data: image
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { makeUploader } from "../../utils/upload";

const router = Router();
const uploadImage = makeUploader("site_images");

router.use(requireAuth, requireAdmin);

router.post("/image", ...uploadImage.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "File gambar wajib diunggah." });
    return;
  }
  res.status(201).json({
    item: { name: req.file.originalname, url: `/uploads/site_images/${req.file.filename}` },
  });
});

export default router;