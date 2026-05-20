"use client";

import { useState, useEffect } from "react";
import { Check, X, AlertTriangle, ArrowRight, SkipForward, RefreshCw, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PredictionRecord {
  id: string;
  plantId: string;
  imageUrl: string;
  diseaseLabel: string;
  confidence: number;
  createdAt: string;
}

interface ReviewLog {
  id: string;
  diseaseLabel: string;
  groundTruth: string;
  createdAt: string;
}

const AVAILABLE_DISEASE_LABELS = [
  "SEHAT",
  "BACTERIAL SPOT",
  "EARLY BLIGHT",
  "LATE BLIGHT",
  "LEAF MOLD",
  "SEPTORIA LEAF SPOT",
  "SPIDER MITES",
  "TARGET SPOT",
  "YELLOW LEAF CURL VIRUS",
  "MOSAIC VIRUS"
];

export default function ReviewPage() {
  const [queue, setQueue] = useState<PredictionRecord[]>([]);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showOthers, setShowOthers] = useState<boolean>(false);
  const [customLabel, setCustomLabel] = useState<string>("");

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/queue`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal mengambil antrean review");
      const json = await res.json();
      if (json.success) {
        setQueue(json.data);
        setQueueCount(json.count);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/logs?limit=5`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal mengambil log review");
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      await Promise.all([fetchQueue(), fetchLogs()]);
      setIsLoading(false);
    }
    loadData();
  }, []);

  const handleSubmitReview = async (groundTruthLabel: string) => {
    if (queue.length === 0) return;
    const currentItem = queue[0];

    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/api/review/${currentItem.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ groundTruth: groundTruthLabel }),
      });
      const json = await res.json();
      if (json.success) {
        // Refresh queue & logs
        await Promise.all([fetchQueue(), fetchLogs()]);
        setShowOthers(false);
        setCustomLabel("");
      }
    } catch (err) {
      console.error("Error submitting review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Skip item: remove from local queue view
    if (queue.length > 1) {
      setQueue(queue.slice(1));
    } else {
      setQueue([]);
    }
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Baru saja";
      if (diffMins < 60) return `${diffMins} mnt lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} jam lalu`;
      return new Date(isoString).toLocaleDateString("id-ID");
    } catch (e) {
      return "Baru saja";
    }
  };

  // Hitung persentase fine-tuning progress (misal target 50 review untuk retrain)
  const totalReviewed = logs.length;
  const progressPercent = Math.min(Math.round((totalReviewed / 10) * 100), 100);

  const currentItem = queue[0];

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Review & Labeling (Human-in-the-Loop)</h1>
          <p className="text-slate-600 mt-1">Konfirmasi prediksi model yang meragukan (Confidence &lt; 90%) untuk fine-tuning otomatis.</p>
        </div>
        <div className={`glass px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 border transition-all ${
          queueCount > 0 
            ? 'border-amber-200 bg-amber-50/50 text-amber-700 animate-pulse' 
            : 'border-emerald-200 bg-emerald-50/50 text-emerald-700'
        }`}>
          <AlertTriangle size={16} /> {queueCount} Antrean Review
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white/40 border border-white/60 rounded-[32px]">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
          <span className="text-sm font-medium text-slate-500 mt-2">Menghubungkan ke database antrean...</span>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Image Review Section */}
          <div className="lg:col-span-2 glass rounded-[32px] p-6 border border-white/60 flex flex-col shadow-sm relative overflow-hidden bg-white/30">
            
            {currentItem ? (
              <div className="flex-1 flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800">Data Sampel #PIC-{currentItem.id.slice(0, 5).toUpperCase()}</h3>
                  <span className="text-xs text-slate-500 bg-white/60 px-3 py-1 rounded-full">{formatTimeAgo(currentItem.createdAt)}</span>
                </div>

                <div className="flex-1 rounded-[24px] overflow-hidden relative border border-white/50 bg-slate-95 group min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentItem.imageUrl} alt="Tomato review" className="w-full h-full object-cover" />
                  
                  <div className="absolute top-4 left-4 glass px-4 py-2 rounded-full border border-white/60 shadow-lg">
                    <span className="text-[10px] text-slate-600 font-bold block uppercase tracking-wider">Prediksi AI Awal:</span>
                    <span className="text-lg font-extrabold text-rose-600">{currentItem.diseaseLabel} ({currentItem.confidence.toFixed(1)}%)</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/40 pt-6">
                  <h4 className="text-sm font-bold text-slate-700 mb-4 text-center">Tentukan Label Sebenarnya (Ground Truth):</h4>
                  
                  {!showOthers ? (
                    <div className="flex justify-center gap-3 flex-wrap">
                      <Button 
                        onClick={() => handleSubmitReview(currentItem.diseaseLabel)}
                        disabled={isSubmitting}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 py-6 h-auto shadow-lg shadow-emerald-500/20 font-semibold"
                      >
                        <Check className="mr-2" size={16} /> Benar ({currentItem.diseaseLabel})
                      </Button>
                      <Button 
                        onClick={() => handleSubmitReview("SEHAT")}
                        disabled={isSubmitting}
                        variant="outline" 
                        className="glass rounded-full px-6 py-6 h-auto hover:bg-white border-white/60 text-emerald-700 font-semibold"
                      >
                        Sehat (Normal)
                      </Button>
                      <Button 
                        onClick={() => setShowOthers(true)}
                        disabled={isSubmitting}
                        variant="outline" 
                        className="glass rounded-full px-6 py-6 h-auto hover:bg-white border-white/60 text-slate-600 font-semibold"
                      >
                        Penyakit Lain...
                      </Button>
                      
                      <div className="w-px h-12 bg-slate-200 mx-2"></div>
                      
                      <Button 
                        onClick={handleSkip}
                        disabled={isSubmitting}
                        variant="outline" 
                        className="rounded-full px-6 py-6 h-auto hover:bg-slate-100 border-dashed border-slate-300 text-slate-500"
                      >
                        <SkipForward className="mr-2" size={16} /> Skip
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
                      <div className="flex gap-2 w-full">
                        <select 
                          value={customLabel}
                          onChange={(e) => setCustomLabel(e.target.value)}
                          className="flex-1 bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        >
                          <option value="">-- Pilih Label Koreksi --</option>
                          {AVAILABLE_DISEASE_LABELS.map(lbl => (
                            <option key={lbl} value={lbl}>{lbl}</option>
                          ))}
                        </select>
                        <Button 
                          onClick={() => customLabel && handleSubmitReview(customLabel)}
                          disabled={!customLabel || isSubmitting}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-5"
                        >
                          Kirim
                        </Button>
                      </div>
                      <Button variant="ghost" className="text-slate-500 text-xs" onClick={() => setShowOthers(false)}>Batal</Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 mb-6 shadow-md shadow-emerald-500/10">
                  <Sparkles size={36} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Semua Antrean Bersih! ✨</h3>
                <p className="text-sm text-slate-600 max-w-sm mt-2 leading-relaxed">
                  Tidak ada prediksi bermasalah yang memerlukan peninjauan manusia saat ini. Model AI berjalan dengan keyakinan tinggi.
                </p>
                <Button onClick={fetchQueue} variant="outline" className="glass rounded-full border-white/60 text-slate-600 mt-6 px-6">
                  <RefreshCw size={14} className="mr-2" /> Cek Ulang Antrean
                </Button>
              </div>
            )}

          </div>

          {/* Sidebar Info & Logs */}
          <div className="flex flex-col gap-6">
            <div className="glass rounded-[32px] p-6 border border-white/60 shadow-sm bg-white/30">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <RefreshCw size={18} className="text-emerald-500 animate-spin-slow" /> Fine-tuning Status
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium">Data Terkumpul (Batch Baru)</span>
                    <span className="font-bold text-slate-800">{totalReviewed} / 10</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                    <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    Setiap 10 data review terkumpul, model siap dilatih ulang (fine-tuned) secara lokal untuk meningkatkan akurasi.
                  </p>
                </div>

                <Button 
                  className="w-full rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 mt-4 shadow-sm font-semibold" 
                  disabled={totalReviewed < 10}
                >
                  {totalReviewed >= 10 ? "✨ Mulai Retraining Sekarang" : "Kumpulkan 10 Review untuk Retrain"}
                </Button>
              </div>
            </div>

            <div className="glass rounded-[32px] p-6 border border-white/60 shadow-sm flex-1 flex flex-col bg-white/30">
              <h3 className="font-semibold text-slate-800 mb-4">Log Review Terakhir</h3>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px]">
                {logs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">Belum ada riwayat review tersimpan.</p>
                ) : (
                  logs.map((log) => {
                    const isCorrect = log.diseaseLabel === log.groundTruth;
                    return (
                      <div key={log.id} className="flex justify-between items-center p-3 rounded-xl bg-white/40 border border-white/50">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {isCorrect ? <Check size={14} /> : <AlertCircle size={14} />}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">#PIC-{log.id.slice(0, 5).toUpperCase()}</p>
                            <p className="text-[10px] text-slate-500">
                              {isCorrect ? `Tepat: ${log.groundTruth}` : `Koreksi: ${log.groundTruth}`}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400">{formatTimeAgo(log.createdAt)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
