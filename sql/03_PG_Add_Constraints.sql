-- BTL2 - QUẢN LÝ VÀ ĐẶT VÉ TÀU HỎA | PostgreSQL / pgAdmin 4
-- FILE 03: ALTER TABLE THÊM FOREIGN KEY + CHECK; mỗi bảng 1 ALTER TABLE.
-- FILE 01: CREATE TABLE + PK/UNIQUE/NULL; FILE 02: INSERT DỮ LIỆU.
-- CHÍNH SÁCH THAM CHIẾU:
--   ON DELETE CASCADE: dữ liệu con phụ thuộc, không tồn tại độc lập.
--   ON DELETE SET NULL: liên kết tùy chọn, cột FK phải cho phép NULL.
--   ON DELETE RESTRICT: giữ dữ liệu lịch sử / danh mục đang được tham chiếu.
--   ON UPDATE CASCADE: đồng bộ khóa tham chiếu nếu mã định danh đổi.
-- KHÔNG sửa PK/UNIQUE/NULL đã khai báo trong FILE 01.
-- File này chỉ chạy trên database mới CHƯA có FOREIGN KEY/CHECK.
-- Khi vi phạm constraint, transaction sẽ ROLLBACK, không chạy lại toàn file.

BEGIN;

ALTER TABLE TuyenDuong
    ADD CONSTRAINT ck_td_chieu_dai CHECK (TongChieuDai IS NULL OR TongChieuDai > 0);

ALTER TABLE DoiTuong
    ADD CONSTRAINT ck_dt_khoang_tuoi CHECK (
        TuoiToiThieu IS NULL OR TuoiToiDa IS NULL
        OR TuoiToiDa >= TuoiToiThieu
    ),
    ADD CONSTRAINT ck_dt_ty_le_giam CHECK (TyLeGiam BETWEEN 0 AND 1),
    ADD CONSTRAINT ck_dt_tuoi_khong_am CHECK ((TuoiToiThieu IS NULL OR TuoiToiThieu >= 0) AND (TuoiToiDa IS NULL OR TuoiToiDa >= 0));

ALTER TABLE NguoiDung
    ADD CONSTRAINT ck_nd_cccd CHECK (CCCD ~ '^[0-9]{12}$'),
    ADD CONSTRAINT ck_nd_gioi_tinh CHECK (GioiTinh IN ('Nam', 'Nữ'));

ALTER TABLE NhaGa_HotLine
    ADD CONSTRAINT fk_nghl_ga FOREIGN KEY (MaNhaGa)
        REFERENCES NhaGa (MaNhaGa) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT ck_nghl_dinh_dang CHECK (HotLine ~ '^[0-9 ]{6,15}$');

ALTER TABLE TuyenDuong_NhaGa
    ADD CONSTRAINT fk_tdng_tuyen FOREIGN KEY (MaTuyenDuong)
        REFERENCES TuyenDuong (MaTuyenDuong) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT fk_tdng_ga FOREIGN KEY (MaNhaGa)
        REFERENCES NhaGa (MaNhaGa) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_tdng_thu_tu CHECK (ThuTuGa > 0);

ALTER TABLE MacTau
    ADD CONSTRAINT fk_mt_nhom FOREIGN KEY (MaNhom)
        REFERENCES NhomMacTau (MaNhom) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_mt_tuyen FOREIGN KEY (MaTuyenDuong)
        REFERENCES TuyenDuong (MaTuyenDuong) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ChuyenTau
    ADD CONSTRAINT fk_ct_mac FOREIGN KEY (MaMacTau)
        REFERENCES MacTau (MaMacTau) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_ct_thoi_gian CHECK (
        ThoiGianKetThucDuKien > ThoiGianKhoiHanhDuKien
    );

ALTER TABLE GaTrongChuyen
    ADD CONSTRAINT fk_gtc_chuyen FOREIGN KEY (MaChuyenTau)
        REFERENCES ChuyenTau (MaChuyenTau) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT fk_gtc_ga FOREIGN KEY (MaNhaGa)
        REFERENCES NhaGa (MaNhaGa) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_gtc_thu_tu CHECK (ThuTuGa > 0),
    ADD CONSTRAINT ck_gtc_dung_du_kien CHECK (
        ThoiGianDenDuKien IS NULL OR ThoiGianDiDuKien IS NULL
        OR ThoiGianDiDuKien >= ThoiGianDenDuKien
    ),
    ADD CONSTRAINT ck_gtc_dung_thuc_te CHECK (
        ThoiGianDenThucTe IS NULL OR ThoiGianDiThucTe IS NULL
        OR ThoiGianDiThucTe >= ThoiGianDenThucTe
    );

ALTER TABLE ToaTau
    ADD CONSTRAINT fk_toa_chuyen FOREIGN KEY (MaChuyenTau)
        REFERENCES ChuyenTau (MaChuyenTau) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT fk_toa_loai FOREIGN KEY (MaLoaiToa)
        REFERENCES LoaiToa (MaLoaiToa) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_toa_stt CHECK (STTToa > 0);

ALTER TABLE Cho
    ADD CONSTRAINT fk_cho_toa FOREIGN KEY (MaChuyenTau, STTToa)
        REFERENCES ToaTau (MaChuyenTau, STTToa) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT ck_cho_stt CHECK (STTCho > 0);

ALTER TABLE ChinhSachGia
    ADD CONSTRAINT fk_csg_nhom FOREIGN KEY (MaNhom)
        REFERENCES NhomMacTau (MaNhom) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_csg_don_gia CHECK (DonGiaMoiDoan >= 0),
    ADD CONSTRAINT ck_csg_thoi_han CHECK (NgayKetThuc >= NgayBatDau);

ALTER TABLE ApDungGia
    ADD CONSTRAINT fk_adg_csg FOREIGN KEY (MaChinhSach)
        REFERENCES ChinhSachGia (MaChinhSach) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT fk_adg_loai FOREIGN KEY (MaLoaiToa)
        REFERENCES LoaiToa (MaLoaiToa) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT ck_adg_he_so CHECK (HeSoGiaCho > 0);

ALTER TABLE NguoiDung_SDT
    ADD CONSTRAINT fk_nd_sdt_nguoi FOREIGN KEY (CCCD)
        REFERENCES NguoiDung (CCCD) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT ck_nd_sdt_dinh_dang CHECK (SDT ~ '^[0-9]{9,15}$');

ALTER TABLE NguoiDung_Email
    ADD CONSTRAINT fk_nd_email_nguoi FOREIGN KEY (CCCD)
        REFERENCES NguoiDung (CCCD) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT ck_nd_email_dinh_dang CHECK (
        Email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    );

ALTER TABLE NguoiDung_DiaChiLienHe
    ADD CONSTRAINT fk_nd_dia_chi_nguoi FOREIGN KEY (CCCD)
        REFERENCES NguoiDung (CCCD) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE KhachHang
    ADD CONSTRAINT fk_kh_nguoi FOREIGN KEY (CCCD)
        REFERENCES NguoiDung (CCCD) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE NhanVien
    ADD CONSTRAINT fk_nv_nguoi FOREIGN KEY (CCCD)
        REFERENCES NguoiDung (CCCD) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_nv_ga FOREIGN KEY (MaNhaGa)
        REFERENCES NhaGa (MaNhaGa) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT fk_nv_quan_ly FOREIGN KEY (CCCD_QuanLy)
        REFERENCES NhanVien (CCCD) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT ck_nv_luong CHECK (Luong >= 0),
    ADD CONSTRAINT ck_nv_khong_tu_quan_ly CHECK (
        CCCD_QuanLy IS NULL OR CCCD_QuanLy <> CCCD
    );

ALTER TABLE DamNhan
    ADD CONSTRAINT fk_dn_nhan_vien FOREIGN KEY (CCCD)
        REFERENCES NhanVien (CCCD) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT fk_dn_vai_tro FOREIGN KEY (MaVaiTro)
        REFERENCES VaiTroNhanVien (MaVaiTro) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE PhanCongPhucVu
    ADD CONSTRAINT fk_pcpv_nv FOREIGN KEY (CCCD)
        REFERENCES NhanVien (CCCD) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_pcpv_chuyen FOREIGN KEY (MaChuyenTau)
        REFERENCES ChuyenTau (MaChuyenTau) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT fk_pcpv_vai_tro FOREIGN KEY (MaVaiTro)
        REFERENCES VaiTroNhanVien (MaVaiTro) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_pcpv_dam_nhan FOREIGN KEY (CCCD, MaVaiTro)
        REFERENCES DamNhan (CCCD, MaVaiTro) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE DonDatVe
    ADD CONSTRAINT fk_ddv_kh FOREIGN KEY (CCCD_KhachHang)
        REFERENCES KhachHang (CCCD) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_ddv_tong_tien CHECK (TongTien >= 0);

ALTER TABLE MucDatVe
    ADD CONSTRAINT fk_mdv_don FOREIGN KEY (MaDonDatVe)
        REFERENCES DonDatVe (MaDonDatVe) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT fk_mdv_doi_tuong FOREIGN KEY (MaDoiTuong)
        REFERENCES DoiTuong (MaDoiTuong) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_mdv_cho FOREIGN KEY (MaChuyenTau, STTToa, STTCho)
        REFERENCES Cho (MaChuyenTau, STTToa, STTCho) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_mdv_ga_len FOREIGN KEY (MaChuyenTau, ThuTuGaLen)
        REFERENCES GaTrongChuyen (MaChuyenTau, ThuTuGa) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_mdv_ga_xuong FOREIGN KEY (MaChuyenTau, ThuTuGaXuong)
        REFERENCES GaTrongChuyen (MaChuyenTau, ThuTuGa) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_mdv_stt CHECK (STTMuc > 0),
    ADD CONSTRAINT ck_mdv_gia CHECK (
        GiaCoSo >= 0 AND GiamDoiTuong >= 0
        AND GiamDoiTuong <= GiaCoSo
        AND ThanhTien = GiaCoSo - GiamDoiTuong
    ),
    ADD CONSTRAINT ck_mdv_chang CHECK (ThuTuGaLen < ThuTuGaXuong),
    ADD CONSTRAINT ck_mdv_chi_so_khong_am CHECK (STTToa >= 0 AND STTCho >= 0 AND ThuTuGaLen >= 0 AND ThuTuGaXuong >= 0);

ALTER TABLE Ve
    ADD CONSTRAINT fk_ve_muc_dat FOREIGN KEY (MaDonDatVe, STTMuc)
        REFERENCES MucDatVe (MaDonDatVe, STTMuc) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE YeuCauDoiTra
    ADD CONSTRAINT fk_ycdt_kh FOREIGN KEY (CCCD_KhachHang)
        REFERENCES KhachHang (CCCD) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_ycdt_nv FOREIGN KEY (CCCD_NhanVienXuLy)
        REFERENCES NhanVien (CCCD) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_ycdt_ve_goc FOREIGN KEY (MaVeGoc)
        REFERENCES Ve (MaVe) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_ycdt_ve_moi FOREIGN KEY (MaVeThayThe)
        REFERENCES Ve (MaVe) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_ycdt_loai CHECK (LoaiYeuCau IN ('Đổi vé', 'Trả vé')),
    ADD CONSTRAINT ck_ycdt_phi CHECK (PhiDoiTra IS NULL OR PhiDoiTra >= 0),
    ADD CONSTRAINT ck_ycdt_ve_khac_nhau CHECK (
        MaVeThayThe IS NULL OR MaVeThayThe <> MaVeGoc
    ),
    ADD CONSTRAINT ck_ycdt_tra_khong_ve_moi CHECK (
        LoaiYeuCau <> 'Trả vé' OR MaVeThayThe IS NULL
    );

ALTER TABLE GiaoDich
    ADD CONSTRAINT fk_gd_don FOREIGN KEY (MaDonDatVe)
        REFERENCES DonDatVe (MaDonDatVe) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_gd_yeu_cau FOREIGN KEY (MaYeuCau)
        REFERENCES YeuCauDoiTra (MaYeuCau) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT ck_gd_co_nghiep_vu CHECK (
        MaDonDatVe IS NOT NULL OR MaYeuCau IS NOT NULL
    );

COMMIT;