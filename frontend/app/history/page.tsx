"use client";

import { Search, Filter, Calendar, Download, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const tableData = [
    { id: "LOG-001", time: "10:05 AM", temp: "28.4°C", hum: "65%", status: "SEHAT", conf: "96%" },
    { id: "LOG-002", time: "09:05 AM", temp: "27.8°C", hum: "66%", status: "SEHAT", conf: "94%" },
    { id: "LOG-003", time: "08:05 AM", temp: "26.5°C", hum: "70%", status: "EARLY BLIGHT", conf: "82%" },
    { id: "LOG-004", time: "07:05 AM", temp: "25.2°C", hum: "72%", status: "SEHAT", conf: "91%" },
    { id: "LOG-005", time: "06:05 AM", temp: "24.8°C", hum: "75%", status: "SEHAT", conf: "95%" },
  ];

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
                placeholder="Cari ID Log..." 
                className="pl-9 pr-4 py-2 bg-white/50 border border-white/60 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 w-64 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/50 border border-white/60 rounded-full px-4 py-2 text-sm text-slate-600">
              <Calendar size={14} /> Hari Ini (29 April 2026)
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
              {tableData.map((row, i) => (
                <tr key={i} className="border-b border-white/20 hover:bg-white/30 transition-colors group">
                  <td className="py-4 px-4 text-sm font-medium text-slate-700">{row.id}</td>
                  <td className="py-4 px-4 text-sm text-slate-600">{row.time}</td>
                  <td className="py-4 px-4 text-sm text-slate-700 font-medium">{row.temp}</td>
                  <td className="py-4 px-4 text-sm text-slate-700 font-medium">{row.hum}</td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      row.status === 'SEHAT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {row.status} ({row.conf})
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination mock */}
        <div className="flex justify-between items-center mt-6 text-sm text-slate-500">
          <span>Menampilkan 1-5 dari 1,250 data</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="glass rounded-full h-8 px-3 border-white/60">Prev</Button>
            <Button variant="outline" size="sm" className="glass rounded-full h-8 px-3 border-white/60 bg-white/80">1</Button>
            <Button variant="outline" size="sm" className="glass rounded-full h-8 px-3 border-white/60">2</Button>
            <Button variant="outline" size="sm" className="glass rounded-full h-8 px-3 border-white/60">3</Button>
            <Button variant="outline" size="sm" className="glass rounded-full h-8 px-3 border-white/60">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
