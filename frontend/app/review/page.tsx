"use client";

import { Check, X, AlertTriangle, ArrowRight, SkipForward, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReviewPage() {
  const placeholderImg = "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=1200&auto=format&fit=crop";

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Review & Labeling (Human-in-the-Loop)</h1>
          <p className="text-slate-600 mt-1">Konfirmasi prediksi model yang meragukan (Confidence &lt; 90%) untuk fine-tuning otomatis.</p>
        </div>
        <div className="glass px-4 py-2 rounded-full text-sm font-medium text-amber-700 flex items-center gap-2 border border-amber-200 bg-amber-50/50">
          <AlertTriangle size={16} /> 5 Antrean Review
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Image Review Section */}
        <div className="lg:col-span-2 glass rounded-[32px] p-6 border border-white/60 flex flex-col shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Data Sampel #ID-8842</h3>
            <span className="text-sm text-slate-500 bg-white/50 px-3 py-1 rounded-full">Ditangkap: 12 mnt lalu</span>
          </div>

          <div className="flex-1 rounded-[24px] overflow-hidden relative border border-white/50 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={placeholderImg} alt="Tomato" className="w-full h-full object-cover" />
            
            <div className="absolute top-4 left-4 glass px-4 py-2 rounded-full border border-white/60 shadow-lg">
              <span className="text-xs text-slate-600 font-medium block">Prediksi Awal:</span>
              <span className="text-lg font-bold text-slate-800">Late Blight (82%)</span>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-600 mb-3 text-center">Tentukan Label Sebenarnya (Ground Truth):</h4>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 py-6 h-auto shadow-lg shadow-emerald-500/20">
                <Check className="mr-2" /> Benar (Late Blight)
              </Button>
              <Button variant="outline" className="glass rounded-full px-6 py-6 h-auto hover:bg-white border-white/60 text-emerald-700">
                Sehat
              </Button>
              <Button variant="outline" className="glass rounded-full px-6 py-6 h-auto hover:bg-white border-white/60 text-amber-600">
                Early Blight
              </Button>
              <Button variant="outline" className="glass rounded-full px-6 py-6 h-auto hover:bg-white border-white/60 text-slate-600">
                Lainnya...
              </Button>
              
              <div className="w-px h-12 bg-slate-200 mx-2"></div>
              
              <Button variant="outline" className="rounded-full px-6 py-6 h-auto hover:bg-slate-100 border-dashed border-slate-300 text-slate-500">
                <SkipForward className="mr-2" size={16} /> Skip
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar Info & Logs */}
        <div className="flex flex-col gap-6">
          <div className="glass rounded-[32px] p-6 border border-white/60 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <RefreshCw size={18} className="text-emerald-500" /> Fine-tuning Status
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Data Terkumpul (Batch Baru)</span>
                  <span className="font-bold text-slate-800">45 / 100</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-400 h-2 rounded-full" style={{ width: "45%" }}></div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Model akan dilatih ulang secara lokal setelah 100 data baru tervalidasi.</p>
              </div>

              <Button className="w-full rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 mt-4 shadow-sm" disabled>
                Paksa Training Sekarang
              </Button>
            </div>
          </div>

          <div className="glass rounded-[32px] p-6 border border-white/60 shadow-sm flex-1">
            <h3 className="font-semibold text-slate-800 mb-4">Log Review Terakhir</h3>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/40 border border-white/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Check size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">#ID-884{i}</p>
                      <p className="text-[10px] text-slate-500">Label: Early Blight</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">1 jam lalu</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
