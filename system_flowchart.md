# Flowchart Tahapan Pembuatan Sistem AgriDashboard

Dokumen ini berisi diagram alir (flowchart) menggunakan sintaks **Mermaid** untuk menggambarkan seluruh tahapan pengembangan sistem AgriDashboard, mulai dari persiapan dataset, training model ML, integrasi IoT (ESP32), hingga visualisasi dashboard (Next.js & FastAPI).

---

## 1. Flowchart End-to-End Sistem

Berikut adalah visualisasi alur pembuatan sistem dari awal hingga siap digunakan:

```mermaid
graph TD
    %% Styling
    classDef ML fill:#f9f,stroke:#333,stroke-width:2px;
    classDef IoT fill:#bbf,stroke:#333,stroke-width:2px;
    classDef Back fill:#fbb,stroke:#333,stroke-width:2px;
    classDef Front fill:#bfb,stroke:#333,stroke-width:2px;
    classDef DB fill:#ffb,stroke:#333,stroke-width:2px;

    %% STAGE 1: ML & Dataset (Google Colab)
    subgraph STAGE_1 ["1. Pengembangan Machine Learning (Google Colab)"]
        A[Mulai] --> B[Cari Dataset Lapangan Nyata di Kaggle <br>Contoh: PlantDoc]
        B --> C[Setup Kaggle Token di Google Colab]
        C --> D[Penyaringan Otomatis Gambar Tomat <br>Filter & Rename Folder]
        D --> E[Augmentasi Gambar & Pembagian Train/Val]
        E --> F[Training Tahap 1: Transfer Learning <br>MobileNetV2 ImageNet]:::ML
        F --> G[Training Tahap 2: Fine-Tuning <br>Unfreeze Layer Atas]:::ML
        G --> H[Simpan Model & Download <br>tomato_model.h5]:::ML
    end

    %% STAGE 2: IoT (ESP32)
    subgraph STAGE_2 ["2. Sistem IoT & Webcam Uploader"]
        I[Mulai Sensor & Kamera] --> J[ESP32 Membaca Data Sensor <br>Suhu, Kelembapan, pH]:::IoT
        J --> K[ESP32 Kirim Data Sensor via Wi-Fi <br>HTTP POST ke FastAPI]:::IoT
        L[Kamera/Webcam Kebun] --> M[Webcam Uploader Script <br>Ambil Gambar Tiap Interval]:::IoT
        M --> N[Kirim Gambar via HTTP POST <br>ke Endpoint FastAPI /predict]:::IoT
    end

    %% STAGE 3: Backend & Database (FastAPI & Prisma)
    subgraph STAGE_3 ["3. Pengembangan Backend (FastAPI)"]
        H --> O[Letakkan tomato_model.h5 <br>di backend/ml/models/]
        O --> P[Membuat Endpoint FastAPI]:::Back
        P --> Q["/predict (Klasifikasi Gambar Tomat & Simpan DB)"]:::Back
        P --> R["/sensor (Menerima & Menyimpan Data IoT)"]:::Back
        
        Q --> S[Inisialisasi Prisma Client]:::DB
        R --> S
        S --> T[(Simpan Data ke Database <br>History, Predictions, Sensor)]:::DB
    end

    %% STAGE 4: Frontend (Next.js Dashboard)
    subgraph STAGE_4 ["4. Pengembangan Frontend Dashboard (Next.js)"]
        T --> U[Membuat Halaman React/TSX]:::Front
        U --> V[Halaman Real-time Predictions <br>Menampilkan klasifikasi daun & resep obat]:::Front
        U --> W[Halaman Sensor History <br>Grafik suhu & kelembapan tanah]:::Front
        U --> X[Halaman Review Penyakit & Aksi]:::Front
    end

    V --> Y[Selesai & Deployment]
    W --> Y
    X --> Y

    %% Penerapan Class
    class F,G,H ML;
    class J,K,M,N IoT;
    class P,Q,R Back;
    class S,T DB;
    class U,V,W,X Front;
```

---

## 2. Rincian Penjelasan Tiap Tahapan

### Tahap 1: Persiapan & Pelatihan Model Machine Learning (Google Colab)
*   **Pengumpulan Dataset**: Mengambil dataset *PlantDoc* dari Kaggle karena memiliki latar belakang lapangan nyata agar model tidak bias.
*   **Preprocessing (Filtering)**: Memilah folder daun tomat dan menghapus folder tanaman lain yang tidak dibutuhkan di sistem, lalu mengubah nama kelasnya agar rapi.
*   **Transfer Learning (MobileNetV2)**: Menggunakan MobileNetV2 yang sudah terlatih di ImageNet. Tahap awal hanya melatih "kepala" classifier baru.
*   **Fine-Tuning**: Membuka kunci (*unfreeze*) beberapa layer teratas MobileNetV2 dan melatih ulang dengan *learning rate* sangat kecil agar model beradaptasi penuh dengan tekstur daun tomat asli di kebun.
*   **Ekspor Model**: Menghasilkan file `tomato_model.h5`.

### Tahap 2: Pengiriman Data IoT & Kamera (ESP32)
*   **ESP32**: Membaca sensor tanah/udara lalu mengirim data tersebut secara berkala menggunakan protokol HTTP POST ke API Backend.
*   **Webcam Uploader**: Script Python di lapangan/sisi hardware yang menangkap gambar dari webcam/kamera pengawas secara real-time lalu mengirimnya ke backend untuk dianalisis otomatis.

### Tahap 3: Pemrosesan Data & Logika Bisnis (FastAPI & Prisma)
*   **TensorFlow Integration**: Backend me-load `tomato_model.h5` di dalam memori saat server menyala.
*   **FastAPI Endpoints**:
    *   Menerima data sensor IoT dan menyimpannya di DB.
    *   Menerima gambar webcam, melakukan pra-pemrosesan (resize ke 224x224), menjalankan prediksi TensorFlow, lalu mencocokkannya ke label penyakit tomat.
*   **Database (Prisma ORM)**: Menyimpan riwayat deteksi, probabilitas penyakit, dan data sensor secara aman.

### Tahap 4: Antarmuka Pengguna & Visualisasi (Next.js)
*   **Dashboard Utama**: Menampilkan grafik kondisi kebun (dari data sensor ESP32) serta rangkuman kesehatan tanaman tomat.
*   **Riwayat Prediksi**: Menampilkan daftar foto daun tomat yang ditangkap webcam beserta hasil deteksi penyakit dan akurasinya.
*   **Panduan Solusi (Review)**: Memberikan saran obat atau aksi yang harus diambil petani berdasarkan penyakit tomat yang terdeteksi.
