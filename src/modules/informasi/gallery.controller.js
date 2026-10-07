const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { sortNewest, omit } = require("../../utils/helpers");

// Publik & menampilkan semua item (tanpa pagination).
exports.list = (req, res) => {
  res.json({ gallery: sortNewest(readDB().gallery) });
};

exports.getOne = (req, res) => {
  const item = readDB().gallery.find((g) => g.id === req.params.id);
  if (!item) throw httpError(404, "Item galeri tidak ditemukan.");
  res.json({ item });
};

exports.create = async (req, res) => {
  const { title, caption, image } = req.body;
  if (!title || !image) throw httpError(400, "Judul dan gambar wajib diisi.");
  const item = { id: `gal-${nanoid(8)}`, title, caption: caption || "", image, date: new Date().toISOString() };
  await update((data) => data.gallery.push(item));
  res.status(201).json({ item });
};

exports.update = async (req, res) => {
  if (!readDB().gallery.find((g) => g.id === req.params.id)) throw httpError(404, "Item galeri tidak ditemukan.");
  await update((data) => {
    Object.assign(data.gallery.find((g) => g.id === req.params.id), omit(req.body, ["id"]));
  });
  res.json({ message: "Item galeri diperbarui." });
};

exports.remove = async (req, res) => {
  await update((data) => {
    data.gallery = data.gallery.filter((g) => g.id !== req.params.id);
  });
  res.json({ message: "Item galeri dihapus." });
};
