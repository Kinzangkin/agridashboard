"""
====================================================================
  AgriDashboard — Script Pengujian Model ML (untuk Presentasi)
====================================================================
  Cara Pakai:
  1. Simpan gambar-gambar daun tomat ke dalam folder: backend/test_images/
     (buat sub-folder per penyakit jika ingin hitung akurasi)
  2. Jalankan: python test_model.py
  3. Pastikan backend uvicorn sudah berjalan di port 8000

  Struktur folder contoh untuk hitung akurasi:
    test_images/
    ├── SEHAT/           gambar1.jpg, gambar2.jpg, ...
    ├── EARLY BLIGHT/    gambar1.jpg, ...
    ├── LATE BLIGHT/     gambar1.jpg, ...
    └── BACTERIAL SPOT/  gambar1.jpg, ...

  Jika tidak pakai sub-folder, tetap bisa jalan — hanya tidak
  menampilkan kolom akurasi (tidak ada ground truth).
====================================================================
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from datetime import datetime

# ============================================================
# KONFIGURASI
# ============================================================
API_BASE_URL = "http://localhost:8000"
TEST_IMAGES_DIR = os.path.join(os.path.dirname(__file__), "test_images")

# Nilai sensor default yang akan dikirim bersama gambar
DEFAULT_TEMPERATURE = 27.5
DEFAULT_HUMIDITY    = 70.0

# Ekstensi gambar yang didukung
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# ============================================================
# WARNA TERMINAL (ANSI)
# ============================================================
class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    RED    = "\033[91m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    BLUE   = "\033[94m"
    CYAN   = "\033[96m"
    WHITE  = "\033[97m"
    DIM    = "\033[2m"


def cprint(text, color=C.RESET, bold=False):
    prefix = C.BOLD if bold else ""
    print(f"{prefix}{color}{text}{C.RESET}")


def separator(char="─", width=72):
    print(C.DIM + char * width + C.RESET)


# ============================================================
# CEK KONEKSI BACKEND
# ============================================================
def check_backend():
    try:
        r = requests.get(f"{API_BASE_URL}/", timeout=5)
        data = r.json()
        model_loaded = data.get("model_loaded", False)
        return True, model_loaded
    except Exception:
        return False, False


# ============================================================
# KIRIM GAMBAR KE API DAN DAPATKAN PREDIKSI
# ============================================================
def predict_image(image_path: str, temperature: float, humidity: float) -> dict:
    try:
        with open(image_path, "rb") as f:
            ext = Path(image_path).suffix.lower()
            mime = "image/jpeg" if ext in {".jpg", ".jpeg"} else "image/png"
            files = {"image": (Path(image_path).name, f, mime)}
            data  = {"temperature": temperature, "humidity": humidity}
            r = requests.post(f"{API_BASE_URL}/api/upload", files=files, data=data, timeout=30)

        if r.status_code == 200:
            return r.json()
        else:
            return {"success": False, "error": f"HTTP {r.status_code}"}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Timeout — server terlalu lama merespons"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# KUMPULKAN GAMBAR (dengan atau tanpa sub-folder ground truth)
# ============================================================
def collect_images(base_dir: str):
    """
    Mengembalikan list of dict:
      { "path": str, "ground_truth": str|None }
    Jika gambar ada di sub-folder, nama sub-folder = ground truth label.
    Jika gambar langsung di root folder, ground_truth = None.
    """
    results = []
    base = Path(base_dir)

    if not base.exists():
        return results

    # Cek sub-folder (mode akurasi)
    has_subfolders = any(p.is_dir() for p in base.iterdir())

    if has_subfolders:
        for subfolder in sorted(base.iterdir()):
            if subfolder.is_dir():
                label = subfolder.name.upper()
                for f in sorted(subfolder.iterdir()):
                    if f.suffix.lower() in IMAGE_EXTENSIONS:
                        results.append({"path": str(f), "ground_truth": label})
    else:
        # Mode tanpa ground truth — gambar langsung di root
        for f in sorted(base.iterdir()):
            if f.suffix.lower() in IMAGE_EXTENSIONS:
                results.append({"path": str(f), "ground_truth": None})

    return results


# ============================================================
# FORMAT LABEL PENYAKIT
# ============================================================
def shorten_label(label: str, max_len: int = 24) -> str:
    if len(label) <= max_len:
        return label
    return label[:max_len - 1] + "…"


def label_color(label: str) -> str:
    if "SEHAT" in label.upper():
        return C.GREEN
    return C.RED


# ============================================================
# MAIN
# ============================================================
def main():
    print()
    separator("═")
    cprint("  🌿  AgriDashboard — Pengujian Model ML", C.GREEN, bold=True)
    cprint(f"  📅  {datetime.now().strftime('%d %B %Y, %H:%M:%S')}", C.DIM)
    separator("═")
    print()

    # 1. Cek backend
    cprint("◉ Mengecek koneksi ke Backend API...", C.CYAN)
    backend_ok, model_loaded = check_backend()

    if not backend_ok:
        cprint("  ✗ Backend TIDAK dapat dijangkau!", C.RED, bold=True)
        cprint("    Pastikan 'uvicorn main:app --reload --host 0.0.0.0' sudah berjalan.", C.YELLOW)
        sys.exit(1)

    if model_loaded:
        cprint(f"  ✓ Backend online  |  Model TensorFlow: LOADED ✅", C.GREEN)
    else:
        cprint(f"  ✓ Backend online  |  Model TensorFlow: ⚡ MOCK MODE (model.h5 tidak ditemukan)", C.YELLOW)

    print()

    # 2. Cek folder test_images
    cprint(f"◉ Membaca gambar dari: {TEST_IMAGES_DIR}", C.CYAN)
    images = collect_images(TEST_IMAGES_DIR)

    if not images:
        cprint(f"\n  ✗ Tidak ada gambar di folder: {TEST_IMAGES_DIR}", C.RED, bold=True)
        cprint("  Buat folder tersebut dan isi dengan gambar daun tomat:", C.YELLOW)
        cprint(f"\n    {TEST_IMAGES_DIR}/", C.WHITE)
        cprint("    ├── SEHAT/", C.DIM)
        cprint("    │   ├── sehat1.jpg", C.DIM)
        cprint("    │   └── sehat2.jpg", C.DIM)
        cprint("    ├── EARLY BLIGHT/", C.DIM)
        cprint("    │   └── blight1.jpg", C.DIM)
        cprint("    └── (atau langsung taruh jpg di sini tanpa sub-folder)", C.DIM)
        print()
        cprint("  Download gambar test dari PlantVillage Dataset:", C.CYAN)
        cprint("  https://www.kaggle.com/datasets/emmarex/plantdisease", C.BLUE)
        sys.exit(0)

    has_gt = images[0]["ground_truth"] is not None
    cprint(f"  ✓ {len(images)} gambar ditemukan  |  Mode: {'Akurasi (dengan ground truth)' if has_gt else 'Prediksi saja (tanpa ground truth)'}", C.GREEN)
    print()

    # 3. Header tabel
    separator()
    if has_gt:
        print(f"  {'No':<4}  {'Nama File':<26}  {'Ground Truth':<22}  {'Prediksi':<24}  {'Conf':>6}  {'✓/✗':>4}")
    else:
        print(f"  {'No':<4}  {'Nama File':<32}  {'Prediksi':<28}  {'Conf':>6}  {'Status':>8}")
    separator()

    # 4. Proses setiap gambar
    results = []
    correct = 0
    total   = 0

    for i, item in enumerate(images, 1):
        path       = item["path"]
        ground_truth = item["ground_truth"]
        filename   = Path(path).name

        resp = predict_image(path, DEFAULT_TEMPERATURE, DEFAULT_HUMIDITY)
        total += 1

        if resp.get("success") and resp.get("data"):
            pred_label  = resp["data"]["prediction"]["diseaseLabel"]
            confidence  = resp["data"]["prediction"]["confidence"]
            is_mock     = resp.get("is_mock", False)

            if has_gt:
                # Cek apakah prediksi benar
                # Pengecekan fleksibel: ground truth bisa "SEHAT", prediksi bisa "SEHAT (KONDISI OPTIMAL)"
                gt_upper   = ground_truth.upper()
                pred_upper = pred_label.upper()
                is_correct = (
                    gt_upper in pred_upper or
                    pred_upper in gt_upper or
                    (gt_upper == "SEHAT" and "SEHAT" in pred_upper) or
                    gt_upper == pred_upper
                )

                if is_correct:
                    correct += 1
                    tick_color = C.GREEN
                    tick = "✓"
                else:
                    tick_color = C.RED
                    tick = "✗"

                mock_tag = " ⚡" if is_mock else ""
                print(
                    f"  {i:<4}  "
                    f"{C.WHITE}{filename[:26]:<26}{C.RESET}  "
                    f"{C.CYAN}{shorten_label(ground_truth, 22):<22}{C.RESET}  "
                    f"{label_color(pred_label)}{shorten_label(pred_label, 24):<24}{C.RESET}  "
                    f"{confidence:>5.1f}%  "
                    f"{tick_color}{C.BOLD}{tick:>4}{C.RESET}{mock_tag}"
                )
                results.append({
                    "file": filename,
                    "ground_truth": ground_truth,
                    "predicted": pred_label,
                    "confidence": confidence,
                    "correct": is_correct,
                    "is_mock": is_mock,
                })
            else:
                mock_tag = " ⚡" if is_mock else ""
                is_disease = resp["data"]["prediction"].get("isDisease", False)
                status_color = C.RED if is_disease else C.GREEN
                status_label = "SAKIT" if is_disease else "SEHAT"

                print(
                    f"  {i:<4}  "
                    f"{C.WHITE}{filename[:32]:<32}{C.RESET}  "
                    f"{label_color(pred_label)}{shorten_label(pred_label, 28):<28}{C.RESET}  "
                    f"{confidence:>5.1f}%  "
                    f"{status_color}{C.BOLD}{status_label:>8}{C.RESET}{mock_tag}"
                )
                results.append({
                    "file": filename,
                    "predicted": pred_label,
                    "confidence": confidence,
                    "is_mock": is_mock,
                })
        else:
            err = resp.get("error", "Unknown error")
            print(f"  {i:<4}  {C.WHITE}{filename[:32]:<32}{C.RESET}  {C.RED}ERROR: {err[:40]}{C.RESET}")
            results.append({"file": filename, "error": err})

        # Jeda kecil antar request agar tidak membebani server
        time.sleep(0.3)

    # 5. Ringkasan
    print()
    separator("═")
    cprint("  📊  RINGKASAN HASIL PENGUJIAN", C.CYAN, bold=True)
    separator("─")

    errors = sum(1 for r in results if "error" in r)
    processed = total - errors

    print(f"  Total gambar diuji     : {C.BOLD}{total}{C.RESET}")
    print(f"  Berhasil diproses      : {C.GREEN}{C.BOLD}{processed}{C.RESET}")
    if errors > 0:
        print(f"  Gagal/Error            : {C.RED}{C.BOLD}{errors}{C.RESET}")

    if has_gt and processed > 0:
        accuracy = (correct / processed) * 100
        color = C.GREEN if accuracy >= 80 else (C.YELLOW if accuracy >= 60 else C.RED)
        print(f"  Prediksi Benar         : {C.GREEN}{C.BOLD}{correct}{C.RESET} / {processed}")
        print(f"  Akurasi Model          : {color}{C.BOLD}{accuracy:.1f}%{C.RESET}")

        separator("─")
        # Hitung per-kelas
        from collections import defaultdict
        per_class = defaultdict(lambda: {"total": 0, "correct": 0})
        for r in results:
            if "ground_truth" in r and "error" not in r:
                per_class[r["ground_truth"]]["total"] += 1
                if r.get("correct"):
                    per_class[r["ground_truth"]]["correct"] += 1

        cprint("  Akurasi Per Kelas:", C.CYAN)
        for cls, counts in sorted(per_class.items()):
            acc = (counts["correct"] / counts["total"] * 100) if counts["total"] > 0 else 0
            bar_len = int(acc / 5)
            bar = "█" * bar_len + "░" * (20 - bar_len)
            color = C.GREEN if acc >= 80 else (C.YELLOW if acc >= 60 else C.RED)
            print(f"  {cls[:22]:<22}  {color}{bar}{C.RESET}  {acc:5.1f}%  ({counts['correct']}/{counts['total']})")

    # Cek apakah ada yang pakai mock mode
    mock_count = sum(1 for r in results if r.get("is_mock"))
    if mock_count > 0:
        print()
        cprint(f"  ⚡ {mock_count} gambar menggunakan MOCK MODE (model.h5 belum termuat).", C.YELLOW)
        cprint("     Muat model nyata untuk hasil akurasi yang sebenarnya.", C.YELLOW)

    separator("═")

    # 6. Simpan laporan JSON opsional
    report_path = os.path.join(os.path.dirname(__file__), "test_report.json")
    report = {
        "timestamp": datetime.now().isoformat(),
        "total": total,
        "processed": processed,
        "errors": errors,
        "accuracy_percent": round((correct / processed * 100) if (has_gt and processed > 0) else 0, 2),
        "results": results,
    }
    with open(report_path, "w", encoding="utf-8") as fp:
        json.dump(report, fp, ensure_ascii=False, indent=2)

    cprint(f"\n  💾  Laporan JSON disimpan ke: {report_path}", C.DIM)
    print()


if __name__ == "__main__":
    main()
