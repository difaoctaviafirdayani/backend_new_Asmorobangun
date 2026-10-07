// ===========================================================================
// ADMIN › STATISTIK DASHBOARD        Base URL: /api/admin
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { readDB } = require("../../database/db");
const { sortNewest } = require("../../utils/helpers");

const router = express.Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get("/stats", (req, res) => {
  const db = readDB();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = (item, key = "createdAt") => new Date(item[key]) >= startOfMonth;

  // fasilitas paling banyak dibooking
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

  const members = db.users.filter((u) => u.role !== "admin");
  const recentRegistrants = sortNewest(db.bookings, "createdAt")
    .slice(0, 6)
    .map((b) => ({ name: b.userName, email: b.userEmail, facility: b.facilityName, date: b.createdAt, status: b.status }));

  res.json({
    totalPendaftar: db.bookings.length + db.topengOrders.length,
    bookingsThisMonth: db.bookings.filter((b) => thisMonth(b)).length,
    ordersThisMonth: db.topengOrders.filter((o) => thisMonth(o)).length,
    totalUsers: members.length,
    newUsersThisMonth: members.filter((u) => thisMonth(u)).length,
    forumThreadsThisMonth: db.forumThreads.filter((t) => thisMonth(t, "date")).length,
    popularFacility: popular ? popular.name : "-",
    pendingReview:
      db.bookings.filter((b) => b.status === "menunggu_verifikasi").length +
      db.topengOrders.filter((o) => o.status === "menunggu_verifikasi").length,
    recentRegistrants,
  });
});

module.exports = router;
