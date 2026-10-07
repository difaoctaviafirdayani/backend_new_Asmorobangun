const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { omit } = require("../../utils/helpers");

exports.list = (req, res) => {
  res.json({ topeng: readDB().topeng });
};

exports.getOne = (req, res) => {
  const item = readDB().topeng.find((t) => t.id === req.params.id);
  if (!item) throw httpError(404, "Topeng tidak ditemukan.");
  res.json({ topeng: item });
};

exports.create = async (req, res) => {
  const { name, character, color, price, stock, image, desc } = req.body;
  if (!name || !price) throw httpError(400, "Nama dan harga wajib diisi.");
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) throw httpError(400, "Harga harus berupa angka lebih dari 0.");
  const item = {
    id: `tp-${nanoid(6)}`,
    name,
    character: character || "",
    color: color || "",
    price: Number(price),
    stock: Number(stock) || 0,
    image: image || "topeng-default.jpg",
    desc: desc || "",
  };
  await update((data) => data.topeng.push(item));
  res.status(201).json({ topeng: item });
};

exports.update = async (req, res) => {
  if (!readDB().topeng.find((t) => t.id === req.params.id)) throw httpError(404, "Topeng tidak ditemukan.");
  const body = omit(req.body, ["id"]);
  if (body.price !== undefined) {
    body.price = Number(body.price);
    if (!Number.isFinite(body.price) || body.price <= 0) throw httpError(400, "Harga harus berupa angka lebih dari 0.");
  }
  if (body.stock !== undefined) body.stock = Number(body.stock) || 0;
  await update((data) => {
    Object.assign(data.topeng.find((t) => t.id === req.params.id), body);
  });
  res.json({ message: "Topeng diperbarui." });
};

exports.remove = async (req, res) => {
  await update((data) => {
    data.topeng = data.topeng.filter((t) => t.id !== req.params.id);
  });
  res.json({ message: "Topeng dihapus dari katalog." });
};
