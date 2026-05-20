import cv2
import requests
import time
import os

# ============================================================
# KONFIGURASI
# ============================================================
API_BASE_URL = "http://localhost:8000"
CAPTURE_INTERVAL = 15  # Tangkap gambar setiap 15 detik
WEBCAM_INDEX = 1       # 0 = Webcam internal bawaan, 1 = Webcam eksternal USB

def set_webcam_index(index: int):
    """Mengubah indeks webcam secara dinamis di runtime dari API Backend."""
    global WEBCAM_INDEX
    WEBCAM_INDEX = index
    print(f"\n[CONFIG] Indeks kamera diubah secara dinamis menjadi: {WEBCAM_INDEX}\n")

def get_latest_sensor_data():
    """Mengambil data sensor suhu & kelembapan asli yang dikirim oleh ESP32 ke backend."""
    try:
        response = requests.get(f"{API_BASE_URL}/api/sensor?limit=1")
        if response.status_code == 200:
            json_data = response.json()
            if json_data.get("success") and len(json_data.get("data", [])) > 0:
                latest = json_data["data"][0]
                return float(latest["temperature"]), float(latest["humidity"])
    except Exception as e:
        print(f"[WARNING] Gagal mengambil data sensor asli dari ESP32: {e}")
    
    # Nilai default (jika ESP32 sedang mati/belum terhubung)
    return 27.5, 70.0

def start_webcam_uploader():
    print("============================================================")
    print("      Agridashboard - External Webcam Uploader (AI)")
    print("============================================================")
    print(f"[INFO] Uploader siaga. Akan menangkap gambar dari Webcam (Index: {WEBCAM_INDEX}) setiap {CAPTURE_INTERVAL} detik.")
    print("[INFO] Kamera akan dibuka & dilepas secara dinamis agar tidak mengunci perangkat.")
    print("[INFO] Tekan Ctrl+C untuk menghentikan program.\n")

    try:
        while True:
            # 1. Ambil data sensor terbaru dari database (dikirim oleh ESP32)
            temp, hum = get_latest_sensor_data()
            print(f"[INFO] Sinkronisasi Sensor ESP32 -> Suhu: {temp}°C, Kelembapan: {hum}%")

            # 2. Buka Kamera (Open on-demand agar tidak mengunci kamera selamanya)
            cap = cv2.VideoCapture(WEBCAM_INDEX, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(WEBCAM_INDEX)
            
            if not cap.isOpened():
                print(f"[ERROR] Gagal membuka webcam dengan index {WEBCAM_INDEX}! Akan mencoba kembali...")
                time.sleep(5)
                continue

            # Berikan jeda 0.5 detik agar kamera melakukan auto-focus & exposure warmup
            time.sleep(0.5)

            # 3. Capture frame dari webcam
            ret, frame = cap.read()
            
            # Lepaskan kamera secepat mungkin agar bisa dipakai aplikasi lain (seperti browser)
            cap.release()

            if not ret:
                print("[WARNING] Gagal mengambil gambar dari webcam, mencoba ulang...")
                time.sleep(2)
                continue

            # Buat file temporary gambar untuk diunggah
            temp_filename = "webcam_capture.jpg"
            cv2.imwrite(temp_filename, frame)

            # 4. Kirim gambar ke API Backend
            print("[UPLOADING] Mengirim foto daun tomat ke model AI...")
            try:
                with open(temp_filename, "rb") as img_file:
                    files = {"image": (temp_filename, img_file, "image/jpeg")}
                    data = {
                        "temperature": temp,
                        "humidity": hum
                    }
                    
                    response = requests.post(f"{API_BASE_URL}/api/upload", files=files, data=data)
                    
                    if response.status_code == 200:
                        res_json = response.json()
                        if res_json.get("success"):
                            pred = res_json["data"]["prediction"]
                            print(f"✅ [SUKSES] Hasil Prediksi AI: {pred['diseaseLabel']} ({pred['confidence']}% Confidence)")
                        else:
                            print(f"❌ [GAGAL] Server menolak file: {res_json.get('error')}")
                    else:
                        print(f"❌ [GAGAL] Response HTTP Error: {response.status_code}")
            except Exception as e:
                print(f"❌ [ERROR] Gagal menghubungi backend API: {e}")

            # Bersihkan file temporary
            if os.path.exists(temp_filename):
                os.remove(temp_filename)

            print(f"[WAIT] Menunggu {CAPTURE_INTERVAL} detik untuk pengambilan berikutnya...\n")
            time.sleep(CAPTURE_INTERVAL)

    except KeyboardInterrupt:
        print("\n[STOP] Program webcam uploader dihentikan oleh pengguna.")
    finally:
        cv2.destroyAllWindows()

if __name__ == "__main__":
    start_webcam_uploader()
