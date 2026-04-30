# ============================================================
# TomatoHealth AI — Training Notebook untuk Google Colab
# ============================================================
# CARA PAKAI:
# 1. Buka Google Colab (colab.research.google.com)
# 2. Buat notebook baru
# 3. Pastikan GPU aktif: Runtime → Change runtime type → GPU
# 4. Copy-paste SETIAP SECTION di bawah ke cell terpisah
# 5. Jalankan satu per satu dari atas ke bawah
# ============================================================

# ============================================================
# CELL 1: Install & Setup Kaggle API
# ============================================================
# !pip install -q kaggle tensorflow matplotlib seaborn scikit-learn

import os

# Set Kaggle API token — GANTI dengan token kamu
os.environ['KAGGLE_API_TOKEN'] = 'KGAT_daa331266da7750be396bf5a0bc58ba3'

# Setup kaggle credentials directory
os.makedirs(os.path.expanduser('~/.kaggle'), exist_ok=True)

# Verify kaggle works
# !kaggle datasets list -s "plantvillage"

# ============================================================
# CELL 2: Download Dataset PlantVillage dari Kaggle
# ============================================================
# !kaggle datasets download -d abdallahalidev/plantvillage-dataset
# !unzip -q plantvillage-dataset.zip -d /content/dataset

# ============================================================
# CELL 3: Filter hanya folder Tomato & lihat kelas
# ============================================================
import shutil
import glob

SOURCE_DIR = '/content/dataset/plantvillage dataset/color'
TOMATO_DIR = '/content/tomato_data'

os.makedirs(TOMATO_DIR, exist_ok=True)

# Filter hanya folder Tomato
tomato_folders = [f for f in os.listdir(SOURCE_DIR) if 'Tomato' in f]
tomato_folders.sort()

print(f"Ditemukan {len(tomato_folders)} kelas tomat:\n")
for i, folder in enumerate(tomato_folders):
    src = os.path.join(SOURCE_DIR, folder)
    dst = os.path.join(TOMATO_DIR, folder)
    if not os.path.exists(dst):
        shutil.copytree(src, dst)
    count = len(os.listdir(dst))
    print(f"  {i}: {folder} ({count} foto)")

# ============================================================
# CELL 4: Preprocessing & Data Split
# ============================================================
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator

IMG_SIZE = 224
BATCH_SIZE = 32

# Augmentasi untuk training
train_datagen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=20,
    horizontal_flip=True,
    zoom_range=0.2,
    brightness_range=[0.8, 1.2],
    validation_split=0.2  # 80% train, 20% val
)

# Tanpa augmentasi untuk validasi
val_datagen = ImageDataGenerator(
    rescale=1./255,
    validation_split=0.2
)

# Training set
train_generator = train_datagen.flow_from_directory(
    TOMATO_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='training',
    shuffle=True,
    seed=42
)

# Validation set
val_generator = val_datagen.flow_from_directory(
    TOMATO_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation',
    shuffle=False,
    seed=42
)

# Print info
print(f"\nTraining samples: {train_generator.samples}")
print(f"Validation samples: {val_generator.samples}")
print(f"Jumlah kelas: {train_generator.num_classes}")
print(f"\nLabel mapping:")
for name, idx in sorted(train_generator.class_indices.items(), key=lambda x: x[1]):
    print(f"  {idx}: {name}")

# ============================================================
# CELL 5: Build Model — MobileNetV2 + Custom Classifier
# ============================================================
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model

NUM_CLASSES = train_generator.num_classes

# Load MobileNetV2 (pretrained ImageNet, tanpa top layer)
base_model = MobileNetV2(
    weights='imagenet',
    include_top=False,
    input_shape=(IMG_SIZE, IMG_SIZE, 3)
)

# Freeze semua layer base model
base_model.trainable = False

# Tambah custom classifier
x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(256, activation='relu')(x)
x = Dropout(0.5)(x)
predictions = Dense(NUM_CLASSES, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=predictions)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

model.summary()
print(f"\nTotal layers: {len(model.layers)}")
print(f"Trainable: {len([l for l in model.layers if l.trainable])}")
print(f"Non-trainable: {len([l for l in model.layers if not l.trainable])}")

# ============================================================
# CELL 6: Training Tahap 1 — Hanya Classifier (5 epoch)
# ============================================================
print("=" * 50)
print("TAHAP 1: Training classifier saja (base frozen)")
print("=" * 50)

history1 = model.fit(
    train_generator,
    epochs=5,
    validation_data=val_generator,
    verbose=1
)

# ============================================================
# CELL 7: Training Tahap 2 — Fine-tune top layers (10 epoch)
# ============================================================
print("=" * 50)
print("TAHAP 2: Fine-tuning 30 layer terakhir MobileNetV2")
print("=" * 50)

# Unfreeze 30 layer terakhir
base_model.trainable = True
for layer in base_model.layers[:-30]:
    layer.trainable = False

# Re-compile dengan learning rate lebih kecil
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

trainable_count = len([l for l in model.layers if l.trainable])
print(f"Trainable layers sekarang: {trainable_count}")

history2 = model.fit(
    train_generator,
    epochs=10,
    validation_data=val_generator,
    verbose=1
)

# ============================================================
# CELL 8: Evaluasi — Accuracy & Confusion Matrix
# ============================================================
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix

# Evaluasi pada validation set
val_generator.reset()
predictions_arr = model.predict(val_generator, verbose=1)
y_pred = np.argmax(predictions_arr, axis=1)
y_true = val_generator.classes

# Class names
class_names = list(val_generator.class_indices.keys())
class_names_short = [c.replace('Tomato___', '').replace('_', ' ') for c in class_names]

# Classification report
print("\n" + "=" * 50)
print("CLASSIFICATION REPORT")
print("=" * 50)
print(classification_report(y_true, y_pred, target_names=class_names_short))

# Confusion Matrix
cm = confusion_matrix(y_true, y_pred)
plt.figure(figsize=(12, 10))
sns.heatmap(cm, annot=True, fmt='d', cmap='Greens',
            xticklabels=class_names_short,
            yticklabels=class_names_short)
plt.title('Confusion Matrix — TomatoHealth AI', fontsize=14)
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.savefig('/content/confusion_matrix.png', dpi=150)
plt.show()

# Accuracy plot
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Gabung history
all_acc = history1.history['accuracy'] + history2.history['accuracy']
all_val_acc = history1.history['val_accuracy'] + history2.history['val_accuracy']
all_loss = history1.history['loss'] + history2.history['loss']
all_val_loss = history1.history['val_loss'] + history2.history['val_loss']

ax1.plot(all_acc, label='Train Accuracy')
ax1.plot(all_val_acc, label='Val Accuracy')
ax1.axvline(x=4.5, color='gray', linestyle='--', label='Fine-tune start')
ax1.set_title('Model Accuracy')
ax1.legend()

ax2.plot(all_loss, label='Train Loss')
ax2.plot(all_val_loss, label='Val Loss')
ax2.axvline(x=4.5, color='gray', linestyle='--', label='Fine-tune start')
ax2.set_title('Model Loss')
ax2.legend()

plt.tight_layout()
plt.savefig('/content/training_history.png', dpi=150)
plt.show()

val_loss, val_acc = model.evaluate(val_generator)
print(f"\nFinal Validation Accuracy: {val_acc:.4f}")
print(f"Final Validation Loss: {val_loss:.4f}")

# ============================================================
# CELL 9: Simpan Label Map untuk Backend
# ============================================================
label_map = {}
label_map_indo = {
    'healthy': 'Sehat',
    'Bacterial_spot': 'Bercak Bakteri (Bacterial Spot)',
    'Early_blight': 'Bercak Daun Awal (Early Blight)',
    'Late_blight': 'Bercak Daun Akhir (Late Blight)',
    'Leaf_Mold': 'Jamur Daun (Leaf Mold)',
    'Septoria_leaf_spot': 'Bercak Septoria (Septoria Leaf Spot)',
    'Spider_mites Two-spotted_spider_mite': 'Tungau Laba-laba (Spider Mites)',
    'Target_Spot': 'Bercak Target (Target Spot)',
    'Tomato_Yellow_Leaf_Curl_Virus': 'Virus Keriting Kuning (Yellow Leaf Curl)',
    'Tomato_mosaic_virus': 'Virus Mosaik (Mosaic Virus)',
}

print("LABEL_MAP untuk backend (copy ke label_map.py):\n")
print("LABEL_MAP = {")
for class_name, idx in sorted(val_generator.class_indices.items(), key=lambda x: x[1]):
    short_name = class_name.replace('Tomato___', '').replace('Tomato__', '')
    indo_name = label_map_indo.get(short_name, short_name)
    print(f'    {idx}: "{indo_name}",')
print("}")

# ============================================================
# CELL 10: Export Model & Download
# ============================================================

# Simpan sebagai .h5
model.save('/content/tomato_model.h5')
print("✅ Model saved: /content/tomato_model.h5")

# Simpan juga sebagai SavedModel format (opsional, lebih modern)
model.save('/content/tomato_model_savedmodel')
print("✅ Model saved: /content/tomato_model_savedmodel/")

# Cek ukuran file
size_mb = os.path.getsize('/content/tomato_model.h5') / (1024 * 1024)
print(f"📦 Ukuran model: {size_mb:.1f} MB")

# Download ke laptop
# from google.colab import files
# files.download('/content/tomato_model.h5')

print("\n" + "=" * 50)
print("SELESAI! Download tomato_model.h5")
print("Taruh di: backend/ml/models/tomato_model.h5")
print("=" * 50)
