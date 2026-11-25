# Tàu Việt

Ứng dụng demo BTL2 cho phép tra cứu chuyến tàu, chọn chỗ theo chặng, đặt vé, thanh toán mô phỏng và đổi hoặc trả vé. Lịch chạy, chỗ ngồi, giá vé và đơn đặt đều dùng dữ liệu PostgreSQL.

## Kiến trúc và công nghệ

```text
Trình duyệt
  → Frontend React + TypeScript + Tailwind CSS (Vite, cổng 5173)
    → REST API JSON (Node.js + Express, cổng 3000)
      → PostgreSQL 18 (node-postgres/pg, cổng 5432)
```

- **Frontend:** React 19, TypeScript 5, Tailwind CSS 4 và Vite 8. Gọi API qua biến `VITE_API_URL`.
- **Backend:** Node.js, Express 4, `pg` để kết nối PostgreSQL, `dotenv` để đọc cấu hình và `cors` để cho phép frontend gọi API.
- **CSDL:** PostgreSQL 18 và PL/pgSQL. API gọi procedure tìm chuyến, hàm tính giá vé và hàm kiểm tra chỗ theo chặng. Trigger cập nhật tổng tiền đơn từ các mục đặt vé.
- **Quản lý package:** npm workspaces cài chung hai package `client` và `server`. `concurrently` chạy cả hai tiến trình khi dùng `npm run dev`.

```text
TauViet_MeaningfulData/
├── package.json                 # Khai báo hai workspace và lệnh chạy chung
├── package-lock.json            # Phiên bản dependency để npm ci cài lại
├── .gitignore                   # Bỏ qua .env, node_modules, dist và log
├── README.md                    # Cài đặt, nạp CSDL, chạy và kiểm tra nhanh
│
├── client/
│   ├── index.html               # Trang HTML chứa <div id="root">
│   ├── package.json             # Lệnh dev, build, preview, typecheck, format
│   ├── vite.config.ts           # Plugin React, Tailwind và cổng frontend
│   ├── tsconfig.json            # Quy tắc kiểm tra kiểu TypeScript
│   ├── .env.example             # Mẫu cấu hình VITE_API_URL
│   ├── README.md                # Hướng dẫn riêng cho frontend
│   ├── public/                  # Favicon được phục vụ trực tiếp
│   ├── reference/               # Bản xuất Figma Make và ảnh tham khảo
│   └── src/
│       ├── main.tsx             # Gắn React vào HTML
│       ├── App.tsx              # Điều hướng và trạng thái toàn luồng đặt vé
│       ├── index.css           # Font, màu, hiệu ứng và quy tắc in
│       ├── vite-env.d.ts       # Khai báo kiểu do Vite cung cấp
│       ├── assets/             # Ảnh dùng trong giao diện
│       ├── components/         # Thành phần giao diện dùng lại
│       ├── lib/                # API, kiểu dữ liệu và hàm tiện ích
│       ├── steps/              # Các bước trong luồng đặt vé
│       └── views/              # Đơn của tôi, đổi/trả, quản trị
│
├── server/
│   ├── package.json             # Dependency và lệnh chạy backend
│   ├── .env.example             # Mẫu cấu hình kết nối, cổng và CORS
│   └── src/
│       ├── index.mjs            # Khởi động API, tra chuyến, giữ chỗ, đặt vé
│       ├── admin.mjs            # Phân công phục vụ và điều chỉnh lịch ga
│       └── ticket-changes.mjs   # Báo phí và xác nhận đổi/trả vé
│
├── sql/                         # 12 script tạo dữ liệu và nghiệp vụ CSDL
└── docs/
    └── KIEM_THU_POSTGRESQL.md    # Ca kiểm tra dữ liệu, API và trigger
```

## 1. Chuẩn bị môi trường

- Node.js **22.12 trở lên** và npm.
- PostgreSQL **18** đang chạy. Chuẩn bị tài khoản PostgreSQL có quyền tạo database nếu chưa có CSDL.
- Dùng **pgAdmin 4** hoặc **`psql`** để chạy các file SQL. Chỉ cần một trong hai.

Mở terminal tại thư mục `TauViet_MeaningfulData`, nơi có cả `client/`, `server/` và `sql/`. Các lệnh dưới đây chạy từ thư mục này.

## 2. Tạo và nạp dữ liệu PostgreSQL

Nếu máy đã có database `btl_tauhoa_meaningfulData` với đầy đủ dữ liệu và các đối tượng SQL bên dưới, chuyển đến bước 3. Các script tạo bảng, nạp dữ liệu và thêm ràng buộc chỉ chạy một lần trên database mới.

### Cách A — Dùng pgAdmin 4

1. Kết nối đến PostgreSQL. Mở **Query Tool** của database mặc định `postgres` và chạy riêng câu lệnh sau:

   ```sql
   CREATE DATABASE "btl_tauhoa_meaningfulData" WITH ENCODING 'UTF8';
   ```

   Giữ dấu ngoặc kép để PostgreSQL giữ đúng chữ hoa trong tên database.

2. Làm mới mục **Databases**, chọn `btl_tauhoa_meaningfulData` và mở **Query Tool** của database này.
3. Mở và chạy từng file trong `sql/` theo đúng thứ tự:

   1. `01_PG_Create_Tables.sql`
   2. `02_PG_Insert_Data.sql`
   3. `03_PG_Add_Constraints.sql`
   4. `Muc2.1_PG_Create_CRUD_PhanCongPhucVu.sql`
   5. `Muc2.2_PG_Trigger1_Create.sql`
   6. `Muc2.2_PG_Trigger2_Create.sql`
   7. `Muc2.3_PG_Procedure1_Create.sql`
   8. `Muc2.3_PG_Procedure2_Create.sql`
   9. `Muc2.4_PG_Function1_Create.sql`
   10. `Muc2.4_PG_Function2_Create.sql`

### Cách B — Dùng `psql` (macOS/Linux)

Thay `postgres` sau `-U` bằng tài khoản PostgreSQL của bạn nếu dùng tên khác. `psql` sẽ hỏi mật khẩu theo cấu hình máy.

```bash
psql -h localhost -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"btl_tauhoa_meaningfulData\" WITH ENCODING 'UTF8';"

psql -h localhost -p 5432 -U postgres -d btl_tauhoa_meaningfulData -v ON_ERROR_STOP=1 \
  -f sql/01_PG_Create_Tables.sql \
  -f sql/02_PG_Insert_Data.sql \
  -f sql/03_PG_Add_Constraints.sql \
  -f sql/Muc2.1_PG_Create_CRUD_PhanCongPhucVu.sql \
  -f sql/Muc2.2_PG_Trigger1_Create.sql \
  -f sql/Muc2.2_PG_Trigger2_Create.sql \
  -f sql/Muc2.3_PG_Procedure1_Create.sql \
  -f sql/Muc2.3_PG_Procedure2_Create.sql \
  -f sql/Muc2.4_PG_Function1_Create.sql \
  -f sql/Muc2.4_PG_Function2_Create.sql
```

`04_PG_Create_Indexes_5_NhuCau.sql` phục vụ phân tích chỉ mục và `05_PG_Select_Queries.sql` chứa truy vấn tham khảo. Hai file này không bắt buộc để chạy ứng dụng.

## 3. Cấu hình kết nối

Tạo `server/.env` từ `server/.env.example` và `client/.env` từ `client/.env.example` nếu chưa có. Có thể sao chép bằng trình quản lý file hoặc dùng `cp` trên macOS/Linux.

Nội dung `server/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/btl_tauhoa_meaningfulData
EXPECTED_DATABASE=btl_tauhoa_meaningfulData
DB_SSL=false
DB_POOL_MAX=10
PORT=3000
CLIENT_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
```

- Thay `YOUR_PASSWORD` và tên tài khoản bằng thông tin PostgreSQL trên máy bạn. Nếu mật khẩu có ký tự đặc biệt trong URL, mã hóa riêng phần mật khẩu, ví dụ `@` thành `%40` và `#` thành `%23`.
- `EXPECTED_DATABASE` phải khớp chính xác tên database trong `DATABASE_URL`. API kiểm tra tên này lúc khởi động.
- Chỉ lưu mật khẩu trong `server/.env`. Không đưa file này lên Git.
- Nếu cần chỉ định nhân viên xử lý đổi/trả, đặt `TICKET_CHANGE_EMPLOYEE_CCCD` bằng CCCD của nhân viên bán vé có vai trò `VT02`. Khi bỏ trống, bản demo chọn nhân viên bán vé đầu tiên theo CCCD.

Nội dung `client/.env`:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Nếu đổi cổng API, cập nhật `PORT` và `VITE_API_URL` tương ứng. Nếu Vite chạy trên cổng khác 5173, thêm đúng địa chỉ frontend vào `CLIENT_ORIGIN`.

## 4. Cài package và chạy ứng dụng

Tại thư mục `TauViet_MeaningfulData`:

```bash
npm ci
npm run dev
```

`npm ci` cài package cho cả frontend và backend theo `package-lock.json`. Mở địa chỉ Vite in trong terminal, mặc định là [http://127.0.0.1:5173](http://127.0.0.1:5173).

- **Kiểm tra API và CSDL:** [http://localhost:3000/api/health](http://localhost:3000/api/health) hoặc [http://localhost:3000/api](http://localhost:3000/api). Kết quả có `ok: true` và tên database. Với bộ mẫu mới nạp, dự kiến có 28 bảng, 30 chuyến, 90 toa, 1.620 chỗ, 7 routine và 2 trigger.
- **Thử tra chuyến:** chọn **Hà Nội → Huế**, ngày **10/12/2026**. Bộ dữ liệu mẫu có chuyến **CT001 (SE1)**.
- **Kiểm tra TypeScript:** `npm run typecheck`. **Build frontend:** `npm run build`. Kết quả build nằm ở `client/dist/`.

Nếu terminal báo lỗi kết nối, kiểm tra PostgreSQL đã chạy, tài khoản và cổng trong `DATABASE_URL`. Nếu API báo sai database, kiểm tra lại tên có phân biệt hoa thường. Nếu API trả `ok: true` nhưng thao tác nghiệp vụ lỗi, kiểm tra `installedRoutines` và `enabledTriggers` trong kết quả health.

Thanh toán và quyết toán đổi/trả đều là mô phỏng. Phiên giữ chỗ 10 phút nằm trong bộ nhớ backend và hết hiệu lực khi API khởi động lại. Ứng dụng dùng cho demo localhost.
