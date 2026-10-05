const express = require("express");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Public, no login required, and returns every item (no pagination/limit) --
// the gallery is meant to be fully browsable by anyone landing on the site.
router.get("/", (req, res) => {
  const db = readDB();
  res.json({ gallery: [...db.gallery].sort((a, b) => new Date(b.date) - new Date(a.date)) });
});

router.get("/:id", (req, res) => {
  const db = readDB();
  const item = db.gallery.find((g) => g.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item galeri tidak ditemukan." });
  res.json({ item });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { title, caption, image } = req.body;
  if (!title || !image) return res.status(400).json({ error: "Judul dan gambar wajib diisi." });
  const item = { id: `gal-${nanoid(8)}`, title, caption: caption || "", image, date: new Date().toISOString() };
  await update((data) => data.gallery.push(item));
  res.status(201).json({ item });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const db = readDB();
  const item = db.gallery.find((g) => g.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item galeri tidak ditemukan." });
  await update((data) => {
    Object.assign(data.gallery.find((g) => g.id === req.params.id), req.body);
  });
  res.json({ message: "Item galeri diperbarui." });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await update((data) => {
    data.gallery = data.gallery.filter((g) => g.id !== req.params.id);
  });
  res.json({ message: "Item galeri dihapus." });
});

module.exports = router;
