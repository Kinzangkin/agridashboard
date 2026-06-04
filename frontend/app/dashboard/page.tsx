"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Thermometer, Droplets, Leaf, ArrowUpRight, Activity, Camera, Wind, Zap, CheckCircle2, XCircle, Sprout, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkBackendStatus } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SensorReading {
  id: string;
  temperature: number;
  humidity: number;
  soilMoisture: number | null;
  plantId: string;
  createdAt: string;
}

interface PredictionRecord {
  id: string;
  imageUrl: string;
  diseaseLabel: string;
  confidence: number;
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

export default function DashboardPage() {
  const placeholderImg = "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=1200&auto=format&fit=crop";
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [sensorData, setSensorData] = useState<SensorReading[]>([]);
  const [totalSensor, setTotalSensor] = useState<number>(0);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [latestPrediction, setLatestPrediction] = useState<PredictionRecord | null>(null);

  // ESP32-CAM live stream states
  const [camIp, setCamIp] = useState<string>("");
  const [useLiveStream, setUseLiveStream] = useState<boolean>(false);
  const [isEditingIp, setIsEditingIp] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<"usb" | "esp">("usb");
  const [imageError, setImageError] = useState<boolean>(false);
  const [currentWebcamIndex, setCurrentWebcamIndex] = useState<number>(1);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [cameraConflict, setCameraConflict] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedBoxRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const boxOpacityRef = useRef<number>(0);

  const fetchSensorData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sensor?limit=100`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setSensorData(json.data);
        setTotalSensor(json.total ?? json.data.length);
        setLatestReading(json.data[0]); // data[0] = terbaru
      }
    } catch (e) {
      console.error("Failed to fetch sensor data", e);
    }
  }, []);

  const fetchLatestPrediction = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/predictions?limit=1`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setLatestPrediction(json.data[0]);
      }
    } catch (e) {
      console.error("Failed to fetch latest prediction", e);
    }
  }, []);

  const fetchWebcamSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/webcam`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setCurrentWebcamIndex(json.webcamIndex);
      }
    } catch (e) {
      console.error("Failed to fetch webcam settings", e);
    }
  }, []);

  const handleSwitchWebcam = async (index: number) => {
    setCurrentWebcamIndex(index);
    try {
      await fetch(`${API_BASE_URL}/api/settings/webcam`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ index })
      });
    } catch (e) {
      console.error("Failed to switch webcam settings", e);
    }
  };

  const startWebcam = async (deviceIndex: number = 1) => {
    try {
      setCameraConflict(false);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Warmup permission stream
      let tempStream: MediaStream | null = null;
      try {
        tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (e) {
        console.error("Gagal mendapatkan izin awal kamera", e);
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoIn = devices.filter(d => d.kind === "videoinput");

      if (tempStream) {
        tempStream.getTracks().forEach(track => track.stop());
      }

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

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err: any) {
      console.warn("Gagal mengakses webcam di Dashboard:", err);
      if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setCameraConflict(true);
      }
      setIsWebcamActive(false);
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsWebcamActive(false);
  };

  const silentCaptureAndUpload = useCallback(async () => {
    let sourceElement: HTMLVideoElement | HTMLImageElement | null = null;
    let width = 640;
    let height = 480;

    if (isWebcamActive && videoRef.current) {
      sourceElement = videoRef.current;
      width = videoRef.current.videoWidth || 640;
      height = videoRef.current.videoHeight || 480;
    } else if (useLiveStream) {
      const imgEl = document.getElementById("ip-camera-stream") as HTMLImageElement;
      if (imgEl && imgEl.complete) {
        sourceElement = imgEl;
        width = imgEl.naturalWidth || 640;
        height = imgEl.naturalHeight || 480;
      }
    }

    if (sourceElement) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(sourceElement, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const capturedFile = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" });
            
            const temp = latestReading?.temperature ?? 25.5;
            const hum = latestReading?.humidity ?? 70;

            const formData = new FormData();
            formData.append("image", capturedFile);
            formData.append("temperature", temp.toString());
            formData.append("humidity", hum.toString());

            try {
              const res = await fetch(`${API_BASE_URL}/api/upload`, {
                method: "POST",
                body: formData
              });
              const json = await res.json();
              if (json.success) {
                setLatestPrediction({
                  id: json.data.prediction.id ?? "",
                  imageUrl: json.data.prediction.imageUrl,
                  diseaseLabel: json.data.prediction.diseaseLabel,
                  confidence: json.data.prediction.confidence,
                  createdAt: new Date().toISOString()
                });
              } else {
                console.error("[Dashboard] Prediksi gagal dari backend:", json.error);
              }
            } catch (err) {
              console.error("Gagal melakukan unggahan background di Dashboard:", err);
            }
          }
        }, "image/jpeg", 0.95);
      }
    }
  }, [isWebcamActive, useLiveStream, latestReading]);

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const temp = latestReading?.temperature ?? 25.5;
    const hum = latestReading?.humidity ?? 70;

    const formData = new FormData();
    formData.append("image", file);
    formData.append("temperature", temp.toString());
    formData.append("humidity", hum.toString());

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        setLatestPrediction({
          id: json.data.prediction.id,
          imageUrl: json.data.prediction.imageUrl,
          diseaseLabel: json.data.prediction.diseaseLabel,
          confidence: json.data.prediction.confidence,
          createdAt: new Date().toISOString()
        });
        
        // Hentikan webcam sementara agar pengguna bisa melihat hasil unggahan manual
        stopWebcam();
        setCountdown(null);
      }
    } catch (err) {
      console.error("Gagal melakukan unggahan file manual:", err);
    }
    
    // Reset value input agar bisa unggah file yang sama lagi jika perlu
    e.target.value = '';
  };

  // Sinkronkan start/stop webcam berdasarkan status modal dan IP stream
  useEffect(() => {
    if (!useLiveStream) {
      startWebcam(currentWebcamIndex);
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [useLiveStream, currentWebcamIndex]);

  // Trigger countdown ketika webcam Dashboard aktif
  useEffect(() => {
    if (isWebcamActive || useLiveStream) {
      setCountdown(15);
    } else {
      setCountdown(null);
    }
  }, [isWebcamActive, useLiveStream]);

  // Loop countdown 15s untuk capture di Dashboard secara kontinu
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      silentCaptureAndUpload();
      setCountdown(15);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, silentCaptureAndUpload]);

  useEffect(() => {
    setImageError(false);
  }, [latestPrediction]);

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

  useEffect(() => {
    // Load IP setting if available
    const savedIp = localStorage.getItem("esp32_cam_ip");
    if (savedIp) {
      setCamIp(savedIp);
      setUseLiveStream(true);
    }

    const checkStatus = async () => {
      const isOnline = await checkBackendStatus();
      setIsBackendOnline(isOnline);
    };

    checkStatus();
    fetchSensorData();
    fetchLatestPrediction();
    fetchWebcamSettings();

    // Poll setiap 5 detik
    const interval = setInterval(() => {
      checkStatus();
      fetchSensorData();
      fetchLatestPrediction();
      fetchWebcamSettings();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchSensorData, fetchLatestPrediction, fetchWebcamSettings]);

  const handleSaveIp = (ip: string) => {
    const cleanIp = ip.trim();
    if (cleanIp) {
      localStorage.setItem("esp32_cam_ip", cleanIp);
      setCamIp(cleanIp);
      setUseLiveStream(true);
      setIsEditingIp(false);
    }
  };

  const handleDisableStream = () => {
    localStorage.removeItem("esp32_cam_ip");
    setUseLiveStream(false);
  };

  // Hitung rata-rata
  const avgTemp = sensorData.length > 0
    ? (sensorData.reduce((s, r) => s + r.temperature, 0) / sensorData.length).toFixed(1)
    : "--";
  const avgHum = sensorData.length > 0
    ? (sensorData.reduce((s, r) => s + r.humidity, 0) / sensorData.length).toFixed(0)
    : "--";

  // Data untuk bar chart (ambil 30 terakhir agar muat di UI secara estetik, reversed agar kiri=lama, kanan=baru)
  const tempBars = [...sensorData].reverse().slice(-30);
  const humBars = [...sensorData].reverse().slice(-30);

  const maxTemp = Math.max(...tempBars.map(r => r.temperature), 40);
  const maxHum = 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full relative">
      
      {/* Backend Status Indicator */}
      <div className="absolute -top-12 right-0 flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-white/60 text-xs font-semibold shadow-sm z-10">
        Status API: 
        {isBackendOnline === null ? (
          <span className="flex items-center gap-1 text-slate-500"><div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div> Mengecek...</span>
        ) : isBackendOnline ? (
          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14} /> Online</span>
        ) : (
          <span className="flex items-center gap-1 text-rose-600"><XCircle size={14} /> Offline</span>
        )}
      </div>

      {/* Hero Image / Video Stream Section */}
      <div className="lg:col-span-2 lg:row-span-2 relative rounded-[32px] overflow-hidden shadow-sm border border-white/40 group mt-4 lg:mt-0 bg-slate-900 flex items-center justify-center min-h-[400px]">
        {useLiveStream && camIp ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            id="ip-camera-stream"
            crossOrigin="anonymous"
            src={camIp.startsWith('http') ? `${API_BASE_URL}/api/stream?url=${encodeURIComponent(camIp)}` : `http://${camIp}:81/stream`} 
            alt="IP Camera Live Video Stream" 
            className="w-full h-full object-cover"
          />
        ) : cameraConflict ? (
          <div className="absolute inset-0 w-full h-full bg-linear-to-br from-slate-900 to-amber-950/80 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
            <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 mb-4 shadow-lg">
              <Camera className="text-amber-400" size={24} />
            </div>
            <h3 className="text-white font-bold text-base mb-1 tracking-wide">Kamera Sedang Digunakan</h3>
            <p className="text-slate-300 text-[11px] max-w-xs leading-relaxed mb-6">
              Webcam Anda sedang dikunci oleh program lain (seperti halaman Predictions yang masih terbuka, Zoom, atau aplikasi uploader python).
              <br/><br/>
              Silakan tutup tab/aplikasi tersebut untuk menikmati siaran langsung otomatis di Dashboard!
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                setCameraConflict(false);
                startWebcam(currentWebcamIndex);
              }}
              className="glass text-white border-white/20 hover:bg-white/10 text-[10px]"
            >
              Coba Hubungkan Ulang
            </Button>
          </div>
        ) : isWebcamActive ? (
          <div className="relative w-full h-full min-h-[400px] flex-1">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              controls={false}
              className="w-full h-full object-cover absolute inset-0"
              style={{ minHeight: "400px" }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              style={{ minHeight: "400px" }}
            />
            {countdown !== null && (
              <div className="absolute top-4 right-4 bg-emerald-500/95 backdrop-blur-md text-white font-black text-[10px] px-3.5 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 uppercase tracking-wider z-20 animate-pulse">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                Auto-Capture {countdown}s
              </div>
            )}
          </div>
        ) : (!imageError && latestPrediction?.imageUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={latestPrediction.imageUrl} 
            alt="Tomato Leaf Capture" 
            className="w-full h-full object-cover"
            style={{ minHeight: "400px" }}
            onError={() => setImageError(true)}
          />
        ) : (
          // Premium glassmorphic emerald gradient standby placeholder
          <div className="absolute inset-0 w-full h-full bg-linear-to-br from-slate-900 to-emerald-950/80 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20 mb-4 shadow-lg animate-pulse">
              <Camera className="text-emerald-400" size={28} />
            </div>
            <h3 className="text-white font-bold text-lg mb-1 tracking-wide">Webcam Uploader Aktif</h3>
            <p className="text-slate-300 text-xs max-w-sm leading-relaxed mb-6">
              Belum ada foto tanaman tomat yang terekam atau link gambar lama tidak valid. 
              Pastikan webcam USB Anda tercolok dan uploader otomatis di latar belakang berjalan!
            </p>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Standby Mode
              </span>
            </div>
          </div>
        )}
        
        {/* Floating Health Status Widget (Bottom-Right) */}
        <div className="absolute bottom-6 right-6 glass bg-white/80 backdrop-blur-md rounded-[24px] p-5 w-64 flex flex-col items-center justify-center border border-white/50 shadow-xl">
          <div className="w-full flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-slate-800 text-sm font-medium">
              <SparkleIcon /> Status ML
            </div>
            <div className="w-7 h-7 rounded-full bg-white/50 flex items-center justify-center">
              <ArrowUpRight size={14} className="text-slate-600" />
            </div>
          </div>
          
          <div className="relative w-32 h-16 overflow-hidden mb-1">
            <div className="absolute top-0 left-0 w-32 h-32 rounded-full border-8 border-emerald-100 border-t-emerald-500 border-l-emerald-500 rotate-45"></div>
          </div>
          <h2 className="text-3xl font-bold text-slate-800">
            {latestPrediction ? `${latestPrediction.confidence.toFixed(0)}%` : "96%"}
          </h2>
          <p className={`font-semibold mt-1 uppercase text-xs ${(latestPrediction?.diseaseLabel || "SEHAT").includes("SEHAT") ? "text-emerald-600" : "text-rose-600"}`}>
            {latestPrediction?.diseaseLabel || "SEHAT (Normal)"}
          </p>
        </div>
        
        {/* ESP32 Label & Stream Toggle Button */}
        <div className="absolute bottom-6 left-6 flex items-center gap-2">
          <div className="glass px-4 py-2 rounded-full text-xs font-semibold text-slate-700 flex items-center gap-2 border border-white/60 max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
            <Camera size={14} className={useLiveStream ? "animate-pulse text-rose-500 min-w-[14px]" : "min-w-[14px]"} /> 
            {useLiveStream ? `Live: ${camIp.startsWith('http') ? camIp : 'http://' + camIp + ':81/stream'}` : "ESP32-CAM Feed"}
          </div>
          
          <button 
            onClick={() => setIsEditingIp(true)}
            className="glass hover:bg-white/80 p-2.5 rounded-full border border-white/60 shadow-lg text-slate-700 transition-colors flex items-center justify-center"
            title="Konfigurasi Stream Kamera"
          >
            <Zap size={14} />
          </button>

          <button 
            onClick={() => document.getElementById('manual-upload-input')?.click()}
            className="glass hover:bg-white/80 px-4 py-2 rounded-full border border-white/60 shadow-lg text-slate-700 transition-colors flex items-center gap-2 text-xs font-semibold"
            title="Unggah Foto Manual"
          >
            <Upload size={14} /> Unggah Manual
          </button>
          <input 
            type="file" 
            id="manual-upload-input" 
            className="hidden" 
            accept="image/*" 
            onChange={handleManualUpload} 
          />

          {useLiveStream && (
            <button 
              onClick={handleDisableStream}
              className="glass bg-rose-500/15 hover:bg-rose-500/35 px-4 py-2 rounded-full border border-rose-200 shadow-lg text-rose-700 text-xs font-bold transition-colors"
            >
              Matikan Live
            </button>
          )}
        </div>

        {/* IP Config Overlay Modal */}
        {isEditingIp && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="glass bg-white/95 p-6 rounded-3xl w-full max-w-sm border border-white shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              
              {/* Tab Navigation */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => setActiveModalTab("usb")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeModalTab === "usb" 
                      ? "bg-white text-emerald-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Webcam USB (Kabel)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab("esp")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeModalTab === "esp" 
                      ? "bg-white text-emerald-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ESP32-CAM (Wi-Fi)
                </button>
              </div>

              {activeModalTab === "usb" ? (
                <div className="py-1">
                  <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Camera className="text-emerald-500" size={18} />
                    Pilih Input Kamera USB
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                    Pilih tipe webcam lokal yang terhubung ke server backend Anda untuk analisis otomatis.
                  </p>

                  <div className="flex flex-col gap-2.5 mb-5">
                    {/* Kamera Eksternal USB Card */}
                    <button
                      type="button"
                      onClick={() => handleSwitchWebcam(1)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                        currentWebcamIndex === 1
                          ? "bg-emerald-50 border-emerald-500 shadow-sm"
                          : "bg-white border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentWebcamIndex === 1 ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        <Camera size={16} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-bold ${currentWebcamIndex === 1 ? "text-emerald-800" : "text-slate-700"}`}>
                          Webcam laptop
                        </p>
                        <p className="text-[10px] text-slate-400">Kamera Tambahan / Kabel USB</p>
                      </div>
                      {currentWebcamIndex === 1 && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
                      )}
                    </button>

                    {/* Kamera Bawaan Laptop Card */}
                    <button
                      type="button"
                      onClick={() => handleSwitchWebcam(0)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                        currentWebcamIndex === 0
                          ? "bg-emerald-50 border-emerald-500 shadow-sm"
                          : "bg-white border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentWebcamIndex === 0 ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        <Camera size={16} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-bold ${currentWebcamIndex === 0 ? "text-emerald-800" : "text-slate-700"}`}>
                          Webcam external
                        </p>
                        <p className="text-[10px] text-slate-400">Kamera Internal / Built-in</p>
                      </div>
                      {currentWebcamIndex === 0 && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
                      )}
                    </button>
                  </div>

                  <Button 
                    onClick={() => {
                      setIsEditingIp(false);
                      setUseLiveStream(false);
                    }} 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs py-2.5 font-bold shadow-md shadow-emerald-500/10"
                  >
                    Simpan & Terapkan
                  </Button>
                </div>
              ) : (
                <div>
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Camera className="text-emerald-500" size={18} />
                    IP Camera / ESP32-CAM
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Masukkan IP lokal ESP32-CAM (contoh: <code>192.168.1.100</code>) ATAU masukkan URL penuh dari aplikasi IP Camera di HP Anda (contoh: <code>http://192.168.1.5:8080/video</code>).
                  </p>
                  
                  <input 
                    type="text" 
                    placeholder="Contoh: http://192.168.1.5:8080/video" 
                    value={camIp}
                    onChange={(e) => setCamIp(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 mb-4"
                  />
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setIsEditingIp(false)} 
                      variant="ghost" 
                      className="flex-1 rounded-xl text-xs text-slate-500"
                    >
                      Batal
                    </Button>
                    <Button 
                      onClick={() => handleSaveIp(camIp)} 
                      disabled={!camIp}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs"
                    >
                      Hubungkan Stream
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Card 1: Total Sensor Readings */}
      <div className="glass rounded-[32px] p-6 flex flex-col h-full border border-white/60 shadow-sm mt-4 lg:mt-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <div className="p-1.5 bg-white/60 rounded-full"><Zap size={16} /></div> 
            Data Sensor
          </div>
          <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
            <ArrowUpRight size={16} className="text-slate-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-800 mb-1">{totalSensor} <span className="text-sm font-medium text-slate-500">Pembacaan</span></div>
        <div className="flex-1 mt-6 flex items-end gap-1.5 h-24">
          {(sensorData.length > 0 ? tempBars : [40, 60, 45, 80, 50, 90, 70, 85, 60, 75].map((h) => ({ temperature: h * 0.4 } as SensorReading))).map((r, i) => (
            <div key={i} className="flex-1 bg-linear-to-t from-emerald-400 to-emerald-200 rounded-t-sm" style={{ height: `${Math.min((r.temperature / maxTemp) * 100, 100)}%` }}></div>
          ))}
        </div>
      </div>

      {/* Right Card 2: Soil Moisture */}
      <div className="glass rounded-[32px] p-6 flex flex-col h-full border border-white/60 shadow-sm mt-4 lg:mt-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <div className="p-1.5 bg-white/60 rounded-full"><Sprout size={16} /></div> 
            Kelembapan Tanah
          </div>
          <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
            <ArrowUpRight size={16} className="text-slate-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-800 mb-1">
          {latestReading?.soilMoisture != null ? `${latestReading.soilMoisture.toFixed(0)}` : "--"} <span className="text-sm font-medium text-slate-500">%</span>
        </div>
        <div className="flex-1 mt-6 flex items-end gap-1.5 h-24">
          {(sensorData.length > 0
            ? [...sensorData].reverse().slice(-30).map((r) => r.soilMoisture ?? 0)
            : [60, 40, 70, 50, 85, 65, 45, 80, 55, 90]
          ).map((h, i) => (
            <div key={i} className={`flex-1 rounded-t-sm ${i % 2 === 0 ? 'bg-orange-400' : 'bg-slate-300/50'}`} style={{ height: `${Math.min(h, 100)}%` }}></div>
          ))}
        </div>
      </div>

      {/* 4 Small Metric Cards */}
      <div className="grid grid-cols-2 grid-rows-2 gap-4">
        <div className="glass rounded-[24px] p-5 flex flex-col justify-between border border-white/60 hover:bg-white/40 transition-colors">
          <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
            <Thermometer size={16} /> Suhu Udara
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-2xl font-bold text-slate-800">{latestReading ? latestReading.temperature.toFixed(1) : "--"}<span className="text-lg">°C</span></div>
            <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center"><ArrowUpRight size={12} className="text-slate-600" /></div>
          </div>
        </div>
        
        <div className="glass rounded-[24px] p-5 flex flex-col justify-between border border-white/60 hover:bg-white/40 transition-colors">
          <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
            <Droplets size={16} /> Kelembapan
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-2xl font-bold text-slate-800">{latestReading ? latestReading.humidity.toFixed(0) : "--"}<span className="text-lg">%</span></div>
            <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center"><ArrowUpRight size={12} className="text-slate-600" /></div>
          </div>
        </div>
        
        <div className="glass rounded-[24px] p-5 flex flex-col justify-between border border-white/60 hover:bg-white/40 transition-colors">
          <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
            <Leaf size={16} /> Model Val
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-2xl font-bold text-slate-800">92.5<span className="text-lg">%</span></div>
            <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center"><ArrowUpRight size={12} className="text-slate-600" /></div>
          </div>
        </div>
      </div>

      {/* Trend Suhu (live data) */}
      <div className="glass rounded-[32px] p-6 flex flex-col h-full border border-white/60 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <div className="p-1.5 bg-white/60 rounded-full"><Activity size={16} /></div> 
            Trend Suhu
          </div>
          <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
            <ArrowUpRight size={16} className="text-slate-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-800 mb-2">{avgTemp} <span className="text-sm font-medium text-slate-500">Rata-rata °C</span></div>
        <div className="flex-1 flex items-end gap-1 h-32 mt-4">
          {(tempBars.length > 0 ? tempBars : [30, 32, 28, 35, 27, 31, 29, 33, 26, 34, 30, 28, 32, 31, 27, 29].map(t => ({ temperature: t } as SensorReading))).map((r, i) => (
            <div key={i} className="flex-1 bg-slate-300/50 rounded-t-sm relative group">
              <div className="absolute bottom-0 w-full bg-emerald-500/80 rounded-t-sm" style={{ height: `${(r.temperature / maxTemp) * 100}%` }}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Kelembapan Historis (live data) */}
      <div className="glass rounded-[32px] p-6 flex flex-col h-full border border-white/60 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <div className="p-1.5 bg-white/60 rounded-full"><Wind size={16} /></div> 
            Kelembapan Historis
          </div>
          <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
            <ArrowUpRight size={16} className="text-slate-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-800 mb-2">{avgHum} <span className="text-sm font-medium text-slate-500">%</span></div>
        <div className="flex-1 flex items-end gap-1 h-32 mt-4">
          {(humBars.length > 0 ? humBars : [65, 70, 60, 72, 58, 68, 63, 75, 62, 67, 71, 59, 66, 64, 73, 61].map(h => ({ humidity: h } as SensorReading))).map((r, i) => (
            <div key={i} className="flex-1 bg-slate-300/50 rounded-t-sm relative group">
              <div className="absolute bottom-0 w-full bg-blue-500/80 rounded-t-sm" style={{ height: `${(r.humidity / maxHum) * 100}%` }}></div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-800">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
