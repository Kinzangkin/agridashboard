# Panduan Menjalankan Proyek AgriDashboard

Proyek ini terdiri dari dua bagian utama: **Backend** (Python/FastAPI) dan **Frontend** (Next.js/React). Selain itu, proyek ini menggunakan database PostgreSQL (bisa dijalankan via cloud Supabase atau lokal menggunakan Docker).

Berikut adalah langkah-langkah untuk menjalankan proyek secara lokal di Windows.

## 1. Menjalankan Database (PostgreSQL)

Secara default, konfigurasi `.env` pada Backend diarahkan langsung ke **Supabase (Cloud)**. Jika Anda ingin menggunakan database tersebut, Anda dapat **melewati langkah Docker ini** dan langsung menuju ke bagian **2. Menjalankan Backend**.

Jika Anda lebih memilih menggunakan database offline lokal:
1. Pastikan Anda sudah menginstal Docker Desktop dan statusnya sedang berjalan.
2. Buka terminal di folder utama proyek (`agridashboard`).
3. Jalankan perintah berikut untuk mengangkat container database PostgreSQL:
   ```bash
   docker-compose up -d
   ```
   *(Ini akan menjalankan PostgreSQL pada port `5454` sesuai dengan konfigurasi di `docker-compose.yml`)*
4. Jangan lupa sesuaikan URL database di file `backend/.env` Anda ke database lokal.

---

## 2. Menjalankan Backend (FastAPI)

Backend menggunakan Python dan Prisma sebagai ORM. 
> [!IMPORTANT]
> **PENTING:** Sangat direkomendasikan menggunakan **Python versi 3.12** (atau di bawahnya s.d. 3.9). Jangan menggunakan versi Python 3.13 atau 3.14 karena pustaka **TensorFlow** belum didukung secara resmi di versi tersebut.

1. Buka terminal baru dan arahkan ke direktori `backend`:
   ```bash
   cd backend
   ```
2. Buat virtual environment (jika belum ada). Jika di sistem Anda terdapat beberapa versi Python, pastikan menggunakan Python 3.12 secara spesifik:
   ```bash
   # Jika Python default Anda sudah versi 3.12:
   python -m venv venv

   # Jika default Anda versi lain (misal 3.14), gunakan versi 3.12 eksplisit:
   py -3.12 -m venv venv
   ```
3. Aktifkan virtual environment:
   - Di **PowerShell**:
     ```powershell
     venv\Scripts\Activate.ps1
     ```
   - Di **Command Prompt (CMD)**:
     ```cmd
     venv\Scripts\activate
     ```
   - Di **Git Bash**:
     ```bash
     source venv/Scripts/activate
     ```
4. Instal semua dependensi yang dibutuhkan:
   ```bash
   pip install -r requirements.txt
   ```
5. Sinkronisasi database & Generate client ORM Prisma:
   > [!NOTE]
   > Pastikan virtual environment Anda dalam keadaan **aktif** saat menjalankan perintah di bawah ini agar file binary python terdeteksi di system PATH.
   ```bash
   prisma generate
   prisma db push
   ```
6. Jalankan server FastAPI:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0
   ```
   Backend akan berjalan di `http://127.0.0.1:8000`. Anda bisa mengakses halaman dokumentasi interaktif di `http://127.0.0.1:8000/docs`.

---

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
Anda membutuhkan setidaknya 2 terminal utama yang berjalan bersamaan secara terus-menerus:
1. Terminal 1: **Backend** (menjalankan virtual environment + `uvicorn`).
2. Terminal 2: **Frontend** (menjalankan `npm run dev`).
3. *(Opsional)* Terminal 3: Untuk mengangkat container docker PostgreSQL jika menggunakan database lokal offline.
