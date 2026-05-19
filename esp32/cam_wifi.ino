#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// ===========================
// PENGATURAN WIFI & SERVER
// ===========================
const char* WIFI_SSID     = "ABCDE";       // Ganti dengan SSID WiFi Anda
const char* WIFI_PASSWORD = "12345678";    // Ganti dengan Password WiFi Anda

// Ganti IP sesuai dengan IP komputer Anda (jalankan ipconfig di CMD)
const char* SERVER_URL    = "http://10.86.100.196:8000/api/upload";

// ===========================
// KONFIGURASI PIN ESP32-CAM
// (Model AI-THINKER)
// ===========================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Variabel untuk menyimpan data sensor (jika tidak ada sensor fisik, gunakan dummy)
float temperature = 28.5;
float humidity = 65.0;

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  // 1. Konfigurasi Kamera
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Ukuran gambar (pilih yang sesuai, backend akan resize ke 224x224)
  if(psramFound()){
    config.frame_size = FRAMESIZE_QVGA; // 320x240
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_CIF;  // 400x296
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Inisialisasi Kamera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Gagal inisialisasi kamera dengan error 0x%x", err);
    return;
  }

  // 2. Hubungkan ke WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan ke WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Terhubung!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    sendPhotoToServer();
  }
  
  // Ambil gambar setiap 10 detik (atau sesuaikan kebutuhan)
  delay(10000);
}

void sendPhotoToServer() {
  camera_fb_t * fb = NULL;
  fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("Gagal mengambil gambar");
    return;
  }

  Serial.println("Mengirim gambar ke server...");

  HTTPClient http;
  http.begin(SERVER_URL);

  String boundary = "X-ESP32-CAM";
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  // Menyusun body multipart/form-data secara manual
  String head = "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"temperature\"\r\n\r\n";
  head += String(temperature, 1) + "\r\n";
  
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"humidity\"\r\n\r\n";
  head += String(humidity, 1) + "\r\n";
  
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"upload.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";

  String tail = "\r\n--" + boundary + "--\r\n";

  size_t totalLen = head.length() + fb->len + tail.length();

  // Kirim data menggunakan stream agar hemat RAM
  int httpResponseCode = http.sendRequest("POST", (uint8_t*)head.c_str(), head.length(), fb->buf, fb->len, (uint8_t*)tail.c_str(), tail.length());

  if (httpResponseCode > 0) {
    Serial.print("BERHASIL! Respon: ");
    Serial.println(http.getString());
  } else {
    Serial.print("GAGAL. Error: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
  esp_camera_fb_return(fb);
}
