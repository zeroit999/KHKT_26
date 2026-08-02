# KHKT_26

Ứng dụng AI exam monitoring gồm frontend React/Vite và backend Python.

## Yêu cầu

- Node.js >= 18
- npm >= 9
- Python 3.11 cho backend local
- Windows nếu muốn chạy local bằng PowerShell script
- Linux + Java 21 nếu muốn chạy full local bằng script

## Chạy frontend local

1. Vào thư mục frontend:

```bash
cd frontend
```

2. Cài dependencies:

```bash
npm install
```

3. Tạo file `.env` từ `frontend/.env.example`.

4. Chạy ứng dụng:

```bash
npm run dev
```

5. Mở trình duyệt tại:

```text
http://127.0.0.1:5173 || http://localhost:5173 (nếu chạy bằng npm run dev)
```

## Chạy local trên Linux

Script này khởi động Firebase Emulator, backend và frontend.

```bash
./scripts/linux/start-local.sh
```

Dừng toàn bộ dịch vụ local bằng:

```bash
./scripts/linux/stop-local.sh
```

Mặc định local dùng cấu hình an toàn, không cần kết nối production. File mẫu đã có sẵn:

- `frontend/.env.example`
- `backend/.env.example`

Tài khoản demo local:

- Học sinh: `student@zuny.local`
- Giáo viên: `teacher@zuny.local`
- Mật khẩu chung: `Zuny@123`

Các tài khoản này chỉ hoạt động khi `VITE_LOCAL_DEV_MODE=true`.

## Chạy local trên Windows

Script PowerShell sẽ khởi động Firebase Emulator, backend và frontend.

```powershell
./scripts/windows/start-local.ps1
```

Dừng toàn bộ dịch vụ local bằng:

```powershell
./scripts/windows/stop-local.ps1
```

Nếu chưa có môi trường phù hợp, script sẽ báo thiếu `backend/venv311`, Node.js hoặc OpenJDK 21. File mẫu cấu hình vẫn dùng:

- `frontend/.env.example`
- `backend/.env.example`

## Ghi chú production

- Frontend production cần đặt `VITE_API_BASE_URL` trỏ tới backend.
- Backend production cần cho phép domain frontend trong `ALLOWED_ORIGINS`.
- Nếu muốn dùng OpenAI thật, cấu hình trong `backend/.env`, không đặt API key vào biến `VITE_*`.
- Firebase Storage cần áp dụng CORS một lần cho bucket để lưu ảnh bằng chứng giám sát từ frontend:

```bash
gcloud storage buckets update gs://<FIREBASE_STORAGE_BUCKET> --cors-file=storage.cors.json
```

Sau khi đổi domain frontend, cập nhật `storage.cors.json` và chạy lại lệnh trên.

## Deploy

https://ai-exam-monitoring.vercel.app/
