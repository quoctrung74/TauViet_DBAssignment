-- ============================================================================
-- BTL2 | PHẦN 2.2 | TRIGGER 1: KIỂM TRA TÍNH LIÊN TỤC LỊCH GA
-- PostgreSQL / pgAdmin 4 | Database: btl_tauhoa | Schema: public
-- Yêu cầu: Đã thực hiện FILE 01, 02, 03 trước khi chạy.
-- Kiểm tra giữa CÁC DÒNG ga trong CÙNG một chuyến tàu.
-- CHECK ở file 03 đã kiểm tra giờ đến <= giờ đi TRONG CÙNG MỘT GA.
-- Script có thể chạy lại trên PostgreSQL 14+ (CREATE OR REPLACE TRIGGER).
-- KHÔNG INSERT/UPDATE/DELETE dữ liệu mẫu.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_gtc_kiem_tra_lien_tuc_thoi_gian()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_stt_truoc          INTEGER;
    v_di_du_kien_truoc   TIMESTAMP WITHOUT TIME ZONE;
    v_di_thuc_te_truoc   TIMESTAMP WITHOUT TIME ZONE;

    v_stt_sau            INTEGER;
    v_den_du_kien_sau    TIMESTAMP WITHOUT TIME ZONE;
    v_den_thuc_te_sau    TIMESTAMP WITHOUT TIME ZONE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.MaChuyenTau IS DISTINCT FROM OLD.MaChuyenTau
           OR NEW.ThuTuGa IS DISTINCT FROM OLD.ThuTuGa THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'Khong duoc sua MaChuyenTau hoac ThuTuGa trong lich ga',
                HINT = 'Hay xu ly thay doi cau truc lich trinh bang nghiep vu rieng.';
        END IF;
    END IF;

    -- Ga liền trước: STT lớn nhất < ga hiện tại, cùng MaChuyenTau.
    -- Không giả định ThuTuGa phải liên tiếp 1, 2, 3, ...
    SELECT g.ThuTuGa, g.ThoiGianDiDuKien, g.ThoiGianDiThucTe
      INTO v_stt_truoc, v_di_du_kien_truoc, v_di_thuc_te_truoc
    FROM public.GaTrongChuyen AS g
    WHERE g.MaChuyenTau = NEW.MaChuyenTau
      AND g.ThuTuGa < NEW.ThuTuGa
    ORDER BY g.ThuTuGa DESC
    LIMIT 1;

    -- Ga liền sau: STT nhỏ nhất > ga hiện tại, cùng MaChuyenTau.
    SELECT g.ThuTuGa, g.ThoiGianDenDuKien, g.ThoiGianDenThucTe
      INTO v_stt_sau, v_den_du_kien_sau, v_den_thuc_te_sau
    FROM public.GaTrongChuyen AS g
    WHERE g.MaChuyenTau = NEW.MaChuyenTau
      AND g.ThuTuGa > NEW.ThuTuGa
    ORDER BY g.ThuTuGa ASC
    LIMIT 1;

    -- 1. GA TRƯỚC -> GA HIỆN TẠI: thời gian DỰ KIẾN.
    IF v_stt_truoc IS NOT NULL
       AND v_di_du_kien_truoc IS NOT NULL
       AND NEW.ThoiGianDenDuKien IS NOT NULL
       AND NEW.ThoiGianDenDuKien < v_di_du_kien_truoc THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = format(
                'Lich du kien khong hop le: chuyen %s, ga %s den %s truoc khi ga %s roi %s',
                NEW.MaChuyenTau, NEW.ThuTuGa, NEW.ThoiGianDenDuKien,
                v_stt_truoc, v_di_du_kien_truoc
            );
    END IF;

    -- 2. GA HIỆN TẠI -> GA SAU: thời gian DỰ KIẾN.
    IF v_stt_sau IS NOT NULL
       AND NEW.ThoiGianDiDuKien IS NOT NULL
       AND v_den_du_kien_sau IS NOT NULL
       AND NEW.ThoiGianDiDuKien > v_den_du_kien_sau THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = format(
                'Lich du kien khong hop le: chuyen %s, ga %s roi %s sau khi ga %s den %s',
                NEW.MaChuyenTau, NEW.ThuTuGa, NEW.ThoiGianDiDuKien,
                v_stt_sau, v_den_du_kien_sau
            );
    END IF;

    -- 3. GA TRƯỚC -> GA HIỆN TẠI: thời gian THỰC TẾ (nếu có dữ liệu).
    IF v_stt_truoc IS NOT NULL
       AND v_di_thuc_te_truoc IS NOT NULL
       AND NEW.ThoiGianDenThucTe IS NOT NULL
       AND NEW.ThoiGianDenThucTe < v_di_thuc_te_truoc THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = format(
                'Lich thuc te khong hop le: chuyen %s, ga %s den %s truoc khi ga %s roi %s',
                NEW.MaChuyenTau, NEW.ThuTuGa, NEW.ThoiGianDenThucTe,
                v_stt_truoc, v_di_thuc_te_truoc
            );
    END IF;

    -- 4. GA HIỆN TẠI -> GA SAU: thời gian THỰC TẾ (nếu có dữ liệu).
    IF v_stt_sau IS NOT NULL
       AND NEW.ThoiGianDiThucTe IS NOT NULL
       AND v_den_thuc_te_sau IS NOT NULL
       AND NEW.ThoiGianDiThucTe > v_den_thuc_te_sau THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = format(
                'Lich thuc te khong hop le: chuyen %s, ga %s roi %s sau khi ga %s den %s',
                NEW.MaChuyenTau, NEW.ThuTuGa, NEW.ThoiGianDiThucTe,
                v_stt_sau, v_den_thuc_te_sau
            );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_gtc_kiem_tra_lien_tuc_thoi_gian
BEFORE INSERT OR UPDATE
ON public.GaTrongChuyen
FOR EACH ROW
EXECUTE FUNCTION public.fn_gtc_kiem_tra_lien_tuc_thoi_gian();

COMMIT;

-- Xác nhận trigger đã được tạo và bật.
SELECT
    t.tgname AS ten_trigger,
    c.relname AS bang_kich_hoat,
    p.proname AS ham_trigger,
    t.tgenabled AS trang_thai
FROM pg_trigger AS t
JOIN pg_class AS c ON c.oid = t.tgrelid
JOIN pg_proc AS p ON p.oid = t.tgfoid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'gatrongchuyen'
  AND t.tgname = 'trg_gtc_kiem_tra_lien_tuc_thoi_gian';

-- Dữ liệu CT001 ga 1-10 để chuẩn bị kiểm thử.
SELECT MaChuyenTau, ThuTuGa, MaNhaGa,
       ThoiGianDenDuKien, ThoiGianDiDuKien,
       ThoiGianDenThucTe, ThoiGianDiThucTe
FROM public.GaTrongChuyen
WHERE MaChuyenTau = 'CT001' AND ThuTuGa BETWEEN 1 AND 10
ORDER BY ThuTuGa;

-- HẠN CHẾ CỦA THIẾT KẾ:
-- * DELETE không kích hoạt trigger này (theo đặc tả nghiệp vụ đã chọn).
-- * Không đổi PK ghép qua UPDATE; điều này cũng chặn ON UPDATE CASCADE của
--   ChuyenTau.MaChuyenTau nếu cần đổi mã chuyến tàu.
-- * Chỉ kiểm tra láng giềng trên dữ liệu thấy được tại thời điểm trigger chạy;
--   khi triển khai đa người dùng cần thiết kế thêm khóa/transaction phù hợp.
-- * Đối với UPDATE nhiều dòng trong một lệnh, kiểm tra được thực hiện từng dòng;
--   việc dời lịch hàng loạt nên có quy trình nghiệp vụ riêng.