from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import random
import uuid
import os

app = FastAPI(title="TomatoHealth AI API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow frontend to access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MOCK ML FUNCTION ---
def mock_predict(image_bytes):
    """
    Fungsi palsu (mock) untuk simulasi Machine Learning.
    Akan diganti dengan keras.models.load_model() nantinya.
    """
    statuses = ["SEHAT", "EARLY BLIGHT", "LATE BLIGHT", "SEPTORIA"]
    # 70% kemungkinan sehat, 30% penyakit
    status = "SEHAT" if random.random() < 0.7 else random.choice(statuses[1:])
    confidence = random.uniform(80.0, 99.9)
    
    return status, round(confidence, 1)

@app.get("/")
def read_root():
    return {"message": "TomatoHealth AI Backend is running!"}

@app.post("/api/upload")
async def upload_esp32_data(
    temperature: float = Form(...),
    humidity: float = Form(...),
    image: UploadFile = File(...)
):
    """
    Endpoint utama untuk ESP32-CAM.
    Menerima Suhu, Kelembapan, dan File Gambar secara bersamaan.
    """
    try:
        # 1. Baca gambar
        image_bytes = await image.read()
        
        # 2. Lakukan Prediksi (Mock)
        status, confidence = mock_predict(image_bytes)
        
        # 3. Tentukan apakah butuh human review
        needs_review = confidence < 90.0
        
        # Simulasi Simpan ke Database & Supabase...
        mock_image_url = f"https://storage.supabase.com/tomato-images/{uuid.uuid4()}.jpg"
        
        return {
            "success": True,
            "message": "Data received and analyzed successfully",
            "data": {
                "sensor": {
                    "temperature": temperature,
                    "humidity": humidity
                },
                "prediction": {
                    "diseaseLabel": status,
                    "confidence": confidence,
                    "needsReview": needs_review,
                    "imageUrl": mock_image_url
                }
            }
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
