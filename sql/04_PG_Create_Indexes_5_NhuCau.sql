-- ============================================================================
-- BTL2 | FILE 04 (MOI) | 5 NHU CAU DANH CHI MUC CO CO SO NGHIEP VU
-- PostgreSQL 18 / pgAdmin 4 | Database: btl_tauhoa | Schema public
-- DOI CHIEU: MAU BAO CAO BTL2 P1-2-3, muc 1.2: 5 nhu cau + ly do +
-- chuc nang/man hinh + CREATE INDEX + EXPLAIN truoc va sau.
--
-- QUY TRINH (QUAN TRONG, KHONG CHAY TOAN BO FILE MOT LAN):
-- 0. BACKUP neu can. Chay 04_0_PG_Drop_Indexes_Cu.sql de xoa index cu.
-- 1. Chay A0; lan luot chay A1 ... A5, chup EXPLAIN TRUOC.
-- 2. Chay B0 (BEGIN ... 5 CREATE INDEX ... COMMIT) DUY NHAT MOT LAN.
-- 3. Chay C0; lan luot chay C1 ... C5, chup EXPLAIN SAU.
-- 4. Chay D1, D2 de xac nhan da tao du 5 index bo sung.
--
-- CAC INDEX PK / UNIQUE tu dong co do FILE 01 DUOC GIU NGUYEN.
-- Dung EXPLAIN (ANALYZE, BUFFERS) voi SELECT -> khong sua du lieu.
-- Data sample rat nho -> PostgreSQL co the chon Seq Scan ca truoc/sau;
-- KHONG duoc khang dinh index tang toc neu planner khong dung index.
-- ============================================================================

-- [A0] Cap nhat thong ke truoc do
ANALYZE public.NhaGa;
ANALYZE public.GaTrongChuyen;
ANALYZE public.Cho;
ANALYZE public.MucDatVe;
ANALYZE public.PhanCongPhucVu;

-- ============================================================================
-- A. EXPLAIN TRUOC KHI TAO 5 INDEX - CHAY TUNG CAU RIENG
-- ============================================================================


-- [I1-A] Tra ten nha ga (du lieu dau vao tren giao dien)
-- CHUC NANG: Chon ga di/ga den theo TEN GA trong form Tim chuyen tau.
-- MAN HINH: Khach hang > Tim chuyen tau > O chon Ga di / Ga den.
-- CAN CU: Q1 file 05; sp_tim_chuyen_tau file 2.3; NhaGa.TenNhaGa.
-- INDEX: idx_nhaga_ten ON NhaGa(TenNhaGa).
-- VI SAO: loc theo TenNhaGa, trong khi PK cua NhaGa la MaNhaGa.
-- KHONG danh UNIQUE: schema hien tai khong bat buoc ten ga duy nhat.
-- DATA DEMO: 'Ha Noi' co dau la 'Hà Nội'.
EXPLAIN (ANALYZE, BUFFERS)
SELECT ng.MaNhaGa, ng.TenNhaGa, ng.TrangThai
FROM public.NhaGa AS ng
WHERE ng.TenNhaGa = 'Hà Nội'
ORDER BY ng.MaNhaGa;


-- [I2-A] Tra chuyen tu ga di theo ngay/gio khoi hanh
-- CHUC NANG: Tim chuyen theo ga di va ngay gio di tai ga khach len tau.
-- MAN HINH: Khach hang > Tim chuyen tau > Ga di / Ngay di / Ket qua.
-- CAN CU: sp_tim_chuyen_tau file 2.3, Q1 file 05.
-- INDEX: idx_gtc_ga_gio_di (MaNhaGa, ThoiGianDiDuKien).
-- VI SAO: = theo MaNhaGa, tiep den loc theo khoang thoi gian [tu, den).
-- MaChuyenTau da la cot dau trong PK(MaChuyenTau, ThuTuGa), khong can index rieng.
-- CHU Y: Q1 hien dang ::DATE tren cot timestamp; de toi uu phan thoi gian,
-- nen dung khoang [DATE, DATE + 1 day) trong Q1 (van la loc MOT NGAY).


EXPLAIN (ANALYZE, BUFFERS)
SELECT g.MaChuyenTau, g.ThuTuGa, g.MaNhaGa, g.ThoiGianDiDuKien
FROM public.GaTrongChuyen AS g
WHERE g.MaNhaGa = 'GA001'
  AND g.ThoiGianDiDuKien >= TIMESTAMP '2026-12-10 00:00:00'
  AND g.ThoiGianDiDuKien <  TIMESTAMP '2026-12-11 00:00:00'
ORDER BY g.ThoiGianDiDuKien, g.MaChuyenTau;

-- [I3-A] Loc nhanh danh sach cho duoc danh dau Da dat
-- CHUC NANG: Quan ly danh sach cho co TrangThai = 'Đã đặt'.
-- MAN HINH: Nhan vien > Quan ly cho tren chuyen tau > Loc 'Đã đặt'.
-- CAN CU: Q2 file 05; xem cho cua sp_tong_hop_cho_theo_toa file 2.3.
-- INDEX: partial index chi bao gom cho co TrangThai = 'Đã đặt'.
-- VI SAO: sample cho co 3/252 hang 'Đã đặt'; index ngan va co the sap xep
-- theo MaChuyenTau, STTToa, STTCho, khong can chi muc cho tat ca 'Trống'.
-- GIOI HAN: trang thai Cho la snapshot; kiem tra trung CHANG phai dung Ham 2.
-- PK(ChuyenTau, Toa, Cho) khong thay the partial index khi loc toan he thong
-- theo TrangThai = 'Đã đặt' ma khong biet MaChuyenTau.
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.MaChuyenTau, c.STTToa, c.STTCho, c.TrangThai
FROM public.Cho AS c
WHERE c.TrangThai = 'Đã đặt'
ORDER BY c.MaChuyenTau, c.STTToa, c.STTCho;


-- [I4-A] Tim muc dat ve theo cho de kiem tra trung chang
-- CHUC NANG: Kiem tra cho co the ban tren chang len/xuong da chon hay khong.
-- MAN HINH: Khach hang > Chon chuyen > Chon toa/cho > Xac nhan cho.
-- CAN CU: fn_kiem_tra_cho_theo_chang file 2.4.
-- INDEX: (MaChuyenTau, STTToa, STTCho) tren MucDatVe.
-- VI SAO: Ham 2 loc ba cot nay de tim cac ve tren CUNG mot cho roi moi
-- JOIN Ve va xet giao doan. PK MucDatVe(MaDonDatVe, STTMuc) khong ho tro
-- truc tiep tim theo chuyen/toa/cho. FK khong tu tao index o bang con.
-- Khong danh index rieng ThuTuGaLen/ThuTuGaXuong: chua co nghiep vu can.
-- So dong sample MucDatVe rat nho nen planner van co the Seq Scan.
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.MaDonDatVe, m.STTMuc, m.MaChuyenTau, m.STTToa, m.STTCho,
       m.ThuTuGaLen, m.ThuTuGaXuong, v.MaVe, v.TrangThaiVe
FROM public.MucDatVe AS m
JOIN public.Ve AS v
  ON v.MaDonDatVe = m.MaDonDatVe AND v.STTMuc = m.STTMuc
WHERE m.MaChuyenTau = 'CT001'
  AND m.STTToa = 2 AND m.STTCho = 1
  AND v.TrangThaiVe = 'Có hiệu lực'
  AND 2 < m.ThuTuGaXuong
  AND m.ThuTuGaLen < 3
ORDER BY m.MaDonDatVe, m.STTMuc;


-- [I5-A] Hien thi danh sach nhan vien phuc vu mot chuyen tau
-- CHUC NANG: Nhan vien dieu hanh xem toan bo phan cong cua mot chuyen.
-- MAN HINH: Nhan vien > Quan ly phan cong phuc vu > Chon chuyen tau > Danh sach.
-- CAN CU: Muc 2.1 (sp_them_phan_cong/sp_sua_phan_cong/sp_xoa_phan_cong).
-- INDEX: (MaChuyenTau, CCCD) tren PhanCongPhucVu.
-- VI SAO: danh sach loc CHI theo MaChuyenTau, sap xep theo CCCD; nhung PK
-- la (CCCD, MaChuyenTau), co thu tu nguoc va khong toi uu cho dieu kien
-- MaChuyenTau dung mot minh. FK MaChuyenTau khong tu sinh index.
-- Demo CT001 dang co 3 nhan vien phan cong (theo file 02).
EXPLAIN (ANALYZE, BUFFERS)
SELECT pc.MaChuyenTau, pc.CCCD, pc.MaVaiTro
FROM public.PhanCongPhucVu AS pc
WHERE pc.MaChuyenTau = 'CT001'
ORDER BY pc.CCCD;


-- ============================================================================
-- B. TAO INDEX (SAU KHI CHUP DU 5 EXPLAIN TRUOC)
-- BOI DEN TU BEGIN; DEN COMMIT; VA CHAY CHUNG MOT LAN.
-- Neu gap loi: ROLLBACK; (neu transaction con mo), sua loi roi chay lai.
-- ============================================================================
-- [B0] Tao 5 chi muc bo sung trong cung mot transaction.
BEGIN;


-- [I1-B] Tra ten nha ga (du lieu dau vao tren giao dien)
CREATE INDEX idx_nhaga_ten
ON public.NhaGa (TenNhaGa);


-- [I2-B] Tra chuyen tu ga di theo ngay/gio khoi hanh
CREATE INDEX idx_gtc_ga_gio_di
ON public.GaTrongChuyen (MaNhaGa, ThoiGianDiDuKien);


-- [I3-B] Loc nhanh danh sach cho duoc danh dau Da dat
CREATE INDEX idx_cho_da_dat
ON public.Cho (MaChuyenTau, STTToa, STTCho)
WHERE TrangThai = 'Đã đặt';


-- [I4-B] Tim muc dat ve theo cho de kiem tra trung chang
CREATE INDEX idx_mdv_theo_cho
ON public.MucDatVe (MaChuyenTau, STTToa, STTCho);


-- [I5-B] Hien thi danh sach nhan vien phuc vu mot chuyen tau
CREATE INDEX idx_pcpv_theo_chuyen
ON public.PhanCongPhucVu (MaChuyenTau, CCCD);


COMMIT;

-- [C0] Lam moi thong ke sau khi co 5 index
ANALYZE public.NhaGa;
ANALYZE public.GaTrongChuyen;
ANALYZE public.Cho;
ANALYZE public.MucDatVe;
ANALYZE public.PhanCongPhucVu;

-- ============================================================================
-- C. EXPLAIN SAU KHI TAO INDEX: GIU Y NGUYEN TRUY VAN GIAI DOAN A
-- ============================================================================


-- [I1-C] Tra ten nha ga (du lieu dau vao tren giao dien) (GIONG Y HET I1-A)
EXPLAIN (ANALYZE, BUFFERS)
SELECT ng.MaNhaGa, ng.TenNhaGa, ng.TrangThai
FROM public.NhaGa AS ng
WHERE ng.TenNhaGa = 'Hà Nội'
ORDER BY ng.MaNhaGa;


-- [I2-C] Tra chuyen tu ga di theo ngay/gio khoi hanh (GIONG Y HET I2-A)
EXPLAIN (ANALYZE, BUFFERS)
SELECT g.MaChuyenTau, g.ThuTuGa, g.MaNhaGa, g.ThoiGianDiDuKien
FROM public.GaTrongChuyen AS g
WHERE g.MaNhaGa = 'GA001'
  AND g.ThoiGianDiDuKien >= TIMESTAMP '2026-12-10 00:00:00'
  AND g.ThoiGianDiDuKien <  TIMESTAMP '2026-12-11 00:00:00'
ORDER BY g.ThoiGianDiDuKien, g.MaChuyenTau;


-- [I3-C] Loc nhanh danh sach cho duoc danh dau Da dat (GIONG Y HET I3-A)
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.MaChuyenTau, c.STTToa, c.STTCho, c.TrangThai
FROM public.Cho AS c
WHERE c.TrangThai = 'Đã đặt'
ORDER BY c.MaChuyenTau, c.STTToa, c.STTCho;


-- [I4-C] Tim muc dat ve theo cho de kiem tra trung chang (GIONG Y HET I4-A)
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.MaDonDatVe, m.STTMuc, m.MaChuyenTau, m.STTToa, m.STTCho,
       m.ThuTuGaLen, m.ThuTuGaXuong, v.MaVe, v.TrangThaiVe
FROM public.MucDatVe AS m
JOIN public.Ve AS v
  ON v.MaDonDatVe = m.MaDonDatVe AND v.STTMuc = m.STTMuc
WHERE m.MaChuyenTau = 'CT001'
  AND m.STTToa = 2 AND m.STTCho = 1
  AND v.TrangThaiVe = 'Có hiệu lực'
  AND 2 < m.ThuTuGaXuong
  AND m.ThuTuGaLen < 3
ORDER BY m.MaDonDatVe, m.STTMuc;


-- [I5-C] Hien thi danh sach nhan vien phuc vu mot chuyen tau (GIONG Y HET I5-A)
EXPLAIN (ANALYZE, BUFFERS)
SELECT pc.MaChuyenTau, pc.CCCD, pc.MaVaiTro
FROM public.PhanCongPhucVu AS pc
WHERE pc.MaChuyenTau = 'CT001'
ORDER BY pc.CCCD;


-- ============================================================================
-- D. KIEM TRA CHI MUC DA DUOC TAO
-- ============================================================================
-- [D1] Danh sach 5 index bo sung (mong doi: 5 dong)
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
       'idx_nhaga_ten',
       'idx_gtc_ga_gio_di',
       'idx_cho_da_dat',
       'idx_mdv_theo_cho',
       'idx_pcpv_theo_chuyen'
  )
ORDER BY tablename, indexname;

-- [D2] Dem so index bo sung, loai tru index cua PK va UNIQUE (mong doi: 5)
SELECT COUNT(*) AS so_index_bo_sung
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
       'idx_nhaga_ten', 'idx_gtc_ga_gio_di', 'idx_cho_da_dat',
       'idx_mdv_theo_cho', 'idx_pcpv_theo_chuyen'
  );



-- [TEST mo phong, han che lua chon quet tuan tu]
BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    MaNhaGa,
    TenNhaGa,
    TrangThai
FROM NhaGa
WHERE TenNhaGa = 'Hà Nội'
ORDER BY MaNhaGa;
ROLLBACK;
-- ============================================================================
-- HUONG DAN BAO CAO: voi MOI INDEX ghi:
-- (1) Chuc nang va man hinh; (2) bang/cot va ly do; (3) CREATE INDEX;
-- (4) Anh EXPLAIN truoc; (5) Anh EXPLAIN sau; (6) nhan xet planner,
-- actual rows, actual time, Buffers. Neu Seq Scan van duoc chon thi noi ro.
-- Anh D1 cho thay index va predicate cua chi muc partial idx_cho_da_dat.
--
-- TEST MINH HOA KHẢ NANG SU DUNG INDEX (khong bat buoc):
-- BEGIN;
-- SET LOCAL enable_seqscan = off;
-- EXPLAIN (ANALYZE, BUFFERS) SELECT ...; -- dung cau SELECT o C1..C5
-- ROLLBACK;
-- Day la test ep planer, KHONG phai ket qua hoat dong binh thuong.
-- ============================================================================
