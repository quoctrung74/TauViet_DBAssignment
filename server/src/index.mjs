import "dotenv/config";
import cors from "cors";
import express from "express";
import pg from "pg";
import crypto from "node:crypto";
import { registerTicketChanges } from "./ticket-changes.mjs";

// PostgreSQL TIMESTAMP WITHOUT TIME ZONE: giu nguyen chuoi ngay-gio tai VN.
pg.types.setTypeParser(1114, (value) => value);
pg.types.setTypeParser(1082, (value) => value);
if (!process.env.DATABASE_URL) {
  console.error("Thieu server/.env: DATABASE_URL");
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 5000,
});
const app = express();
app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim()),
  }),
);
app.use(express.json({ limit: "300kb" }));
app.disable("x-powered-by");
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const fail = (res, error, label) => {
  console.error(`[${label}]`, error);
  const known =
    error.code === "P0001" ||
    error.code === "23514" ||
    error.code === "23503" ||
    error.code === "23505";
  return res.status(known ? 400 : 500).json({
    error: known
      ? error.message
      : `Truy van ${label} that bai. Kiem tra server console va PostgreSQL.`,
  });
};
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch((err) => fail(res, err, `${req.method} ${req.path}`));
const toLocalISO = (value) =>
  typeof value === "string" ? value.replace(" ", "T").slice(0, 19) : String(value || "");
const paramsRequired = (query, keys) =>
  keys.every((k) => typeof query[k] === "string" && query[k].trim());
const dayIsValid = (day) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00`));
const randId = (prefix, bytes = 10) =>
  prefix + crypto.randomBytes(bytes).toString("hex").toUpperCase();
const holdDuration = 10 * 60 * 1000;
const holds = new Map();
const paymentMethods = new Map([
  ["qr", "QR / Ví điện tử"],
  ["atm", "Thẻ ATM nội địa"],
  ["card", "Thẻ quốc tế"],
]);
const bookingError = (message) => Object.assign(new Error(message), { code: "P0001" });
const bookingSeatKey = ({ carNo, seatNo }) => `${carNo}:${seatNo}`;
function heldSeats(trainId, a, b) {
  const occupied = new Set();
  for (const hold of holds.values()) {
    if (!hold.processing && hold.expiresAt <= Date.now()) continue;
    if (hold.trainId === trainId && hold.a.seq < b.seq && a.seq < hold.b.seq) {
      for (const key of hold.keys) occupied.add(key);
    }
  }
  return occupied;
}

app.get(
  ["/api", "/api/health"],
  wrap(async (_req, res) => {
    const [dbResult, routinesResult, triggersResult] = await Promise.all([
      pool.query(`SELECT current_database() AS db, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
      (SELECT count(*)::int FROM public.chuyentau) AS trips,
      (SELECT count(*)::int FROM public.toatau) AS cars,
      (SELECT count(*)::int FROM public.cho) AS seats`),
      pool.query(
        `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname=ANY($1::text[])`,
        [
          [
            "sp_tim_chuyen_tau",
            "sp_tong_hop_cho_theo_toa",
            "sp_them_phan_cong",
            "sp_sua_phan_cong",
            "sp_xoa_phan_cong",
            "fn_tinh_gia_ve_du_kien",
            "fn_kiem_tra_cho_theo_chang",
          ],
        ],
      ),
      pool.query(
        `SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D' AND tgname=ANY($1::text[])`,
        [["trg_gtc_kiem_tra_lien_tuc_thoi_gian", "trigger_order_total"]],
      ),
    ]);
    const { db, tables, trips, cars, seats } = dbResult.rows[0];
    res.json({
      ok: true,
      source: "postgresql",
      database: db,
      tables,
      trips,
      cars,
      seats,
      installedRoutines: routinesResult.rows.map((r) => r.proname).sort(),
      enabledTriggers: triggersResult.rows.map((r) => r.tgname).sort(),
    });
  }),
);
app.get(
  "/api/stations",
  wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT manhaga AS "id", tennhaga AS "name", tinhtp AS "region", trangthai AS "status" FROM public.nhaga ORDER BY tennhaga, manhaga`,
    );
    res.json({ source: "postgresql", stations: rows });
  }),
);
app.get(
  "/api/config",
  wrap(async (_req, res) => {
    const [{ rows: dates }, { rows: routes }] = await Promise.all([
      pool.query(
        `SELECT min(thoigiandidukien)::date AS "firstDate", max(thoigiandidukien)::date AS "lastDate" FROM public.gatrongchuyen`,
      ),
      pool.query(`WITH endpoints AS (
      SELECT g.machuyentau, min(g.thutuga) minstt, max(g.thutuga) maxstt FROM public.gatrongchuyen g GROUP BY g.machuyentau
    ) SELECT DISTINCT di.manhaga AS "fromId", den.manhaga AS "toId",
      ndi.tennhaga AS "fromName", nden.tennhaga AS "toName"
      FROM endpoints e
      JOIN public.gatrongchuyen di ON di.machuyentau=e.machuyentau AND di.thutuga=e.minstt
      JOIN public.gatrongchuyen den ON den.machuyentau=e.machuyentau AND den.thutuga=e.maxstt
      JOIN public.nhaga ndi ON ndi.manhaga=di.manhaga
      JOIN public.nhaga nden ON nden.manhaga=den.manhaga
      ORDER BY "fromName", "toName" LIMIT 8`),
    ]);
    res.json({
      source: "postgresql",
      firstDate: dates[0].firstDate,
      lastDate: dates[0].lastDate,
      routes: routes,
    });
  }),
);

// Chi doc du lieu tu PostgreSQL. CALL procedure voi refcursor PHAI cung mot connection + transaction.
app.get(
  "/api/trips",
  wrap(async (req, res) => {
    const { from, to, date } = req.query;
    if (!paramsRequired(req.query, ["from", "to", "date"]) || !dayIsValid(date))
      return res.status(400).json({ error: "Can from, to, date=YYYY-MM-DD" });
    const nextDate = new Date(`${date}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const following = nextDate.toISOString().slice(0, 10);
    const client = await pool.connect();
    try {
      const st = await client.query(
        `SELECT manhaga, tennhaga FROM public.nhaga WHERE manhaga = ANY($1::varchar[])`,
        [[from, to]],
      );
      const a = st.rows.find((s) => s.manhaga === from),
        b = st.rows.find((s) => s.manhaga === to);
      if (!a || !b) return res.status(400).json({ error: "Ga di/den khong ton tai trong NhaGa" });
      if (from === to) return res.status(400).json({ error: "Ga di phai khac ga den" });
      await client.query("BEGIN");
      await client.query(
        `CALL public.sp_tim_chuyen_tau($1::varchar(150),$2::varchar(150),$3::timestamp,$4::timestamp,$5::refcursor)`,
        [
          a.tennhaga,
          b.tennhaga,
          `${date} 00:00:00`,
          `${following} 00:00:00`,
          "tauviet_trip_cursor",
        ],
      );
      const cursorResult = await client.query("FETCH ALL FROM tauviet_trip_cursor");
      await client.query("COMMIT");
      res.json({ source: "sp_tim_chuyen_tau", trips: cursorResult.rows });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }),
);

// Duy tri ket qua procedure 2.3.2 cho tung toa, nhung KHONG coi Cho.TrangThai la con trong theo chang.
app.get(
  "/api/trips/:trainId/cars",
  wrap(async (req, res) => {
    const { trainId } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`CALL public.sp_tong_hop_cho_theo_toa($1::varchar(30),$2::refcursor)`, [
        trainId,
        "tauviet_car_cursor",
      ]);
      const summary = await client.query("FETCH ALL FROM tauviet_car_cursor");
      await client.query("COMMIT");
      res.json({ source: "sp_tong_hop_cho_theo_toa", cars: summary.rows });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }),
);

const routeNames = async (trainId, from, to) => {
  const { rows } = await pool.query(
    `SELECT g.manhaga AS "id", n.tennhaga AS "name", g.thutuga AS "seq"
      FROM public.gatrongchuyen g JOIN public.nhaga n ON n.manhaga=g.manhaga
      WHERE g.machuyentau=$1 AND g.manhaga = ANY($2::varchar[])`,
    [trainId, [from, to]],
  );
  const a = rows.find((r) => r.id === from),
    b = rows.find((r) => r.id === to);
  if (!a || !b || a.seq >= b.seq)
    throw Object.assign(new Error("Ga len va ga xuong khong thuoc chuyen hoac sai chieu."), {
      code: "P0001",
    });
  return { a, b };
};
app.post(
  "/api/holds",
  wrap(async (req, res) => {
    const { trainId, from, to, seats } = req.body || {};
    if (
      !paramsRequired(req.body || {}, ["trainId", "from", "to"]) ||
      !Array.isArray(seats) ||
      seats.length < 1 ||
      seats.length > 10 ||
      !seats.every(
        (s) =>
          Number.isSafeInteger(s?.carNo) &&
          s.carNo > 0 &&
          Number.isSafeInteger(s?.seatNo) &&
          s.seatNo > 0,
      )
    )
      throw bookingError("Cần chọn chuyến, chặng và từ 1 đến 10 chỗ hợp lệ.");
    const keys = new Set(seats.map(bookingSeatKey));
    if (keys.size !== seats.length) throw bookingError("Có chỗ được chọn nhiều lần.");
    const { a, b } = await routeNames(trainId, from, to);
    const { rows } = await pool.query(
      `SELECT g.thoigiandidukien > (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') AS future,
            c.trangthai = 'Sẵn sàng' AS ready
       FROM public.gatrongchuyen g JOIN public.chuyentau c USING (machuyentau)
       WHERE g.machuyentau=$1 AND g.thutuga=$2`,
      [trainId, a.seq],
    );
    if (!rows[0]?.future || !rows[0].ready) throw bookingError("Chuyến này hiện không thể đặt.");
    const client = await pool.connect();
    const holdId = randId("DDW", 13);
    let hold;
    try {
      await client.query("BEGIN");
      for (const key of [...keys].sort())
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${trainId}:${key}`]);
      const occupied = heldSeats(trainId, a, b);
      for (const seat of seats) {
        const { rows } = await client.query(
          "SELECT public.fn_kiem_tra_cho_theo_chang($1,$2,$3,$4,$5) AS ok",
          [trainId, seat.carNo, seat.seatNo, a.name, b.name],
        );
        if (!rows[0].ok || occupied.has(bookingSeatKey(seat)))
          throw bookingError("Một hoặc nhiều chỗ đã được giữ hoặc đã có vé. Vui lòng chọn lại.");
      }
      hold = { trainId, a, b, keys, expiresAt: Date.now() + holdDuration, processing: false };
      holds.set(holdId, hold);
      await client.query("COMMIT");
    } catch (e) {
      holds.delete(holdId);
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    setTimeout(() => {
      if (!hold.processing) holds.delete(holdId);
    }, holdDuration).unref();
    res.status(201).json({ holdId, expiresAt: hold.expiresAt });
  }),
);
app.delete("/api/holds/:holdId", (req, res) => {
  if (!holds.get(req.params.holdId)?.processing) holds.delete(req.params.holdId);
  res.sendStatus(204);
});
app.get(
  "/api/trips/:trainId/seats",
  wrap(async (req, res) => {
    const { trainId } = req.params,
      { from, to } = req.query;
    if (!paramsRequired(req.query, ["from", "to"]))
      return res.status(400).json({ error: "Thieu ga len/xuong" });
    const { a, b } = await routeNames(trainId, from, to);
    // Hai ham 2.4 duoc goi TREN TUNG CHO DUOC LUU TRONG Cho, KHONG sin h random.
    const { rows } = await pool.query(
      `SELECT c.stttoa AS "carNo", c.sttcho AS "number", c.vitritang AS "tier",
      c.trangthai AS "seatStatus", t.maloaitoa AS "carTypeId", lt.tenloaitoa AS "carTypeName",
      public.fn_kiem_tra_cho_theo_chang($1::varchar(30),c.stttoa,c.sttcho,$2::varchar(150),$3::varchar(150)) AS available,
      p.thanhtien::numeric AS "price"
    FROM public.cho c
    JOIN public.toatau t ON t.machuyentau=c.machuyentau AND t.stttoa=c.stttoa
    JOIN public.loaitoa lt ON lt.maloaitoa=t.maloaitoa
    CROSS JOIN LATERAL public.fn_tinh_gia_ve_du_kien($1::varchar,c.stttoa,c.sttcho,$2::varchar,$3::varchar,'DT01'::varchar) p
    WHERE c.machuyentau=$1 ORDER BY c.stttoa,c.sttcho`,
      [trainId, a.name, b.name],
    );
    const occupied = heldSeats(trainId, a, b);
    res.json({
      source: "postgresql:Cho + 2 functions",
      seats: rows.map((r) => ({
        ...r,
        available:
          r.available && !occupied.has(bookingSeatKey({ carNo: r.carNo, seatNo: r.number })),
        price: Number(r.price),
      })),
    });
  }),
);
app.get(
  "/api/price",
  wrap(async (req, res) => {
    const { trainId, carNo, seatNo, from, to, passengerType } = req.query;
    if (!paramsRequired(req.query, ["trainId", "carNo", "seatNo", "from", "to", "passengerType"]))
      return res.status(400).json({ error: "Thieu tham so tinh gia" });
    const { a, b } = await routeNames(trainId, from, to);
    const { rows } = await pool.query(
      `SELECT sodoan AS "segments", giacoso::numeric AS "base", giamdoituong::numeric AS "discount", thanhtien::numeric AS "total" FROM public.fn_tinh_gia_ve_du_kien($1::varchar,$2::integer,$3::integer,$4::varchar,$5::varchar,$6::varchar)`,
      [trainId, carNo, seatNo, a.name, b.name, passengerType],
    );
    res.json({
      source: "fn_tinh_gia_ve_du_kien",
      quote: rows.length
        ? Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]))
        : null,
    });
  }),
);
app.get(
  "/api/passenger-types",
  wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT madoituong AS "id", tendoituong AS "name", tylegiam::numeric AS "rate" FROM public.doituong ORDER BY madoituong`,
    );
    res.json({ source: "postgresql", types: rows.map((r) => ({ ...r, rate: Number(r.rate) })) });
  }),
);

// Thanh toán mô phỏng: lưu khách, đơn, giao dịch và vé trong cùng transaction.
app.post(
  "/api/orders",
  wrap(async (req, res) => {
    const { customer, holdId, paymentMethod, passengers } = req.body || {};
    const { cccd: customerCccd, fullName, phone, email, birthDate, gender } = customer || {};
    const method = paymentMethods.get(paymentMethod);
    const hold = holds.get(holdId);
    if (
      typeof customerCccd !== "string" ||
      !/^\d{12}$/.test(customerCccd) ||
      typeof fullName !== "string" ||
      fullName.trim().length < 3 ||
      (phone && (typeof phone !== "string" || !/^\d{9,15}$/.test(phone))) ||
      (email &&
        (typeof email !== "string" ||
          email.length > 254 ||
          !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) ||
      !method ||
      !Array.isArray(passengers) ||
      !passengers.length ||
      passengers.length > 10
    )
      return res
        .status(400)
        .json({ error: "Kiểm tra thông tin người đặt, hành khách và phương thức thanh toán." });
    if (!hold || hold.expiresAt <= Date.now())
      return res.status(410).json({ error: "Phiên giữ chỗ đã hết hạn. Vui lòng đặt lại." });
    if (hold.processing) return res.status(409).json({ error: "Thanh toán đang được xử lý." });
    if (
      passengers.some(
        (p) =>
          !p ||
          !Number.isSafeInteger(p.carNo) ||
          !Number.isSafeInteger(p.seatNo) ||
          typeof p.name !== "string" ||
          !p.name.trim() ||
          p.name.length > 150 ||
          typeof p.document !== "string" ||
          !p.document.trim() ||
          p.document.length > 30 ||
          typeof p.passengerType !== "string" ||
          !p.passengerType ||
          p.passengerType.length > 20,
      )
    )
      throw bookingError("Kiểm tra thông tin của từng hành khách.");
    const keys = new Set(passengers.map(bookingSeatKey));
    if (
      keys.size !== passengers.length ||
      keys.size !== hold.keys.size ||
      [...keys].some((key) => !hold.keys.has(key))
    )
      throw bookingError("Danh sách chỗ không khớp với phiên giữ chỗ.");
    const { trainId, a, b } = hold;
    const client = await pool.connect();
    try {
      if (hold.processing || holds.get(holdId) !== hold)
        return res.status(409).json({ error: "Phiên giữ chỗ đã được xử lý hoặc đã hủy." });
      if (hold.expiresAt <= Date.now())
        return res.status(410).json({ error: "Phiên giữ chỗ đã hết hạn. Vui lòng đặt lại." });
      hold.processing = true;
      await client.query("BEGIN");
      for (const key of [...keys].sort())
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${trainId}:${key}`]);
      if (hold.expiresAt <= Date.now()) throw bookingError("Phiên giữ chỗ đã hết hạn.");
      const departure = await client.query(
        `SELECT thoigiandidukien > (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') AS future
         FROM public.gatrongchuyen WHERE machuyentau=$1 AND thutuga=$2`,
        [trainId, a.seq],
      );
      if (!departure.rows[0]?.future) throw bookingError("Chuyến đã khởi hành.");
      const person = await client.query("SELECT 1 FROM public.nguoidung WHERE cccd=$1", [
        customerCccd,
      ]);
      if (!person.rowCount) {
        const [lastName, ...rest] = fullName.trim().split(/\s+/);
        const firstName = rest.pop();
        const middleName = rest.join(" ");
        if (
          !firstName ||
          [lastName, firstName, middleName].some((part) => part.length > 50) ||
          typeof birthDate !== "string" ||
          !dayIsValid(birthDate) ||
          new Date(`${birthDate}T00:00:00Z`).toISOString().slice(0, 10) !== birthDate ||
          birthDate > new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }) ||
          !["Nam", "Nữ"].includes(gender)
        )
          throw bookingError("Khách mới cần họ tên đầy đủ, ngày sinh và giới tính hợp lệ.");
        await client.query(
          `INSERT INTO public.nguoidung(cccd,ho,tengiua,ten,ngaysinh,gioitinh)
           VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (cccd) DO NOTHING`,
          [customerCccd, lastName, middleName || null, firstName, birthDate, gender],
        );
        if (phone)
          await client.query(
            "INSERT INTO public.nguoidung_sdt(cccd,sdt) VALUES($1,$2) ON CONFLICT DO NOTHING",
            [customerCccd, phone],
          );
        if (email)
          await client.query(
            "INSERT INTO public.nguoidung_email(cccd,email) VALUES($1,$2) ON CONFLICT DO NOTHING",
            [customerCccd, email],
          );
      }
      await client.query("INSERT INTO public.khachhang(cccd) VALUES($1) ON CONFLICT DO NOTHING", [
        customerCccd,
      ]);
      const orderId = holdId;
      await client.query(
        `INSERT INTO public.dondatve(madondatve,ngaytaodon,giotaodon,trangthai,tongtien,cccd_khachhang) VALUES($1,CURRENT_DATE,LOCALTIME,'Đã thanh toán',0,$2)`,
        [orderId, customerCccd],
      );
      for (const [i, p] of passengers.entries()) {
        const available = await client.query(
          `SELECT public.fn_kiem_tra_cho_theo_chang($1,$2,$3,$4,$5) AS ok`,
          [trainId, p.carNo, p.seatNo, a.name, b.name],
        );
        if (!available.rows[0].ok)
          throw Object.assign(new Error(`Cho ${p.carNo}/${p.seatNo} da co ve trung chang`), {
            code: "P0001",
          });
        const quote = await client.query(
          `SELECT giacoso,giamdoituong,thanhtien FROM public.fn_tinh_gia_ve_du_kien($1::varchar,$2::integer,$3::integer,$4::varchar,$5::varchar,$6::varchar)`,
          [trainId, p.carNo, p.seatNo, a.name, b.name, p.passengerType],
        );
        const q = quote.rows[0];
        await client.query(
          `INSERT INTO public.mucdatve(madondatve,sttmuc,hotenhanhkhach,sogiayto,giacoso,giamdoituong,thanhtien,machuyentau,stttoa,sttcho,thutugalen,thutugaxuong,madoituong)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            orderId,
            i + 1,
            p.name,
            p.document,
            q.giacoso,
            q.giamdoituong,
            q.thanhtien,
            trainId,
            p.carNo,
            p.seatNo,
            a.seq,
            b.seq,
            p.passengerType,
          ],
        );
      }
      // Trigger trigger_order_total cap nhat TongTien tu MucDatVe.
      const check = await client.query(
        `SELECT d.tongtien::numeric AS "total", COALESCE(SUM(m.thanhtien),0)::numeric AS "sum" FROM public.dondatve d LEFT JOIN public.mucdatve m ON m.madondatve=d.madondatve WHERE d.madondatve=$1 GROUP BY d.tongtien`,
        [orderId],
      );
      if (!check.rows.length || Number(check.rows[0].total) !== Number(check.rows[0].sum))
        throw Object.assign(
          new Error("Trigger dong bo TongTien chua duoc cai dat/chua hoat dong"),
          { code: "P0001" },
        );
      await client.query(
        `INSERT INTO public.giaodich(magiaodich,ngaygiaodich,giogiaodich,loaigiaodich,sotien,phuongthucthanhtoan,trangthai,madondatve)
         VALUES($1,CURRENT_DATE,LOCALTIME,'Thu',$2,$3,'Thành công',$4)`,
        [randId("GDW"), check.rows[0].total, method, orderId],
      );
      for (const [i] of passengers.entries()) {
        await client.query(
          `INSERT INTO public.ve(mave,trangthaive,madondatve,sttmuc) VALUES($1,'Có hiệu lực',$2,$3)`,
          [randId("VW"), orderId, i + 1],
        );
      }
      if (hold.expiresAt <= Date.now()) throw bookingError("Phiên giữ chỗ đã hết hạn.");
      await client.query("COMMIT");
      holds.delete(holdId);
      res.status(201).json({
        source: "postgresql",
        orderId,
        status: "Đã thanh toán",
        total: Number(check.rows[0].total),
        issuedTickets: passengers.length,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      hold.processing = false;
      if (hold.expiresAt <= Date.now()) holds.delete(holdId);
      throw e;
    } finally {
      client.release();
    }
  }),
);

app.get(
  "/api/orders",
  wrap(async (req, res) => {
    const cccd = String(req.query.customerCccd || "");
    if (!/^\d{12}$/.test(cccd))
      return res.status(400).json({ error: "Nhap CCCD khach hang (12 chu so)" });
    const { rows } = await pool.query(
      `SELECT d.madondatve AS "orderId", d.ngaytaodon AS "date", d.trangthai AS "status", d.tongtien::numeric AS "total", COUNT(m.sttmuc)::int AS "items"
      FROM public.dondatve d LEFT JOIN public.mucdatve m ON m.madondatve=d.madondatve
      WHERE d.cccd_khachhang=$1 GROUP BY d.madondatve ORDER BY d.ngaytaodon DESC,d.madondatve DESC`,
      [cccd],
    );
    res.json({ source: "postgresql", orders: rows.map((r) => ({ ...r, total: Number(r.total) })) });
  }),
);
app.get(
  "/api/orders/:orderId",
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT m.madondatve AS "orderId",m.sttmuc AS "itemNo",m.hotenhanhkhach AS "passengerName",m.sogiayto AS "document",m.machuyentau AS "trainId", m.stttoa AS "carNo",m.sttcho AS "seatNo",m.thutugalen AS "fromSeq",m.thutugaxuong AS "toSeq",m.thanhtien::numeric AS "price",d.trangthai AS "orderStatus",d.cccd_khachhang AS "customerCccd", v.mave AS "ticketId",v.trangthaive AS "ticketStatus",
       c.mamactau AS "trainCode",a.manhaga AS "fromId", b.manhaga AS "toId",
       na.tennhaga AS "fromName", nb.tennhaga AS "toName",a.thoigiandidukien AS "departure",
       (v.trangthaive='Có hiệu lực' AND d.trangthai='Đã thanh toán' AND
         a.thoigiandidukien > (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')) IS TRUE AS eligible,
       concat_ws(' ',n.ho,n.tengiua,n.ten) AS "customerName"
      FROM public.mucdatve m JOIN public.dondatve d ON d.madondatve=m.madondatve LEFT JOIN public.ve v ON v.madondatve=m.madondatve AND v.sttmuc=m.sttmuc
      JOIN public.nguoidung n ON n.cccd=d.cccd_khachhang
      JOIN public.chuyentau c ON c.machuyentau=m.machuyentau
      JOIN public.gatrongchuyen a ON a.machuyentau=m.machuyentau AND a.thutuga=m.thutugalen
      JOIN public.gatrongchuyen b ON b.machuyentau=m.machuyentau AND b.thutuga=m.thutugaxuong
      JOIN public.nhaga na ON na.manhaga=a.manhaga JOIN public.nhaga nb ON nb.manhaga=b.manhaga
      WHERE m.madondatve=$1 ORDER BY m.sttmuc`,
      [req.params.orderId],
    );
    res.json({ source: "postgresql", items: rows.map((r) => ({ ...r, price: Number(r.price) })) });
  }),
);
registerTicketChanges(app, { pool, wrap, bookingError, randId, heldSeats, bookingSeatKey });
app.get(
  "/api/assignments",
  wrap(async (req, res) => {
    const trainId = String(req.query.trainId || "");
    const { rows } = await pool.query(
      `SELECT p.cccd AS "cccd",p.machuyentau AS "trainId",p.mavaitro AS "roleId",v.tenvaitro AS "roleName",(n.ho||' '||COALESCE(n.tengiua||' ','')||n.ten) AS "employeeName" FROM public.phancongphucvu p JOIN public.nguoidung n ON n.cccd=p.cccd JOIN public.vaitronhanvien v ON v.mavaitro=p.mavaitro WHERE ($1='' OR p.machuyentau=$1) ORDER BY p.machuyentau,p.cccd`,
      [trainId],
    );
    res.json({ source: "postgresql", assignments: rows });
  }),
);
app.post(
  "/api/assignments",
  wrap(async (req, res) => {
    const { cccd, trainId, roleId } = req.body;
    await pool.query(
      "CALL public.sp_them_phan_cong($1::char(12),$2::varchar(30),$3::varchar(20))",
      [cccd, trainId, roleId],
    );
    res.status(201).json({ ok: true, procedure: "sp_them_phan_cong" });
  }),
);
app.put(
  "/api/assignments",
  wrap(async (req, res) => {
    const { oldCccd, newCccd, trainId, roleId } = req.body;
    await pool.query(
      "CALL public.sp_sua_phan_cong($1::char(12),$2::varchar(30),$3::char(12),$4::varchar(20))",
      [oldCccd, trainId, newCccd, roleId],
    );
    res.json({ ok: true, procedure: "sp_sua_phan_cong" });
  }),
);
app.delete(
  "/api/assignments",
  wrap(async (req, res) => {
    const { cccd, trainId } = req.body;
    await pool.query("CALL public.sp_xoa_phan_cong($1::char(12),$2::varchar(30))", [cccd, trainId]);
    res.json({ ok: true, procedure: "sp_xoa_phan_cong" });
  }),
);
app.get(
  "/api/schedule",
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT g.machuyentau AS "trainId",g.thutuga AS "seq",n.tennhaga AS "station",to_char(g.thoigiandendukien,'YYYY-MM-DD HH24:MI:SS') AS "arrival",to_char(g.thoigiandidukien,'YYYY-MM-DD HH24:MI:SS') AS "departure" FROM public.gatrongchuyen g JOIN public.nhaga n ON n.manhaga=g.manhaga WHERE g.machuyentau=$1 ORDER BY g.thutuga`,
      [req.query.trainId],
    );
    res.json({ source: "postgresql", schedule: rows });
  }),
);
app.patch(
  "/api/schedule",
  wrap(async (req, res) => {
    const { trainId, seq, arrival, departure } = req.body;
    const { rows } = await pool.query(
      `UPDATE public.gatrongchuyen SET thoigiandendukien=$3::timestamp,thoigiandidukien=$4::timestamp WHERE machuyentau=$1 AND thutuga=$2 RETURNING machuyentau,thutuga,thoigiandendukien,thoigiandidukien`,
      [trainId, seq, arrival || null, departure || null],
    );
    if (!rows.length) return res.status(404).json({ error: "Khong tim thay ga trong chuyen" });
    res.json({ updated: rows[0], trigger: "trg_gtc_kiem_tra_lien_tuc_thoi_gian" });
  }),
);
app.use("/api", (_req, res) => res.status(404).json({ error: "API khong ton tai" }));
// Kiem tra ten CSDL truoc khi mo cong API, tranh ghi nham vao btl_tauhoa cu.
async function startServer() {
  const expected = (process.env.EXPECTED_DATABASE || "").trim();
  const result = await pool.query("SELECT current_database() AS name");
  const actual = result.rows[0].name;
  if (expected && actual !== expected)
    throw new Error(
      `Sai database: dang ket noi ${actual}, yeu cau ${expected}. Kiem tra server/.env.`,
    );
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () =>
    console.log(`TauViet API http://localhost:${port}/api | PostgreSQL: ${actual}`),
  );
}
startServer().catch((error) => {
  console.error("Khoi dong Backend that bai:", error.message);
  process.exit(1);
});
