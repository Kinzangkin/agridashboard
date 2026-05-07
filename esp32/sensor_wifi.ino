#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

// Pengaturan WiFi dan Server
const char* WIFI_SSID     = "ABCDE";       
const char* WIFI_PASSWORD = "12345678";    
const char* API_URL = "http://10.86.100.196:8000/api/sensor";

// Definisi Pin
#define DHTPIN 4          
#define DHTTYPE DHT11     
#define SOILPIN 34        

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  
  // Memulai Koneksi WiFi
  Serial.print("Menghubungkan ke WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Tunggu sampai terhubung
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Terhubung!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  dht.begin();
}

void loop() {
  // Memastikan WiFi tetap terhubung
  if (WiFi.status() == WL_CONNECTED) {
    
    // 1. Membaca Sensor
    float hum = dht.readHumidity();
    float temp = dht.readTemperature();
    int soil = analogRead(SOILPIN);

    if (isnan(hum) || isnan(temp)) {
      Serial.println("Gagal membaca DHT11!");
      return;
    }

    // 2. Menampilkan Data di Serial
    Serial.print("Suhu: "); Serial.print(temp);
    Serial.print(" | Kelembapan: "); Serial.print(hum);
    Serial.print(" | Tanah: "); Serial.println(soil);

    // 3. Mengirim ke Server via POST JSON
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");

    // Buat JSON payload
    String jsonPayload = "{\"temperature\":" + String(temp, 1) + 
                         ",\"humidity\":" + String(hum, 1) + 
                         ",\"soilMoisture\":" + String(soil) + "}";

    Serial.print("Mengirim JSON: ");
    Serial.println(jsonPayload);

    int httpResponseCode = http.POST(jsonPayload); // POST, bukan GET!

    if (httpResponseCode > 0) {
      Serial.print("BERHASIL! Respon: ");
      Serial.println(http.getString());
    } else {
      Serial.print("GAGAL. Error: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }

    http.end();

  } else {
    Serial.println("WiFi Terputus! Mencoba menyambung kembali...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  Serial.println("------------------------------------");
  delay(5000); // Kirim data setiap 5 detik
}
