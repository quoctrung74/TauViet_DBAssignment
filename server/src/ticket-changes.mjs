// Báo cáo BTL2: phí 10% giá vé cũ, giao dịch ghi số tiền sau cấn trừ.
export function registerTicketChanges(
  app,
  { pool, wrap, bookingError, randId, heldSeats, bookingSeatKey },
) {
  const handler = (confirm) =>
    wrap(async (req, res) => {
      const { action, tickets, expectedSettlements } = req.body || {};
      if (
        !["return", "exchange"].includes(action) ||
        !Array.isArray(tickets) ||
        tickets.length < 1 ||
        tickets.length > 10 ||
        tickets.some(
          (t) =>
            typeof t?.ticketId !== "string" ||
            !t.ticketId ||
            t.ticketId.length > 30 ||
            (action === "exchange" &&
              (typeof t.trainId !== "string" ||
                !t.trainId ||
                !Number.isSafeInteger(t.carNo) ||
                t.carNo < 1 ||
                !Number.isSafeInteger(t.seatNo) ||
                t.seatNo < 1)),
        )
      )
        throw bookingError("Vui lòng chọn vé và chỗ thay thế hợp lệ.");
      if (new Set(tickets.map((t) => t.ticketId)).size !== tickets.length)
        throw bookingError("Danh sách có vé bị chọn trùng.");
      if (
        confirm &&
        (!Array.isArray(expectedSettlements) || expectedSettlements.length !== tickets.length)
      )
        throw bookingError("Vui lòng tính lại phí trước khi xác nhận.");
      const client = await pool.connect();
      try {
        await client.query(confirm ? "BEGIN" : "BEGIN READ ONLY");
        const { rows: originals } = await client.query(
          `SELECT v.mave, v.trangthaive, m.hotenhanhkhach, m.sogiayto, m.madoituong,
           m.thanhtien, m.machuyentau, m.stttoa, m.sttcho, g.manhaga AS from_id,
           h.manhaga AS to_id, d.cccd_khachhang, d.trangthai AS order_status,
           g.thoigiandidukien > (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') AS future,
           COALESCE(gd.phuongthucthanhtoan, incoming.phuongthucthanhtoan, original_payment.phuongthucthanhtoan) AS method
         FROM public.ve v
         JOIN public.mucdatve m USING (madondatve, sttmuc)
         JOIN public.dondatve d USING (madondatve)
         JOIN public.gatrongchuyen g ON g.machuyentau=m.machuyentau AND g.thutuga=m.thutugalen
         JOIN public.gatrongchuyen h ON h.machuyentau=m.machuyentau AND h.thutuga=m.thutugaxuong
         LEFT JOIN public.giaodich gd ON gd.madondatve=d.madondatve AND gd.trangthai='Thành công'
         LEFT JOIN public.yeucaudoitra previous ON previous.mavethaythe=v.mave
         LEFT JOIN public.giaodich incoming ON incoming.mayeucau=previous.mayeucau
         LEFT JOIN public.ve original ON original.mave=previous.mavegoc
         LEFT JOIN public.giaodich original_payment ON original_payment.madondatve=original.madondatve
         WHERE d.madondatve=$1 AND v.mave=ANY($2::varchar[])
         ORDER BY v.mave ${confirm ? "FOR UPDATE OF v" : ""}`,
          [req.params.orderId, tickets.map((t) => t.ticketId)],
        );
        if (
          originals.length !== tickets.length ||
          originals.some(
            (v) =>
              v.trangthaive !== "Có hiệu lực" || v.order_status !== "Đã thanh toán" || !v.future,
          )
        )
          throw bookingError(
            "Chỉ có thể đổi hoặc trả vé còn hiệu lực của đơn đã thanh toán, trước giờ tàu chạy.",
          );
        if (confirm && action === "exchange") {
          const keys = new Set(tickets.map((t) => `${t.trainId}:${bookingSeatKey(t)}`));
          for (const key of [...keys].sort())
            await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
        }
        let employee;
        if (confirm) {
          const staff = await client.query(
            `SELECT cccd FROM public.damnhan WHERE mavaitro='VT02'
           AND ($1='' OR cccd=$1) ORDER BY cccd LIMIT 1`,
            [process.env.TICKET_CHANGE_EMPLOYEE_CCCD?.trim() || ""],
          );
          employee = staff.rows[0]?.cccd;
          if (!employee)
            throw bookingError("Chưa có nhân viên bán vé được cấu hình để xử lý yêu cầu.");
        }
        const results = [];
        const targets = [];
        for (const [i, ticket] of tickets.entries()) {
          const old = originals.find((v) => v.mave === ticket.ticketId);
          let target;
          if (action === "exchange") {
            if (
              old.machuyentau === ticket.trainId &&
              old.stttoa === ticket.carNo &&
              old.sttcho === ticket.seatNo
            )
              throw bookingError("Vui lòng chọn chỗ hoặc chuyến khác vé hiện tại.");
            const { rows } = await client.query(
              `SELECT a.thutuga AS "fromSeq", b.thutuga AS "toSeq", p.giacoso, p.giamdoituong, p.thanhtien,
               public.fn_kiem_tra_cho_theo_chang(c.machuyentau,$4,$5,na.tennhaga,nb.tennhaga) AS available
             FROM public.chuyentau c
             JOIN public.gatrongchuyen a ON a.machuyentau=c.machuyentau AND a.manhaga=$2
             JOIN public.gatrongchuyen b ON b.machuyentau=c.machuyentau AND b.manhaga=$3
             JOIN public.nhaga na ON na.manhaga=a.manhaga
             JOIN public.nhaga nb ON nb.manhaga=b.manhaga
             CROSS JOIN LATERAL public.fn_tinh_gia_ve_du_kien(c.machuyentau,$4,$5,na.tennhaga,nb.tennhaga,$6) p
             WHERE c.machuyentau=$1 AND c.trangthai='Sẵn sàng' AND a.thutuga<b.thutuga
               AND a.thoigiandidukien > (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
              [ticket.trainId, old.from_id, old.to_id, ticket.carNo, ticket.seatNo, old.madoituong],
            );
            target = rows[0];
            const key = bookingSeatKey(ticket);
            if (
              !target?.available ||
              heldSeats(ticket.trainId, { seq: target.fromSeq }, { seq: target.toSeq }).has(key) ||
              targets.some(
                (t) =>
                  t.trainId === ticket.trainId &&
                  t.key === key &&
                  t.fromSeq < target.toSeq &&
                  target.fromSeq < t.toSeq,
              )
            )
              throw bookingError("Chỗ thay thế không còn trống hoặc không phù hợp với hành trình.");
            targets.push({
              trainId: ticket.trainId,
              key,
              fromSeq: target.fromSeq,
              toSeq: target.toSeq,
            });
          }
          const {
            rows: [amounts],
          } = await client.query(
            `SELECT $1::numeric AS "oldPrice", $2::numeric AS "newPrice",
             round($1::numeric * 0.10, 2) AS fee,
             $2::numeric - $1::numeric + round($1::numeric * 0.10, 2) AS settlement`,
            [old.thanhtien, target?.thanhtien ?? 0],
          );
          const result = {
            ticketId: ticket.ticketId,
            passengerName: old.hotenhanhkhach,
            ...Object.fromEntries(
              Object.entries(amounts).map(([key, value]) => [key, Number(value)]),
            ),
          };
          results.push(result);
          if (!confirm) continue;
          if (expectedSettlements[i] !== result.settlement)
            throw bookingError("Số tiền đã thay đổi. Vui lòng tính lại trước khi xác nhận.");

          let replacementTicketId = null;
          let replacementOrderId = null;
          if (target) {
            replacementOrderId = randId("DDW", 13);
            replacementTicketId = randId("VW");
            await client.query(
              `INSERT INTO public.dondatve(madondatve,ngaytaodon,giotaodon,trangthai,tongtien,cccd_khachhang)
             VALUES ($1,CURRENT_DATE,LOCALTIME,'Đã thanh toán',0,$2)`,
              [replacementOrderId, old.cccd_khachhang],
            );
            await client.query(
              `INSERT INTO public.mucdatve(madondatve,sttmuc,hotenhanhkhach,sogiayto,giacoso,giamdoituong,thanhtien,
              machuyentau,stttoa,sttcho,thutugalen,thutugaxuong,madoituong)
             VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
              [
                replacementOrderId,
                old.hotenhanhkhach,
                old.sogiayto,
                target.giacoso,
                target.giamdoituong,
                target.thanhtien,
                ticket.trainId,
                ticket.carNo,
                ticket.seatNo,
                target.fromSeq,
                target.toSeq,
                old.madoituong,
              ],
            );
            await client.query(
              `INSERT INTO public.ve(mave,trangthaive,madondatve,sttmuc) VALUES ($1,'Có hiệu lực',$2,1)`,
              [replacementTicketId, replacementOrderId],
            );
          }
          await client.query("UPDATE public.ve SET trangthaive='Đã hủy' WHERE mave=$1", [
            ticket.ticketId,
          ]);
          const requestId = randId("YCW");
          await client.query(
            `INSERT INTO public.yeucaudoitra(mayeucau,loaiyeucau,ngayyeucau,giotaoyeucau,trangthai,
             phidoitra,sotienquyettoan,cccd_khachhang,cccd_nhanvienxuly,mavegoc,mavethaythe)
           VALUES ($1,$2,CURRENT_DATE,LOCALTIME,'Đã xử lý',$3,$4,$5,$6,$7,$8)`,
            [
              requestId,
              target ? "Đổi vé" : "Trả vé",
              amounts.fee,
              amounts.settlement,
              old.cccd_khachhang,
              employee,
              ticket.ticketId,
              replacementTicketId,
            ],
          );
          if (result.settlement !== 0) {
            await client.query(
              `INSERT INTO public.giaodich(magiaodich,ngaygiaodich,giogiaodich,loaigiaodich,sotien,
               phuongthucthanhtoan,trangthai,mayeucau)
             VALUES ($1,CURRENT_DATE,LOCALTIME,$2,$3,$4,'Thành công',$5)`,
              [
                randId("GDW"),
                result.settlement > 0 ? "Thu" : "Hoàn",
                amounts.settlement,
                old.method || "Mô phỏng",
                requestId,
              ],
            );
          }
          Object.assign(result, { requestId, replacementTicketId, replacementOrderId });
        }
        await client.query("COMMIT");
        res.status(confirm ? 201 : 200).json({ results });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    });
  app.post("/api/orders/:orderId/ticket-changes/quote", handler(false));
  app.post("/api/orders/:orderId/ticket-changes", handler(true));
}
