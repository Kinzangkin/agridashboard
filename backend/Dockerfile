# Gunakan Python 3.10-slim agar ukuran image optimal dan stabil untuk TensorFlow
FROM python:3.10-slim

# Install dependensi sistem yang dibutuhkan oleh OpenCV, Prisma, dan TensorFlow
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Tentukan working directory
WORKDIR /app

# Salin requirements.txt terlebih dahulu agar Docker caching berjalan optimal
COPY requirements.txt .

# Install dependensi Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Salin seluruh kode backend ke dalam container
COPY . .

# Buat direktori static jika belum ada untuk menghindari error
RUN mkdir -p static/tomato-images

# Generate Prisma Client sebelum server dijalankan
RUN prisma generate

# Hugging Face Spaces mewajibkan aplikasi mendengarkan port 7860
EXPOSE 7860

# Jalankan server FastAPI pada port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
