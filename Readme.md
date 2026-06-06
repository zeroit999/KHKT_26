# Chạy Frontend

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