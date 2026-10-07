// ===========================================================================
// ADMIN › UPLOAD GAMBAR (topeng, galeri, artikel, pengumuman, QRIS, dll)
// Base URL: /api/uploads        field form-data: image
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { makeUploader } = require("../../utils/upload");

const router = express.Router();
const uploadImage = makeUploader("site_images");

router.use(requireAuth, requireAdmin);

router.post("/image", uploadImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File gambar wajib diunggah." });
  res.status(201).json({
    item: { name: req.file.originalname, url: `/uploads/site_images/${req.file.filename}` },
  });
});

module.exports = router;
