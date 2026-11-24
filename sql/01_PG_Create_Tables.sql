-- BTL2 - QUẢN LÝ VÀ ĐẶT VÉ TÀU HỎA | PostgreSQL / pgAdmin 4
-- FILE 01: CREATE TABLE + PRIMARY KEY + UNIQUE + NULL / NOT NULL.
-- Đầy đủ các cột đóng vai trò FK, nhưng CHƯA khai báo FOREIGN KEY.
-- CHƯA có CHECK. FK và CHECK sẽ được thêm bằng ALTER TABLE trong FILE 03.
-- Chọn database btl_dat_ve_tau_hoa (database mới) trước khi chạy.
-- Tên định danh không quote được PostgreSQL chuyển thành chữ thường.
-- PRIMARY KEY và UNIQUE được PostgreSQL tự động tạo index phục vụ ràng buộc.
-- KHÔNG chạy lại nếu 28 bảng đã tồn tại. Để đổi phân tách cần tạo schema mới.

-- Tạo DATABASE
-- CREATE DATABASE btl_tauhoa
--     WITH ENCODING = 'UTF8';
-- Chọn btl_tauhoa -> chọn query tool -> thực hiện nhiệm vụ
BEGIN;

-- Bang NhomMacTau
CREATE TABLE NhomMacTau (
    MaNhom  VARCHAR(20) NOT NULL,
    CONSTRAINT pk_nhom_mac_tau PRIMARY KEY (MaNhom)
);

-- Bang TuyenDuong
CREATE TABLE TuyenDuong (
    MaTuyenDuong   VARCHAR(20) NOT NULL,
    TenTuyenDuong  VARCHAR(150) NOT NULL,
    TongChieuDai   DECIMAL(10,2) NULL,
    TrangThai      VARCHAR(30) NOT NULL,
    CONSTRAINT pk_tuyen_duong PRIMARY KEY (MaTuyenDuong)
);

-- Bang NhaGa
CREATE TABLE NhaGa (
    MaNhaGa    VARCHAR(20) NOT NULL,
    TenNhaGa   VARCHAR(150) NOT NULL,
    TrangThai  VARCHAR(30) NOT NULL,
    SoDuong    VARCHAR(150) NULL,
    PhuongXa   VARCHAR(100) NOT NULL,
    TinhTP     VARCHAR(100) NOT NULL,
    CONSTRAINT pk_nha_ga PRIMARY KEY (MaNhaGa)
);

-- Bang LoaiToa
CREATE TABLE LoaiToa (
    MaLoaiToa   VARCHAR(20) NOT NULL,
    TenLoaiToa  VARCHAR(100) NOT NULL,
    CONSTRAINT pk_loai_toa PRIMARY KEY (MaLoaiToa)
);

-- Bang VaiTroNhanVien
CREATE TABLE VaiTroNhanVien (
    MaVaiTro   VARCHAR(20) NOT NULL,
    TenVaiTro  VARCHAR(100) NOT NULL,
    CONSTRAINT pk_vai_tro_nhan_vien PRIMARY KEY (MaVaiTro)
);

-- Bang DoiTuong
CREATE TABLE DoiTuong (
    MaDoiTuong    VARCHAR(20) NOT NULL,
    TenDoiTuong   VARCHAR(100) NOT NULL,
    TyLeGiam      DECIMAL(5,4) NOT NULL,
    TuoiToiThieu  INTEGER NULL,
    TuoiToiDa     INTEGER NULL,
    CONSTRAINT pk_doi_tuong PRIMARY KEY (MaDoiTuong)
);

-- Bang NguoiDung
CREATE TABLE NguoiDung (
    CCCD      CHAR(12) NOT NULL,
    Ho        VARCHAR(50) NOT NULL,
    TenGiua   VARCHAR(50) NULL,
    Ten       VARCHAR(50) NOT NULL,
    NgaySinh  DATE NOT NULL,
    GioiTinh  VARCHAR(20) NOT NULL,
    CONSTRAINT pk_nguoi_dung PRIMARY KEY (CCCD)
);

-- Bang NhaGa_HotLine
CREATE TABLE NhaGa_HotLine (
    MaNhaGa  VARCHAR(20) NOT NULL,
    HotLine  VARCHAR(15) NOT NULL,
    CONSTRAINT pk_nha_ga_hotline PRIMARY KEY (MaNhaGa, HotLine)
);

-- Bang TuyenDuong_NhaGa
CREATE TABLE TuyenDuong_NhaGa (
    MaTuyenDuong  VARCHAR(20) NOT NULL,
    MaNhaGa       VARCHAR(20) NOT NULL,
    ThuTuGa       INTEGER NOT NULL,
    CONSTRAINT pk_tuyen_duong_nha_ga PRIMARY KEY (MaTuyenDuong, MaNhaGa),
    CONSTRAINT uq_tdng_thu_tu UNIQUE (MaTuyenDuong, ThuTuGa)
);

-- Bang MacTau
CREATE TABLE MacTau (
    MaMacTau      VARCHAR(20) NOT NULL,
    TrangThai     VARCHAR(30) NOT NULL,
    MaNhom        VARCHAR(20) NOT NULL,
    MaTuyenDuong  VARCHAR(20) NOT NULL,
    CONSTRAINT pk_mac_tau PRIMARY KEY (MaMacTau)
);

-- Bang ChuyenTau
CREATE TABLE ChuyenTau (
    MaChuyenTau             VARCHAR(30) NOT NULL,
    ThoiGianKhoiHanhDuKien  TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ThoiGianKetThucDuKien   TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    TrangThai               VARCHAR(30) NOT NULL,
    MaMacTau                VARCHAR(20) NOT NULL,
    CONSTRAINT pk_chuyen_tau PRIMARY KEY (MaChuyenTau)
);

-- Bang GaTrongChuyen
CREATE TABLE GaTrongChuyen (
    MaChuyenTau        VARCHAR(30) NOT NULL,
    ThuTuGa            INTEGER NOT NULL,
    MaNhaGa            VARCHAR(20) NOT NULL,
    ThoiGianDenDuKien  TIMESTAMP WITHOUT TIME ZONE NULL,
    ThoiGianDiDuKien   TIMESTAMP WITHOUT TIME ZONE NULL,
    ThoiGianDenThucTe  TIMESTAMP WITHOUT TIME ZONE NULL,
    ThoiGianDiThucTe   TIMESTAMP WITHOUT TIME ZONE NULL,
    CONSTRAINT pk_ga_trong_chuyen PRIMARY KEY (MaChuyenTau, ThuTuGa)
);

-- Bang ToaTau
CREATE TABLE ToaTau (
    MaChuyenTau  VARCHAR(30) NOT NULL,
    STTToa       INTEGER NOT NULL,
    TrangThai    VARCHAR(30) NOT NULL,
    MaLoaiToa    VARCHAR(20) NOT NULL,
    CONSTRAINT pk_toa_tau PRIMARY KEY (MaChuyenTau, STTToa)
);

-- Bang Cho
CREATE TABLE Cho (
    MaChuyenTau  VARCHAR(30) NOT NULL,
    STTToa       INTEGER NOT NULL,
    STTCho       INTEGER NOT NULL,
    ViTriTang    VARCHAR(20) NULL,
    TrangThai    VARCHAR(30) NOT NULL,
    CONSTRAINT pk_cho PRIMARY KEY (MaChuyenTau, STTToa, STTCho)
);

-- Bang ChinhSachGia
CREATE TABLE ChinhSachGia (
    MaChinhSach    VARCHAR(20) NOT NULL,
    TenChinhSach   VARCHAR(150) NOT NULL,
    DonGiaMoiDoan  DECIMAL(12,2) NOT NULL,
    NgayBatDau     DATE NOT NULL,
    NgayKetThuc    DATE NOT NULL,
    MaNhom         VARCHAR(20) NOT NULL,
    CONSTRAINT pk_chinh_sach_gia PRIMARY KEY (MaChinhSach)
);

-- Bang ApDungGia
CREATE TABLE ApDungGia (
    MaChinhSach  VARCHAR(20) NOT NULL,
    MaLoaiToa    VARCHAR(20) NOT NULL,
    HeSoGiaCho   DECIMAL(6,3) NOT NULL,
    CONSTRAINT pk_ap_dung_gia PRIMARY KEY (MaChinhSach, MaLoaiToa)
);

-- Bang NguoiDung_SDT
CREATE TABLE NguoiDung_SDT (
    CCCD  CHAR(12) NOT NULL,
    SDT   VARCHAR(15) NOT NULL,
    CONSTRAINT pk_nd_sdt PRIMARY KEY (CCCD, SDT)
);

-- Bang NguoiDung_Email
CREATE TABLE NguoiDung_Email (
    CCCD   CHAR(12) NOT NULL,
    Email  VARCHAR(254) NOT NULL,
    CONSTRAINT pk_nd_email PRIMARY KEY (CCCD, Email)
);

-- Bang NguoiDung_DiaChiLienHe
CREATE TABLE NguoiDung_DiaChiLienHe (
    CCCD      CHAR(12) NOT NULL,
    SoDuong   VARCHAR(150) NOT NULL,
    PhuongXa  VARCHAR(100) NOT NULL,
    TinhTP    VARCHAR(100) NOT NULL,
    CONSTRAINT pk_nd_dia_chi PRIMARY KEY (CCCD, SoDuong, PhuongXa, TinhTP)
);

-- Bang KhachHang
CREATE TABLE KhachHang (
    CCCD  CHAR(12) NOT NULL,
    CONSTRAINT pk_khach_hang PRIMARY KEY (CCCD)
);

-- Bang NhanVien
CREATE TABLE NhanVien (
    CCCD         CHAR(12) NOT NULL,
    NgayVaoLam   DATE NOT NULL,
    Luong        DECIMAL(14,2) NOT NULL,
    MaNhaGa      VARCHAR(20) NULL,
    CCCD_QuanLy  CHAR(12) NULL,
    CONSTRAINT pk_nhan_vien PRIMARY KEY (CCCD)
);

-- Bang DamNhan
CREATE TABLE DamNhan (
    CCCD      CHAR(12) NOT NULL,
    MaVaiTro  VARCHAR(20) NOT NULL,
    CONSTRAINT pk_dam_nhan PRIMARY KEY (CCCD, MaVaiTro)
);

-- Bang PhanCongPhucVu
CREATE TABLE PhanCongPhucVu (
    CCCD         CHAR(12) NOT NULL,
    MaChuyenTau  VARCHAR(30) NOT NULL,
    MaVaiTro     VARCHAR(20) NOT NULL,
    CONSTRAINT pk_phan_cong PRIMARY KEY (CCCD, MaChuyenTau)
);

-- Bang DonDatVe
CREATE TABLE DonDatVe (
    MaDonDatVe      VARCHAR(30) NOT NULL,
    NgayTaoDon      DATE NOT NULL,
    GioTaoDon       TIME NOT NULL,
    TrangThai       VARCHAR(30) NOT NULL,
    TongTien        DECIMAL(14,2) NOT NULL,
    CCCD_KhachHang  CHAR(12) NOT NULL,
    CONSTRAINT pk_don_dat_ve PRIMARY KEY (MaDonDatVe)
);

-- Bang MucDatVe
CREATE TABLE MucDatVe (
    MaDonDatVe      VARCHAR(30) NOT NULL,
    STTMuc          INTEGER NOT NULL,
    HoTenHanhKhach  VARCHAR(150) NOT NULL,
    SoGiayTo        VARCHAR(30) NOT NULL,
    GiaCoSo         DECIMAL(14,2) NOT NULL,
    GiamDoiTuong    DECIMAL(14,2) NOT NULL,
    ThanhTien       DECIMAL(14,2) NOT NULL,
    MaChuyenTau     VARCHAR(30) NOT NULL,
    STTToa          INTEGER NOT NULL,
    STTCho          INTEGER NOT NULL,
    ThuTuGaLen      INTEGER NOT NULL,
    ThuTuGaXuong    INTEGER NOT NULL,
    MaDoiTuong      VARCHAR(20) NOT NULL,
    CONSTRAINT pk_muc_dat_ve PRIMARY KEY (MaDonDatVe, STTMuc)
);

-- Bang Ve
CREATE TABLE Ve (
    MaVe         VARCHAR(30) NOT NULL,
    TrangThaiVe  VARCHAR(30) NOT NULL,
    MaQR         VARCHAR(255) NULL,
    MaDonDatVe   VARCHAR(30) NOT NULL,
    STTMuc       INTEGER NOT NULL,
    CONSTRAINT pk_ve PRIMARY KEY (MaVe),
    CONSTRAINT uq_ve_ma_qr UNIQUE (MaQR),
    CONSTRAINT uq_ve_muc_dat UNIQUE (MaDonDatVe, STTMuc)
);

-- Bang YeuCauDoiTra
CREATE TABLE YeuCauDoiTra (
    MaYeuCau           VARCHAR(30) NOT NULL,
    LoaiYeuCau         VARCHAR(20) NOT NULL,
    NgayYeuCau         DATE NOT NULL,
    GioTaoYeuCau       TIME NOT NULL,
    LyDo               VARCHAR(500) NULL,
    TrangThai          VARCHAR(30) NOT NULL,
    PhiDoiTra          DECIMAL(14,2) NULL,
    SoTienQuyetToan    DECIMAL(14,2) NULL,
    CCCD_KhachHang     CHAR(12) NOT NULL,
    CCCD_NhanVienXuLy  CHAR(12) NOT NULL,
    MaVeGoc            VARCHAR(30) NOT NULL,
    MaVeThayThe        VARCHAR(30) NULL,
    CONSTRAINT pk_yeu_cau_doi_tra PRIMARY KEY (MaYeuCau),
    CONSTRAINT uq_ycdt_ve_goc UNIQUE (MaVeGoc),
    CONSTRAINT uq_ycdt_ve_thay_the UNIQUE (MaVeThayThe)
);

-- Bang GiaoDich
CREATE TABLE GiaoDich (
    MaGiaoDich           VARCHAR(30) NOT NULL,
    NgayGiaoDich         DATE NOT NULL,
    GioGiaoDich          TIME NOT NULL,
    LoaiGiaoDich         VARCHAR(30) NOT NULL,
    SoTien               DECIMAL(14,2) NOT NULL,
    PhuongThucThanhToan  VARCHAR(50) NOT NULL,
    TrangThai            VARCHAR(30) NOT NULL,
    MaDonDatVe           VARCHAR(30) NULL,
    MaYeuCau             VARCHAR(30) NULL,
    CONSTRAINT pk_giao_dich PRIMARY KEY (MaGiaoDich),
    CONSTRAINT uq_gd_don UNIQUE (MaDonDatVe),
    CONSTRAINT uq_gd_yeu_cau UNIQUE (MaYeuCau)
);

COMMIT;

-- Đếm số bảng
SELECT COUNT(*) AS so_bang
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

