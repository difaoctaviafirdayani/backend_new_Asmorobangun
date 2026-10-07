const { readDB, update } = require("../../database/db");

const FIELDS = ["bankName", "accountNumber", "accountName", "qrisMerchantName", "qrisImage", "whatsapp"];

// GET /api/payments/settings
exports.getSettings = (req, res) => {
  res.json({ settings: readDB().paymentSettings });
};

// PATCH /api/payments/settings
exports.updateSettings = async (req, res) => {
  await update((data) => {
    FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) data.paymentSettings[f] = req.body[f];
    });
  });
  res.json({ message: "Pengaturan pembayaran diperbarui." });
};
