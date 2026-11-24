-- ============================================================
-- 2.3.a - THU TUC TIM CHUYEN TAU THEO TEN GA DI, TEN GA DEN
--        VA KHOANG THOI GIAN
-- ============================================================

CREATE OR REPLACE PROCEDURE public.sp_tim_chuyen_tau(
    IN p_ten_ga_di       VARCHAR(150),
    IN p_ten_ga_den      VARCHAR(150),
    IN p_tu_thoi_gian    TIMESTAMP WITHOUT TIME ZONE,
    IN p_den_thoi_gian   TIMESTAMP WITHOUT TIME ZONE,
    INOUT p_ket_qua      REFCURSOR
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    v_chuyen RECORD;
    v_so_chuyen INTEGER := 0;
BEGIN
    -- 1. Kiem tra tham so dau vao
    IF p_ten_ga_di IS NULL OR BTRIM(p_ten_ga_di) = '' THEN
        RAISE EXCEPTION 'Ten ga di khong duoc de trong.';
    END IF;

    IF p_ten_ga_den IS NULL OR BTRIM(p_ten_ga_den) = '' THEN
        RAISE EXCEPTION 'Ten ga den khong duoc de trong.';
    END IF;

    IF BTRIM(p_ten_ga_di) = BTRIM(p_ten_ga_den) THEN
        RAISE EXCEPTION 'Ga di va ga den phai khac nhau.';
    END IF;

    IF p_tu_thoi_gian IS NULL OR p_den_thoi_gian IS NULL THEN
        RAISE EXCEPTION 'Khoang thoi gian tim kiem khong duoc de trong.';
    END IF;

    IF p_tu_thoi_gian >= p_den_thoi_gian THEN
        RAISE EXCEPTION 'Thoi gian bat dau phai nho hon thoi gian ket thuc.';
    END IF;

    -- 2. Kiem tra ten hai nha ga co ton tai
    IF NOT EXISTS (
        SELECT 1
        FROM public.nhaga
        WHERE tennhaga = BTRIM(p_ten_ga_di)
    ) THEN
        RAISE EXCEPTION 'Khong ton tai ga di co ten %.', p_ten_ga_di;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.nhaga
        WHERE tennhaga = BTRIM(p_ten_ga_den)
    ) THEN
        RAISE EXCEPTION 'Khong ton tai ga den co ten %.', p_ten_ga_den;
    END IF;

    -- 3. Tao bang tam luu ket qua
    CREATE TEMP TABLE IF NOT EXISTS tmp_ket_qua_tim_chuyen (
        machuyentau VARCHAR(30),
        mamactau VARCHAR(20),
        gadi VARCHAR(150),
        gaden VARCHAR(150),
        thutugalen INTEGER,
        thutugaxuong INTEGER,
        thoigiandidukien TIMESTAMP WITHOUT TIME ZONE,
        thoigiandendukien TIMESTAMP WITHOUT TIME ZONE,
        trangthai VARCHAR(30)
    ) ON COMMIT DROP;

    TRUNCATE TABLE pg_temp.tmp_ket_qua_tim_chuyen;

    -- 4. Tim cac chuyen tau phu hop
    FOR v_chuyen IN
        SELECT
            ct.machuyentau,
            mt.mamactau,
            ng_di.tennhaga AS gadi,
            ng_den.tennhaga AS gaden,
            g_di.thutuga AS thutugalen,
            g_den.thutuga AS thutugaxuong,
            g_di.thoigiandidukien,
            g_den.thoigiandendukien,
            ct.trangthai
        FROM public.gatrongchuyen AS g_di

        JOIN public.gatrongchuyen AS g_den
          ON g_den.machuyentau = g_di.machuyentau

        JOIN public.chuyentau AS ct
          ON ct.machuyentau = g_di.machuyentau

        JOIN public.mactau AS mt
          ON mt.mamactau = ct.mamactau

        JOIN public.nhaga AS ng_di
          ON ng_di.manhaga = g_di.manhaga

        JOIN public.nhaga AS ng_den
          ON ng_den.manhaga = g_den.manhaga

        WHERE ng_di.tennhaga = BTRIM(p_ten_ga_di)
          AND ng_den.tennhaga = BTRIM(p_ten_ga_den)

          -- Ga len phai dung truoc ga xuong
          AND g_di.thutuga < g_den.thutuga

          -- Khoang thoi gian di tai ga len
          AND g_di.thoigiandidukien >= p_tu_thoi_gian
          AND g_di.thoigiandidukien < p_den_thoi_gian

          -- Chi tim chuyen o trang thai San sang
          AND BTRIM(ct.trangthai) = 'Sẵn sàng'

        ORDER BY g_di.thoigiandidukien, ct.machuyentau

    LOOP
        INSERT INTO pg_temp.tmp_ket_qua_tim_chuyen (
            machuyentau,
            mamactau,
            gadi,
            gaden,
            thutugalen,
            thutugaxuong,
            thoigiandidukien,
            thoigiandendukien,
            trangthai
        )
        VALUES (
            v_chuyen.machuyentau,
            v_chuyen.mamactau,
            v_chuyen.gadi,
            v_chuyen.gaden,
            v_chuyen.thutugalen,
            v_chuyen.thutugaxuong,
            v_chuyen.thoigiandidukien,
            v_chuyen.thoigiandendukien,
            v_chuyen.trangthai
        );

        v_so_chuyen := v_so_chuyen + 1;
    END LOOP;

    -- 5. Thong bao so chuyen tim thay
    IF v_so_chuyen = 0 THEN
        RAISE NOTICE 'Khong tim thay chuyen tau phu hop voi dieu kien da nhap.';
    ELSE
        RAISE NOTICE 'Tim thay % chuyen tau phu hop.', v_so_chuyen;
    END IF;

    -- 6. Mo cursor tra ket qua
    IF p_ket_qua IS NULL THEN
        p_ket_qua := 'cur_tim_chuyen';
    END IF;

    OPEN p_ket_qua FOR
        SELECT
            machuyentau AS "MaChuyenTau",
            mamactau AS "MaMacTau",
            gadi AS "GaDi",
            gaden AS "GaDen",
            thutugalen AS "ThuTuGaLen",
            thutugaxuong AS "ThuTuGaXuong",
            thoigiandidukien AS "ThoiGianDiDuKien",
            thoigiandendukien AS "ThoiGianDenDuKien",
            trangthai AS "TrangThai"
        FROM pg_temp.tmp_ket_qua_tim_chuyen
        ORDER BY thoigiandidukien, machuyentau;
END;
$procedure$;

-- Kiem tra thu tuc da duoc tao
SELECT
    n.nspname AS schema_name,
    p.proname AS procedure_name,
    pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'sp_tim_chuyen_tau'
  AND p.prokind = 'p';