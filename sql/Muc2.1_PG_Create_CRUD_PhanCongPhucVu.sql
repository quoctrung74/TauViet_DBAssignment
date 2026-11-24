-- ==============================================================
-- BTL2 - MỤC 2.1: 03 THỦ TỤC INSERT / UPDATE / DELETE
-- Bảng DML chính: public.PhanCongPhucVu
-- Hệ QTCSDL: PostgreSQL, ngôn ngữ PL/pgSQL
-- Quy ước bổ sung của nhóm:
--   * Chỉ thêm/sửa phân công cho chuyến 'Sẵn sàng', CHƯA khởi hành.
--   * Chỉ xóa phân công của chuyến CHƯA khởi hành.
--   * Không phân công cùng một nhân viên cho 2 chuyến trùng thời gian.
--   * Các khoảng thời gian tính theo [KhoiHanh, KetThuc) (tiếp giáp được).
--   * UPDATE có thể đổi nhân viên/đổi vai trò, KHÔNG đổi MaChuyenTau.
--   * Tất cả thay đổi phân công của ứng dụng phải CALL các procedure này.
-- ============================================================== 

CREATE OR REPLACE PROCEDURE public.sp_them_phan_cong(
    p_cccd CHAR(12),
    p_ma_chuyen_tau VARCHAR(30),
    p_ma_vai_tro VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ngay_vao_lam DATE;
    v_bat_dau TIMESTAMP;
    v_ket_thuc TIMESTAMP;
    v_trang_thai VARCHAR(30);
BEGIN
    -- 1. Xác thực input
    IF p_cccd IS NULL OR BTRIM(p_cccd) = ''
       OR p_ma_chuyen_tau IS NULL OR BTRIM(p_ma_chuyen_tau) = ''
       OR p_ma_vai_tro IS NULL OR BTRIM(p_ma_vai_tro) = '' THEN
        RAISE EXCEPTION 'Khong duoc de trong CCCD, ma chuyen hoac ma vai tro';
    END IF;

    -- 2. Khóa nhân viên để tránh hai phiên phân công trùng lịch cùng lúc
    SELECT nv.ngayvaolam INTO v_ngay_vao_lam
    FROM public.nhanvien AS nv
    WHERE nv.cccd = p_cccd
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nhan vien % khong ton tai', BTRIM(p_cccd);
    END IF;

    -- 3. Xác thực chuyến và khóa đọc lịch cho đến kết thúc transaction
    SELECT ct.thoigiankhoihanhdukien,
           ct.thoigianketthucdukien,
           ct.trangthai
      INTO v_bat_dau, v_ket_thuc, v_trang_thai
    FROM public.chuyentau AS ct
    WHERE ct.machuyentau = p_ma_chuyen_tau
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chuyen tau % khong ton tai', p_ma_chuyen_tau;
    END IF;

    IF v_trang_thai <> 'Sẵn sàng' THEN
        RAISE EXCEPTION 'Chuyen % khong o trang thai San sang', p_ma_chuyen_tau;
    END IF;

    IF v_bat_dau <= LOCALTIMESTAMP THEN
        RAISE EXCEPTION 'Khong the phan cong: chuyen % da/đang khoi hanh', p_ma_chuyen_tau;
    END IF;

    IF v_ngay_vao_lam > v_bat_dau::DATE THEN
        RAISE EXCEPTION 'Ngay vao lam cua nhan vien % sau ngay khoi hanh', BTRIM(p_cccd);
    END IF;

    -- 4. Nhân viên phải có vai trò được giao (FK ghép cùng bảo vệ)
    IF NOT EXISTS (
        SELECT 1 FROM public.damnhan AS dn
        WHERE dn.cccd = p_cccd AND dn.mavaitro = p_ma_vai_tro
    ) THEN
        RAISE EXCEPTION 'Nhan vien % khong dam nhan vai tro %', BTRIM(p_cccd), p_ma_vai_tro;
    END IF;

    -- 5. Không lặp phân công trên cùng chuyến
    IF EXISTS (
        SELECT 1 FROM public.phancongphucvu AS pc
        WHERE pc.cccd = p_cccd AND pc.machuyentau = p_ma_chuyen_tau
    ) THEN
        RAISE EXCEPTION 'Nhan vien % da duoc phan cong vao chuyen %', BTRIM(p_cccd), p_ma_chuyen_tau;
    END IF;

    -- 6. Chống trùng lịch giữa các chuyến: [a,b) giao [c,d) iff a<d AND c<b
    IF EXISTS (
        SELECT 1
        FROM public.phancongphucvu AS pc
        JOIN public.chuyentau AS ct ON ct.machuyentau = pc.machuyentau
        WHERE pc.cccd = p_cccd
          AND v_bat_dau < ct.thoigianketthucdukien
          AND ct.thoigiankhoihanhdukien < v_ket_thuc
    ) THEN
        RAISE EXCEPTION 'Nhan vien % da co chuyen phuc vu trung thoi gian', BTRIM(p_cccd);
    END IF;

    -- 7. DML chỉ trên 1 bảng
    INSERT INTO public.phancongphucvu(cccd, machuyentau, mavaitro)
    VALUES (p_cccd, p_ma_chuyen_tau, p_ma_vai_tro);

    RAISE NOTICE 'Da them phan cong: nhan vien %, chuyen %, vai tro %',
        BTRIM(p_cccd), p_ma_chuyen_tau, p_ma_vai_tro;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Phan cong (%, %) da ton tai', BTRIM(p_cccd), p_ma_chuyen_tau;
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Tham chieu nhan vien, chuyen tau hoac vai tro khong hop le';
END;
$$;


CREATE OR REPLACE PROCEDURE public.sp_sua_phan_cong(
    p_cccd_cu CHAR(12),
    p_ma_chuyen_tau VARCHAR(30),
    p_cccd_moi CHAR(12),
    p_ma_vai_tro_moi VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ngay_vao_lam_moi DATE;
    v_bat_dau TIMESTAMP;
    v_ket_thuc TIMESTAMP;
    v_trang_thai VARCHAR(30);
    v_vai_tro_cu VARCHAR(20);
BEGIN
    -- 1. Xác thực input
    IF p_cccd_cu IS NULL OR BTRIM(p_cccd_cu) = ''
       OR p_cccd_moi IS NULL OR BTRIM(p_cccd_moi) = ''
       OR p_ma_chuyen_tau IS NULL OR BTRIM(p_ma_chuyen_tau) = ''
       OR p_ma_vai_tro_moi IS NULL OR BTRIM(p_ma_vai_tro_moi) = '' THEN
        RAISE EXCEPTION 'Thieu thong tin phan cong can sua';
    END IF;

    -- 2. Khóa nhân viên cũ và mới theo cùng thứ tự để hạn chế deadlock
    PERFORM 1
    FROM public.nhanvien AS nv
    WHERE nv.cccd IN (p_cccd_cu, p_cccd_moi)
    ORDER BY nv.cccd
    FOR UPDATE;

    SELECT nv.ngayvaolam INTO v_ngay_vao_lam_moi
    FROM public.nhanvien AS nv
    WHERE nv.cccd = p_cccd_moi;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nhan vien thay the % khong ton tai', BTRIM(p_cccd_moi);
    END IF;

    -- 3. Đọc và giữ ổn định thời gian chuyến
    SELECT ct.thoigiankhoihanhdukien,
           ct.thoigianketthucdukien,
           ct.trangthai
      INTO v_bat_dau, v_ket_thuc, v_trang_thai
    FROM public.chuyentau AS ct
    WHERE ct.machuyentau = p_ma_chuyen_tau
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chuyen tau % khong ton tai', p_ma_chuyen_tau;
    END IF;

    IF v_bat_dau <= LOCALTIMESTAMP THEN
        RAISE EXCEPTION 'Khong duoc sua phan cong cua chuyen % da bat dau', p_ma_chuyen_tau;
    END IF;

    IF v_trang_thai <> 'Sẵn sàng' THEN
        RAISE EXCEPTION 'Khong duoc sua phan cong cua chuyen % khong San sang', p_ma_chuyen_tau;
    END IF;

    -- 4. Khóa phân công hiện tại và xác thực tồn tại
    SELECT pc.mavaitro INTO v_vai_tro_cu
    FROM public.phancongphucvu AS pc
    WHERE pc.cccd = p_cccd_cu AND pc.machuyentau = p_ma_chuyen_tau
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Khong tim thay phan cong (%, %)', BTRIM(p_cccd_cu), p_ma_chuyen_tau;
    END IF;

    IF v_ngay_vao_lam_moi > v_bat_dau::DATE THEN
        RAISE EXCEPTION 'Nhan vien thay the vao lam sau ngay khoi hanh';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.damnhan AS dn
        WHERE dn.cccd = p_cccd_moi AND dn.mavaitro = p_ma_vai_tro_moi
    ) THEN
        RAISE EXCEPTION 'Nhan vien % khong dam nhan vai tro %', BTRIM(p_cccd_moi), p_ma_vai_tro_moi;
    END IF;

    -- 5. Kiểm tra trùng lịch, bỏ qua CHÍNH phân công đang sửa
    IF EXISTS (
        SELECT 1
        FROM public.phancongphucvu AS pc
        JOIN public.chuyentau AS ct ON ct.machuyentau = pc.machuyentau
        WHERE pc.cccd = p_cccd_moi
          AND NOT (pc.cccd = p_cccd_cu AND pc.machuyentau = p_ma_chuyen_tau)
          AND v_bat_dau < ct.thoigianketthucdukien
          AND ct.thoigiankhoihanhdukien < v_ket_thuc
    ) THEN
        RAISE EXCEPTION 'Nhan vien thay the % da co lich phuc vu trung', BTRIM(p_cccd_moi);
    END IF;

    -- 6. Thay nhân viên và/hoặc vai trò, giữ nguyên chuyến
    UPDATE public.phancongphucvu
       SET cccd = p_cccd_moi,
           mavaitro = p_ma_vai_tro_moi
     WHERE cccd = p_cccd_cu AND machuyentau = p_ma_chuyen_tau;

    RAISE NOTICE 'Da cap nhat phan cong chuyen %: nhan vien % -> %, vai tro % -> %',
        p_ma_chuyen_tau, BTRIM(p_cccd_cu), BTRIM(p_cccd_moi), v_vai_tro_cu, p_ma_vai_tro_moi;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Nhan vien thay the da co phan cong tren chuyen %', p_ma_chuyen_tau;
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Nhan vien/vai tro moi khong co lien ket DamNhan hop le';
END;
$$;


CREATE OR REPLACE PROCEDURE public.sp_xoa_phan_cong(
    p_cccd CHAR(12),
    p_ma_chuyen_tau VARCHAR(30)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_bat_dau TIMESTAMP;
BEGIN
    IF p_cccd IS NULL OR BTRIM(p_cccd) = ''
       OR p_ma_chuyen_tau IS NULL OR BTRIM(p_ma_chuyen_tau) = '' THEN
        RAISE EXCEPTION 'Phai cung cap CCCD va ma chuyen can xoa phan cong';
    END IF;

    -- Nhất quán với thứ tự khóa của INSERT/UPDATE
    PERFORM 1 FROM public.nhanvien AS nv
    WHERE nv.cccd = p_cccd
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nhan vien % khong ton tai', BTRIM(p_cccd);
    END IF;

    SELECT ct.thoigiankhoihanhdukien INTO v_bat_dau
    FROM public.chuyentau AS ct
    WHERE ct.machuyentau = p_ma_chuyen_tau
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chuyen tau % khong ton tai', p_ma_chuyen_tau;
    END IF;

    IF v_bat_dau <= LOCALTIMESTAMP THEN
        RAISE EXCEPTION 'Khong duoc xoa phan cong cua chuyen % da bat dau', p_ma_chuyen_tau;
    END IF;

    -- Chỉ xóa đúng quan hệ phân công; KHÔNG xóa NhanVien/ChuyenTau
    DELETE FROM public.phancongphucvu
    WHERE cccd = p_cccd AND machuyentau = p_ma_chuyen_tau;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Khong tim thay phan cong (%, %)', BTRIM(p_cccd), p_ma_chuyen_tau;
    END IF;

    RAISE NOTICE 'Da xoa phan cong: nhan vien %, chuyen %', BTRIM(p_cccd), p_ma_chuyen_tau;
END;
$$;

-- Xác nhận 3 procedure đã được tạo (PostgreSQL catalog):
SELECT n.nspname AS schema_name, p.proname AS procedure_name,
       pg_get_function_identity_arguments(p.oid) AS parameters
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE p.prokind = 'p' AND n.nspname = 'public'
  AND p.proname IN ('sp_them_phan_cong','sp_sua_phan_cong','sp_xoa_phan_cong')
ORDER BY p.proname;