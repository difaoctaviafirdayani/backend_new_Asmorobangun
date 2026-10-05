const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { makeUploader } = require("../upload");

const router = express.Router();
const uploadImage = makeUploader("site_images");

// Upload langsung dari masing-masing fitur di dashboard admin (foto topeng, galeri,
// artikel, pengumuman, kelas/fasilitas, gambar QRIS, dll). Tidak ada lagi "pustaka media":
// file disimpan ke /uploads/site_images dan URL-nya langsung dikembalikan ke form.
router.use(requireAuth, requireAdmin);

// POST /api/uploads/image  (multipart field: image)  ->  { item: { name, url } }
router.post("/image", uploadImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File gambar wajib diunggah." });
  res.status(201).json({
    item: {
      name: req.file.originalname,
      url: `/uploads/site_images/${req.file.filename}`,
    },
  });
});

module.exports = router;
