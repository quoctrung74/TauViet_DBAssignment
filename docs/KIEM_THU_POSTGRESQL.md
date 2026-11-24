# Checklist kiểm thử PostgreSQL meaningfulData

## Phần A: đảm bảo dùng đúng DB (pgAdmin)

```sql
SELECT current_database();
SELECT COUNT(*) AS so_chuyen FROM ChuyenTau;
SELECT COUNT(*) AS so_toa FROM ToaTau;
SELECT COUNT(*) AS so_cho FROM Cho;
```

Khi chưa thêm dữ liệu khác, kết quả dự kiến lần lượt: `btl_tauhoa_meaningfulData`, `30`, `90`, `1620`.

## Phần B: API kiểm tra

1. `http://localhost:3000/api/health`: xem database, routines, triggers.
2. `http://localhost:3000/api/stations`: đọc nhà ga PostgreSQL.
3. `http://localhost:3000/api/trips?from=GA001&to=GA018&date=2026-12-10`: tra CT001 bằng procedure.
4. `http://localhost:3000/api/trips/CT001/cars`: tổng hợp ba toa bằng procedure.
5. `http://localhost:3000/api/trips/CT001/seats?from=GA001&to=GA018`: đọc 54 chỗ và gọi hai function.
6. `http://localhost:3000/api/price?trainId=CT001&carNo=2&seatNo=2&from=GA001&to=GA018&passengerType=DT01`: tính giá từ function.

Nếu bước 3/4/5/6 báo 500, mở terminal backend xem lỗi PostgreSQL. Nguyên nhân thường gặp là chưa cài procedure hoặc function vào DB **mới**.

## Phần C: Kiểm tra trigger cập nhật tổng tiền

Sau khi web trả mã đơn, thay `MA_DON` trong SQL bên dưới:

```sql
SELECT d.MaDonDatVe, d.TrangThai, d.TongTien,
       SUM(m.ThanhTien) AS TongMuc
FROM DonDatVe d JOIN MucDatVe m ON m.MaDonDatVe=d.MaDonDatVe
WHERE d.MaDonDatVe='MA_DON'
GROUP BY d.MaDonDatVe, d.TrangThai, d.TongTien;
```

`TongTien` phải bằng `TongMuc`. Nếu trigger `trigger_order_total` chưa được cài trong DB mới, API sẽ từ chối tạo đơn do tổng không khớp.

## Cẩn trọng

Không chạy lại file 01/02/03 trên một DB đã có bảng và dữ liệu. Không chạy thủ tục INSERT/UPDATE/DELETE mẫu tràn lan trên DB bạn dùng để làm báo cáo. Dữ liệu đầu vào đã bao gồm các giao dịch, đơn và vé mẫu, nhưng ứng dụng **không xác nhận thanh toán thực**.
