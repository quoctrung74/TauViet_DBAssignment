-- BTL2 - QUẢN LÝ VÀ ĐẶT VÉ TÀU HỎA | PostgreSQL / pgAdmin 4
-- FILE 05: 05 TRUY VẤN
-- ĐIỀU KIỆN: đã chạy 01, 02, 03.
-- File 04 (index) không bắt buộc.
-- Q1, Q2: SELECT, FROM, WHERE, ORDER BY.
-- Q3, Q4: SELECT, FROM, WHERE, GROUP BY, ORDER BY, aggregate.
-- Q5: 02 subqueries lồng nhau + COUNT, AVG.
-- Q1-DEMO ... Q5-DEMO chỉ để chụp dữ liệu mẫu.
-- Dữ liệu mới: 30 chuyến tàu, 660 ga trong chuyến,
-- 90 toa tàu, 1620 chỗ.
-- Ngày khởi hành: 10/12/2026 - 31/01/2027.


-- ============================================================
-- [Q1] SELECT - FROM - WHERE - ORDER BY (CÂU SỐ 1)
-- CHỨC NĂNG: Khách tra cứu chuyến tàu theo hành trình.
-- MÀN HÌNH: Tìm chuyến tàu.
-- ĐẦU VÀO:
--     Ga đi: Hà Nội
--     Ga đến: Huế
--     Ngày đi: 10/12/2026
-- BẢNG: GaTrongChuyen, ChuyenTau, MacTau, NhaGa.
-- ĐIỀU KIỆN: Ga lên đứng trước ga xuống trong cùng chuyến.
-- KẾT QUẢ DỰ KIẾN: 1 dòng (CT001 - SE1).
-- ============================================================

SELECT
    ct.MaChuyenTau,
    mt.MaMacTau,
    nga_di.TenNhaGa AS GaDi,
    nga_den.TenNhaGa AS GaDen,
    gd.ThoiGianDiDuKien AS GioDiDuKien,
    gx.ThoiGianDenDuKien AS GioDenDuKien,
    ct.TrangThai
FROM GaTrongChuyen AS gd
JOIN GaTrongChuyen AS gx
    ON gx.MaChuyenTau = gd.MaChuyenTau
    AND gd.ThuTuGa < gx.ThuTuGa
JOIN ChuyenTau AS ct
    ON ct.MaChuyenTau = gd.MaChuyenTau
JOIN MacTau AS mt
    ON mt.MaMacTau = ct.MaMacTau
JOIN NhaGa AS nga_di
    ON nga_di.MaNhaGa = gd.MaNhaGa
JOIN NhaGa AS nga_den
    ON nga_den.MaNhaGa = gx.MaNhaGa
WHERE nga_di.TenNhaGa = 'Hà Nội'
    AND nga_den.TenNhaGa = 'Huế'
    AND gd.ThoiGianDiDuKien >= TIMESTAMP '2026-12-10 00:00:00'
    AND gd.ThoiGianDiDuKien < TIMESTAMP '2026-12-11 00:00:00'
    AND ct.TrangThai = 'Sẵn sàng'
ORDER BY gd.ThoiGianDiDuKien ASC, ct.MaChuyenTau ASC;


-- [Q1-DEMO] ẢNH DỮ LIỆU MẪU
-- Hiển thị thông tin ga Hà Nội và ga Huế của tất cả
-- các chuyến chạy theo chiều Hà Nội -> Huế.
-- Không giới hạn ngày khởi hành.

SELECT
    g.MaChuyenTau,
    mt.MaMacTau,
    g.ThuTuGa,
    ng.TenNhaGa,
    g.ThoiGianDiDuKien,
    g.ThoiGianDenDuKien
FROM GaTrongChuyen AS g
JOIN ChuyenTau AS ct
    ON ct.MaChuyenTau = g.MaChuyenTau
JOIN MacTau AS mt
    ON mt.MaMacTau = ct.MaMacTau
JOIN NhaGa AS ng
    ON ng.MaNhaGa = g.MaNhaGa
WHERE ng.TenNhaGa IN ('Hà Nội', 'Huế')
    AND EXISTS (
        SELECT 1
        FROM GaTrongChuyen AS gd
        JOIN GaTrongChuyen AS gx
            ON gd.MaChuyenTau = gx.MaChuyenTau
        JOIN NhaGa AS ng_di
            ON ng_di.MaNhaGa = gd.MaNhaGa
        JOIN NhaGa AS ng_den
            ON ng_den.MaNhaGa = gx.MaNhaGa
        WHERE gd.MaChuyenTau = g.MaChuyenTau
            AND ng_di.TenNhaGa = 'Hà Nội'
            AND ng_den.TenNhaGa = 'Huế'
            AND gd.ThuTuGa < gx.ThuTuGa
    )
ORDER BY g.MaChuyenTau, g.ThuTuGa;


-- ============================================================
-- [Q2] SELECT - FROM - WHERE - ORDER BY (CÂU SỐ 2)
-- CHỨC NĂNG: Nhân viên/quản trị xem các chỗ đã đặt.
-- MÀN HÌNH: Quản lý chỗ trên chuyến tàu.
-- BỘ LỌC: TrangThai = 'Đã đặt'.
-- BẢNG: Cho, ToaTau, LoaiToa, ChuyenTau.
-- KẾT QUẢ DỰ KIẾN: 9 dòng thuộc 8 chuyến tàu.
-- LƯU Ý: Đây là trạng thái lưu trong bảng Cho,
-- không thay thế việc kiểm tra chỗ trống theo chặng.
-- ============================================================

SELECT
    c.MaChuyenTau,
    c.STTToa,
    lt.TenLoaiToa,
    c.STTCho,
    c.TrangThai AS TrangThaiCho
FROM Cho AS c
JOIN ToaTau AS tt
    ON tt.MaChuyenTau = c.MaChuyenTau
    AND tt.STTToa = c.STTToa
JOIN LoaiToa AS lt
    ON lt.MaLoaiToa = tt.MaLoaiToa
JOIN ChuyenTau AS ct
    ON ct.MaChuyenTau = c.MaChuyenTau
WHERE c.TrangThai = 'Đã đặt'
    AND ct.TrangThai = 'Sẵn sàng'
ORDER BY c.MaChuyenTau, c.STTToa, c.STTCho;


-- [Q2-DEMO] ẢNH DỮ LIỆU MẪU
-- Minh họa toàn bộ chỗ thuộc toa 2 và toa 3 của CT001.
-- Tổng cộng 34 chỗ, trong đó có 2 chỗ Đã đặt.

SELECT
    c.MaChuyenTau,
    c.STTToa,
    tt.MaLoaiToa,
    lt.TenLoaiToa,
    c.STTCho,
    c.ViTriTang,
    c.TrangThai
FROM Cho AS c
JOIN ToaTau AS tt
    ON tt.MaChuyenTau = c.MaChuyenTau
    AND tt.STTToa = c.STTToa
JOIN LoaiToa AS lt
    ON lt.MaLoaiToa = tt.MaLoaiToa
WHERE c.MaChuyenTau = 'CT001'
    AND c.STTToa IN (2, 3)
ORDER BY c.MaChuyenTau, c.STTToa, c.STTCho;


-- ============================================================
-- [Q3] SELECT - FROM - WHERE - GROUP BY - ORDER BY
--      + AGGREGATE FUNCTION (CÂU SỐ 3)
-- CHỨC NĂNG: Thống kê số lượng mục đặt vé và chi phí
--            ưu đãi theo đối tượng hành khách.
-- MÀN HÌNH: Báo cáo đặt vé và chính sách ưu đãi.
-- BẢNG: MucDatVe, DoiTuong, DonDatVe.
-- AGGREGATE: COUNT(*), SUM(...).
-- KẾT QUẢ DỰ KIẾN:
--     4 dòng tương ứng 4 đối tượng hành khách.
--     Tổng số mục đặt vé: 12.
--     Tổng giá cơ sở: 2843150.
--     Tổng tiền giảm: 176400.
--     Tổng thành tiền: 2666750.
-- ============================================================

SELECT
    dt.MaDoiTuong,
    dt.TenDoiTuong,
    COUNT(*) AS SoMucDatVe,
    SUM(m.GiaCoSo) AS TongGiaCoSo,
    SUM(m.GiamDoiTuong) AS TongTienGiam,
    SUM(m.ThanhTien) AS TongThanhTien
FROM MucDatVe AS m
JOIN DoiTuong AS dt
    ON dt.MaDoiTuong = m.MaDoiTuong
JOIN DonDatVe AS d
    ON d.MaDonDatVe = m.MaDonDatVe
WHERE d.TrangThai = 'Đã thanh toán'
GROUP BY dt.MaDoiTuong, dt.TenDoiTuong
ORDER BY SoMucDatVe DESC, dt.MaDoiTuong;


-- [Q3-DEMO] ẢNH DỮ LIỆU MẪU
-- Hiển thị các mục đặt vé thuộc đơn đã thanh toán,
-- bao gồm đầy đủ 4 đối tượng hành khách và giá tiền.

SELECT
    m.MaDonDatVe,
    d.TrangThai AS TrangThaiDon,
    m.STTMuc,
    m.MaDoiTuong,
    dt.TenDoiTuong,
    dt.TyLeGiam,
    m.GiaCoSo,
    m.GiamDoiTuong,
    m.ThanhTien
FROM MucDatVe AS m
JOIN DonDatVe AS d
    ON d.MaDonDatVe = m.MaDonDatVe
JOIN DoiTuong AS dt
    ON dt.MaDoiTuong = m.MaDoiTuong
WHERE d.TrangThai = 'Đã thanh toán'
ORDER BY m.MaDoiTuong, m.MaDonDatVe, m.STTMuc;


-- ============================================================
-- [Q4] SELECT - FROM - WHERE - GROUP BY - ORDER BY
--      + AGGREGATE FUNCTION (CÂU SỐ 4)
-- CHỨC NĂNG: Thống kê dòng tiền giao dịch thành công
--            theo phương thức thanh toán.
-- MÀN HÌNH: Thống kê giao dịch.
-- BẢNG: GiaoDich.
-- AGGREGATE: COUNT(*), SUM(...).
-- QUY ƯỚC:
--     'Thu': SoTien dương.
--     'Hoàn': SoTien âm.
-- KẾT QUẢ DỰ KIẾN:
--     2 dòng tương ứng 2 phương thức thanh toán.
--     Chuyển khoản: 1564850 tiền thuần.
--     Ví điện tử: 804900 tiền thuần.
--     Tổng tiền thuần: 2369750.
-- LƯU Ý: Tổng tiền thuần là tổng dòng tiền giao dịch,
-- không tự động đồng nhất với doanh thu kế toán.
-- ============================================================

SELECT
    gd.PhuongThucThanhToan,
    COUNT(*) AS SoGiaoDichThanhCong,
    SUM(CASE WHEN gd.LoaiGiaoDich = 'Thu' THEN gd.SoTien ELSE 0 END) AS TongTienThu,
    SUM(CASE WHEN gd.LoaiGiaoDich = 'Hoàn' THEN -gd.SoTien ELSE 0 END) AS TongTienHoan,
    SUM(gd.SoTien) AS TongTienThuan
FROM GiaoDich AS gd
WHERE gd.TrangThai = 'Thành công'
GROUP BY gd.PhuongThucThanhToan
ORDER BY TongTienThuan DESC, gd.PhuongThucThanhToan;


-- [Q4-DEMO] ẢNH DỮ LIỆU MẪU
-- Hiển thị 8 giao dịch thành công, bao gồm giao dịch
-- thanh toán đơn đặt vé và giao dịch đổi/trả vé.

SELECT
    MaGiaoDich,
    MaDonDatVe,
    MaYeuCau,
    LoaiGiaoDich,
    SoTien,
    PhuongThucThanhToan,
    TrangThai
FROM GiaoDich
WHERE TrangThai = 'Thành công'
ORDER BY MaGiaoDich;


-- ============================================================
-- [Q5] 02 TRUY VẤN LỒNG + AGGREGATE FUNCTION (CÂU SỐ 5)
-- CHỨC NĂNG: Phát hiện các chuyến có số ga trong lịch
--            trình lớn hơn mức trung bình.
-- MÀN HÌNH: Phân tích lịch chạy / Thống kê chuyến tàu.
-- BẢNG: ChuyenTau, MacTau, GaTrongChuyen.
-- TRUY VẤN LỒNG 1: SELECT AVG(...).
-- TRUY VẤN LỒNG 2: SELECT MaChuyenTau, COUNT(*)...
--                    GROUP BY MaChuyenTau.
-- AGGREGATE: COUNT(*), AVG(...).
-- KẾT QUẢ DỰ KIẾN:
--     Số ga trung bình: 660 / 30 = 22 ga/chuyến.
--     15 chuyến CT001 - CT015 có 36 ga/chuyến.
--     Các chuyến này đều thuộc tuyến TD01.
-- ============================================================

SELECT
    ct.MaChuyenTau,
    mt.MaMacTau,
    COUNT(*) AS SoGaTrongLich
FROM ChuyenTau AS ct
JOIN MacTau AS mt
    ON mt.MaMacTau = ct.MaMacTau
JOIN GaTrongChuyen AS g
    ON g.MaChuyenTau = ct.MaChuyenTau
WHERE ct.TrangThai = 'Sẵn sàng'
GROUP BY ct.MaChuyenTau, mt.MaMacTau
HAVING COUNT(*) > (
    SELECT AVG(ThongKeChuyen.SoGa)
    FROM (
        SELECT
            g2.MaChuyenTau,
            COUNT(*) AS SoGa
        FROM GaTrongChuyen AS g2
        GROUP BY g2.MaChuyenTau
    ) AS ThongKeChuyen
)
ORDER BY SoGaTrongLich DESC, ct.MaChuyenTau;


-- [Q5-DEMO] ẢNH DỮ LIỆU MẪU
-- Hiển thị số ga của toàn bộ 30 chuyến tàu.

SELECT
    g.MaChuyenTau,
    mt.MaMacTau,
    mt.MaTuyenDuong,
    ct.TrangThai,
    COUNT(*) AS SoGa
FROM GaTrongChuyen AS g
JOIN ChuyenTau AS ct
    ON ct.MaChuyenTau = g.MaChuyenTau
JOIN MacTau AS mt
    ON mt.MaMacTau = ct.MaMacTau
GROUP BY
    g.MaChuyenTau,
    mt.MaMacTau,
    mt.MaTuyenDuong,
    ct.TrangThai
ORDER BY g.MaChuyenTau;


-- [Q5-DEMO-2] Kiểm tra tổng số chuyến, tổng số ga
-- và số ga trung bình trên mỗi chuyến.

SELECT
    COUNT(*) AS TongSoChuyen,
    SUM(ThongKeChuyen.SoGa) AS TongSoGa,
    ROUND(AVG(ThongKeChuyen.SoGa), 2) AS SoGaTrungBinh
FROM (
    SELECT
        MaChuyenTau,
        COUNT(*) AS SoGa
    FROM GaTrongChuyen
    GROUP BY MaChuyenTau
) AS ThongKeChuyen;


-- ============================================================
-- CHECKLIST BÁO CÁO MỤC 1.3
--
-- [Q1] SELECT FROM WHERE ORDER BY | 1 dòng.
-- [Q2] SELECT FROM WHERE ORDER BY | 9 dòng.
-- [Q3] SELECT FROM WHERE GROUP BY ORDER BY | 4 dòng.
-- [Q4] SELECT FROM WHERE GROUP BY ORDER BY | 2 dòng.
-- [Q5] 02 nested queries + COUNT, AVG | 15 dòng.
--
-- Mỗi câu trong báo cáo cần:
--     1. Mô tả chức năng và màn hình.
--     2. Câu lệnh SQL dạng text.
--     3. Ảnh dữ liệu mẫu liên quan.
--     4. Ảnh kết quả thực thi câu truy vấn.
--     5. Nhận xét và ý nghĩa nghiệp vụ của kết quả.
-- ============================================================