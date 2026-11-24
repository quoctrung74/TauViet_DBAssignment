
-- ============================================================
-- 2.4.b - HAM KIEM TRA CHO TRONG THEO CHANG
-- Dau vao: chuyen tau, toa, cho, TEN ga len, TEN ga xuong
-- TRUE: khong co ve con hieu luc trung chang
-- FALSE: co ve con hieu luc trung chang
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_kiem_tra_cho_theo_chang(
    p_ma_chuyen_tau VARCHAR(30),
    p_stt_toa INTEGER,
    p_stt_cho INTEGER,
    p_ten_ga_len VARCHAR(150),
    p_ten_ga_xuong VARCHAR(150)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $function$
DECLARE
    v_ve RECORD;

    -- Bien luu thu tu ga tu ten ga
    v_thu_tu_ga_len INTEGER;
    v_thu_tu_ga_xuong INTEGER;

    -- Dem so ga trung ten tren cung chuyen
    v_so_khop_ga_len BIGINT;
    v_so_khop_ga_xuong BIGINT;
BEGIN
    -- 1. Kiem tra tham so dau vao
    IF p_ma_chuyen_tau IS NULL OR BTRIM(p_ma_chuyen_tau) = ''
       OR p_stt_toa IS NULL OR p_stt_cho IS NULL
       OR p_ten_ga_len IS NULL OR BTRIM(p_ten_ga_len) = ''
       OR p_ten_ga_xuong IS NULL OR BTRIM(p_ten_ga_xuong) = '' THEN

        RAISE EXCEPTION
            'Tham so dau vao khong duoc NULL hoac de trong.';
    END IF;

    -- 2. Xac thuc cho tren dung chuyen/toa
    IF NOT EXISTS (
        SELECT 1
        FROM public.cho AS c
        WHERE c.machuyentau = p_ma_chuyen_tau
          AND c.stttoa = p_stt_toa
          AND c.sttcho = p_stt_cho
    ) THEN
        RAISE EXCEPTION
            'Cho khong ton tai: chuyen %, toa %, cho %.',
            p_ma_chuyen_tau, p_stt_toa, p_stt_cho;
    END IF;

    -- 3. Tim thu tu ga len tu TEN ga
    SELECT MIN(g.thutuga), COUNT(*)
    INTO v_thu_tu_ga_len, v_so_khop_ga_len
    FROM public.gatrongchuyen AS g
    JOIN public.nhaga AS n
      ON n.manhaga = g.manhaga
    WHERE g.machuyentau = p_ma_chuyen_tau
      AND BTRIM(n.tennhaga) = BTRIM(p_ten_ga_len);

    IF v_so_khop_ga_len = 0 THEN
        RAISE EXCEPTION
            'Ga len % khong ton tai trong lich chuyen %.',
            p_ten_ga_len, p_ma_chuyen_tau;

    ELSIF v_so_khop_ga_len > 1 THEN
        RAISE EXCEPTION
            'Ten ga len % khong xac dinh duy nhat tren chuyen %.',
            p_ten_ga_len, p_ma_chuyen_tau;
    END IF;

    -- 4. Tim thu tu ga xuong tu TEN ga
    SELECT MIN(g.thutuga), COUNT(*)
    INTO v_thu_tu_ga_xuong, v_so_khop_ga_xuong
    FROM public.gatrongchuyen AS g
    JOIN public.nhaga AS n
      ON n.manhaga = g.manhaga
    WHERE g.machuyentau = p_ma_chuyen_tau
      AND BTRIM(n.tennhaga) = BTRIM(p_ten_ga_xuong);

    IF v_so_khop_ga_xuong = 0 THEN
        RAISE EXCEPTION
            'Ga xuong % khong ton tai trong lich chuyen %.',
            p_ten_ga_xuong, p_ma_chuyen_tau;

    ELSIF v_so_khop_ga_xuong > 1 THEN
        RAISE EXCEPTION
            'Ten ga xuong % khong xac dinh duy nhat tren chuyen %.',
            p_ten_ga_xuong, p_ma_chuyen_tau;
    END IF;

    -- 5. Kiem tra thu tu ga len va ga xuong
    IF v_thu_tu_ga_len >= v_thu_tu_ga_xuong THEN
        RAISE EXCEPTION
            'Ga len % phai dung truoc ga xuong % tren chuyen %.',
            p_ten_ga_len, p_ten_ga_xuong, p_ma_chuyen_tau;
    END IF;

    -- 6. Duyet cac ve con hieu luc cua cung cho
    FOR v_ve IN
        SELECT m.thutugalen,
               m.thutugaxuong,
               v.mave
        FROM public.mucdatve AS m
        JOIN public.ve AS v
          ON v.madondatve = m.madondatve
         AND v.sttmuc = m.sttmuc
        WHERE m.machuyentau = p_ma_chuyen_tau
          AND m.stttoa = p_stt_toa
          AND m.sttcho = p_stt_cho
          AND BTRIM(v.trangthaive) = 'Có hiệu lực'
    LOOP
        -- Hai khoang [a,b) va [c,d) trung nhau
        -- neu a < d AND c < b
        IF v_thu_tu_ga_len < v_ve.thutugaxuong
           AND v_ve.thutugalen < v_thu_tu_ga_xuong THEN

            RETURN FALSE;
        END IF;
    END LOOP;

    -- Khong co ve hieu luc nao trung chang
    RETURN TRUE;
END;
$function$;

-- Xac nhan ham da duoc tao
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'fn_kiem_tra_cho_theo_chang'
  AND p.prokind = 'f';
