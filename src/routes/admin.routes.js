const express = require("express");
const { readDB } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/stats", (req, res) => {
  const db = readDB();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const bookingsThisMonth = db.bookings.filter((b) => new Date(b.createdAt) >= startOfMonth).length;
  const ordersThisMonth = db.topengOrders.filter((o) => new Date(o.createdAt) >= startOfMonth).length;

  // most popular facility by booking count
  const countByFacility = {};
  db.bookings.forEach((b) => {
    countByFacility[b.facilityId] = (countByFacility[b.facilityId] || 0) + 1;
  });
  let popular = null;
  let max = 0;
  Object.entries(countByFacility).forEach(([fid, count]) => {
    if (count > max) {
      max = count;
      popular = db.facilities.find((f) => f.id === fid);
    }
  });

  const recentRegistrants = [...db.bookings]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
    .map((b) => ({ name: b.userName, email: b.userEmail, facility: b.facilityName, date: b.createdAt, status: b.status }));

  const pendingReview = db.bookings.filter((b) => b.status === "menunggu_verifikasi").length + db.topengOrders.filter((o) => o.status === "menunggu_verifikasi").length;

  res.json({
    totalPendaftar: db.bookings.length + db.topengOrders.length,
    bookingsThisMonth,
    ordersThisMonth,
    totalUsers: db.users.filter((u) => u.role !== "admin").length,
    popularFacility: popular ? popular.name : "-",
    pendingReview,
    recentRegistrants,
  });
});

module.exports = router;
