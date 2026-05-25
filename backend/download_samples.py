import os
import requests
import time

CLASSES = {
    "Tomato___healthy": "SEHAT",
    "Tomato___Early_blight": "EARLY BLIGHT",
    "Tomato___Late_blight": "LATE BLIGHT",
    "Tomato___Bacterial_spot": "BACTERIAL SPOT"
}

BASE_API_URL = "https://api.github.com/repos/spMohanty/PlantVillage-Dataset/contents/raw/color"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "test_images")

def download_samples():
    print("Mulai mengunduh sampel gambar dari PlantVillage Dataset...")
    
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    for github_folder, local_folder in CLASSES.items():
        folder_path = os.path.join(OUTPUT_DIR, local_folder)
        if not os.path.exists(folder_path):
            os.makedirs(folder_path)
            
        print(f"\nMencari gambar untuk kelas: {local_folder}")
        try:
            r = requests.get(f"{BASE_API_URL}/{github_folder}")
            if r.status_code == 200:
                files = r.json()
                # Ambil 2 file pertama
                for file_info in files[:2]:
                    download_url = file_info["download_url"]
                    file_name = file_info["name"]
                    
                    # Jangan donwload jika sudah ada
                    save_path = os.path.join(folder_path, file_name)
                    if os.path.exists(save_path):
                        print(f"  Sudah ada: {file_name}")
                        continue
                        
                    print(f"  Mengunduh: {file_name} ...", end=" ")
                    img_data = requests.get(download_url).content
                    with open(save_path, "wb") as handler:
                        handler.write(img_data)
                    print("Selesai.")
                    time.sleep(1) # Jeda sedikit agar tidak kena rate limit
            else:
                print(f"  Gagal mendapatkan daftar file: HTTP {r.status_code}")
        except Exception as e:
            print(f"  Error: {e}")

    print("\nSemua sampel berhasil diunduh!")

if __name__ == "__main__":
    download_samples()
