"use client";

import { useState, useEffect, useCallback } from "react";
import { Thermometer, Droplets, Leaf, ArrowUpRight, Activity, Camera, Wind, Zap, CheckCircle2, XCircle, Sprout } from "lucide-react";
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

export default function DashboardPage() {
  const placeholderImg = "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=1200&auto=format&fit=crop";
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [sensorData, setSensorData] = useState<SensorReading[]>([]);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);

  const fetchSensorData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sensor?limit=20`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setSensorData(json.data);
        setLatestReading(json.data[0]); // data[0] = terbaru (sorted desc)
      }
    } catch (e) {
      console.error("Failed to fetch sensor data", e);
    }
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      const isOnline = await checkBackendStatus();
      setIsBackendOnline(isOnline);
    };
    checkStatus();
    fetchSensorData();

    // Poll setiap 5 detik
    const interval = setInterval(() => {
      checkStatus();
      fetchSensorData();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchSensorData]);

  // Hitung rata-rata
  const avgTemp = sensorData.length > 0
    ? (sensorData.reduce((s, r) => s + r.temperature, 0) / sensorData.length).toFixed(1)
    : "--";
  const avgHum = sensorData.length > 0
    ? (sensorData.reduce((s, r) => s + r.humidity, 0) / sensorData.length).toFixed(0)
    : "--";

  // Data untuk bar chart (ambil 16 terakhir, reversed agar kiri=lama, kanan=baru)
  const tempBars = [...sensorData].reverse().slice(-16);
  const humBars = [...sensorData].reverse().slice(-16);

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

      {/* Hero Image (Spans 2 columns, 2 rows) */}
      <div className="lg:col-span-2 lg:row-span-2 relative rounded-[32px] overflow-hidden shadow-sm border border-white/40 group mt-4 lg:mt-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={placeholderImg} 
          alt="Tomato Plants" 
          className="w-full h-full object-cover"
          style={{ minHeight: "400px" }}
        />
        
        {/* Floating Health Status Widget (Center) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass rounded-[28px] p-6 w-72 flex flex-col items-center justify-center border border-white/50 shadow-2xl">
          <div className="w-full flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-slate-800 font-medium">
              <SparkleIcon /> Status ML
            </div>
            <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
              <ArrowUpRight size={16} className="text-slate-600" />
            </div>
          </div>
          
          <div className="relative w-40 h-20 overflow-hidden mb-2">
            <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-12 border-emerald-100 border-t-emerald-500 border-l-emerald-500 rotate-45"></div>
          </div>
          <h2 className="text-4xl font-bold text-slate-800">96%</h2>
          <p className="text-emerald-600 font-medium mt-1">SEHAT (Normal)</p>
        </div>
        
        {/* ESP32 Label */}
        <div className="absolute bottom-6 left-6 glass px-4 py-2 rounded-full text-xs font-semibold text-slate-700 flex items-center gap-2">
          <Camera size={14} /> 
          {sensorData.length > 0 ? `ESP32 Terhubung (${sensorData.length} data)` : "ESP32-CAM Feed (Mock)"}
        </div>
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
        <div className="text-3xl font-bold text-slate-800 mb-1">{sensorData.length} <span className="text-sm font-medium text-slate-500">Pembacaan</span></div>
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
            ? [...sensorData].reverse().slice(-10).map((r) => r.soilMoisture ?? 0)
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
