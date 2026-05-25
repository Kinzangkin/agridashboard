import os
import requests

urls = {
    'EARLY BLIGHT': [
        'https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/color/Tomato___Early_blight/0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B%208389.JPG',
        'https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/color/Tomato___Early_blight/0034a551-9512-44e5-ba6c-827f85ecc688___RS_Erly.B%209432.JPG'
    ],
    'BACTERIAL SPOT': [
        'https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/color/Tomato___Bacterial_spot/00416648-be6e-4bd4-bc8d-82f43f8a7240___GCREC_Bact.Sp%203110.JPG',
        'https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/color/Tomato___Bacterial_spot/0045ba29-ed1b-43b4-afde-719cc7adefdb___GCREC_Bact.Sp%206254.JPG'
    ]
}

for folder, links in urls.items():
    dir_path = os.path.join('test_images', folder)
    os.makedirs(dir_path, exist_ok=True)
    for url in links:
        filename = url.split('/')[-1].replace('%20', '_')
        filepath = os.path.join(dir_path, filename)
        print(f"Mengunduh {filename} ke {folder}...")
        img_data = requests.get(url).content
        with open(filepath, 'wb') as f:
            f.write(img_data)

print("Berhasil mengunduh gambar yang kurang!")
