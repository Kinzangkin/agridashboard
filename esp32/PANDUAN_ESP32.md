# Panduan Menghubungkan ESP32 ke TomatoHealth AI

## Arsitektur Sistem

```
┌──────────────┐      WiFi (HTTP POST)     ┌──────────────┐      PostgreSQL       ┌──────────┐
│   ESP32      │  ──────────────────────►   │  FastAPI     │  ──────────────────►  │ Supabase │
│ DHT11 + Soil │    JSON setiap 5 detik    │  Backend     │    Prisma ORM        │ Database │
└──────────────┘                           └──────────────┘                      └──────────┘
                                                  ▲
                                                  │ HTTP GET
                                           ┌──────────────┐
                                           │   Next.js    │
                                           │  Dashboard   │
                                           └──────────────┘
```

## 1. Wiring / Rangkaian

### Komponen yang Dibutuhkan
| No | Komponen | Jumlah |
|---|---|---|
| 1 | ESP32 DevKit V1 | 1 |
| 2 | Sensor DHT11 | 1 |
| 3 | Sensor Soil Moisture v1.2 | 1 |
| 4 | Kabel Jumper | Secukupnya |
| 5 | Breadboard | 1 |

### Skema Wiring

```
ESP32               DHT11
─────               ─────
GPIO 4  ◄────────── DATA
3.3V    ◄────────── VCC
GND     ◄────────── GND

ESP32               Soil Moisture v1.2
─────               ──────────────────
GPIO 34 ◄────────── AO (Analog Output)
3.3V    ◄────────── VCC
GND     ◄────────── GND
```

> ⚠️ **Penting:** GPIO 34 adalah pin ADC1. Jangan gunakan pin ADC2 (GPIO 0, 2, 4, 12-15, 25-27) karena konflik dengan WiFi.

## 2. Setup Arduino IDE

### Install Board ESP32
1. Buka **Arduino IDE** → **File** → **Preferences**
2. Di kolom **Additional Board Manager URLs**, tambahkan:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Tools** → **Board** → **Boards Manager** → Cari **"esp32"** → **Install**

### Install Library
1. **Sketch** → **Include Library** → **Manage Libraries**
2. Cari dan install:
   - **DHT sensor library** (by Adafruit)
   - **Adafruit Unified Sensor** (dependency DHT)

### Pilih Board
- **Tools** → **Board** → **ESP32 Dev Module**
- **Tools** → **Port** → Pilih port COM ESP32 Anda

## 3. Konfigurasi Kode ESP32

Buka file `sensor_wifi.ino` dan ubah 3 hal berikut:

### a. WiFi Credentials
```cpp
const char* WIFI_SSID     = "NAMA_WIFI_ANDA";      // ← Ganti
const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA";   // ← Ganti
```

### b. IP Address Komputer
Cari IP komputer Anda:
- Buka **CMD** → ketik `ipconfig`
- Cari **IPv4 Address** (biasanya `192.168.x.x`)

```cpp
const char* API_URL = "http://192.168.1.100:8000/api/sensor";
//                      ^^^^^^^^^^^^^^^^^ Ganti dengan IP Anda
```

### c. Interval Pengiriman (Opsional)
```cpp
const unsigned long SEND_INTERVAL = 5000;  // 5000ms = 5 detik
```

## 4. Cara Menjalankan

### Langkah 1: Pastikan Backend Berjalan
```bash
# Di terminal, dari folder backend/
source venv/Scripts/activate   # Git Bash
uvicorn main:app --reload --host 0.0.0.0
```
> **Penting:** Gunakan `--host 0.0.0.0` agar backend bisa diakses dari ESP32 di jaringan yang sama.

### Langkah 2: Upload Kode ke ESP32
1. Buka `sensor_wifi.ino` di Arduino IDE
2. Klik **Upload** (→)
3. Buka **Serial Monitor** (baud rate: 115200)

### Langkah 3: Cek Output
Jika berhasil, Serial Monitor akan menampilkan:
```
========================================
  TomatoHealth AI - ESP32 Sensor
========================================
📡 Menghubungkan ke WiFi: NAMA_WIFI
✅ WiFi Terhubung!
   IP Address: 192.168.1.50
------------------------------------
🌡️  Suhu: 28.0°C
💧 Kelembapan Udara: 65.0%
🌱 Kelembapan Tanah: 45.0% (raw: 2650)
📤 Mengirim ke server: {"temperature":28.0,"humidity":65.0,"soilMoisture":45.0}
✅ Response (200): {"success":true,"message":"Data sensor berhasil disimpan",...}
```

## 5. API Endpoint Reference

### POST `/api/sensor` — Kirim Data Sensor
**Request (JSON):**
```json
{
  "temperature": 28.5,
  "humidity": 65.0,
  "soilMoisture": 45.0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data sensor berhasil disimpan",
  "data": {
    "id": "uuid-here",
    "temperature": 28.5,
    "humidity": 65.0,
    "soilMoisture": 45.0,
    "plantId": "default-plant-uuid",
    "createdAt": "2026-05-06T23:00:00"
  },
  "alerts": []
}
```

### GET `/api/sensor` — Ambil Data Sensor
```
GET http://localhost:8000/api/sensor?limit=50
```

### GET `/api/alerts` — Ambil Alert
```
GET http://localhost:8000/api/alerts?limit=20
```

## 6. Troubleshooting

| Masalah | Solusi |
|---|---|
| `WiFi tidak terhubung` | Cek SSID & password. Pastikan ESP32 dalam jangkauan WiFi. |
| `Error mengirim data (-1)` | Cek IP komputer sudah benar. Pastikan backend pakai `--host 0.0.0.0`. |
| `Gagal membaca DHT11` | Cek wiring. Coba tambahkan resistor pull-up 10kΩ antara DATA dan VCC. |
| `Soil Moisture selalu 0 atau 100` | Kalibrasi ulang nilai `map()` di kode. Cek pin 34 terhubung ke AO. |
| `Connection refused` | Firewall mungkin memblokir port 8000. Matikan firewall sementara untuk test. |
