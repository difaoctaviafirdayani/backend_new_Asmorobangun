// ===========================================================================
// ADMIN › STATISTIK DASHBOARD        Base URL: /api/admin
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const { facilities } = require("../../database/layanan.repo");
const { threads } = require("../../database/forum.repo");
const { bookings, orders } = require("../../database/registrasi.repo");
const { getMemberStats } = require("../../database/users.repo");

const router = express.Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const [bookingList, orderList, threadList, facilityList] = await Promise.all([
      bookings.list(),
      orders.list(),
      threads.list(),
      facilities.list(),
    ]);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = (item, key = "createdAt") => new Date(item[key]) >= startOfMonth;

    // fasilitas paling banyak dibooking
    const countByFacility = {};
    bookingList.forEach((b) => {
      countByFacility[b.facilityId] = (countByFacility[b.facilityId] || 0) + 1;
    });
    let popular = null;
    let max = 0;
    Object.entries(countByFacility).forEach(([fid, count]) => {
      if (count > max) {
        max = count;
        popular = facilityList.find((f) => f.id === fid);
      }
    });

    // data member diambil dari MySQL
    const members = await getMemberStats(startOfMonth);

    const recentRegistrants = bookingList
      .slice(0, 6)
      .map((b) => ({ name: b.userName, email: b.userEmail, facility: b.facilityName, date: b.createdAt, status: b.status }));

    res.json({
      totalPendaftar: bookingList.length + orderList.length,
      bookingsThisMonth: bookingList.filter((b) => thisMonth(b)).length,
      ordersThisMonth: orderList.filter((o) => thisMonth(o)).length,
      totalUsers: members.total,
      newUsersThisMonth: members.newThisMonth,
      forumThreadsThisMonth: threadList.filter((t) => thisMonth(t, "date")).length,
      popularFacility: popular ? popular.name : "-",
      pendingReview:
        bookingList.filter((b) => b.status === "menunggu_verifikasi").length +
        orderList.filter((o) => o.status === "menunggu_verifikasi").length,
      recentRegistrants,
    });
  })
);

module.exports = router;