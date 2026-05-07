from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
def predict(image_bytes: bytes):
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

    class_index = int(np.argmax(predictions[0]))
    confidence = float(np.max(predictions[0])) * 100

    label = LABEL_MAP.get(class_index, "TIDAK DIKETAHUI")
    return label, round(confidence, 1), False  # is_mock = False


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
            }
            for r in readings
        ],
    }

# ============================================================
# GET Alerts (untuk Frontend)
# ============================================================
@app.get("/api/alerts")
async def get_alerts(limit: int = 20):
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
# Upload + Predict (untuk Frontend & ESP32-CAM nanti)
# ============================================================
@app.post("/api/upload")
async def upload_and_predict(
    temperature: float = Form(...),
    humidity: float = Form(...),
    image: UploadFile = File(...)
):
    """
    Endpoint untuk upload gambar daun tomat dan mendapatkan prediksi penyakit.
    Digunakan oleh Frontend (Testing Manual) maupun ESP32-CAM.
    """
    try:
        # 1. Baca bytes gambar
        image_bytes = await image.read()

        # 2. Jalankan prediksi
        disease_label, confidence, is_mock = predict(image_bytes)

        # 3. Tentukan apakah butuh human review (confidence < 85%)
        needs_review = confidence < 85.0

        # 4. Simpan prediksi ke database
        plant = await db.plant.find_first()
        if plant:
            await db.prediction.create(
                data={
                    "plantId": plant.id,
                    "imageUrl": f"https://storage.supabase.com/tomato-images/{uuid.uuid4()}.jpg",
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
                    "imageUrl": f"https://storage.supabase.com/tomato-images/{uuid.uuid4()}.jpg",
                    "timestamp": datetime.now().isoformat(),
                }
            }
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
