# Panduan Menjalankan Proyek AgriDashboard

Proyek ini terdiri dari dua bagian utama: **Backend** (Python/FastAPI) dan **Frontend** (Next.js/React). Selain itu, proyek ini menggunakan database PostgreSQL yang dijalankan melalui Docker.

Berikut adalah langkah-langkah untuk menjalankan proyek secara lokal di Windows.

## 1. Menjalankan Database (PostgreSQL)

Pastikan Anda sudah menginstal Docker Desktop dan sedang berjalan.

1. Buka terminal di folder utama proyek (`d:\web\mechine-learning\agridashboard-2`).
2. Jalankan perintah berikut untuk mengangkat container database:
   ```bash
   docker-compose up -d
   ```
   *(Ini akan menjalankan PostgreSQL pada port `5454` sesuai dengan konfigurasi di `docker-compose.yml`)*

## 2. Menjalankan Backend (FastAPI)

Backend menggunakan Python dan Prisma sebagai ORM.

1. Buka terminal baru dan arahkan ke direktori `backend`:
   ```bash
   cd backend
   ```
2. Buat virtual environment (jika belum ada):
   ```bash
   python -m venv venv
   ```
3. Aktifkan virtual environment:
   - Di **Git Bash**:
     ```bash
     source venv/Scripts/activate
     ```
   - Di **Command Prompt (CMD)**:
     ```bash
     venv\Scripts\activate
     ```
   - Di **PowerShell**:
     ```bash
     venv\Scripts\Activate.ps1
     ```
4. Instal semua dependensi yang dibutuhkan:
   ```bash
   pip install -r requirements.txt
   ```
5. *(Opsional jika baru pertama kali)* Generate Prisma client dan sinkronisasi database:
   ```bash
   prisma generate
   prisma db push
   ```
6. Jalankan server FastAPI:
   ```bash
   uvicorn main:app --reload
   ```
   Backend akan berjalan di `http://127.0.0.1:8000`.

## 3. Menjalankan Frontend (Next.js)

Frontend menggunakan framework Next.js.

1. Buka terminal baru dan arahkan ke direktori `frontend`:
   ```bash
   cd frontend
   ```
2. Instal semua dependensi Node.js:
   ```bash
   npm install
   ```
3. Jalankan server development:
   ```bash
   npm run dev
   ```
   Frontend akan berjalan dan dapat diakses melalui browser di `http://localhost:3000`.

---
**Ringkasan Terminal yang Dibutuhkan:**
Anda membutuhkan setidaknya 2-3 terminal yang berjalan bersamaan:
1. Terminal untuk `docker-compose` (bisa ditutup setelah jalan karena `-d`).
2. Terminal untuk **Backend** (menjalankan `uvicorn`).
3. Terminal untuk **Frontend** (menjalankan `npm run dev`).
