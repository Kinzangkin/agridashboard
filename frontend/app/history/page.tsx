"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Calendar, Download, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SensorReading {
  id: string;
  temperature: number;
  humidity: number;
  soilMoisture: number | null;
  plantId: string;
  createdAt: string;
  plantStatus: string;
}

export default function HistoryPage() {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function fetchHistory() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/sensor?limit=100`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const json = await res.json();
        if (json.success) {
          setReadings(json.data);
        } else {
          setError(json.error || "Gagal memuat data riwayat.");
        }
      } catch (err) {
        console.error("Error fetching history:", err);
        setError("Gagal menghubungi server backend. Pastikan backend sudah berjalan.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const filteredReadings = readings.filter((r) => {
    const shortId = `LOG-${r.id.slice(0, 5).toUpperCase()}`;
    const idMatch = shortId.includes(searchQuery.toUpperCase()) || r.id.toLowerCase().includes(searchQuery.toLowerCase());
    const statusMatch = r.plantStatus.toLowerCase().includes(searchQuery.toLowerCase());
    return idMatch || statusMatch;
  });

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
      return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) {
      return "";
    }
  };

  const todayDateString = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Riwayat Data & Sensor</h1>
          <p className="text-slate-600 mt-1">Log periodik suhu, kelembapan, dan hasil snapshot kamera ESP32.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="glass rounded-full border border-white/60 text-slate-600">
            <Filter size={16} className="mr-2" /> Filter
          </Button>
          <Button variant="outline" className="glass rounded-full border border-white/60 text-slate-600">
            <Download size={16} className="mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="glass rounded-[32px] p-6 border border-white/60 shadow-sm flex-1 flex flex-col">
        {/* Table Toolbar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input 
                type="text" 
                placeholder="Cari ID Log atau status..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white/50 border border-white/60 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 w-64 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/50 border border-white/60 rounded-full px-4 py-2 text-sm text-slate-600">
              <Calendar size={14} /> Hari Ini ({todayDateString})
            </div>
          </div>
        </div>

        {/* Custom Glass Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/40 text-sm text-slate-500">
                <th className="pb-3 px-4 font-medium">Log ID</th>
                <th className="pb-3 px-4 font-medium">Waktu</th>
                <th className="pb-3 px-4 font-medium">Suhu</th>
                <th className="pb-3 px-4 font-medium">Kelembapan</th>
                <th className="pb-3 px-4 font-medium">Prediksi ML</th>
                <th className="pb-3 px-4 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-emerald-500" size={28} />
                      <span className="text-sm font-medium mt-2">Menghubungkan ke database...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-rose-500 font-semibold text-sm">
                    {error}
                  </td>
                </tr>
              ) : filteredReadings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    {searchQuery ? "Tidak ditemukan log yang cocok." : "Belum ada log sensor yang tersimpan."}
                  </td>
                </tr>
              ) : (
                filteredReadings.map((row) => {
                  const shortId = `LOG-${row.id.slice(0, 5).toUpperCase()}`;
                  const isHealthy = row.plantStatus.toUpperCase().includes('SEHAT');
                  return (
                    <tr key={row.id} className="border-b border-white/20 hover:bg-white/30 transition-colors group">
                      <td className="py-4 px-4 text-sm font-medium text-slate-700">{shortId}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {formatDate(row.createdAt)} {formatTime(row.createdAt)}
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-700 font-medium">{row.temperature.toFixed(1)}°C</td>
                      <td className="py-4 px-4 text-sm text-slate-700 font-medium">{row.humidity.toFixed(0)}%</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {row.plantStatus}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal size={16} />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex justify-between items-center mt-6 text-sm text-slate-500">
          <span>Menampilkan {filteredReadings.length} data terbaru</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="glass rounded-full h-8 px-3 border-white/60" disabled>Prev</Button>
            <Button variant="outline" size="sm" className="glass rounded-full h-8 px-3 border-white/60 bg-white/80">1</Button>
            <Button variant="outline" size="sm" className="glass rounded-full h-8 px-3 border-white/60" disabled>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
