from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import os
import io
import numpy as np
from PIL import Image
import tensorflow as tf
from prisma import Prisma

# ============================================================
# Prisma Client (Database)
# ============================================================
db = Prisma()

def run_webcam_uploader_in_background():
    """Menjalankan webcam uploader secara otomatis di background thread."""
    import threading
    
    def thread_loop():
        import time
        # Beri waktu uvicorn untuk siap me-listen port 8000
        time.sleep(4)
        try:
            from webcam_uploader import start_webcam_uploader
            start_webcam_uploader()
        except ImportError:
            print("\n[INFO] OpenCV (opencv-python) atau requests belum terinstal di venv.")
            print("[INFO] Jalankan 'pip install opencv-python requests' untuk mengaktifkan uploader webcam otomatis!\n")
        except Exception as e:
            print(f"\n[WARNING] Gagal menjalankan background webcam uploader: {e}\n")

    t = threading.Thread(target=thread_loop, daemon=True)
    t.start()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle: connect DB saat startup, disconnect saat shutdown."""
    await db.connect()
    print("[OK] Database connected!")

    # Buat default Plant jika belum ada
    plant_count = await db.plant.count()
    if plant_count == 0:
        await db.plant.create(
            data={
                "name": "Kebun A - Tomat",
                "status": "SEHAT",
            }
        )
        print("[OK] Default plant created.")

    # Jalankan webcam uploader secara otomatis di latar belakang
    run_webcam_uploader_in_background()

    yield

    await db.disconnect()
    print("[OK] Database disconnected.")

app = FastAPI(title="TomatoHealth AI API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tentukan direktori penyimpanan gambar statis lokal
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(STATIC_DIR, "tomato-images"), exist_ok=True)

# Mount folder /static agar bisa diakses oleh browser/frontend
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ============================================================
# Pydantic Models untuk request dari ESP32
# ============================================================
class SensorData(BaseModel):
    temperature: float
    humidity: float
    soilMoisture: Optional[float] = None
    plantId: Optional[str] = None  # Opsional, pakai default plant jika kosong

# ============================================================
# Load Model (dijalankan SEKALI saat server start)
# ============================================================
MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml", "models", "tomato_model.h5")
model = None

try:
    print(f"[LOADING] Memuat model dari: {MODEL_PATH}")
    model = tf.keras.models.load_model(MODEL_PATH)
    print("[OK] Model berhasil dimuat!")
except Exception as e:
    print(f"[WARNING] Model gagal dimuat: {e}")
    print("[WARNING] Menggunakan Mock Mode sebagai fallback.")

# ============================================================
# Label Map — urutan alphabetical dari flow_from_directory
# PlantVillage Tomato folders (sorted):
#   0: Tomato___Bacterial_spot
#   1: Tomato___Early_blight
#   2: Tomato___Late_blight
#   3: Tomato___Leaf_Mold
#   4: Tomato___Septoria_leaf_spot
#   5: Tomato___Spider_mites Two-spotted_spider_mite
#   6: Tomato___Target_Spot
#   7: Tomato___Tomato_Yellow_Leaf_Curl_Virus
#   8: Tomato___Tomato_mosaic_virus
#   9: Tomato___healthy
# ============================================================
LABEL_MAP = {
    0: "BACTERIAL SPOT",
    1: "EARLY BLIGHT",
    2: "LATE BLIGHT",
    3: "LEAF MOLD",
    4: "SEPTORIA LEAF SPOT",
    5: "SPIDER MITES",
    6: "TARGET SPOT",
    7: "YELLOW LEAF CURL VIRUS",
    8: "MOSAIC VIRUS",
    9: "SEHAT",
}

# Tentukan apakah label termasuk kategori "sakit"
DISEASE_LABELS = {
    "SEHAT": False,
    "SEHAT (KONDISI OPTIMAL)": False,
    "SEHAT (POTENSI DEHIDRASI / SUHU TINGGI)": False,
    "SEHAT (KELEMBAPAN TINGGI / RAWAN JAMUR)": False,
    "SEHAT (SUHU DINGIN / PERTUMBUHAN LAMBAT)": False,
    "TIDAK TERDETEKSI DAUN HIJAU": False,
    "BACTERIAL SPOT": True,
    "EARLY BLIGHT": True,
    "LATE BLIGHT": True,
    "LEAF MOLD": True,
    "SEPTORIA LEAF SPOT": True,
    "SPIDER MITES": True,
    "TARGET SPOT": True,
    "YELLOW LEAF CURL VIRUS": True,
    "MOSAIC VIRUS": True,
}

IMG_SIZE = 224

# ============================================================
# Fungsi Deteksi Keberadaan Daun (Greenness Filter)
# ============================================================
def check_leaf_presence(image_bytes: bytes) -> tuple[bool, float]:
    """
    Mengecek apakah gambar yang diunggah mengandung warna hijau daun yang cukup signifikan
    dan mengembalikan (is_leaf_present, lesion_ratio) untuk validasi penyakit di tahap klasifikasi.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("HSV")
        hsv_arr = np.array(img)
        h, s, v = hsv_arr[:,:,0], hsv_arr[:,:,1], hsv_arr[:,:,2]
        
        # 1. Deteksi warna hijau daun (H: 25 - 100)
        green_pixels = ((h >= 25) & (h <= 100)) & (s > 35) & (v > 30)
        green_ratio = float(np.sum(green_pixels) / (h.shape[0] * h.shape[1]))
        
        # 2. Deteksi warna kecokelatan / bercak lesi / kering (H: 3 - 22, s > 45, v > 25)
        lesion_pixels = ((h >= 3) & (h <= 22)) & (s > 45) & (v > 25)
        lesion_ratio = float(np.sum(lesion_pixels) / (h.shape[0] * h.shape[1]))
        
        print(f"[GREEN_FILTER] Hijau daun: {green_ratio:.4f}, Bercak cokelat/lesi: {lesion_ratio:.4f}")
        
        # Anggap valid jika warna hijau daun minimal 18% dari luas frame
        is_leaf = green_ratio > 0.18
        return is_leaf, lesion_ratio
    except Exception as e:
        print(f"[GREEN_FILTER] Gagal memproses filter warna: {e}")
        return True, 0.0  # Fallback: biarkan prediksi lanjut jika gagal parsing

# ============================================================
# Fungsi Preprocessing Gambar
# ============================================================
def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Ubah bytes gambar menjadi numpy array siap prediksi.
    Sesuaikan dengan preprocessing saat training (rescale=1./255, resize 224x224).
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))
    img_array = np.array(img, dtype=np.float32)
    img_array = img_array / 255.0  # Rescale sama seperti saat training
    img_array = np.expand_dims(img_array, axis=0)  # Tambah batch dimension: (1, 224, 224, 3)
    return img_array

# ============================================================
# Fungsi Prediksi
# ============================================================
def predict(image_bytes: bytes, lesion_ratio: float = 0.0):
    """
    Jalankan prediksi menggunakan model TensorFlow.
    Jika model belum termuat, gunakan mock fallback.
    """
    if model is None:
        # Fallback ke mock jika model gagal load
        import random
        statuses = list(LABEL_MAP.values())
        status = "SEHAT" if random.random() < 0.7 else random.choice([s for s in statuses if s != "SEHAT"])
        confidence = round(random.uniform(75.0, 99.9), 1)
        return status, confidence, True  # is_mock = True

    img_array = preprocess_image(image_bytes)
    predictions = model.predict(img_array, verbose=0)
    probs = predictions[0]

    # Ambil probabilitas untuk kelas SEHAT (index 9) dan penyakit terbaik (index 0-8)
    sehat_prob = float(probs[9])
    best_disease_idx = int(np.argmax(probs[:9]))
    best_disease_prob = float(probs[best_disease_idx])

    # --- KALIBRASI: BIAS KELAS SEHAT (HEALTHY BOOST FACTOR) ---
    # Mengalikan probabilitas SEHAT dengan faktor pengali agar model tidak gampang panik (false alarm).
    HEALTHY_BOOST_FACTOR = 2.2
    boosted_sehat_prob = sehat_prob * HEALTHY_BOOST_FACTOR

    if boosted_sehat_prob >= best_disease_prob:
        class_index = 9
        # Rekalkulasi confidence setelah diboost agar tetap dinormalisasi
        total = float(sum(probs[:9])) + boosted_sehat_prob
        confidence = float((boosted_sehat_prob / total) * 100)
    else:
        # --- KALIBRASI: OVERRIDE PENYAKIT AKIBAT NOISE (CONFIDENCE THRESHOLD & LESION CHECK) ---
        # 1. Overriding jika confidence penyakit sangat rendah (< 72%)
        # 2. Overriding jika fisik daun dominan bersih tanpa bercak cokelat/lesi (< 0.8% lesion_ratio)
        #    Hanya berlaku untuk penyakit yang menyebabkan bercak cokelat/lesi fisik yang jelas.
        raw_disease_confidence = best_disease_prob * 100
        
        # Daftar index penyakit bercak cokelat/lesi (Bacterial Spot, Early Blight, Late Blight, Septoria, Target Spot)
        lesion_diseases = {0, 1, 2, 4, 6}
        
        should_override = False
        override_reason = ""
        
        if raw_disease_confidence < 72.0:
            should_override = True
            override_reason = f"Raw Confidence ({raw_disease_confidence:.2f}%) di bawah threshold 72%"
        elif best_disease_idx in lesion_diseases and lesion_ratio < 0.008:
            should_override = True
            override_reason = f"Lesion Ratio ({lesion_ratio:.4f}) di bawah threshold 0.008 untuk penyakit bercak"
            
        if should_override:
            print(f"[CALIBRATION] Penyakit di-override ke SEHAT. Alasan: {override_reason}")
            class_index = 9
            # Hitung kembali confidence SEHAT yang disesuaikan
            total = float(sum(probs[:9])) + boosted_sehat_prob
            calculated_conf = float((boosted_sehat_prob / total) * 100) if total > 0 else 0.0
            confidence = max(calculated_conf, 50.0) # Hindari 0% confidence di UI jika di-override
        else:
            class_index = best_disease_idx
            confidence = float(raw_disease_confidence)

    label = LABEL_MAP.get(class_index, "TIDAK DIKETAHUI")
    return label, round(float(confidence), 1), False  # is_mock = False


# ============================================================
# Endpoints
# ============================================================

@app.get("/")
async def read_root():
    plant_count = await db.plant.count()
    sensor_count = await db.sensorreading.count()
    return {
        "message": "TomatoHealth AI Backend is running!",
        "model_loaded": model is not None,
        "database": "connected",
        "plants": plant_count,
        "sensor_readings": sensor_count,
    }

# ============================================================
# ESP32 Sensor Endpoint (DHT11 + Soil Moisture)
# ============================================================
@app.post("/api/sensor")
async def receive_sensor_data(data: SensorData):
    """
    Endpoint untuk menerima data sensor dari ESP32.
    ESP32 mengirim JSON: {"temperature": 28.5, "humidity": 65.0, "soilMoisture": 2100}
    Data disimpan ke database Supabase.
    """
    try:
        # Cari plant (gunakan default jika plantId tidak dikirim)
        if data.plantId:
            plant = await db.plant.find_unique(where={"id": data.plantId})
        else:
            plant = await db.plant.find_first()

        if not plant:
            raise HTTPException(status_code=404, detail="Plant tidak ditemukan")

        # Simpan ke database
        reading = await db.sensorreading.create(
            data={
                "plantId": plant.id,
                "temperature": data.temperature,
                "humidity": data.humidity,
                "soilMoisture": data.soilMoisture,
            }
        )

        # --- STRATEGI A: FIFO Quota Limit (Maks 100 Sensor Readings) ---
        total_readings = await db.sensorreading.count()
        if total_readings > 100:
            excess_count = total_readings - 100
            old_readings = await db.sensorreading.find_many(
                take=excess_count,
                order={"createdAt": "asc"}
            )
            for or_data in old_readings:
                await db.sensorreading.delete(where={"id": or_data.id})
            print(f"[FIFO] Dihapus {excess_count} sensor reading lama dari database.")

        # Cek kondisi alert (suhu terlalu tinggi / kelembapan rendah)
        alerts = []
        if data.temperature > 35:
            alert = await db.alert.create(
                data={
                    "title": "[ALERT] Suhu Tinggi!",
                    "message": f"Suhu mencapai {data.temperature} C pada {plant.name}",
                }
            )
            alerts.append(alert.title)
        if data.humidity < 30:
            alert = await db.alert.create(
                data={
                    "title": "[ALERT] Kelembapan Rendah!",
                    "message": f"Kelembapan udara hanya {data.humidity}% pada {plant.name}",
                }
            )
            alerts.append(alert.title)

        return {
            "success": True,
            "message": "Data sensor berhasil disimpan",
            "data": {
                "id": reading.id,
                "temperature": reading.temperature,
                "humidity": reading.humidity,
                "soilMoisture": reading.soilMoisture,
                "plantId": reading.plantId,
                "createdAt": reading.createdAt.isoformat(),
            },
            "alerts": alerts,
        }

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# GET Sensor Readings (untuk Frontend Dashboard)
# ============================================================
@app.get("/api/sensor")
async def get_sensor_readings(limit: int = 50):
    """Ambil data sensor terbaru untuk ditampilkan di dashboard."""
    readings = await db.sensorreading.find_many(
        take=limit,
        order={"createdAt": "desc"},
        include={"plant": True}
    )
    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "temperature": r.temperature,
                "humidity": r.humidity,
                "soilMoisture": r.soilMoisture,
                "plantId": r.plantId,
                "createdAt": r.createdAt.isoformat(),
                "plantStatus": r.plant.status if r.plant else "SEHAT"
            }
            for r in readings
        ],
    }

# ============================================================
# GET Alerts (untuk Frontend)
# ============================================================
@app.get("/api/alerts")
async def get_alerts(limit: int = 50):
    """Ambil alert terbaru."""
    alerts = await db.alert.find_many(
        take=limit,
        order={"createdAt": "desc"},
    )
    return {
        "success": True,
        "data": [
            {
                "id": a.id,
                "title": a.title,
                "message": a.message,
                "isRead": a.isRead,
                "createdAt": a.createdAt.isoformat(),
            }
            for a in alerts
        ],
    }

# ============================================================
# GET Predictions (untuk Frontend Galeri)
# ============================================================
@app.get("/api/predictions")
async def get_predictions(limit: int = 50):
    """Ambil data prediksi penyakit terbaru untuk galeri."""
    predictions = await db.prediction.find_many(
        take=limit,
        order={"createdAt": "desc"},
    )
    return {
        "success": True,
        "data": [
            {
                "id": p.id,
                "plantId": p.plantId,
                "imageUrl": p.imageUrl,
                "diseaseLabel": p.diseaseLabel,
                "confidence": p.confidence,
                "needsReview": p.needsReview,
                "humanReviewed": p.humanReviewed,
                "groundTruth": p.groundTruth,
                "createdAt": p.createdAt.isoformat(),
            }
            for p in predictions
        ],
    }

# ============================================================
# Webcam Settings Endpoints (untuk switch dinamis dari Frontend)
# ============================================================
class WebcamSettingsRequest(BaseModel):
    index: int

@app.get("/api/settings/webcam")
async def get_webcam_settings():
    try:
        import webcam_uploader
        return {"success": True, "webcamIndex": webcam_uploader.WEBCAM_INDEX}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/settings/webcam")
async def set_webcam_settings(data: WebcamSettingsRequest):
    try:
        import webcam_uploader
        webcam_uploader.set_webcam_index(data.index)
        return {
            "success": True, 
            "message": f"Webcam index diubah ke {data.index}",
            "webcamIndex": data.index
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# Human-in-the-Loop Review Endpoints
# ============================================================
class ReviewRequest(BaseModel):
    groundTruth: str

@app.get("/api/review/queue")
async def get_review_queue():
    """Ambil daftar prediksi yang membutuhkan human review dan belum direview."""
    queue = await db.prediction.find_many(
        where={
            "needsReview": True,
            "humanReviewed": False
        },
        order={"createdAt": "asc"}
    )
    return {
        "success": True,
        "count": len(queue),
        "data": [
            {
                "id": p.id,
                "plantId": p.plantId,
                "imageUrl": p.imageUrl,
                "diseaseLabel": p.diseaseLabel,
                "confidence": p.confidence,
                "createdAt": p.createdAt.isoformat(),
            }
            for p in queue
        ]
    }

@app.post("/api/review/{id}")
async def submit_review(id: str, data: ReviewRequest):
    """
    Kirim review manusia untuk memperbaiki label prediksi model AI.
    Menyimpan ground truth dan menandai data sebagai human reviewed.
    """
    try:
        prediction = await db.prediction.find_unique(where={"id": id})
        if not prediction:
            raise HTTPException(status_code=404, detail="Data prediksi tidak ditemukan")

        # Update prediction record
        updated_pred = await db.prediction.update(
            where={"id": id},
            data={
                "humanReviewed": True,
                "groundTruth": data.groundTruth
            }
        )

        # Update status tanaman
        await db.plant.update(
            where={"id": prediction.plantId},
            data={"status": data.groundTruth}
        )

        return {
            "success": True,
            "message": "Review berhasil disimpan",
            "data": {
                "id": updated_pred.id,
                "groundTruth": updated_pred.groundTruth,
                "humanReviewed": updated_pred.humanReviewed
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/review/logs")
async def get_review_logs(limit: int = 5):
    """Ambil log review manusia yang terakhir disubmit."""
    logs = await db.prediction.find_many(
        where={
            "humanReviewed": True
        },
        take=limit,
        order={"createdAt": "desc"}
    )
    return {
        "success": True,
        "data": [
            {
                "id": p.id,
                "diseaseLabel": p.diseaseLabel,
                "groundTruth": p.groundTruth,
                "createdAt": p.createdAt.isoformat(),
            }
            for p in logs
        ]
    }

# ============================================================
# Upload + Predict (untuk Frontend & ESP32-CAM nanti)
# ============================================================
@app.post("/api/upload")
async def upload_and_predict(
    request: Request,
    temperature: float = Form(...),
    humidity: float = Form(...),
    image: UploadFile = File(...)
):
    """
    Endpoint untuk upload gambar daun tomat dan mendapatkan prediksi penyakit.
    Digunakan oleh Frontend (Testing Manual) maupun ESP32-CAM.
    Gambar disimpan secara lokal dan disajikan sebagai file statis.
    """
    try:
        # 1. Baca bytes gambar
        image_bytes = await image.read()

        # 2. Filter Deteksi Daun Hijau (mencegah salah deteksi di luar tanaman)
        is_leaf, lesion_ratio = check_leaf_presence(image_bytes)
        if not is_leaf:
            disease_label = "TIDAK TERDETEKSI DAUN HIJAU"
            confidence = 100.0
            is_mock = True
            needs_review = False
        else:
            # Jalankan prediksi model TensorFlow jika terdeteksi warna hijau daun
            disease_label, confidence, is_mock = predict(image_bytes, lesion_ratio=lesion_ratio)
            
            # Tambahkan variasi output SEHAT cerdas berdasarkan pembacaan data sensor aktual
            if disease_label == "SEHAT":
                if temperature > 30.0:
                    disease_label = "SEHAT (POTENSI DEHIDRASI / SUHU TINGGI)"
                elif humidity > 80.0:
                    disease_label = "SEHAT (KELEMBAPAN TINGGI / RAWAN JAMUR)"
                elif temperature < 18.0:
                    disease_label = "SEHAT (SUHU DINGIN / PERTUMBUHAN LAMBAT)"
                else:
                    disease_label = "SEHAT (KONDISI OPTIMAL)"
                    
            # Tentukan apakah butuh human review (confidence < 85%)
            needs_review = confidence < 85.0

        # 4. Simpan gambar secara lokal ke static/tomato-images
        file_ext = os.path.splitext(image.filename)[1] or ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        filepath = os.path.join(STATIC_DIR, "tomato-images", unique_filename)
        
        with open(filepath, "wb") as f:
            f.write(image_bytes)

        # Buat URL statis yang bisa diakses secara dinamis oleh browser/frontend
        base_url = str(request.base_url).rstrip("/")
        image_url = f"{base_url}/static/tomato-images/{unique_filename}"

        # 5. Simpan prediksi ke database
        plant = await db.plant.find_first()
        if plant:
            await db.prediction.create(
                data={
                    "plantId": plant.id,
                    "imageUrl": image_url,
                    "diseaseLabel": disease_label,
                    "confidence": confidence,
                    "needsReview": needs_review,
                }
            )

            # Update status plant
            await db.plant.update(
                where={"id": plant.id},
                data={"status": disease_label},
            )

            # --- STRATEGI A: FIFO Quota Limit (Maks 100 Prediksi Teratas) ---
            total_predictions = await db.prediction.count()
            if total_predictions > 100:
                excess_count = total_predictions - 100
                old_preds = await db.prediction.find_many(
                    take=excess_count,
                    order={"createdAt": "asc"}
                )
                for op in old_preds:
                    # Hapus file fisik gambar lokal jika ada untuk mencegah kelebihan disk space
                    if "static/tomato-images/" in op.imageUrl:
                        filename = op.imageUrl.split("static/tomato-images/")[-1]
                        old_filepath = os.path.join(STATIC_DIR, "tomato-images", filename)
                        if os.path.exists(old_filepath):
                            try:
                                os.remove(old_filepath)
                                print(f"[FIFO] Dihapus gambar lokal lama: {filename}")
                            except Exception as file_err:
                                print(f"[WARNING] Gagal menghapus file {filename}: {file_err}")
                    
                    await db.prediction.delete(where={"id": op.id})
                print(f"[FIFO] Dihapus {excess_count} prediksi lama dari database.")

        return {
            "success": True,
            "message": "Prediksi berhasil",
            "is_mock": is_mock,
            "data": {
                "sensor": {
                    "temperature": temperature,
                    "humidity": humidity,
                },
                "prediction": {
                    "diseaseLabel": disease_label,
                    "confidence": confidence,
                    "needsReview": needs_review,
                    "isDisease": DISEASE_LABELS.get(disease_label, True),
                    "imageUrl": image_url,
                    "timestamp": datetime.now().isoformat(),
                }
            }
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
