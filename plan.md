# 🍅 TomatoHealth AI — Full Project Plan

## Daftar Isi
1. [Gambaran Umum Project](#1-gambaran-umum-project)
2. [Tech Stack Lengkap](#2-tech-stack-lengkap)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Struktur Folder](#4-struktur-folder)
5. [Database Schema (Prisma)](#5-database-schema-prisma)
6. [Docker Setup (Dev)](#6-docker-setup-dev)
7. [Machine Learning Pipeline](#7-machine-learning-pipeline)
8. [Backend FastAPI](#8-backend-fastapi)
9. [Frontend Next.js](#9-frontend-nextjs)
10. [ESP32 Code](#10-esp32-code)
11. [Environment Variables](#11-environment-variables)
12. [Alur Fine-tuning Lokal](#12-alur-fine-tuning-lokal)
13. [Migrasi Docker → Supabase](#13-migrasi-docker--supabase)
14. [Deployment](#14-deployment)
15. [Urutan Pengerjaan](#15-urutan-pengerjaan)

---

## 1. Gambaran Umum Project

**Nama Project:** TomatoHealth AI  
**Tujuan:** Sistem monitoring dan prediksi kesehatan tanaman tomat berbasis IoT + Machine Learning  
**Skala awal:** 1 tanaman tomat  
**User:** Single user (tidak ada sistem login)

### Apa yang sistem ini lakukan:
- ESP32Cam mengambil foto tanaman tomat secara berkala
- Sensor DHT22 membaca suhu dan kelembapan udara
- Data dikirim ke backend FastAPI via HTTP setiap 5–15 menit
- Model CNN menganalisis foto dan memprediksi:
  - Status kesehatan tanaman (sehat/sakit/kritis)
  - Jenis penyakit yang terdeteksi
  - Rekomendasi perawatan (dalam Bahasa Indonesia)
  - Estimasi waktu panen (jika tanaman sehat)
- Alert otomatis jika suhu/kelembapan di luar batas normal atau tanaman terdeteksi sakit
- Dashboard Next.js menampilkan semua data secara real-time
- Sistem auto-labeling foto untuk fine-tuning model secara lokal

---

## 2. Tech Stack Lengkap

| Layer | Teknologi | Keterangan |
|---|---|---|
| Frontend | Next.js | UI & routing |
| Styling | Tailwind CSS | Utility-first CSS |
| Grafik | Recharts | Grafik sensor history |
| Backend | FastAPI (Python) | REST API + ML inference |
| ML Framework | TensorFlow / Keras | CNN model |
| Base Model | MobileNetV2 | Transfer learning dari ImageNet |
| Training | Google Colab | GPU gratis untuk training awal |
| Fine-tuning | Script Python lokal | Ringan, tidak butuh GPU |
| ORM | Prisma (dengan prisma-client-py) | Database access layer |
| Database Dev | PostgreSQL via Docker | Lokal, tidak butuh internet |
| Database Prod | Supabase | PostgreSQL cloud, siap migrasi |
| File Storage | Supabase Storage | Simpan foto ESP32Cam |
| Deploy Frontend | Vercel | Gratis untuk Next.js |
| Deploy Backend | Railway | Gratis tier tersedia |
| ESP32 Comm | HTTP (HTTPClient library) | Kirim data & foto ke FastAPI |
| Dataset Awal | PlantVillage (Kaggle) | Ribuan foto penyakit tomat |
| Dataset Fine-tune | Foto dari ESP32Cam sendiri | Dikumpulkan otomatis |

---

## 3. Arsitektur Sistem

### Alur Data Lengkap

```
┌─────────────────────────────────────────────────────────────┐
│                        ESP32-CAM                            │
│  DHT22 sensor → baca suhu & kelembapan                      │
│  Kamera → ambil foto tanaman                                │
│  Setiap 5-15 menit:                                         │
│    POST /api/esp32/sensor → data suhu & kelembapan          │
│    POST /api/esp32/image  → foto tanaman (multipart)        │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP (WiFi)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│                                                             │
│  1. Terima data sensor → simpan ke DB → cek alert           │
│  2. Terima foto → upload ke Supabase Storage                │
│  3. Jalankan CNN inference pada foto                        │
│  4. Jika confidence > 90% → auto-label                      │
│  5. Jika confidence < 90% → tandai untuk review manual      │
│  6. Generate prediksi & rekomendasi                         │
│  7. Simpan semua ke database                                │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐       ┌─────────────────────┐
│   PostgreSQL     │       │  Supabase Storage   │
│  (Docker/Supabase│       │  (foto ESP32Cam)    │
│  - SensorReading │       └─────────────────────┘
│  - PlantImage    │
│  - Prediction    │
│  - Alert         │
└──────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│                                                             │
│  /dashboard   → status real-time, foto terbaru, alert       │
│  /history     → grafik sensor, riwayat foto & prediksi      │
│  /predictions → detail prediksi & rekomendasi               │
│  /review      → konfirmasi foto untuk fine-tuning           │
│  /settings    → konfigurasi alert, info model               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               Google Colab (Training Awal)                  │
│  Dataset: PlantVillage (Kaggle)                             │
│  Model: MobileNetV2 + custom classifier                     │
│  Output: tomato_model.h5 → download ke laptop               │
│  → taruh di backend/ml/models/tomato_model.h5               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               Fine-tuning Lokal (Berkala)                   │
│  Foto dari ESP32Cam yang sudah dilabel                       │
│  → python finetune.py                                       │
│  → model baru replace tomato_model.h5                       │
│  → FastAPI reload model secara otomatis                     │
└─────────────────────────────────────────────────────────────┘
```

### Dev vs Production

```
DEV (laptop):                    PRODUCTION:
─────────────────────            ─────────────────────────
PostgreSQL → Docker              PostgreSQL → Supabase
FastAPI    → localhost:8000      FastAPI    → Railway
Next.js    → localhost:3000      Next.js    → Vercel
Storage    → Supabase Storage    Storage    → Supabase Storage
ESP32      → IP lokal laptop     ESP32      → URL Railway
```

---

## 4. Struktur Folder

```
tomatohealth/
│
├── frontend/                          # Next.js 14
│   ├── app/
│   │   ├── layout.tsx                 # Root layout + sidebar
│   │   ├── page.tsx                   # Redirect ke /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx               # Dashboard utama
│   │   ├── history/
│   │   │   └── page.tsx               # Riwayat sensor & foto
│   │   ├── predictions/
│   │   │   └── page.tsx               # Hasil prediksi ML
│   │   ├── review/
│   │   │   └── page.tsx               # Review foto manual
│   │   └── settings/
│   │       └── page.tsx               # Pengaturan sistem
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── dashboard/
│   │   │   ├── HealthStatusCard.tsx   # Status kesehatan utama
│   │   │   ├── SensorCard.tsx         # Card suhu & kelembapan
│   │   │   ├── LatestImageCard.tsx    # Foto terbaru dari ESP32
│   │   │   └── AlertBanner.tsx        # Banner notifikasi alert
│   │   ├── history/
│   │   │   ├── SensorChart.tsx        # Grafik suhu & kelembapan
│   │   │   └── ImageHistoryGrid.tsx   # Grid foto dengan label
│   │   ├── review/
│   │   │   └── ImageReviewCard.tsx    # Kartu review foto
│   │   └── ui/
│   │       ├── Badge.tsx              # Badge status (sehat/sakit/dll)
│   │       ├── LoadingSpinner.tsx
│   │       └── ConfidenceBar.tsx      # Progress bar confidence
│   ├── lib/
│   │   ├── api.ts                     # Fetch wrapper ke FastAPI
│   │   └── utils.ts                   # Helper functions
│   ├── types/
│   │   └── index.ts                   # TypeScript types
│   ├── .env.local                     # Environment variables
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                           # FastAPI (Python)
│   ├── main.py                        # Entry point FastAPI
│   ├── requirements.txt
│   ├── .env
│   ├── database.py                    # Prisma client setup
│   ├── routers/
│   │   ├── esp32.py                   # Endpoint dari ESP32
│   │   ├── plants.py                  # CRUD tanaman
│   │   ├── images.py                  # Manajemen foto
│   │   ├── predictions.py             # Hasil prediksi
│   │   ├── alerts.py                  # Alert/notifikasi
│   │   └── training.py                # Trigger fine-tuning
│   ├── services/
│   │   ├── storage.py                 # Upload ke Supabase Storage
│   │   ├── alert_service.py           # Logic generate alert
│   │   └── ml_service.py             # Wrapper ML inference
│   ├── ml/
│   │   ├── models/
│   │   │   └── tomato_model.h5        # ← taruh hasil Colab di sini
│   │   ├── inference.py               # Load model & prediksi
│   │   ├── finetune.py                # Script fine-tuning lokal
│   │   └── label_map.py               # Mapping index → nama penyakit
│   └── prisma/
│       └── schema.prisma              # Database schema
│
├── docker/
│   ├── docker-compose.yml             # PostgreSQL untuk dev
│   └── .env.docker                    # Env vars untuk Docker
│
├── colab/
│   └── tomato_training.ipynb          # Notebook Google Colab
│
├── .env.example                       # Template semua env vars
└── README.md                          # Panduan setup project
```

---

## 5. Database Schema (Prisma)

### File: `backend/prisma/schema.prisma`

```prisma
generator client {
  provider             = "prisma-client-py"
  interface            = "asyncio"
  recursive_model_inclusion = true
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Tanaman ───────────────────────────────────────────────
model Plant {
  id          String         @id @default(cuid())
  name        String         @default("Tomat 1")
  location    String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  sensorReadings SensorReading[]
  images         PlantImage[]
  predictions    Prediction[]
  alerts         Alert[]
}

// ─── Data Sensor (dari DHT22) ──────────────────────────────
model SensorReading {
  id          String   @id @default(cuid())
  plantId     String
  temperature Float    // dalam Celcius
  humidity    Float    // dalam persen (%)
  timestamp   DateTime @default(now())

  plant       Plant    @relation(fields: [plantId], references: [id])

  @@index([plantId, timestamp])
}

// ─── Foto dari ESP32Cam ────────────────────────────────────
model PlantImage {
  id              String      @id @default(cuid())
  plantId         String
  imageUrl        String      // URL di Supabase Storage
  timestamp       DateTime    @default(now())

  // Label hasil prediksi atau konfirmasi manual
  label           ImageLabel  @default(UNKNOWN)
  confidence      Float?      // 0.0 - 1.0, hasil model CNN
  isAutoLabeled   Boolean     @default(false)  // true jika confidence > 90%
  isConfirmed     Boolean     @default(false)  // true jika dikonfirmasi user
  isTrainingData  Boolean     @default(false)  // true jika dipakai fine-tuning
  labeledAt       DateTime?

  plant           Plant       @relation(fields: [plantId], references: [id])
  predictions     Prediction[]

  @@index([plantId, timestamp])
  @@index([isConfirmed, isTrainingData])
}

enum ImageLabel {
  HEALTHY
  EARLY_DISEASE
  DISEASED
  CRITICAL
  UNKNOWN
}

// ─── Hasil Prediksi ML ─────────────────────────────────────
model Prediction {
  id              String          @id @default(cuid())
  plantId         String
  imageId         String?

  type            PredictionType
  healthStatus    ImageLabel?     // status kesehatan
  diseaseType     String?         // nama penyakit (jika ada)
  confidence      Float?          // confidence prediksi
  careRecommendation String?      // rekomendasi perawatan (Bahasa Indonesia)
  harvestEstimate String?         // estimasi panen (jika sehat)
  rawResult       Json?           // full output model (fleksibel)

  createdAt       DateTime        @default(now())

  plant           Plant           @relation(fields: [plantId], references: [id])
  image           PlantImage?     @relation(fields: [imageId], references: [id])

  @@index([plantId, createdAt])
}

enum PredictionType {
  HEALTH_STATUS         // dari foto CNN
  SENSOR_ANALYSIS       // dari data sensor saja
  COMBINED              // foto + sensor
}

// ─── Alert / Peringatan ────────────────────────────────────
model Alert {
  id          String      @id @default(cuid())
  plantId     String
  type        AlertType
  severity    AlertSeverity
  message     String      // pesan dalam Bahasa Indonesia
  isRead      Boolean     @default(false)
  createdAt   DateTime    @default(now())

  plant       Plant       @relation(fields: [plantId], references: [id])

  @@index([plantId, isRead])
}

enum AlertType {
  TEMPERATURE_HIGH      // suhu terlalu tinggi
  TEMPERATURE_LOW       // suhu terlalu rendah
  HUMIDITY_HIGH         // kelembapan terlalu tinggi
  HUMIDITY_LOW          // kelembapan terlalu rendah
  DISEASE_DETECTED      // penyakit terdeteksi
  CRITICAL_CONDITION    // kondisi kritis
  REVIEW_NEEDED         // foto perlu review manual
}

enum AlertSeverity {
  INFO
  WARNING
  CRITICAL
}

// ─── Log Fine-tuning ───────────────────────────────────────
model FineTuneLog {
  id              String    @id @default(cuid())
  startedAt       DateTime  @default(now())
  finishedAt      DateTime?
  photosUsed      Int       // jumlah foto yang dipakai
  oldAccuracy     Float?    // akurasi model lama
  newAccuracy     Float?    // akurasi model baru
  isModelReplaced Boolean   @default(false)
  notes           String?
}
```

---

## 6. Docker Setup (Dev)

### File: `docker/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: tomatohealth_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### File: `docker/.env.docker`

```env
POSTGRES_USER=tomatohealth
POSTGRES_PASSWORD=rahasia123
POSTGRES_DB=tomatohealth_dev
```

### DATABASE_URL untuk Prisma (di `backend/.env`):

```env
# Dev (Docker)
DATABASE_URL="postgresql://tomatohealth:rahasia123@localhost:5432/tomatohealth_dev"

# Production (Supabase) — ganti saat migrasi
# DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
```

### Perintah Docker:

```bash
# Pertama kali setup
cd docker
docker compose --env-file .env.docker up -d

# Cek status
docker compose ps

# Lihat log
docker compose logs postgres

# Stop
docker compose down

# Reset database (hapus semua data)
docker compose down -v
docker compose up -d
```

---

## 7. Machine Learning Pipeline

### 7.1 Training Awal (Google Colab)

**Dataset:** PlantVillage dari Kaggle
- 9 kelas penyakit tomat
- ~18.000 foto

**Arsitektur Model:**
```
Input (224 x 224 x 3)
    ↓
MobileNetV2 (pretrained ImageNet, frozen layers)
    ↓
GlobalAveragePooling2D
    ↓
Dense(256, activation='relu')
    ↓
Dropout(0.5)
    ↓
Dense(9, activation='softmax')   ← 9 kelas penyakit
    ↓
Output: probabilitas setiap kelas
```

**Kelas yang dideteksi:**
```python
LABEL_MAP = {
    0: "Sehat",
    1: "Bercak Daun Awal (Early Blight)",
    2: "Bercak Daun Akhir (Late Blight)",
    3: "Jamur Daun (Leaf Mold)",
    4: "Bercak Septoria (Septoria Leaf Spot)",
    5: "Tungau Laba-laba (Spider Mites)",
    6: "Bercak Target (Target Spot)",
    7: "Virus Keriting Kuning (Yellow Leaf Curl Virus)",
    8: "Virus Mosaik (Mosaic Virus)",
}
```

**Alur di Google Colab:**
1. Install kaggle API → download PlantVillage
2. Filter hanya folder `Tomato_*`
3. Split: 80% train / 10% validation / 10% test
4. Augmentasi: flip horizontal, rotate ±20°, zoom 20%, brightness
5. Load MobileNetV2 tanpa top layer, freeze semua layer
6. Tambah custom classifier di atas
7. Train tahap 1: hanya classifier (5 epoch)
8. Unfreeze 30 layer terakhir MobileNetV2
9. Train tahap 2: fine-tune dengan learning rate kecil (10 epoch)
10. Evaluasi: accuracy, confusion matrix
11. Export ke `tomato_model.h5`
12. Download ke laptop → taruh di `backend/ml/models/`

### 7.2 ML Inference (FastAPI)

**File: `backend/ml/inference.py`**

```python
# Pseudocode alur inference
def predict(image_bytes):
    # 1. Decode foto → resize ke 224x224
    # 2. Normalisasi pixel (0-1)
    # 3. Tambah dimensi batch
    # 4. model.predict()
    # 5. Ambil kelas dengan probabilitas tertinggi
    # 6. Map ke label dalam Bahasa Indonesia
    # 7. Generate rekomendasi perawatan berdasarkan kelas
    # 8. Jika sehat → generate estimasi panen
    # 9. Return hasil lengkap
    return {
        "health_status": "HEALTHY" | "EARLY_DISEASE" | "DISEASED" | "CRITICAL",
        "disease_type": "nama penyakit" | None,
        "confidence": 0.95,  # 0.0 - 1.0
        "care_recommendation": "Siram tanaman 2x sehari...",
        "harvest_estimate": "Estimasi panen 3-4 minggu lagi",
        "label_index": 0,
        "all_probabilities": [0.95, 0.02, 0.01, ...]
    }
```

**Mapping health_status berdasarkan kelas:**
```
Kelas 0 (Sehat)           → HEALTHY
Kelas 1-2 (Awal penyakit) → EARLY_DISEASE
Kelas 3-6 (Penyakit aktif)→ DISEASED
Kelas 7-8 (Virus)         → CRITICAL
```

**Auto-label logic:**
```
confidence >= 0.90 → isAutoLabeled = true, isTrainingData = true
confidence < 0.90  → isConfirmed = false, perlu review manual
                      → buat Alert: REVIEW_NEEDED
```

### 7.3 Rekomendasi Perawatan

Setiap kelas penyakit punya rekomendasi statis dalam Bahasa Indonesia:

```python
CARE_RECOMMENDATIONS = {
    "HEALTHY": "Tanaman dalam kondisi baik. Lanjutkan penyiraman rutin 2x sehari...",
    "EARLY_DISEASE": "Terdeteksi gejala awal penyakit. Segera periksa daun...",
    "DISEASED": "Penyakit sudah menyebar. Pisahkan tanaman dari yang lain...",
    "CRITICAL": "Kondisi kritis terdeteksi. Tanaman membutuhkan perhatian segera...",
}
```

### 7.4 Estimasi Panen

Hanya dihasilkan jika status HEALTHY, berdasarkan logika sederhana:

```python
# Estimasi panen berdasarkan suhu dan kelembapan optimal
if health_status == "HEALTHY":
    if 20 <= temperature <= 30 and 60 <= humidity <= 80:
        return "Kondisi optimal. Estimasi panen 3-4 minggu lagi."
    elif temperature > 30:
        return "Suhu terlalu tinggi, panen mungkin tertunda."
    else:
        return "Estimasi panen 4-6 minggu lagi."
```

---

## 8. Backend FastAPI

### Semua Endpoint

#### ESP32 Endpoints

```
POST /api/esp32/sensor
  Body: { plantId, temperature, humidity, timestamp? }
  Action:
    - Simpan SensorReading ke DB
    - Cek threshold alert:
        suhu > 35°C atau < 15°C → buat Alert TEMPERATURE_HIGH/LOW
        kelembapan < 40% atau > 85% → buat Alert HUMIDITY_HIGH/LOW
  Response: { success: true, alertCreated: boolean }

POST /api/esp32/image
  Body: multipart/form-data (foto + plantId)
  Action:
    - Upload foto ke Supabase Storage
    - Jalankan CNN inference
    - Simpan PlantImage ke DB
    - Jika confidence >= 0.90 → auto-label
    - Jika confidence < 0.90 → tandai perlu review, buat Alert REVIEW_NEEDED
    - Jika DISEASED/CRITICAL → buat Alert DISEASE_DETECTED/CRITICAL_CONDITION
    - Simpan Prediction ke DB
  Response: { success: true, prediction: {...}, needsReview: boolean }
```

#### Plant Endpoints

```
GET  /api/plants                    → list semua tanaman
POST /api/plants                    → buat tanaman baru
GET  /api/plants/{id}               → detail tanaman
GET  /api/plants/{id}/dashboard     → data lengkap untuk dashboard
GET  /api/plants/{id}/sensor-history?range=24h|7d|30d → riwayat sensor
```

#### Image Endpoints

```
GET  /api/images?plantId=&limit=    → list foto
GET  /api/images/pending-review     → foto yang perlu konfirmasi
PATCH /api/images/{id}/confirm      → konfirmasi label manual
  Body: { label: "HEALTHY" | "EARLY_DISEASE" | "DISEASED" | "CRITICAL" }
  Action: set isConfirmed=true, isTrainingData=true, labeledAt=now()
```

#### Alert Endpoints

```
GET  /api/alerts?plantId=&unreadOnly=true → list alert
PATCH /api/alerts/{id}/read              → tandai sudah dibaca
POST /api/alerts/mark-all-read           → tandai semua sudah dibaca
```

#### Training Endpoints

```
GET  /api/training/status           → jumlah foto training yang tersedia
POST /api/training/finetune         → trigger fine-tuning lokal
  Action: jalankan finetune.py sebagai subprocess
  Response: { started: true, photosCount: 45 }
GET  /api/training/logs             → riwayat fine-tuning
```

#### Prediction Endpoints

```
GET /api/predictions?plantId=&limit= → riwayat prediksi
GET /api/predictions/latest          → prediksi terbaru
```

### Alert Thresholds (bisa dikonfigurasi via .env)

```env
ALERT_TEMP_MAX=35        # suhu maksimal (°C)
ALERT_TEMP_MIN=15        # suhu minimal (°C)
ALERT_HUMIDITY_MAX=85    # kelembapan maksimal (%)
ALERT_HUMIDITY_MIN=40    # kelembapan minimal (%)
CONFIDENCE_THRESHOLD=0.90  # batas auto-label
MIN_PHOTOS_FINETUNE=20   # minimal foto untuk fine-tuning
```

### main.py (struktur dasar)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from ml.inference import load_model

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model saat startup
    load_model()
    yield
    # Cleanup saat shutdown

app = FastAPI(title="TomatoHealth API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",          # dev
        "https://tomatohealth.vercel.app" # production
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include semua routers
app.include_router(esp32.router, prefix="/api/esp32")
app.include_router(plants.router, prefix="/api/plants")
app.include_router(images.router, prefix="/api/images")
app.include_router(alerts.router, prefix="/api/alerts")
app.include_router(training.router, prefix="/api/training")
app.include_router(predictions.router, prefix="/api/predictions")
```

### requirements.txt

```
fastapi==0.110.0
uvicorn[standard]==0.27.0
prisma==0.13.1
python-multipart==0.0.9
python-dotenv==1.0.1
supabase==2.3.4
tensorflow==2.15.0
Pillow==10.2.0
numpy==1.26.4
httpx==0.27.0
```

---

## 9. Frontend Next.js

### Halaman & Komponen

#### `/dashboard`
- **HealthStatusCard** — card besar di tengah, warna berubah berdasarkan status:
  - HEALTHY → hijau
  - EARLY_DISEASE → kuning
  - DISEASED → oranye
  - CRITICAL → merah
- **SensorCard** — dua card: suhu dan kelembapan, dengan indikator normal/abnormal
- **LatestImageCard** — foto terbaru dari ESP32Cam
- **AlertBanner** — muncul di atas jika ada alert yang belum dibaca
- Auto-refresh setiap 60 detik (polling)

#### `/history`
- **SensorChart** — grafik garis suhu & kelembapan (pilih range: 24 jam, 7 hari, 30 hari)
- **ImageHistoryGrid** — grid foto dengan badge label dan confidence score
- **PredictionTimeline** — timeline prediksi dari waktu ke waktu

#### `/predictions`
- Kartu prediksi terbaru yang berisi:
  - Status kesehatan + badge warna
  - Confidence score (progress bar)
  - Jenis penyakit (jika ada)
  - Rekomendasi perawatan (kotak teks)
  - Estimasi panen (jika sehat)

#### `/review`
- Counter "X foto menunggu konfirmasi"
- Satu foto ditampilkan besar di tengah
- Di bawah foto: prediksi model + confidence
- Tombol: `✅ Sehat` | `🌿 Penyakit Awal` | `🔴 Sakit` | `⚠️ Kritis` | `⏭️ Skip`
- Setelah semua dikonfirmasi: tombol `🔄 Jalankan Fine-tuning`

#### `/settings`
- Info model: versi, akurasi, tanggal training terakhir
- Status ESP32: kapan terakhir kirim data
- Threshold alert: form untuk ubah batas suhu & kelembapan
- Tombol manual trigger fine-tuning
- Riwayat fine-tuning (tabel log)

### Desain & Tema

- **Tema:** Agritech Modern — natural, bersih, fungsional
- **Warna:**
  - Primary: `#2D6A4F` (hijau tomat)
  - Accent: `#E63946` (merah tomat)
  - Background: `#F8F5F0` (krem/earth tone)
  - Card: `#FFFFFF`
- **Font:** Pilih font yang karakterful dan readable untuk dashboard data
- **Sidebar:** Navigasi vertikal di kiri, ikon + label
- **Responsif:** Mobile-friendly (untuk cek dari ponsel di kebun)

### API Client (`lib/api.ts`)

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = {
  getDashboard: (plantId: string) =>
    fetch(`${BASE_URL}/api/plants/${plantId}/dashboard`).then(r => r.json()),

  getSensorHistory: (plantId: string, range: string) =>
    fetch(`${BASE_URL}/api/plants/${plantId}/sensor-history?range=${range}`).then(r => r.json()),

  getPendingReview: () =>
    fetch(`${BASE_URL}/api/images/pending-review`).then(r => r.json()),

  confirmLabel: (imageId: string, label: string) =>
    fetch(`${BASE_URL}/api/images/${imageId}/confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label })
    }).then(r => r.json()),

  triggerFinetune: () =>
    fetch(`${BASE_URL}/api/training/finetune`, { method: "POST" }).then(r => r.json()),

  getAlerts: (plantId: string) =>
    fetch(`${BASE_URL}/api/alerts?plantId=${plantId}&unreadOnly=true`).then(r => r.json()),
}
```

---

## 10. ESP32 Code

### Konfigurasi (bagian atas sketch)

```cpp
// ─── Konfigurasi WiFi ───────────────────────────────────
const char* WIFI_SSID     = "nama_wifi_kamu";
const char* WIFI_PASSWORD = "password_wifi";

// ─── Konfigurasi Server ─────────────────────────────────
// Dev: IP laptop kamu (cek dengan ipconfig/ifconfig)
// Production: URL Railway kamu
const char* SERVER_URL = "http://192.168.1.10:8000";
const char* PLANT_ID   = "clxxxxxxxxxxxxx";  // ID tanaman dari database

// ─── Interval Pengiriman ────────────────────────────────
const int INTERVAL_MINUTES = 10;  // kirim data setiap 10 menit

// ─── Pin Sensor DHT22 ───────────────────────────────────
const int DHT_PIN = 13;
```

### Alur Program

```
Setup:
  1. Inisialisasi Serial Monitor (115200 baud)
  2. Inisialisasi kamera ESP32-CAM
  3. Inisialisasi DHT22
  4. Connect ke WiFi (retry sampai berhasil)
  5. Print IP address ke Serial Monitor

Loop (setiap INTERVAL_MINUTES):
  1. Baca suhu & kelembapan dari DHT22
  2. Jika bacaan valid:
     POST /api/esp32/sensor dengan data sensor
  3. Ambil foto dari kamera
  4. Jika foto berhasil:
     POST /api/esp32/image dengan foto + plantId
  5. Print response ke Serial Monitor
  6. Delay INTERVAL_MINUTES menit
```

### Error Handling ESP32

```
WiFi disconnect     → reconnect otomatis sebelum kirim data
DHT22 error         → skip pengiriman sensor, lanjut ke foto
Foto gagal          → kirim sensor saja, skip foto
Server error (5xx)  → print error ke Serial, lanjut ke interval berikutnya
Server unreachable  → print error ke Serial, lanjut ke interval berikutnya
```

### Library yang Dibutuhkan (Arduino IDE)

```
- ESP32 board package (via Board Manager)
- DHT sensor library (by Adafruit)
- ArduinoJson (by Benoit Blanchon)
- ESP32 kamera library (sudah built-in di ESP32 board package)
```

---

## 11. Environment Variables

### `backend/.env`

```env
# Database
DATABASE_URL="postgresql://tomatohealth:rahasia123@localhost:5432/tomatohealth_dev"

# Supabase
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_KEY="eyJ..."          # service role key (untuk storage upload)

# ML Model
MODEL_PATH="ml/models/tomato_model.h5"
CONFIDENCE_THRESHOLD=0.90

# Alert Thresholds
ALERT_TEMP_MAX=35
ALERT_TEMP_MIN=15
ALERT_HUMIDITY_MAX=85
ALERT_HUMIDITY_MIN=40

# Fine-tuning
MIN_PHOTOS_FINETUNE=20
FINETUNE_EPOCHS=10
FINETUNE_BATCH_SIZE=8

# App
DEFAULT_PLANT_ID="clxxxxxxxxxxxxx"
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL="http://localhost:8000"   # dev
# NEXT_PUBLIC_API_URL="https://api.railway.app" # production
NEXT_PUBLIC_DEFAULT_PLANT_ID="clxxxxxxxxxxxxx"
```

---

## 12. Alur Fine-tuning Lokal

### Kapan Fine-tuning Dijalankan?

```
Kondisi untuk bisa fine-tuning:
  - Minimal 20 foto sudah dikonfirmasi (isTrainingData = true)
  - Bisa dipicu dari:
      a. Tombol manual di halaman /settings atau /review
      b. POST /api/training/finetune dari frontend
```

### Alur Fine-tuning (`backend/ml/finetune.py`)

```
1. Ambil semua foto dengan isTrainingData=true dari database
2. Download foto dari Supabase Storage ke folder temp lokal
3. Preprocessing: resize 224x224, normalisasi
4. Load model lama: tomato_model.h5
5. Freeze semua layer kecuali 3 layer terakhir
6. Compile dengan learning rate sangat kecil (1e-5)
7. Train dengan data baru (FINETUNE_EPOCHS epochs)
8. Evaluasi model baru vs model lama pada validation set
9. Jika model baru accuracy >= model lama:
     - Backup model lama: tomato_model_backup.h5
     - Replace: tomato_model.h5 ← model baru
     - Reload model di FastAPI
     - Catat ke FineTuneLog (isModelReplaced=true)
10. Jika model baru lebih buruk:
     - Keep model lama
     - Catat ke FineTuneLog (isModelReplaced=false)
     - Return warning ke frontend
11. Hapus file temp
```

### Halaman Review di Website

```
┌─────────────────────────────────────────────┐
│  📸 Review Foto — 5 foto menunggu konfirmasi │
├─────────────────────────────────────────────┤
│                                             │
│        [Foto besar dari ESP32Cam]           │
│                                             │
│  Prediksi model: Bercak Daun Awal           │
│  Confidence:     ████████░░ 78%             │
│                                             │
│  [✅ Sehat] [🌿 Penyakit Awal] [🔴 Sakit]  │
│             [⚠️ Kritis]  [⏭️ Skip]          │
│                                             │
│  Progress: 3 / 5 foto                       │
└─────────────────────────────────────────────┘

Setelah semua selesai:
┌─────────────────────────────────────────────┐
│  ✅ Semua foto sudah dikonfirmasi!           │
│  Total foto training: 47                    │
│                                             │
│       [🔄 Jalankan Fine-tuning]             │
└─────────────────────────────────────────────┘
```

---

## 13. Migrasi Docker → Supabase

### Langkah-langkah

```
Step 1: Buat project baru di supabase.com
  → Catat: URL project & service role key

Step 2: Export data dari Docker (opsional jika ada data dev yang ingin disimpan)
  docker exec tomatohealth_db pg_dump -U tomatohealth tomatohealth_dev > backup.sql

Step 3: Update DATABASE_URL di backend/.env
  Ganti: postgresql://tomatohealth:...@localhost:5432/...
  Dengan: postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

Step 4: Jalankan Prisma migration ke Supabase
  cd backend
  prisma migrate deploy

Step 5: Import data lama (opsional)
  psql [supabase-connection-string] < backup.sql

Step 6: Setup Supabase Storage
  → Buat bucket: "plant-images"
  → Set bucket visibility: public (agar URL foto bisa diakses langsung)

Step 7: Update SUPABASE_URL dan SUPABASE_SERVICE_KEY di .env

Step 8: Test koneksi
  → Jalankan backend
  → Cek endpoint GET /api/plants
  → Pastikan data tampil dari Supabase

Step 9: Matikan Docker (tidak diperlukan lagi)
  docker compose down
```

---

## 14. Deployment

### Frontend → Vercel

```
1. Push project ke GitHub
2. Login ke vercel.com → Import repository
3. Framework preset: Next.js (auto-detect)
4. Set environment variables:
   NEXT_PUBLIC_API_URL = https://[nama-app].railway.app
   NEXT_PUBLIC_DEFAULT_PLANT_ID = [plant id]
5. Deploy → dapat URL: https://tomatohealth.vercel.app
```

### Backend → Railway

```
1. Login ke railway.app → New Project → Deploy from GitHub
2. Pilih folder backend/
3. Set environment variables (semua dari backend/.env production)
4. Railway otomatis detect Python → jalankan: uvicorn main:app
5. Dapat URL: https://[nama-app].railway.app
6. Update CORS di main.py dengan URL Vercel
```

### Update ESP32 setelah Deploy

```cpp
// Ganti dari:
const char* SERVER_URL = "http://192.168.1.10:8000";
// Menjadi:
const char* SERVER_URL = "https://[nama-app].railway.app";
// Re-upload sketch ke ESP32
```

### Checklist Deployment

```
□ Model tomato_model.h5 sudah ada di backend/ml/models/
□ Database sudah migrasi ke Supabase
□ Supabase Storage bucket "plant-images" sudah dibuat
□ Backend sudah di-deploy ke Railway
□ Environment variables Railway sudah lengkap
□ Frontend sudah di-deploy ke Vercel
□ NEXT_PUBLIC_API_URL di Vercel sudah diisi URL Railway
□ CORS di FastAPI sudah include URL Vercel
□ Test: kirim data sensor manual (via curl/Postman)
□ Test: buka dashboard → data muncul
□ Update SERVER_URL di kode ESP32 → upload ulang
□ Test end-to-end: ESP32 kirim → dashboard tampil
```

---

## 15. Urutan Pengerjaan

Ikuti urutan ini agar tidak ada dependency yang hilang:

```
MINGGU 1 — Fondasi
  ✅ Setup struktur folder project
  ✅ Setup Docker + jalankan PostgreSQL
  ✅ Buat Prisma schema & run migration pertama
  ✅ Setup FastAPI dasar (main.py + CORS)
  ✅ Setup Next.js 14 + Tailwind + struktur halaman

MINGGU 2 — Machine Learning
  ✅ Buka Google Colab
  ✅ Download dataset PlantVillage dari Kaggle
  ✅ Train model CNN (MobileNetV2)
  ✅ Export tomato_model.h5
  ✅ Download & taruh di backend/ml/models/

MINGGU 3 — Backend
  ✅ Buat ml/inference.py (load model + predict)
  ✅ Buat router esp32.py (endpoint sensor & foto)
  ✅ Integrate inference ke endpoint foto
  ✅ Buat alert_service.py
  ✅ Buat semua router lainnya (plants, images, alerts, predictions)
  ✅ Test semua endpoint dengan Postman/curl

MINGGU 4 — Frontend
  ✅ Buat layout + sidebar navigasi
  ✅ Buat halaman /dashboard
  ✅ Buat halaman /history + grafik sensor
  ✅ Buat halaman /predictions
  ✅ Buat halaman /review
  ✅ Buat halaman /settings

MINGGU 5 — ESP32 & Integrasi
  ✅ Tulis kode Arduino ESP32
  ✅ Test kirim data sensor ke backend lokal
  ✅ Test kirim foto ke backend lokal
  ✅ Verifikasi data muncul di dashboard

MINGGU 6 — Fine-tuning & Deployment
  ✅ Buat finetune.py
  ✅ Kumpulkan foto dari ESP32Cam (minimal 20 foto)
  ✅ Konfirmasi foto di halaman /review
  ✅ Test fine-tuning lokal
  ✅ Migrasi database ke Supabase
  ✅ Deploy backend ke Railway
  ✅ Deploy frontend ke Vercel
  ✅ Update ESP32 dengan URL production
  ✅ Test end-to-end
```

---

*Plan ini dibuat berdasarkan diskusi lengkap tentang project TomatoHealth AI.*
*Versi: 1.0 — Single plant, Single user, CNN + HTTP.*