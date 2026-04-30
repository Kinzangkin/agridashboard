"use client";

import { Save, RefreshCw, Server, BellRing, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="h-full flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pengaturan Sistem</h1>
          <p className="text-slate-600 mt-1">Konfigurasi notifikasi, perangkat IoT, dan Model Machine Learning.</p>
        </div>
        <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 shadow-md shadow-emerald-500/20">
          <Save className="mr-2" size={16} /> Simpan Perubahan
        </Button>
      </div>

      <div className="space-y-6">
        {/* ML Settings */}
        <div className="glass rounded-[32px] p-8 border border-white/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Server className="text-emerald-500" /> Konfigurasi Model ML
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ambang Batas Confidence (Auto-Labeling)</label>
              <div className="flex items-center gap-4">
                <input type="range" min="50" max="99" defaultValue="90" className="w-full accent-emerald-500" />
                <span className="glass px-3 py-1 rounded-lg text-sm font-bold border border-white/50 text-emerald-700">90%</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Gambar dengan confidence di bawah persentase ini akan masuk ke antrean Review.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Versi Model Aktif</label>
              <select className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50">
                <option>MobileNetV2_v1.2 (Latest)</option>
                <option>MobileNetV2_v1.1</option>
                <option>YOLOv8_Legacy</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-white/40">
            <Button variant="outline" className="glass border-emerald-200 text-emerald-700 hover:bg-white rounded-xl">
              <RefreshCw className="mr-2" size={16} /> Muat Ulang Model ke Memory
            </Button>
          </div>
        </div>

        {/* IoT & Threshold Settings */}
        <div className="glass rounded-[32px] p-8 border border-white/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BellRing className="text-blue-500" /> Ambang Batas Sensor & Peringatan
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Suhu Maksimal (°C)</label>
              <input type="number" defaultValue="35" className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
              <p className="text-xs text-slate-500 mt-2">Peringatan Kritis dikirim jika suhu melebihi batas ini.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Kelembapan Minimal (%)</label>
              <input type="number" defaultValue="50" className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
              <p className="text-xs text-slate-500 mt-2">Peringatan dikirim jika udara terlalu kering.</p>
            </div>
          </div>
        </div>

        {/* Database & System */}
        <div className="glass rounded-[32px] p-8 border border-white/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Database className="text-slate-500" /> Database & Penyimpanan
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-white/40 rounded-2xl border border-white/50">
              <div>
                <p className="font-medium text-slate-800">Supabase Storage</p>
                <p className="text-xs text-slate-500">Penyimpanan gambar tanaman</p>
              </div>
              <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">Terhubung</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-white/40 rounded-2xl border border-white/50">
              <div>
                <p className="font-medium text-slate-800">PostgreSQL (Prisma)</p>
                <p className="text-xs text-slate-500">Database utama sistem</p>
              </div>
              <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">Terhubung</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
