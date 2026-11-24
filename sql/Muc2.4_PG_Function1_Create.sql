CREATE OR REPLACE FUNCTION public.fn_tinh_gia_ve_du_kien(
    p_ma_chuyen_tau VARCHAR,
    p_stt_toa INTEGER,
    p_stt_cho INTEGER,
    p_ten_ga_di VARCHAR,
    p_ten_ga_den VARCHAR,
    p_ma_doi_tuong VARCHAR
)
RETURNS TABLE(
    SoDoan INTEGER,
    GiaCoSo NUMERIC(14,2),
    GiamDoiTuong NUMERIC(14,2),
    ThanhTien NUMERIC(14,2)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_ma_mac_tau ChuyenTau.MaMacTau%TYPE;
    v_ngay_kh DATE;
    v_ma_nhom MacTau.MaNhom%TYPE;
    v_ma_loai_toa ToaTau.MaLoaiToa%TYPE;
    v_ty_le_giam NUMERIC;
    v_don_gia NUMERIC;
    v_he_so NUMERIC;
    v_so_chinh_sach INTEGER := 0;
    v_ma_chinh_sach ChinhSachGia.MaChinhSach%TYPE;
    v_so_doan INTEGER := 0;
    v_so_ga INTEGER := 0;
    v_gia_co_so NUMERIC(14,2);
    v_giam NUMERIC(14,2);

    -- luu thu tu ga tim duoc
    v_thu_tu_ga_len INTEGER;
    v_thu_tu_ga_xuong INTEGER;
    v_so_khop_ga_di BIGINT;
    v_so_khop_ga_den BIGINT;

    r RECORD;
BEGIN
    -- 1. Lay thong tin chuyen va nhom mac tau
    SELECT c.MaMacTau,
           c.ThoiGianKhoiHanhDuKien::DATE,
           m.MaNhom
    INTO v_ma_mac_tau, v_ngay_kh, v_ma_nhom
    FROM ChuyenTau c
    JOIN MacTau m ON m.MaMacTau = c.MaMacTau
    WHERE c.MaChuyenTau = p_ma_chuyen_tau;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chuyen tau % khong ton tai',
            p_ma_chuyen_tau;
    END IF;

    -- 2. Lay loai toa cua cho duoc chon
    SELECT t.MaLoaiToa
    INTO v_ma_loai_toa
    FROM Cho ch
    JOIN ToaTau t
      ON t.MaChuyenTau = ch.MaChuyenTau
     AND t.STTToa = ch.STTToa
    WHERE ch.MaChuyenTau = p_ma_chuyen_tau
      AND ch.STTToa = p_stt_toa
      AND ch.STTCho = p_stt_cho;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Khong ton tai toa % / cho % cua chuyen %',
            p_stt_toa, p_stt_cho, p_ma_chuyen_tau;
    END IF;

    -- 3. Lay ty le giam theo doi tuong
    SELECT d.TyLeGiam
    INTO v_ty_le_giam
    FROM DoiTuong d
    WHERE d.MaDoiTuong = p_ma_doi_tuong;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doi tuong % khong ton tai',
            p_ma_doi_tuong;
    END IF;

    -- 4. Xac dinh thu tu ga tu TEN ga
    IF p_ten_ga_di IS NULL OR BTRIM(p_ten_ga_di) = ''
       OR p_ten_ga_den IS NULL OR BTRIM(p_ten_ga_den) = '' THEN
        RAISE EXCEPTION 'Ten ga di va ga den khong duoc de trong';
    END IF;

    -- Tim thu tu ga len tren chuyen da chon
    SELECT MIN(g.ThuTuGa), COUNT(*)
    INTO v_thu_tu_ga_len, v_so_khop_ga_di
    FROM GaTrongChuyen g
    JOIN NhaGa n ON n.MaNhaGa = g.MaNhaGa
    WHERE g.MaChuyenTau = p_ma_chuyen_tau
      AND BTRIM(n.TenNhaGa) = BTRIM(p_ten_ga_di);

    IF v_so_khop_ga_di = 0 THEN
        RAISE EXCEPTION
            'Ga di % khong thuoc chuyen %',
            p_ten_ga_di, p_ma_chuyen_tau;
    ELSIF v_so_khop_ga_di > 1 THEN
        RAISE EXCEPTION
            'Ten ga di % khong xac dinh duy nhat tren chuyen %',
            p_ten_ga_di, p_ma_chuyen_tau;
    END IF;

    -- Tim thu tu ga xuong tren chuyen da chon
    SELECT MIN(g.ThuTuGa), COUNT(*)
    INTO v_thu_tu_ga_xuong, v_so_khop_ga_den
    FROM GaTrongChuyen g
    JOIN NhaGa n ON n.MaNhaGa = g.MaNhaGa
    WHERE g.MaChuyenTau = p_ma_chuyen_tau
      AND BTRIM(n.TenNhaGa) = BTRIM(p_ten_ga_den);

    IF v_so_khop_ga_den = 0 THEN
        RAISE EXCEPTION
            'Ga den % khong thuoc chuyen %',
            p_ten_ga_den, p_ma_chuyen_tau;
    ELSIF v_so_khop_ga_den > 1 THEN
        RAISE EXCEPTION
            'Ten ga den % khong xac dinh duy nhat tren chuyen %',
            p_ten_ga_den, p_ma_chuyen_tau;
    END IF;

    -- Kiem tra dung chieu hanh trinh
    IF v_thu_tu_ga_len >= v_thu_tu_ga_xuong THEN
        RAISE EXCEPTION
            'Hanh trinh khong hop le: ga di % phai dung truoc ga den %',
            p_ten_ga_di, p_ten_ga_den;
    END IF;

    -- 5. Dem so doan
    FOR r IN
        SELECT g.ThuTuGa
        FROM GaTrongChuyen g
        WHERE g.MaChuyenTau = p_ma_chuyen_tau
          AND g.ThuTuGa BETWEEN v_thu_tu_ga_len
                             AND v_thu_tu_ga_xuong
        ORDER BY g.ThuTuGa
    LOOP
        v_so_ga := v_so_ga + 1;

        IF v_so_ga > 1 THEN
            v_so_doan := v_so_doan + 1;
        END IF;
    END LOOP;

    -- 6. Tim chinh sach gia hieu luc
    v_ma_chinh_sach := NULL;

    FOR r IN
        SELECT cs.MaChinhSach, cs.DonGiaMoiDoan
        FROM ChinhSachGia cs
        WHERE cs.MaNhom = v_ma_nhom
          AND v_ngay_kh >= cs.NgayBatDau
          AND (
              cs.NgayKetThuc IS NULL
              OR v_ngay_kh <= cs.NgayKetThuc
          )
    LOOP
        v_so_chinh_sach := v_so_chinh_sach + 1;
        v_ma_chinh_sach := r.MaChinhSach;
        v_don_gia := r.DonGiaMoiDoan;
    END LOOP;

    IF v_so_chinh_sach = 0 THEN
        RAISE EXCEPTION
            'Khong co chinh sach gia hieu luc cho nhom % vao ngay %',
            v_ma_nhom, v_ngay_kh;

    ELSIF v_so_chinh_sach > 1 THEN
        RAISE EXCEPTION
            'Co % chinh sach gia cung hieu luc cho nhom % vao ngay %',
            v_so_chinh_sach, v_ma_nhom, v_ngay_kh;
    END IF;

    -- 7. Lay he so gia theo loai toa
    SELECT a.HeSoGiaCho
    INTO v_he_so
    FROM ApDungGia a
    WHERE a.MaChinhSach = v_ma_chinh_sach
      AND a.MaLoaiToa = v_ma_loai_toa;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Chinh sach % chua co he so gia cho loai toa %',
            v_ma_chinh_sach, v_ma_loai_toa;
    END IF;

    -- 8. Tinh gia va tra ket qua
    v_gia_co_so := ROUND(v_so_doan * v_don_gia * v_he_so, 2);
    v_giam := ROUND(v_gia_co_so * v_ty_le_giam, 2);

    RETURN QUERY
    SELECT v_so_doan,
           v_gia_co_so,
           v_giam,
           (v_gia_co_so - v_giam)::NUMERIC(14,2);
END;
$$;

SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'fn_tinh_gia_ve_du_kien'
  AND p.prokind = 'f';
