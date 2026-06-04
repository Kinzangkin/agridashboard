"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Filter, AlertCircle, ArrowUpRight, X, AlertTriangle, CheckCircle2, Thermometer, Droplets, Upload, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadPredict, PredictionResponse } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PredictionRecord {
  id: string;
  plantId: string;
  imageUrl: string;
  diseaseLabel: string;
  confidence: number;
  needsReview: boolean;
  humanReviewed: boolean;
  groundTruth: string | null;
  createdAt: string;
}

function detectGreenLeaf(video: HTMLVideoElement, offscreenCanvas: HTMLCanvasElement) {
  const ctx = offscreenCanvas.getContext('2d');
  if (!ctx) return null;

  const w = 160;
  const h = 120;
  offscreenCanvas.width = w;
  offscreenCanvas.height = h;

  // Draw video frame to small canvas
  ctx.drawImage(video, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let greenPixelCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Convert RGB to HSV
      const rP = r / 255;
      const gP = g / 255;
      const bP = b / 255;

      const cMax = Math.max(rP, gP, bP);
      const cMin = Math.min(rP, gP, bP);
      const delta = cMax - cMin;

      // Hue
      let hue = 0;
      if (delta !== 0) {
        if (cMax === rP) {
          hue = 60 * (((gP - bP) / delta) % 6);
        } else if (cMax === gP) {
          hue = 60 * (((bP - rP) / delta) + 2);
        } else if (cMax === bP) {
          hue = 60 * (((rP - gP) / delta) + 4);
        }
      }
      if (hue < 0) hue += 360;

      // OpenCV H scale is 0-179, so we divide hue by 2
      const hOpenCV = hue / 2;

      // Saturation
      const sOpenCV = cMax === 0 ? 0 : (delta / cMax) * 255;

      // Value
      const vOpenCV = cMax * 255;

      // Check green range: H in [25, 90], S > 40, V > 40
      if (hOpenCV >= 25 && hOpenCV <= 90 && sOpenCV > 40 && vOpenCV > 40) {
        greenPixelCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Minimum 0.5% of pixels must be green
  const minGreenPixels = 0.005 * w * h; // 0.5% of 19200 = 96 pixels
  if (greenPixelCount > minGreenPixels) {
    return {
      x: minX / w,
      y: minY / h,
      w: (maxX - minX) / w,
      h: (maxY - minY) / h
    };
  }

  return null;
}

export default function PredictionsPage() {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);

  // --- State for Upload Form ---
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<string>("25.5");
  const [humidity, setHumidity] = useState<string>("70");
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<PredictionResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State for Browser Webcam ---
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedBoxRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const boxOpacityRef = useRef<number>(0);

  // --- State for Predictions Gallery ---
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState<boolean>(true);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [galleryPage, setGalleryPage] = useState<number>(1);
  const [galleryTotal, setGalleryTotal] = useState<number>(0);
  const GALLERY_PER_PAGE = 12;

  const fetchPredictions = async (page: number = galleryPage) => {
    try {
      setIsGalleryLoading(true);
      setGalleryError(null);
      const skip = (page - 1) * GALLERY_PER_PAGE;
      const res = await fetch(`${API_BASE_URL}/api/predictions?limit=${GALLERY_PER_PAGE}&skip=${skip}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const json = await res.json();
      if (json.success) {
        setPredictions(json.data);
        setGalleryTotal(json.total ?? json.data.length);
      } else {
        setGalleryError(json.error || "Gagal memuat galeri prediksi.");
      }
    } catch (err) {
      console.error("Error fetching predictions:", err);
      setGalleryError("Gagal menghubungkan ke server backend.");
    } finally {
      setIsGalleryLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions(galleryPage);
  }, [galleryPage]);

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Real-time client-side leaf detection and tracking overlay
  useEffect(() => {
    if (!isWebcamActive) {
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
      smoothedBoxRef.current = null;
      boxOpacityRef.current = 0;
      return;
    }

    let active = true;
    const offscreenCanvas = document.createElement("canvas");
    const video = videoRef.current;
    if (!video) return;

    const loop = () => {
      if (!active) return;
      
      if (!video || video.paused || video.ended) {
        requestAnimationFrame(loop);
        return;
      }

      const canvas = overlayCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Sync canvas size
          const rect = canvas.getBoundingClientRect();
          if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
          }

          const newBox = detectGreenLeaf(video, offscreenCanvas);

          if (newBox) {
            boxOpacityRef.current = Math.min(boxOpacityRef.current + 0.1, 1);
            if (!smoothedBoxRef.current) {
              smoothedBoxRef.current = { ...newBox };
            } else {
              smoothedBoxRef.current.x += (newBox.x - smoothedBoxRef.current.x) * 0.15;
              smoothedBoxRef.current.y += (newBox.y - smoothedBoxRef.current.y) * 0.15;
              smoothedBoxRef.current.w += (newBox.w - smoothedBoxRef.current.w) * 0.15;
              smoothedBoxRef.current.h += (newBox.h - smoothedBoxRef.current.h) * 0.15;
            }
          } else {
            boxOpacityRef.current = Math.max(boxOpacityRef.current - 0.08, 0);
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (smoothedBoxRef.current && boxOpacityRef.current > 0) {
            const videoWidth = video.videoWidth || 640;
            const videoHeight = video.videoHeight || 480;
            const containerWidth = canvas.width;
            const containerHeight = canvas.height;

            const videoRatio = videoWidth / videoHeight;
            const containerRatio = containerWidth / containerHeight;

            let scale;
            let xOffset = 0;
            let yOffset = 0;

            if (containerRatio > videoRatio) {
              scale = containerWidth / videoWidth;
              yOffset = (containerHeight - videoHeight * scale) / 2;
            } else {
              scale = containerHeight / videoHeight;
              xOffset = (containerWidth - videoWidth * scale) / 2;
            }

            const ix = smoothedBoxRef.current.x * videoWidth;
            const iy = smoothedBoxRef.current.y * videoHeight;
            const iw = smoothedBoxRef.current.w * videoWidth;
            const ih = smoothedBoxRef.current.h * videoHeight;

            const cX = ix * scale + xOffset;
            const cY = iy * scale + yOffset;
            const cW = iw * scale;
            const cH = ih * scale;

            ctx.save();
            ctx.globalAlpha = boxOpacityRef.current;
            
            // Draw corners
            ctx.strokeStyle = '#10B981'; // emerald-500
            ctx.lineWidth = 3;
            ctx.shadowColor = '#10B981';
            ctx.shadowBlur = 8;

            const cornerLength = Math.min(20, cW / 4, cH / 4);

            // Top-Left
            ctx.beginPath();
            ctx.moveTo(cX + cornerLength, cY);
            ctx.lineTo(cX, cY);
            ctx.lineTo(cX, cY + cornerLength);
            ctx.stroke();

            // Top-Right
            ctx.beginPath();
            ctx.moveTo(cX + cW - cornerLength, cY);
            ctx.lineTo(cX + cW, cY);
            ctx.lineTo(cX + cW, cY + cornerLength);
            ctx.stroke();

            // Bottom-Left
            ctx.beginPath();
            ctx.moveTo(cX + cornerLength, cY + cH);
            ctx.lineTo(cX, cY + cH);
            ctx.lineTo(cX, cY + cH - cornerLength);
            ctx.stroke();

            // Bottom-Right
            ctx.beginPath();
            ctx.moveTo(cX + cW - cornerLength, cY + cH);
            ctx.lineTo(cX + cW, cY + cH);
            ctx.lineTo(cX + cW, cY + cH - cornerLength);
            ctx.stroke();

            // Outline
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
            ctx.strokeRect(cX, cY, cW, cH);

            // Fill
            ctx.fillStyle = 'rgba(16, 185, 129, 0.02)';
            ctx.fillRect(cX, cY, cW, cH);

            // Badge
            ctx.fillStyle = '#10B981';
            ctx.shadowColor = 'rgba(0,0,0,0.1)';
            ctx.shadowBlur = 4;
            
            const text = "DAUN TOMAT";
            ctx.font = "bold 9px sans-serif";
            const textWidth = ctx.measureText(text).width;
            
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(cX, cY - 18, textWidth + 12, 14, 4);
              ctx.fill();
            } else {
              ctx.fillRect(cX, cY - 18, textWidth + 12, 14);
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, cX + 6, cY - 8);

            ctx.restore();
          }
        }
      }

      requestAnimationFrame(loop);
    };

    if (video.readyState >= 1) {
      loop();
    } else {
      video.addEventListener("loadedmetadata", loop);
    }

    return () => {
      active = false;
      video.removeEventListener("loadedmetadata", loop);
    };
  }, [isWebcamActive]);

  // Handler untuk Buka Webcam di Browser
  const startWebcam = async (deviceIndex: number = 0) => {
    try {
      // Hentikan stream lama jika ada
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // 1. Minta akses kamera dasar terlebih dahulu agar browser memberikan izin lengkap untuk enumerasi
      let tempStream: MediaStream | null = null;
      try {
        tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permissionErr) {
        console.error("Gagal mendapatkan izin awal kamera:", permissionErr);
      }

      // 2. Sekarang izin telah diberikan, ambil semua media devices kategori kamera dengan label asli!
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoIn = devices.filter(d => d.kind === "videoinput");
      setVideoDevices(videoIn);
      setCurrentDeviceIndex(deviceIndex);

      // Hentikan stream sementara
      if (tempStream) {
        tempStream.getTracks().forEach(track => track.stop());
      }

      // 3. Jalankan stream kamera target berdasarkan indeks perangkat yang dipilih
      let constraints: MediaStreamConstraints = {
        video: {
          facingMode: "environment",
          frameRate: { ideal: 30, min: 25 }
        }
      };

      if (videoIn.length > 0) {
        const targetDevice = videoIn[deviceIndex % videoIn.length];
        constraints = {
          video: {
            deviceId: { exact: targetDevice.deviceId },
            frameRate: { ideal: 30, min: 25 }
          }
        };
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsWebcamActive(true);
      setPreviewUrl(null);
      setFile(null);
      setTestResult(null);

      // Berikan sedikit waktu agar elemen video me-render sebelum memasang stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);

      // 4. Update lagi list video input setelah stream jalan untuk memastikan device list sinkron
      const updatedDevices = await navigator.mediaDevices.enumerateDevices();
      const updatedVideoIn = updatedDevices.filter(d => d.kind === "videoinput");
      if (updatedVideoIn.length > videoIn.length) {
        setVideoDevices(updatedVideoIn);
      }
    } catch (err) {
      console.error("Gagal mengakses webcam:", err);
      alert("Gagal mengakses webcam browser. Pastikan Anda telah memberikan izin kamera.");
    }
  };

  // Handler untuk Stop Webcam
  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsWebcamActive(false);
  };

  // Handler untuk Tangkap Foto dari Webcam
  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const capturedFile = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" });
            setFile(capturedFile);
            setPreviewUrl(URL.createObjectURL(capturedFile));
            stopWebcam();
          }
        }, "image/jpeg", 0.95);
      }
    }
  };

  // Trigger countdown ketika webcam mulai aktif
  useEffect(() => {
    if (isWebcamActive) {
      setCountdown(15);
    } else {
      setCountdown(null);
    }
  }, [isWebcamActive]);

  // Tangkap & Kirim Otomatis ke Backend secara SILENT (Kamera tetap menyala 30fps)
  const silentCaptureAndUpload = useCallback(async () => {
    if (videoRef.current && isWebcamActive) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const capturedFile = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" });
            setFile(capturedFile);
            setPreviewUrl(URL.createObjectURL(capturedFile));

            // Kirim ke backend di background (tanpa mematikan kamera!)
            const temp = parseFloat(temperature);
            const hum = parseFloat(humidity);

            try {
              const response = await uploadPredict(
                isNaN(temp) ? 25.5 : temp,
                isNaN(hum) ? 70 : hum,
                capturedFile
              );

              if (response.success) {
                setTestResult(response);
                setGalleryPage(1);
                fetchPredictions(1);
              }
            } catch (err) {
              console.error("Gagal mengirim tangkapan otomatis:", err);
            }
          }
        }, "image/jpeg", 0.95);
      }
    }
  }, [isWebcamActive, temperature, humidity]);

  // Jam countdown timer loop 15 detik (kontinu tanpa menghentikan kamera)
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      silentCaptureAndUpload();
      setCountdown(15); // Reset hitung mundur ke 15 untuk siklus berikutnya secara kontinu!
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, silentCaptureAndUpload]);

  // Real-time client-side leaf detection and tracking overlay
  useEffect(() => {
    if (!isWebcamActive) {
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
      smoothedBoxRef.current = null;
      boxOpacityRef.current = 0;
      return;
    }

    let active = true;
    const offscreenCanvas = document.createElement("canvas");
    const video = videoRef.current;
    if (!video) return;

    const loop = () => {
      if (!active) return;
      
      if (!video || video.paused || video.ended) {
        requestAnimationFrame(loop);
        return;
      }

      const canvas = overlayCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Sync canvas size
          const rect = canvas.getBoundingClientRect();
          if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
          }

          const newBox = detectGreenLeaf(video, offscreenCanvas);

          if (newBox) {
            boxOpacityRef.current = Math.min(boxOpacityRef.current + 0.1, 1);
            if (!smoothedBoxRef.current) {
              smoothedBoxRef.current = { ...newBox };
            } else {
              smoothedBoxRef.current.x += (newBox.x - smoothedBoxRef.current.x) * 0.15;
              smoothedBoxRef.current.y += (newBox.y - smoothedBoxRef.current.y) * 0.15;
              smoothedBoxRef.current.w += (newBox.w - smoothedBoxRef.current.w) * 0.15;
              smoothedBoxRef.current.h += (newBox.h - smoothedBoxRef.current.h) * 0.15;
            }
          } else {
            boxOpacityRef.current = Math.max(boxOpacityRef.current - 0.08, 0);
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (smoothedBoxRef.current && boxOpacityRef.current > 0) {
            const videoWidth = video.videoWidth || 640;
            const videoHeight = video.videoHeight || 480;
            const containerWidth = canvas.width;
            const containerHeight = canvas.height;

            const videoRatio = videoWidth / videoHeight;
            const containerRatio = containerWidth / containerHeight;

            let scale;
            let xOffset = 0;
            let yOffset = 0;

            if (containerRatio > videoRatio) {
              scale = containerWidth / videoWidth;
              yOffset = (containerHeight - videoHeight * scale) / 2;
            } else {
              scale = containerHeight / videoHeight;
              xOffset = (containerWidth - videoWidth * scale) / 2;
            }

            const ix = smoothedBoxRef.current.x * videoWidth;
            const iy = smoothedBoxRef.current.y * videoHeight;
            const iw = smoothedBoxRef.current.w * videoWidth;
            const ih = smoothedBoxRef.current.h * videoHeight;

            const cX = ix * scale + xOffset;
            const cY = iy * scale + yOffset;
            const cW = iw * scale;
            const cH = ih * scale;

            ctx.save();
            ctx.globalAlpha = boxOpacityRef.current;
            
            // Draw corners
            ctx.strokeStyle = '#00FF00'; // Pure bright green
            ctx.lineWidth = 6;
            ctx.shadowColor = '#00FF00';
            ctx.shadowBlur = 12;

            const cornerLength = Math.min(20, cW / 4, cH / 4);

            // Top-Left
            ctx.beginPath();
            ctx.moveTo(cX + cornerLength, cY);
            ctx.lineTo(cX, cY);
            ctx.lineTo(cX, cY + cornerLength);
            ctx.stroke();

            // Top-Right
            ctx.beginPath();
            ctx.moveTo(cX + cW - cornerLength, cY);
            ctx.lineTo(cX + cW, cY);
            ctx.lineTo(cX + cW, cY + cornerLength);
            ctx.stroke();

            // Bottom-Left
            ctx.beginPath();
            ctx.moveTo(cX + cornerLength, cY + cH);
            ctx.lineTo(cX, cY + cH);
            ctx.lineTo(cX, cY + cH - cornerLength);
            ctx.stroke();

            // Bottom-Right
            ctx.beginPath();
            ctx.moveTo(cX + cW - cornerLength, cY + cH);
            ctx.lineTo(cX + cW, cY + cH);
            ctx.lineTo(cX + cW, cY + cH - cornerLength);
            ctx.stroke();

            // Outline
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
            ctx.strokeRect(cX, cY, cW, cH);

            // Fill
            ctx.fillStyle = 'rgba(16, 185, 129, 0.02)';
            ctx.fillRect(cX, cY, cW, cH);

            // Badge
            ctx.fillStyle = '#10B981';
            ctx.shadowColor = 'rgba(0,0,0,0.1)';
            ctx.shadowBlur = 4;
            
            const text = "DAUN TOMAT";
            ctx.font = "bold 9px sans-serif";
            const textWidth = ctx.measureText(text).width;
            
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(cX, cY - 18, textWidth + 12, 14, 4);
              ctx.fill();
            } else {
              ctx.fillRect(cX, cY - 18, textWidth + 12, 14);
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, cX + 6, cY - 8);

            ctx.restore();
          }
        }
      }

      requestAnimationFrame(loop);
    };

    if (video.readyState >= 1) {
      loop();
    } else {
      video.addEventListener("loadedmetadata", loop);
    }

    return () => {
      active = false;
      video.removeEventListener("loadedmetadata", loop);
    };
  }, [isWebcamActive]);

  const filteredPredictions = predictions.filter((p) => {
    const shortId = `PIC-${p.id.slice(0, 5).toUpperCase()}`;
    const idMatch = shortId.includes(searchQuery.toUpperCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const labelMatch = p.diseaseLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return idMatch || labelMatch;
  });

  const getAiInsight = (status: string) => {
    const statusUpper = status.toUpperCase();
    if (statusUpper.includes("TIDAK TERDETEKSI DAUN") || statusUpper.includes("BUKAN DAUN")) {
      return {
        desc: "Kamera tidak mendeteksi objek daun hijau tomat yang dominan di dalam bingkai gambar.",
        action: "Dekatkan objek daun hijau tomat hingga memenuhi minimal 80% bingkai kamera, pastikan pencahayaan cukup dan hindari masuknya jari, wajah, atau latar ruangan yang ramai.",
        risk: "N/A (Bukan Daun)",
        color: "text-sky-700 bg-sky-50/70 border-sky-200"
      };
    } else if (statusUpper.includes("SUHU TINGGI")) {
      return {
        desc: "Daun dalam kondisi sehat secara fisik, namun sensor merekam suhu lingkungan yang terlalu panas (di atas 30°C). Hal ini berisiko memicu penguapan berlebih (stomata menutup) dan layu daun.",
        action: "1. Berikan peneduh/jaring paranet jika tanaman terkena matahari terik langsung.\n2. Lakukan penyiraman kabut (mist cooling) untuk mendinginkan area sekitar daun.\n3. Jaga kelembapan tanah agar akar tetap terhidrasi.",
        risk: "Rendah (Tantangan Lingkungan)",
        color: "text-amber-700 bg-amber-50/80 border-amber-200"
      };
    } else if (statusUpper.includes("RAWAN JAMUR") || statusUpper.includes("KELEMBAPAN TINGGI")) {
      return {
        desc: "Daun dalam kondisi sehat secara fisik, namun sensor merekam kelembapan udara yang terlalu tinggi (di atas 80%). Lingkungan basah/lembab ini sangat disukai spora jamur penyebab bercak daun.",
        action: "1. Tingkatkan ventilasi atau nyalakan sirkulasi kipas angin di area tanaman.\n2. Hindari menyiram air langsung ke atas permukaan daun.\n3. Kurangi frekuensi siram jika tanah masih terasa sangat basah.",
        risk: "Rendah (Risiko Preventif)",
        color: "text-blue-700 bg-blue-50/80 border-blue-200"
      };
    } else if (statusUpper.includes("SUHU DINGIN") || statusUpper.includes("PERTUMBUHAN LAMBAT")) {
      return {
        desc: "Daun dalam kondisi sehat secara fisik, namun berada di suhu lingkungan yang terlalu dingin (di bawah 18°C) yang dapat memperlambat proses metabolisme tanaman.",
        action: "1. Pastikan tanaman terlindung dari hembusan angin malam yang beku.\n2. Pindahkan tanaman ke area yang lebih hangat jika memungkinkan.\n3. Jangan terlalu sering melakukan penyiraman saat udara dingin.",
        risk: "Rendah (Tantangan Lingkungan)",
        color: "text-cyan-700 bg-cyan-50/80 border-cyan-200"
      };
    } else if (statusUpper.includes("OPTIMAL") || statusUpper.includes("SEHAT")) {
      return {
        desc: "Luar biasa! Daun tomat Anda tumbuh sehat dengan struktur vegetatif yang sempurna dan berada di lingkungan mikroklimat yang sangat ideal.",
        action: "Pertahankan konsistensi ini! Lanjutkan jadwal penyiraman 2x sehari dan pemupukan berkala untuk menjaga kebugaran daun.",
        risk: "Nihil (Sangat Baik)",
        color: "text-emerald-700 bg-emerald-50/80 border-emerald-200"
      };
    } else {
      // General Output for any detected disease
      return {
        desc: `Sistem mendeteksi adanya gejala penyakit pada daun (${status}). Segera lakukan tindakan pencegahan agar penyakit tidak menular ke tanaman lainnya.`,
        action: "1. Pisahkan/isolasi tanaman yang terinfeksi dari tanaman yang sehat.\n2. Pangkas dan buang bagian daun yang menunjukkan bercak atau layu.\n3. Bersihkan alat pertanian sebelum dan sesudah menyentuh tanaman.\n4. Lakukan penyiraman langsung pada tanah (hindari menyiram permukaan daun untuk mengurangi kelembapan jamur).\n5. Konsultasikan dengan penyuluh pertanian atau gunakan fungisida/bakterisida umum jika infeksi meluas.",
        risk: "Sedang - Tinggi (Memerlukan Tindakan)",
        color: "text-rose-700 bg-rose-50 border-rose-200"
      };
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setTestResult(null); // Reset result on new file
    }
  };

  const handleUploadPredict = async () => {
    if (!file) return;

    setIsLoading(true);
    setTestResult(null);

    const temp = parseFloat(temperature);
    const hum = parseFloat(humidity);

    const response = await uploadPredict(
      isNaN(temp) ? 25.5 : temp,
      isNaN(hum) ? 70 : hum,
      file
    );

    setTestResult(response);
    setIsLoading(false);

    // Refresh galeri secara otomatis jika prediksi sukses
    if (response.success) {
      setGalleryPage(1);
      fetchPredictions(1);
    }

    // Update localStorage agar Dashboard dapat mendeteksi perubahan
    if (response.success && response.data) {
      localStorage.setItem('latestPrediction', JSON.stringify({
        temperature: response.data.sensor.temperature,
        humidity: response.data.sensor.humidity,
        timestamp: new Date().toISOString()
      }));
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    } catch (e) {
      return "";
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Galeri Prediksi ML</h1>
          <p className="text-slate-600 mt-1">Kumpulan gambar tanaman beserta hasil klasifikasi dari model MobileNetV2.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Cari label penyakit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white/50 border border-white/60 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 w-64 transition-all"
            />
          </div>
          <Button variant="outline" className="glass rounded-full border border-white/60 text-slate-600">
            <Filter size={16} className="mr-2" /> Label Tertentu
          </Button>
        </div>
      </div>

      {/* --- Test Prediction Panel --- */}
      <div className="glass rounded-[32px] p-6 border border-white/60 shadow-sm mb-2">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ActivitySquareIcon className="text-emerald-500" />
          Test Prediksi Manual (Webcam & File)
        </h2>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Upload & Webcam Area */}
          <div className="flex-1">
            <div
              onClick={() => {
                if (!isWebcamActive && !previewUrl) {
                  fileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
                ${isWebcamActive ? 'border-sky-300 bg-sky-50/20' : previewUrl ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/50'}
              `}
              style={{ minHeight: '200px' }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {isWebcamActive ? (
                <div className="flex flex-col items-center w-full" onClick={(e) => e.stopPropagation()}>
                  <div className="relative w-full max-w-2xl h-72 rounded-2xl overflow-hidden shadow-lg bg-black mb-4 border border-white/50 group">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      controls={false}
                      className="w-full h-full object-cover"
                    />
                    <canvas
                      ref={overlayCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    />

                    {/* Countdown Badge — pojok kiri atas */}
                    {countdown !== null && (
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 border border-white/20">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shadow-md animate-bounce">
                          {countdown}
                        </div>
                        <span className="text-white text-[9px] font-semibold uppercase tracking-widest">Auto Capture</span>
                      </div>
                    )}

                    {/* ML Status Overlay — pojok kanan bawah di dalam frame */}
                    {testResult && testResult.success && testResult.data && (
                      <div className={`absolute bottom-2 right-2 max-w-[200px] rounded-xl px-3 py-2 border text-xs backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                        !testResult.data.prediction.isDisease
                          ? 'bg-emerald-900/70 border-emerald-400/40 text-emerald-100'
                          : 'bg-rose-900/70 border-rose-400/40 text-rose-100'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {!testResult.data.prediction.isDisease
                            ? <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                            : <AlertTriangle size={11} className="text-rose-400 shrink-0" />}
                          <span className="font-bold text-[10px] uppercase tracking-wide truncate">
                            {testResult.data.prediction.diseaseLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                !testResult.data.prediction.isDisease ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                              style={{ width: `${testResult.data.prediction.confidence}%` }}
                            />
                          </div>
                          <span className="font-semibold text-[9px] opacity-90 shrink-0">
                            {testResult.data.prediction.confidence}%
                          </span>
                        </div>
                        {testResult.is_mock && (
                          <span className="mt-1 block text-[8px] opacity-60">⚡ Mock Mode</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        silentCaptureAndUpload();
                        setCountdown(15);
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 py-2 shadow-md"
                    >
                      <Camera className="mr-2 h-4 w-4" /> Ambil Sekarang
                    </Button>

                    {videoDevices.length > 1 && (
                      <Button
                        onClick={() => startWebcam(currentDeviceIndex + 1)}
                        className="bg-sky-500 hover:bg-sky-600 text-white rounded-full px-4 py-2 shadow-md"
                        title="Beralih ke kamera eksternal USB / internal"
                      >
                        Ganti Kamera ({currentDeviceIndex % videoDevices.length + 1}/{videoDevices.length})
                      </Button>
                    )}

                    <Button
                      onClick={stopWebcam}
                      variant="outline"
                      className="glass rounded-full px-6 py-2 border-slate-300 text-slate-600"
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="h-28 w-28 object-cover rounded-xl shadow-md border border-white" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-700">{file?.name || "webcam_capture.jpg"}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file?.size ? (file.size / 1024).toFixed(1) : 0)} KB</p>

                    <div className="flex gap-2 mt-3">
                      <Button variant="ghost" className="text-emerald-600 px-0 h-auto text-xs hover:bg-transparent hover:text-emerald-700 hover:underline" onClick={() => fileInputRef.current?.click()}>
                        Ganti Gambar
                      </Button>
                      <span className="text-slate-300">|</span>
                      <Button variant="ghost" className="text-sky-600 px-0 h-auto text-xs hover:bg-transparent hover:text-sky-700 hover:underline flex items-center gap-1" onClick={() => startWebcam(0)}>
                        <Camera size={12} /> Gunakan Webcam
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 border border-slate-100">
                    <Upload className="text-slate-400" size={20} />
                  </div>
                  <p className="font-semibold text-slate-700">Klik / Seret foto untuk Upload daun</p>
                  <p className="text-xs text-slate-500 mt-1">Format: JPG, PNG, WEBP (Maks 5MB)</p>

                  <span className="text-xs text-slate-400 my-2 font-medium">— atau —</span>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      startWebcam();
                    }}
                    className="rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold px-5 py-2 flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Camera size={14} /> Ambil dari Webcam
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Sensor Inputs & Action */}
          <div className="w-full md:w-1/3 flex flex-col justify-center gap-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">Suhu (°C)</label>
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 h-4 w-4" />
                  <input
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">Kelembapan (%)</label>
                <div className="relative">
                  <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 h-4 w-4" />
                  <input
                    type="number"
                    value={humidity}
                    onChange={(e) => setHumidity(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleUploadPredict}
              disabled={!file || isLoading || isWebcamActive}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 py-5"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menganalisis...</>
              ) : (
                <><ActivitySquareIcon className="mr-2 h-4 w-4" /> Analisis Sekarang</>
              )}
            </Button>
          </div>
        </div>

        {/* Test Result Display */}
        {testResult && (
          <div className="mt-6 pt-6 border-t border-white/50 animate-in slide-in-from-top-4 fade-in duration-300">
            {testResult.success && testResult.data ? (
              <div className="flex flex-col md:flex-row gap-6">
                <div className={`p-4 rounded-2xl flex-1 border ${getAiInsight(testResult.data.prediction.diseaseLabel).color}`}>
                  <h4 className="font-bold flex items-center gap-2 mb-2 text-sm">
                    {!testResult.data.prediction.isDisease ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    Hasil Prediksi
                    {testResult.is_mock && (
                      <span className="ml-auto text-[10px] font-normal bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">⚡ Mock Mode</span>
                    )}
                  </h4>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl font-bold">{testResult.data.prediction.diseaseLabel}</span>
                    <span className="glass bg-white/50 px-2 py-1 rounded-md text-sm font-semibold">
                      {testResult.data.prediction.confidence}% Confidence
                    </span>
                  </div>
                  <p className="text-sm opacity-90 leading-relaxed mb-3">
                    {getAiInsight(testResult.data.prediction.diseaseLabel).desc}
                  </p>

                  {testResult.data.prediction.needsReview && (
                    <div className="mt-2 text-xs font-semibold bg-white/50 px-3 py-2 rounded-lg inline-flex items-center gap-2">
                      <AlertCircle size={14} className="text-amber-600" />
                      Confidence rendah (&lt;90%). Akan masuk antrean Human Review.
                    </div>
                  )}
                </div>

                <div className="md:w-1/3 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
                  <h4 className="font-bold text-slate-800 mb-2 text-sm">Respons Server:</h4>
                  <pre className="text-[10px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200 overflow-x-auto">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 flex items-start gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-bold text-sm">Gagal memproses prediksi</h4>
                  <p className="text-sm mt-1">{testResult.error || "Pastikan backend berjalan (python main.py)."}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* --- End Test Prediction Panel --- */}

      {/* --- Predictions Gallery --- */}
      {isGalleryLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/40 border border-white/60 rounded-[32px]">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
          <span className="text-sm font-medium text-slate-500 mt-2">Memuat galeri prediksi dari database...</span>
        </div>
      ) : galleryError ? (
        <div className="text-center py-12 text-rose-500 font-semibold text-sm bg-white/40 border border-white/60 rounded-[32px]">
          {galleryError}
        </div>
      ) : filteredPredictions.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm bg-white/40 border border-white/60 rounded-[32px]">
          {searchQuery ? "Tidak ditemukan hasil prediksi yang cocok." : "Belum ada riwayat analisis di database. Mulailah dengan melakukan pengujian di atas!"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredPredictions.map((pred, i) => {
            const isHealthy = pred.diseaseLabel.toUpperCase().includes("SEHAT");
            const isLowConf = pred.confidence < 90;
            const formattedTime = formatTime(pred.createdAt);
            const formattedDate = formatDate(pred.createdAt);

            return (
              <div
                key={pred.id}
                onClick={() => setSelectedItem(i)}
                className="glass rounded-[28px] overflow-hidden border border-white/60 shadow-sm hover:-translate-y-1 transition-transform group cursor-pointer"
              >
                <div className="relative h-48 overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pred.imageUrl || "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=400&auto=format&fit=crop"} alt={pred.diseaseLabel} className="w-full h-full object-cover" />
                  {isLowConf && (
                    <div className="absolute top-2 right-2 bg-amber-500 text-white p-1.5 rounded-full shadow-lg" title="Butuh Review">
                      <AlertCircle size={16} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 text-slate-700">
                      <ArrowUpRight size={20} />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider ${isHealthy ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                      {pred.diseaseLabel}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{pred.confidence.toFixed(1)}%</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2 flex justify-between">
                    <span>ID: PIC-{pred.id.slice(0, 5).toUpperCase()}</span>
                    <span>{formattedDate}, {formattedTime}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isGalleryLoading && !galleryError && filteredPredictions.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(galleryTotal / GALLERY_PER_PAGE));
        const startItem = galleryTotal === 0 ? 0 : (galleryPage - 1) * GALLERY_PER_PAGE + 1;
        const endItem = Math.min(galleryPage * GALLERY_PER_PAGE, galleryTotal);

        const pages: number[] = [];
        let startPage = Math.max(1, galleryPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
          startPage = Math.max(1, endPage - 4);
        }
        for (let i = startPage; i <= endPage; i++) {
          pages.push(i);
        }

        return (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
            <span className="text-sm text-slate-500">Menampilkan {startItem}–{endItem} dari {galleryTotal} prediksi</span>
            <div className="flex gap-1 items-center">
              <Button
                variant="outline"
                size="sm"
                className="glass rounded-full h-8 px-3 border-white/60"
                disabled={galleryPage <= 1}
                onClick={() => setGalleryPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              {pages.map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  className={`glass rounded-full h-8 px-3 border-white/60 ${p === galleryPage ? 'bg-white/80 font-bold text-emerald-700' : ''}`}
                  onClick={() => setGalleryPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="glass rounded-full h-8 px-3 border-white/60"
                disabled={galleryPage >= totalPages}
                onClick={() => setGalleryPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
              <Button
                onClick={() => fetchPredictions(galleryPage)}
                variant="outline"
                className="glass rounded-full h-8 px-4 border-white/60 text-slate-600 hover:bg-white/50 ml-2"
              >
                Segarkan
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Modal Detail */}
      {selectedItem !== null && filteredPredictions[selectedItem] && (() => {
        const pred = filteredPredictions[selectedItem];
        return (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedItem(null)}></div>

            <div className="glass bg-white/80 w-full max-w-3xl rounded-[32px] overflow-hidden shadow-2xl relative z-10 border border-white flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-white/50 hover:bg-white rounded-full z-20 text-slate-500"
                onClick={() => setSelectedItem(null)}
              >
                <X size={20} />
              </Button>

              {/* Left side: Image */}
              <div className="md:w-1/2 relative h-64 md:h-auto bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pred.imageUrl || "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=1200&auto=format&fit=crop"} alt="Detail" className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 glass px-3 py-1.5 rounded-full text-xs font-semibold text-slate-800">
                  PIC-{pred.id.slice(0, 5).toUpperCase()}
                </div>
              </div>

              {/* Right side: AI Insight */}
              <div className="md:w-1/2 p-6 md:p-8 flex flex-col h-full overflow-y-auto max-h-[80vh]">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">{pred.diseaseLabel}</h2>
                  <div className="flex items-center gap-3">
                    <span className="glass px-3 py-1 rounded-full text-sm font-bold text-slate-700">Conf: {pred.confidence.toFixed(1)}%</span>
                    <span className="text-xs text-slate-500">Direkam: {formatDate(pred.createdAt)}, {formatTime(pred.createdAt)}</span>
                  </div>
                </div>

                {/* Sensor Context */}
                <div className="flex gap-4 mb-6 p-4 glass rounded-2xl border border-white/50">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Suhu Saat Itu</p>
                    <p className="font-medium text-slate-500 flex items-center gap-1 text-sm italic"><Thermometer size={14} className="text-rose-400" /> Tidak tersimpan</p>
                  </div>
                  <div className="w-px bg-slate-200"></div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Kelembapan</p>
                    <p className="font-medium text-slate-500 flex items-center gap-1 text-sm italic"><Droplets size={14} className="text-blue-400" /> Tidak tersimpan</p>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${getAiInsight(pred.diseaseLabel).color} mb-6`}>
                  <h4 className="font-bold flex items-center gap-2 mb-2 text-sm">
                    {pred.diseaseLabel.toUpperCase() === "SEHAT" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    Analisis AI
                  </h4>
                  <p className="text-sm leading-relaxed opacity-90">
                    {getAiInsight(pred.diseaseLabel).desc}
                  </p>
                  <div className="mt-3 pt-3 border-t border-current/20">
                    <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Risiko Ekologis:</p>
                    <p className="text-sm font-semibold">{getAiInsight(pred.diseaseLabel).risk}</p>
                  </div>
                </div>

                <div className="mt-auto">
                  <h4 className="font-bold text-slate-800 mb-3 text-sm">Tindakan Disarankan:</h4>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                    {getAiInsight(pred.diseaseLabel).action}
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

function ActivitySquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M17 12h-2l-2 5-2-10-2 5H7" />
    </svg>
  );
}
