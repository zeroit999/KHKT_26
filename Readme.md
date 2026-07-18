# Chạy Frontend

## Chạy local an toàn (không kết nối production)

Repository có sẵn hai file mẫu `frontend/.env.example` và `backend/.env.example`.
Thiết lập mặc định dùng `VITE_LOCAL_DEV_MODE=true` và `CHATBOT_PROVIDER=mock`,
vì vậy có thể test giao diện chatbot mà không cần Firebase production hoặc tốn OpenAI API.

```powershell
./scripts/start-local.ps1
```

Mở `http://127.0.0.1:5173`. Dừng các tiến trình local bằng:

```powershell
./scripts/stop-local.ps1
```

Để test OpenAI thật, sửa `backend/.env`:

```env
CHATBOT_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5.6-sol
```

API key chỉ được đặt ở backend, không được thêm vào biến `VITE_*`.
Nếu production chưa đổi sang OpenAI, backend tự động tiếp tục dùng
`GEMINI_API_KEY` hiện có khi `CHATBOT_PROVIDER` không được khai báo.

---

## Di chuyển vào thư mục frontend

```bash
cd frontend
```

## Cài dependencies

```bash
npm install
```

## Chạy React App
1. Tạo file `.env` trong thư mục `frontend` với nội dung sau (thay thế giá trị bằng cấu hình Firebase của bạn):

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

```bash
npm run dev
```

Frontend chạy tại:

```bash
http://localhost:5173
```

---

# Chạy Backend

## Di chuyển vào thư mục backend
```bash
cd backend
```
## Cài dependencies
```bash
npm install
```

## Tạo môi trường ảo
'''bash
python -m venv venv
''' 

## Kích hoạt môi trường ảo
'''bash
venv\Scripts\Activate
'''

## Cài package
'''bash
pip install -r requirements.txt
'''

'''bash
python app.py
'''



# Build logic tại Colab:
https://drive.google.com/drive/folders/16eO0z5zsYyhlQrVUVwNYT5McwJsfvVoZ
```

# Sản phẩm đã được deloy trên Vercel:
https://ai-exam-monitoring.vercel.app/

# Yêu cầu hệ thống

- NodeJS >= 18
- npm >= 9

---
