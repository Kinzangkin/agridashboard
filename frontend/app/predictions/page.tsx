"use client";

import { useState } from "react";
import { Search, Filter, AlertCircle, ArrowUpRight, X, AlertTriangle, CheckCircle2, Thermometer, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PredictionsPage() {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);

  const mockImages = Array(8).fill("https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=400&auto=format&fit=crop");
  const statuses = ["SEHAT", "EARLY BLIGHT", "SEHAT", "LATE BLIGHT", "SEHAT", "SEHAT", "SEPTORIA", "SEHAT"];
  const confidences = ["98%", "85%", "92%", "88%", "95%", "99%", "78%", "96%"];
  
  // Data dummy (insight AI) untuk modal detail
  const getAiInsight = (status: string) => {
    if (status === "SEHAT") {
      return {
        desc: "Pertumbuhan vegetatif sangat baik. Tidak ada tanda bercak jamur atau defisiensi nutrisi.",
        action: "Pertahankan jadwal penyiraman 2x sehari dan pemupukan NPK minggu depan.",
        risk: "Rendah",
        color: "text-emerald-600 bg-emerald-50 border-emerald-200"
      };
    } else if (status === "EARLY BLIGHT") {
      return {
        desc: "Terdeteksi bercak cokelat dengan cincin konsentris di daun bagian bawah (Gejala awal Alternaria solani). Jika dibiarkan, daun akan menguning dan rontok dalam 3-5 hari ke depan.",
        action: "1. Pangkas segera daun yang terinfeksi dan jauhkan dari kebun.\n2. Pastikan sirkulasi udara baik (kipas menyala).\n3. Aplikasikan fungisida (Mankozeb/Klorotalonil) besok pagi.",
        risk: "Sedang",
        color: "text-amber-700 bg-amber-50 border-amber-200"
      };
    } else {
      return {
        desc: "Infeksi agresif terdeteksi pada batang dan daun (Phytophthora infestans). Tanaman berisiko mati total dalam 24-48 jam jika kondisi lembap terus berlanjut.",
        action: "1. Karantina/cabut tanaman yang sudah parah agar tidak menular.\n2. Kurangi kelembapan ruangan segera di bawah 60%.\n3. Semprotkan fungisida sistemik secara menyeluruh.",
        risk: "Sangat Tinggi",
        color: "text-rose-700 bg-rose-50 border-rose-200"
      };
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
              className="pl-9 pr-4 py-2 bg-white/50 border border-white/60 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 w-64 transition-all"
            />
          </div>
          <Button variant="outline" className="glass rounded-full border border-white/60 text-slate-600">
            <Filter size={16} className="mr-2" /> Label Tertentu
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mockImages.map((src, i) => {
          const isHealthy = statuses[i] === "SEHAT";
          const isLowConf = parseInt(confidences[i]) < 90;

          return (
            <div 
              key={i} 
              onClick={() => setSelectedItem(i)}
              className="glass rounded-[28px] overflow-hidden border border-white/60 shadow-sm hover:-translate-y-1 transition-transform group cursor-pointer"
            >
              <div className="relative h-48 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Crop" className="w-full h-full object-cover" />
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
                  <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                    isHealthy ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}>
                    {statuses[i]}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{confidences[i]}</span>
                </div>
                <div className="text-xs text-slate-500 mt-2 flex justify-between">
                  <span>ID: PIC-{8842 - i}</span>
                  <span>Hari ini, {10 - i}:05 AM</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center mt-4">
        <Button variant="outline" className="glass rounded-full px-8 py-2 border border-white/60 text-slate-600 hover:bg-white/50">
          Muat Lebih Banyak
        </Button>
      </div>

      {/* Modal Detail */}
      {selectedItem !== null && (
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
            <div className="md:w-1/2 relative h-64 md:h-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mockImages[selectedItem]} alt="Detail" className="w-full h-full object-cover" />
              <div className="absolute bottom-4 left-4 glass px-3 py-1.5 rounded-full text-xs font-semibold text-slate-800">
                PIC-{8842 - selectedItem}
              </div>
            </div>

            {/* Right side: AI Insight */}
            <div className="md:w-1/2 p-6 md:p-8 flex flex-col h-full overflow-y-auto max-h-[80vh]">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{statuses[selectedItem]}</h2>
                <div className="flex items-center gap-3">
                  <span className="glass px-3 py-1 rounded-full text-sm font-bold text-slate-700">Conf: {confidences[selectedItem]}</span>
                  <span className="text-xs text-slate-500">Direkam: Hari ini, {10 - selectedItem}:05 AM</span>
                </div>
              </div>

              {/* Sensor Context */}
              <div className="flex gap-4 mb-6 p-4 glass rounded-2xl border border-white/50">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Suhu Saat Itu</p>
                  <p className="font-semibold text-slate-800 flex items-center gap-1"><Thermometer size={14} className="text-rose-500"/> 26.5°C</p>
                </div>
                <div className="w-px bg-slate-200"></div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Kelembapan</p>
                  <p className="font-semibold text-slate-800 flex items-center gap-1"><Droplets size={14} className="text-blue-500"/> 78%</p>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${getAiInsight(statuses[selectedItem]).color} mb-6`}>
                <h4 className="font-bold flex items-center gap-2 mb-2 text-sm">
                  {statuses[selectedItem] === "SEHAT" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  Analisis AI
                </h4>
                <p className="text-sm leading-relaxed opacity-90">
                  {getAiInsight(statuses[selectedItem]).desc}
                </p>
                <div className="mt-3 pt-3 border-t border-current/20">
                  <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Risiko Ekologis:</p>
                  <p className="text-sm font-semibold">{getAiInsight(statuses[selectedItem]).risk}</p>
                </div>
              </div>

              <div className="mt-auto">
                <h4 className="font-bold text-slate-800 mb-3 text-sm">Tindakan Disarankan:</h4>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                  {getAiInsight(statuses[selectedItem]).action}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
