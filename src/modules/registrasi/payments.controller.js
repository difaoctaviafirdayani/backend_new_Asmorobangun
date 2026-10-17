const { paymentSettings } = require("../../database/registrasi.repo");

// GET /api/payments/settings
exports.getSettings = async (req, res) => {
  res.json({ settings: await paymentSettings.get() });
};

// PATCH /api/payments/settings
exports.updateSettings = async (req, res) => {
  await paymentSettings.update(req.body || {});
  res.json({ message: "Pengaturan pembayaran diperbarui." });
};