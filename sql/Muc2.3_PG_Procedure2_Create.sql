-- ============================================================================
-- BTL2 - PHAN 2.3.b: THU TUC 2 - TONG HOP CHO THEO TOA
-- PostgreSQL 18 / pgAdmin 4 | Database: btl_tauhoa | Schema: public
-- Use case: Chon chuyen tau -> Xem danh sach toa / so do cho.
-- Input : p_ma_chuyen_tau VARCHAR(30)
-- Output: p_ket_qua INOUT REFCURSOR (nhieu dong; moi toa mot dong).
--
-- Quy uoc: 'Trong' va 'Da dat' trong cac chuoi gia tri ben duoi dung tieng
-- Viet co dau dung nhu du lieu mau: 'Trống', 'Đã đặt'.
-- TrangThai cua Cho la snapshot, KHONG phai kiem tra cho trong theo chang.
--
-- Can BEGIN; CALL ...; FETCH ALL ...; ROLLBACK; trong CUNG Query Tool.
-- Khong FETCH sau COMMIT/ROLLBACK: cursor da dong va bang tam bi huy.
-- ============================================================================

CREATE OR REPLACE PROCEDURE public.sp_tong_hop_cho_theo_toa(
    IN p_ma_chuyen_tau VARCHAR(30),
    INOUT p_ket_qua REFCURSOR
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    v_toa RECORD;
    v_cho RECORD;
    v_so_toa INTEGER := 0;
    v_tong_so_cho INTEGER;
    v_so_cho_trong INTEGER;
    v_so_cho_da_dat INTEGER;
    v_so_cho_khac INTEGER;
BEGIN
    -- (1) Kiem tra ma chuyen dau vao.
    IF p_ma_chuyen_tau IS NULL OR BTRIM(p_ma_chuyen_tau) = '' THEN
        RAISE EXCEPTION 'Ma chuyen tau khong duoc NULL hoac de trong.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.ChuyenTau AS ct
        WHERE ct.MaChuyenTau = p_ma_chuyen_tau
    ) THEN
        RAISE EXCEPTION 'Chuyen tau % khong ton tai.', p_ma_chuyen_tau;
    END IF;

    -- (2) Tao bang tam luu ket qua tung toa trong transaction hien tai.
    CREATE TEMP TABLE IF NOT EXISTS tmp_p2_tong_hop_cho_theo_toa (
        MaChuyenTau VARCHAR(30),
        STTToa INTEGER,
        TenLoaiToa VARCHAR(100),
        TongSoCho INTEGER,
        SoChoTrong INTEGER,
        SoChoDaDat INTEGER,
        SoChoTrangThaiKhac INTEGER
    ) ON COMMIT DROP;

    TRUNCATE TABLE pg_temp.tmp_p2_tong_hop_cho_theo_toa;

    -- (3) Vong FOR ben ngoai: duyet tung toa cua chuyen duoc chon.
    FOR v_toa IN
        SELECT t.MaChuyenTau, t.STTToa, lt.TenLoaiToa
        FROM public.ToaTau AS t
        JOIN public.LoaiToa AS lt
          ON lt.MaLoaiToa = t.MaLoaiToa
        WHERE t.MaChuyenTau = p_ma_chuyen_tau
        ORDER BY t.STTToa
    LOOP
        v_tong_so_cho := 0;
        v_so_cho_trong := 0;
        v_so_cho_da_dat := 0;
        v_so_cho_khac := 0;

        -- (4) Vong FOR ben trong: duyet tung cho, dung IF phan loai.
        FOR v_cho IN
            SELECT c.TrangThai
            FROM public.Cho AS c
            WHERE c.MaChuyenTau = v_toa.MaChuyenTau
              AND c.STTToa = v_toa.STTToa
        LOOP
            v_tong_so_cho := v_tong_so_cho + 1;

            IF BTRIM(v_cho.TrangThai) = 'Trống' THEN
                v_so_cho_trong := v_so_cho_trong + 1;
            ELSIF BTRIM(v_cho.TrangThai) = 'Đã đặt' THEN
                v_so_cho_da_dat := v_so_cho_da_dat + 1;
            ELSE
                v_so_cho_khac := v_so_cho_khac + 1;
            END IF;
        END LOOP;

        -- Neu toa chua khai bao Cho, tat ca bo dem van bang 0.
        INSERT INTO pg_temp.tmp_p2_tong_hop_cho_theo_toa (
            MaChuyenTau, STTToa, TenLoaiToa,
            TongSoCho, SoChoTrong, SoChoDaDat, SoChoTrangThaiKhac
        ) VALUES (
            v_toa.MaChuyenTau, v_toa.STTToa, v_toa.TenLoaiToa,
            v_tong_so_cho, v_so_cho_trong, v_so_cho_da_dat, v_so_cho_khac
        );

        v_so_toa := v_so_toa + 1;
    END LOOP;

    -- (5) Khong co toa: tra tap rong kem NOTICE, KHONG bao loi.
    IF v_so_toa = 0 THEN
        RAISE NOTICE 'Chuyen % ton tai nhung chua duoc cau hinh toa tau.', p_ma_chuyen_tau;
    ELSE
        RAISE NOTICE 'Chuyen % co % toa tau.', p_ma_chuyen_tau, v_so_toa;
    END IF;

    -- (6) Mo cursor tra ket qua (moi dong ung voi mot toa).
    IF p_ket_qua IS NULL THEN
        p_ket_qua := 'cur_p2_tong_hop_cho';
    END IF;

    OPEN p_ket_qua FOR
        SELECT
            k.MaChuyenTau AS "MaChuyenTau",
            k.STTToa AS "STTToa",
            k.TenLoaiToa AS "TenLoaiToa",
            k.TongSoCho AS "TongSoCho",
            k.SoChoTrong AS "SoChoTrong",
            k.SoChoDaDat AS "SoChoDaDat",
            k.SoChoTrangThaiKhac AS "SoChoTrangThaiKhac"
        FROM pg_temp.tmp_p2_tong_hop_cho_theo_toa AS k
        ORDER BY k.STTToa;
END;
$procedure$;

-- [P2-K1] Xac nhan procedure ton tai trong schema public.
SELECT
    n.nspname AS schema_name,
    p.proname AS procedure_name,
    pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'p'
  AND p.proname = 'sp_tong_hop_cho_theo_toa';
