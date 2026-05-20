/*
 * ====================================================================
 * TomatoHealth AI — ESP32 Sensor Node
 * ====================================================================
 * 
 * DESKRIPSI:
 *   Kode ini digunakan untuk ESP32 biasa (BUKAN ESP32-CAM).
 *   ESP32 bertugas membaca sensor DHT11 dan Soil Moisture, lalu
 *   mengirim data ke backend FastAPI via HTTP POST (JSON).
 * 
 *   Kamera/Webcam ditangani TERPISAH oleh:
 *   - Browser Webcam  → langsung di halaman Predictions website
 *   - USB Webcam      → melalui script backend/webcam_uploader.py
 *
 * KOMPONEN YANG DIBUTUHKAN:
 *   - ESP32 DevKit V1 (atau kompatibel)
 *   - Sensor DHT11
 *   - Sensor Soil Moisture v1.2
 * 
 * WIRING:
 *   DHT11:
 *     DATA  → GPIO 4
 *     VCC   → 3.3V
 *     GND   → GND
 * 
 *   Soil Moisture:
 *     AO    → GPIO 34 (ADC1 — hindari GPIO ADC2 saat WiFi aktif!)
 *     VCC   → 3.3V
 *     GND   → GND
 * 
 * LIBRARY YANG DIBUTUHKAN (Install via Library Manager):
 *   - DHT sensor library (by Adafruit)
 *   - Adafruit Unified Sensor (dependency DHT)
 * 
 * BOARD SETTINGS (Arduino IDE):
 *   Board  : ESP32 Dev Module
 *   Port   : COMx (sesuai PC Anda)
 *   Baud   : 115200
 * 
 * ====================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

// ====================================================================
// ⚙️  KONFIGURASI — WAJIB DISESUAIKAN
// ====================================================================

// 1. Kredensial WiFi Anda
const char* WIFI_SSID     = "NAMA_WIFI_ANDA";       // ← Ganti ini
const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA";   // ← Ganti ini

// 2. IP komputer yang menjalankan backend FastAPI.
//    Buka CMD → ketik "ipconfig" → cari IPv4 Address Anda.
//    Pastikan laptop & ESP32 dalam 1 jaringan WiFi yang sama!
const char* API_URL = "http://192.168.1.100:8000/api/sensor"; // ← Ganti IP-nya

// 3. Interval pengiriman data (dalam milidetik)
const unsigned long SEND_INTERVAL = 10000; // 10 detik (rekomendasi: jangan < 5000)

// ====================================================================
// 📌  DEFINISI PIN
// ====================================================================
#define DHTPIN    4       // Pin DATA DHT11 → GPIO 4
#define DHTTYPE   DHT11   // Jenis sensor: DHT11
#define SOILPIN   34      // Pin Analog Soil Moisture → GPIO 34 (ADC1)

// Kalibrasi Soil Moisture
// Sesuaikan nilai ini dengan sensor Anda:
//   - Sensor di udara kering   → catat nilai ADC (biasanya ~4095)
//   - Sensor dicelup air penuh → catat nilai ADC (biasanya ~1200)
#define SOIL_DRY    3200  // ← Nilai ADC saat tanah KERING
#define SOIL_WET    1200  // ← Nilai ADC saat tanah BASAH

// ====================================================================
// 🔧  OBJEK SENSOR & VARIABEL GLOBAL
// ====================================================================
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastSendTime = 0;
int retryCount = 0;
const int MAX_WIFI_RETRY = 20;

// ====================================================================
// 🛠️  FUNGSI BANTU
// ====================================================================

/**
 * Konversi nilai ADC Soil Moisture (0-4095) ke persentase kelembapan (0-100%).
 * Nilai tinggi ADC = kering, nilai rendah ADC = basah.
 */
float soilToPercent(int rawValue) {
  float percent = (float)(SOIL_DRY - rawValue) / (float)(SOIL_DRY - SOIL_WET) * 100.0;
  if (percent < 0.0) percent = 0.0;
  if (percent > 100.0) percent = 100.0;
  return percent;
}

/**
 * Hubungkan ke WiFi dengan timeout dan notifikasi Serial.
 */
bool connectWifi() {
  Serial.print("\n[WiFi] Menghubungkan ke: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < MAX_WIFI_RETRY) {
    delay(500);
    Serial.print(".");
    attempt++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] ✅ Berhasil Terhubung!");
    Serial.print("[WiFi] IP Address ESP32: ");
    Serial.println(WiFi.localIP());
    return true;
  } else {
    Serial.println("\n[WiFi] ❌ Gagal terhubung. Cek SSID/Password.");
    return false;
  }
}

// ====================================================================
// 🚀  SETUP
// ====================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n========================================");
  Serial.println("  TomatoHealth AI — ESP32 Sensor Node");
  Serial.println("========================================");

  // Inisialisasi DHT11
  dht.begin();
  Serial.println("[INIT] Sensor DHT11 diinisialisasi.");
  Serial.print("[INIT] Soil Moisture Pin: GPIO ");
  Serial.println(SOILPIN);

  // Hubungkan ke WiFi
  connectWifi();

  Serial.println("[INIT] Siap mengirim data ke server!");
  Serial.println("----------------------------------------");
}

// ====================================================================
// 🔄  LOOP UTAMA
// ====================================================================
void loop() {
  unsigned long now = millis();
  
  // Cek interval waktu
  if (now - lastSendTime < SEND_INTERVAL) {
    return; // Belum waktunya kirim
  }
  lastSendTime = now;

  // ─── Cek Koneksi WiFi ───
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WiFi] Koneksi terputus. Menyambung ulang...");
    connectWifi();
    return;
  }

  // ─── Baca Sensor DHT11 ───
  float humidity    = dht.readHumidity();
  float temperature = dht.readTemperature(); // Celsius

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("[ERROR] Gagal membaca DHT11! Cek kabel DATA di GPIO 4.");
    return;
  }

  // ─── Baca Soil Moisture ───
  int soilRaw = analogRead(SOILPIN);
  float soilPercent = soilToPercent(soilRaw);

  // ─── Tampilkan Data di Serial Monitor ───
  Serial.println("------------------------------------");
  Serial.print("[SENSOR] 🌡️  Suhu        : "); Serial.print(temperature, 1); Serial.println(" °C");
  Serial.print("[SENSOR] 💧 Kelembapan  : "); Serial.print(humidity, 1);    Serial.println(" %");
  Serial.print("[SENSOR] 🌱 Tanah (raw) : "); Serial.println(soilRaw);
  Serial.print("[SENSOR] 🌱 Tanah (%)   : "); Serial.print(soilPercent, 1); Serial.println(" %");

  // ─── Buat JSON Payload ───
  // Format: {"temperature": 28.5, "humidity": 65.0, "soilMoisture": 45.2}
  String jsonPayload = "{";
  jsonPayload += "\"temperature\":"  + String(temperature, 1) + ",";
  jsonPayload += "\"humidity\":"     + String(humidity, 1)    + ",";
  jsonPayload += "\"soilMoisture\":" + String(soilPercent, 1);
  jsonPayload += "}";

  Serial.print("[HTTP]  📤 Mengirim ke: "); Serial.println(API_URL);
  Serial.print("[HTTP]  📦 Payload: ");     Serial.println(jsonPayload);

  // ─── HTTP POST ke Backend FastAPI ───
  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000); // Timeout 8 detik

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    String response = http.getString();
    if (httpCode == 200 || httpCode == 201) {
      Serial.println("[HTTP]  ✅ Berhasil! Response:");
      Serial.println(response);
    } else {
      Serial.print("[HTTP]  ⚠️  HTTP Code: "); Serial.println(httpCode);
      Serial.println(response);
    }
  } else {
    Serial.print("[HTTP]  ❌ Gagal! Error: ");
    Serial.println(http.errorToString(httpCode).c_str());
    Serial.println("TIPS: Pastikan backend berjalan dengan --host 0.0.0.0");
    Serial.println("      Contoh: uvicorn main:app --reload --host 0.0.0.0");
  }

  http.end();
}
