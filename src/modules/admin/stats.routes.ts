// ===========================================================================
// ADMIN › STATISTIK DASHBOARD        Base URL: /api/admin
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import { facilities } from "../../database/layanan.repo";
import { threads } from "../../database/forum.repo";
import { bookings, orders } from "../../database/registrasi.repo";
import { getMemberStats } from "../../database/users.repo";

type Row = Record<string, any>;

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [bookingList, orderList, threadList, facilityList] = await Promise.all([
      bookings.list(),
      orders.list(),
      threads.list(),
      facilities.list(),
    ]);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = (item: Row, key = "createdAt"): boolean => new Date(item[key]) >= startOfMonth;

    // fasilitas paling banyak dibooking
    const countByFacility: Record<string, number> = {};
    bookingList.forEach((b) => {
      countByFacility[b.facilityId] = (countByFacility[b.facilityId] || 0) + 1;
    });
    let popular: Row | null | undefined = null;
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
      popularFacility: popular ? (popular as Row).name : "-",
      pendingReview:
        bookingList.filter((b) => b.status === "menunggu_verifikasi").length +
        orderList.filter((o) => o.status === "menunggu_verifikasi").length,
      recentRegistrants,
    });
  })
);

export default router;