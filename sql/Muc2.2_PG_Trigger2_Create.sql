CREATE OR REPLACE FUNCTION recalculate_order_total(p_ma_don DonDatVe.MaDonDatVe%TYPE)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	IF p_ma_don IS NULL THEN
        RAISE EXCEPTION 'Ma don dat ve khong duoc NULL';
    END IF;

    PERFORM 1
    FROM DonDatVe d
    WHERE d.MaDonDatVe = p_ma_don
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ma don dat ve % khong ton tai', p_ma_don;
    END IF;

	UPDATE DonDatVe d
	SET TongTien = COALESCE((SELECT SUM(m.ThanhTien)
							 FROM MucDatVe m
							 WHERE m.MaDonDatVe = p_ma_don), 0)
	WHERE d.MaDonDatVe = p_ma_don;
END;
$$;

CREATE OR REPLACE FUNCTION update_order_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		PERFORM recalculate_order_total(NEW.MaDonDatVe);

	ELSIF TG_OP = 'DELETE' THEN
		PERFORM recalculate_order_total(OLD.MaDonDatVe);

	ELSIF TG_OP = 'UPDATE' THEN
		IF OLD.MaDonDatVe IS DISTINCT FROM NEW.MaDonDatVe THEN
			PERFORM recalculate_order_total(LEAST(OLD.MaDonDatVe, NEW.MaDonDatVe));
			PERFORM recalculate_order_total(GREATEST(OLD.MaDonDatVe, NEW.MaDonDatVe));
		ELSIF OLD.ThanhTien IS DISTINCT FROM NEW.ThanhTien THEN
			PERFORM recalculate_order_total(NEW.MaDonDatVe);
		END IF;
	END IF;

	RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_order_total
AFTER INSERT OR UPDATE OF MaDonDatVe, ThanhTien OR DELETE ON MucDatVe
FOR EACH ROW
EXECUTE FUNCTION update_order_total();



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
  AND c.relname = 'mucdatve'
  AND t.tgname = 'trigger_order_total';
