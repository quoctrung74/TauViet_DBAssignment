export function registerAdmin(app, { pool, wrap, bookingError }) {
  // Serialize assignment and timetable changes across API instances.
  async function writeAdmin(run) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'");
      await client.query("SELECT pg_advisory_xact_lock(22761, 1)");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  app.get(
    "/api/admin/catalog",
    wrap(async (_req, res) => {
      const [trips, employees] = await Promise.all([
        pool.query(`SELECT c.machuyentau AS "trainId", c.mamactau AS "trainCode", c.trangthai AS status,
                         c.thoigiankhoihanhdukien AS departure, c.thoigianketthucdukien AS arrival,
                         first_stop.name AS "fromName", last_stop.name AS "toName",
                         c.thoigiankhoihanhdukien > (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') AS future
                  FROM public.chuyentau c
                  LEFT JOIN LATERAL (
                    SELECT n.tennhaga AS name FROM public.gatrongchuyen g JOIN public.nhaga n USING (manhaga)
                    WHERE g.machuyentau=c.machuyentau ORDER BY g.thutuga LIMIT 1
                  ) first_stop ON true
                  LEFT JOIN LATERAL (
                    SELECT n.tennhaga AS name FROM public.gatrongchuyen g JOIN public.nhaga n USING (manhaga)
                    WHERE g.machuyentau=c.machuyentau ORDER BY g.thutuga DESC LIMIT 1
                  ) last_stop ON true
                  ORDER BY c.thoigiankhoihanhdukien,c.machuyentau`),
        pool.query(`SELECT nv.cccd, concat_ws(' ',n.ho,n.tengiua,n.ten) AS "employeeName",
                         jsonb_agg(jsonb_build_object('id',v.mavaitro,'name',v.tenvaitro)
                           ORDER BY v.tenvaitro) AS roles
                  FROM public.nhanvien nv JOIN public.nguoidung n USING (cccd)
                  JOIN public.damnhan d USING (cccd) JOIN public.vaitronhanvien v USING (mavaitro)
                  GROUP BY nv.cccd,n.ho,n.tengiua,n.ten ORDER BY "employeeName",nv.cccd`),
      ]);
      res.json({ trips: trips.rows, employees: employees.rows });
    }),
  );

  app.get(
    "/api/assignments",
    wrap(async (req, res) => {
      const { rows } = await pool.query(
        `SELECT p.cccd, p.machuyentau AS "trainId", p.mavaitro AS "roleId", v.tenvaitro AS "roleName",
              concat_ws(' ',n.ho,n.tengiua,n.ten) AS "employeeName"
       FROM public.phancongphucvu p JOIN public.nguoidung n USING (cccd)
       JOIN public.vaitronhanvien v USING (mavaitro)
       WHERE ($1='' OR p.machuyentau=$1) ORDER BY p.machuyentau,p.cccd`,
        [String(req.query.trainId || "")],
      );
      res.json({ source: "postgresql", assignments: rows });
    }),
  );

  const validId = (value, max) => typeof value === "string" && value.trim() && value.length <= max;
  const validCccd = (value) => typeof value === "string" && /^\d{12}$/.test(value);
  app.post(
    "/api/assignments",
    wrap(async (req, res) => {
      const { cccd, trainId, roleId } = req.body || {};
      if (!validCccd(cccd) || !validId(trainId, 30) || !validId(roleId, 20))
        throw bookingError("Chọn chuyến, nhân viên và vai trò hợp lệ.");
      await writeAdmin((db) =>
        db.query("CALL public.sp_them_phan_cong($1::char(12),$2::varchar(30),$3::varchar(20))", [
          cccd,
          trainId,
          roleId,
        ]),
      );
      res.status(201).json({ ok: true, procedure: "sp_them_phan_cong" });
    }),
  );
  app.put(
    "/api/assignments",
    wrap(async (req, res) => {
      const { oldCccd, newCccd, trainId, roleId } = req.body || {};
      if (
        !validCccd(oldCccd) ||
        !validCccd(newCccd) ||
        !validId(trainId, 30) ||
        !validId(roleId, 20)
      )
        throw bookingError("Chọn phân công, nhân viên và vai trò hợp lệ.");
      await writeAdmin((db) =>
        db.query(
          "CALL public.sp_sua_phan_cong($1::char(12),$2::varchar(30),$3::char(12),$4::varchar(20))",
          [oldCccd, trainId, newCccd, roleId],
        ),
      );
      res.json({ ok: true, procedure: "sp_sua_phan_cong" });
    }),
  );
  app.delete(
    "/api/assignments",
    wrap(async (req, res) => {
      const { cccd, trainId } = req.body || {};
      if (!validCccd(cccd) || !validId(trainId, 30)) throw bookingError("Chọn phân công cần xóa.");
      await writeAdmin((db) =>
        db.query("CALL public.sp_xoa_phan_cong($1::char(12),$2::varchar(30))", [cccd, trainId]),
      );
      res.json({ ok: true, procedure: "sp_xoa_phan_cong" });
    }),
  );

  app.get(
    "/api/schedule",
    wrap(async (req, res) => {
      const { rows } = await pool.query(
        `SELECT g.machuyentau AS "trainId",g.thutuga AS seq,n.tennhaga AS station,
              g.thoigiandendukien AS arrival,g.thoigiandidukien AS departure
       FROM public.gatrongchuyen g JOIN public.nhaga n USING (manhaga)
       WHERE g.machuyentau=$1 ORDER BY g.thutuga`,
        [req.query.trainId],
      );
      res.json({ source: "postgresql", schedule: rows });
    }),
  );

  function validTime(value) {
    if (value == null || value === "") return true;
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(value) ||
      value.startsWith("0000")
    )
      return false;
    const local = value.replace(" ", "T");
    const withSeconds = local.length === 16 ? `${local}:00` : local;
    const date = new Date(`${withSeconds}Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === withSeconds;
  }
  app.patch(
    "/api/schedule",
    wrap(async (req, res) => {
      const { trainId, seq, arrival, departure, previous } = req.body || {};
      if (
        !validId(trainId, 30) ||
        !Number.isInteger(seq) ||
        seq < 1 ||
        seq > 2147483647 ||
        arrival === undefined ||
        departure === undefined ||
        !validTime(arrival) ||
        !validTime(departure)
      )
        throw bookingError("Chọn ga và nhập ngày giờ dự kiến hợp lệ.");

      const updated = await writeAdmin(async (db) => {
        const trip = await db.query(
          `SELECT thoigiankhoihanhdukien AS start, thoigianketthucdukien AS finish
         FROM public.chuyentau WHERE machuyentau=$1 FOR UPDATE`,
          [trainId],
        );
        if (!trip.rowCount) return null;
        const { rows: stops } = await db.query(
          `SELECT thutuga AS seq, thoigiandendukien AS arrival, thoigiandidukien AS departure
         FROM public.gatrongchuyen WHERE machuyentau=$1 ORDER BY thutuga`,
          [trainId],
        );
        const current = stops.find((s) => s.seq === seq);
        if (!current) return null;
        if (
          previous &&
          (previous.arrival !== current.arrival || previous.departure !== current.departure)
        )
          throw bookingError("Lịch ga đã được cập nhật. Hãy tải lại chuyến trước khi lưu.");
        const first = seq === stops[0].seq;
        const last = seq === stops.at(-1).seq;
        if ((first ? !!arrival : !arrival) || (last ? !!departure : !departure))
          throw bookingError(
            "Ga đầu chỉ có giờ đi, ga cuối chỉ có giờ đến và ga giữa cần cả hai mốc.",
          );

        // Trigger checks neighbouring stops. The table CHECK checks arrival against departure.
        const {
          rows: [stop],
        } = await db.query(
          `UPDATE public.gatrongchuyen
         SET thoigiandendukien=$3::timestamp,thoigiandidukien=$4::timestamp
         WHERE machuyentau=$1 AND thutuga=$2
         RETURNING machuyentau,thutuga,thoigiandendukien,thoigiandidukien`,
          [trainId, seq, arrival || null, departure || null],
        );
        const start = first ? stop.thoigiandidukien : trip.rows[0].start;
        const finish = last ? stop.thoigiandendukien : trip.rows[0].finish;
        if (start !== trip.rows[0].start || finish !== trip.rows[0].finish) {
          if (start >= finish) throw bookingError("Giờ kết thúc chuyến phải sau giờ khởi hành.");
          const {
            rows: [conflict],
          } = await db.query(
            `SELECT concat_ws(' ',n.ho,n.tengiua,n.ten) AS employee, c.machuyentau AS trip
           FROM public.phancongphucvu a JOIN public.phancongphucvu b
             ON b.cccd=a.cccd AND b.machuyentau<>a.machuyentau
           JOIN public.chuyentau c ON c.machuyentau=b.machuyentau
           JOIN public.nguoidung n ON n.cccd=a.cccd
           WHERE a.machuyentau=$1 AND $2::timestamp<c.thoigianketthucdukien
             AND c.thoigiankhoihanhdukien<$3::timestamp
           ORDER BY a.cccd,c.machuyentau LIMIT 1`,
            [trainId, start, finish],
          );
          if (conflict)
            throw bookingError(
              `Khung giờ mới làm nhân viên ${conflict.employee} trùng lịch với chuyến ${conflict.trip}.`,
            );
          await db.query(
            `UPDATE public.chuyentau SET thoigiankhoihanhdukien=$2::timestamp,thoigianketthucdukien=$3::timestamp
           WHERE machuyentau=$1`,
            [trainId, start, finish],
          );
        }
        return stop;
      });
      if (!updated) return res.status(404).json({ error: "Không tìm thấy ga trong chuyến." });
      res.json({ updated, trigger: "trg_gtc_kiem_tra_lien_tuc_thoi_gian" });
    }),
  );
}
