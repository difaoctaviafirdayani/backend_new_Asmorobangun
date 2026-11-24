// ===========================================================================
// ADMIN › STATISTIK DASHBOARD        Base URL: /api/admin
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { facilities } from "../database/layanan.repo";
import { threads } from "../database/forum.repo";
import { bookings, orders } from "../database/registrasi.repo";
import { getMemberStats } from "../database/users.repo";
import { getPool } from "../database/mysql";

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

// ---------------------------------------------------------------------------
// GET /api/admin/stats/monthly?month=2026-11
// Waktu di DB = UTC, digeser +7 jam (WIB) supaya hitungan per hari pas.
// ---------------------------------------------------------------------------
const WIB = "DATE_ADD(%COL%, INTERVAL 7 HOUR)";

interface Cat {
  key: string;
  label: string;
  group: "layanan" | "topeng" | "pengguna" | "komunitas";
  daily: number[];
}

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  return {
    start: `${year}-${pad(month)}-01 00:00:00`,
    end: `${ny}-${pad(nm)}-01 00:00:00`,
    days: new Date(year, month, 0).getDate(),
  };
}

async function dailyCounts(
  table: string,
  col: string,
  start: string,
  end: string,
  days: number,
  extraWhere = "",
  groupCol?: string
): Promise<Map<string, number[]>> {
  const t = WIB.replace("%COL%", col);
  const sel = groupCol ? `${groupCol} AS label` : `'_' AS label`;
  const grp = groupCol ? `, ${groupCol}` : "";
  const [rows] = await getPool().query(
    `SELECT DAY(${t}) AS d, ${sel}, COUNT(*) AS c
       FROM ${table}
      WHERE ${t} >= ? AND ${t} < ? ${extraWhere}
      GROUP BY DAY(${t}) ${grp}`,
    [start, end]
  );
  const out = new Map<string, number[]>();
  for (const r of rows as Row[]) {
    const arr = out.get(String(r.label)) || new Array(days).fill(0);
    const idx = Number(r.d) - 1;
    if (idx >= 0 && idx < days) arr[idx] += Number(r.c);
    out.set(String(r.label), arr);
  }
  return out;
}

async function buildMonth(year: number, month: number): Promise<Cat[]> {
  const { start, end, days } = monthRange(year, month);
  const zeros = () => new Array(days).fill(0);

  const [facilityList, bk, od, us, th, rp, rv] = await Promise.all([
    facilities.list(),
    dailyCounts("bookings", "created_at", start, end, days, "", "facility_id"),
    dailyCounts("topeng_orders", "created_at", start, end, days),
    dailyCounts("users", "created_at", start, end, days, "AND role <> 'admin'"),
    dailyCounts("forum_threads", "`date`", start, end, days),
    dailyCounts("forum_replies", "`date`", start, end, days),
    dailyCounts("reviews", "`date`", start, end, days),
  ]);

  const cats: Cat[] = [];
  for (const f of facilityList) {
    cats.push({ key: `fac:${f.id}`, label: f.name, group: "layanan", daily: bk.get(String(f.id)) || zeros() });
  }
  cats.push({ key: "topeng", label: "Pesanan Topeng", group: "topeng", daily: od.get("_") || zeros() });
  cats.push({ key: "users", label: "Pengguna Baru", group: "pengguna", daily: us.get("_") || zeros() });
  cats.push({ key: "threads", label: "Diskusi Forum", group: "komunitas", daily: th.get("_") || zeros() });
  cats.push({ key: "replies", label: "Balasan Forum", group: "komunitas", daily: rp.get("_") || zeros() });
  cats.push({ key: "reviews", label: "Ulasan", group: "komunitas", daily: rv.get("_") || zeros() });
  return cats;
}

router.get(
  "/stats/monthly",
  asyncHandler(async (req, res) => {
    const nowWib = new Date(Date.now() + 7 * 3600 * 1000);
    let year = nowWib.getUTCFullYear();
    let month = nowWib.getUTCMonth() + 1;

    const q = String(req.query.month || "");
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(q)) {
      year = Number(q.slice(0, 4));
      month = Number(q.slice(5, 7));
    }
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    const [cur, prev] = await Promise.all([buildMonth(year, month), buildMonth(prevYear, prevMonth)]);
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const prevTotals = new Map(prev.map((c) => [c.key, sum(c.daily)]));

    res.json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      days: monthRange(year, month).days,
      categories: cur.map((c) => ({
        key: c.key,
        label: c.label,
        group: c.group,
        daily: c.daily,
        total: sum(c.daily),
        prevTotal: prevTotals.get(c.key) || 0,
      })),
    });
  })
);

export default router;