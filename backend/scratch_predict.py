import os
import io
import numpy as np
import tensorflow as tf
from PIL import Image

MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml", "models", "tomato_model.h5")
IMAGE_PATH = os.path.join(os.path.dirname(__file__), "static", "tomato-images", "7fcb3a20-a822-4893-87e6-04139f60d70a.jpeg")

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

print(f"Loading model from: {MODEL_PATH}")
model = tf.keras.models.load_model(MODEL_PATH)
print("Model loaded successfully!")

print(f"Loading image from: {IMAGE_PATH}")
img = Image.open(IMAGE_PATH).convert("RGB")
img = img.resize((224, 224))
img_array = np.array(img, dtype=np.float32)
img_array = img_array / 255.0
img_array = np.expand_dims(img_array, axis=0)

print("Running prediction...")
predictions = model.predict(img_array, verbose=0)
probs = predictions[0]

print("\n--- RAW PROBABILITIES ---")
for idx, prob in enumerate(probs):
    label = LABEL_MAP[idx]
    print(f"Index {idx} ({label}): {prob*100:.6f}%")
