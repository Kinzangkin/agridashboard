"use client";

import { useState, useRef } from "react";
import { Search, Filter, AlertCircle, ArrowUpRight, X, AlertTriangle, CheckCircle2, Thermometer, Droplets, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadPredict, PredictionResponse } from "@/lib/api";

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

  const mockImages = Array(8).fill("https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=400&auto=format&fit=crop");
  const statuses = ["SEHAT", "EARLY BLIGHT", "SEHAT", "LATE BLIGHT", "SEHAT", "SEHAT", "SEPTORIA", "SEHAT"];
  const confidences = ["98%", "85%", "92%", "88%", "95%", "99%", "78%", "96%"];
  
  // Data AI Insight berdasarkan label penyakit
  const getAiInsight = (status: string) => {
    const statusUpper = status.toUpperCase();
    if (statusUpper === "SEHAT") {
      return {
        desc: "Pertumbuhan vegetatif sangat baik. Tidak ada tanda bercak jamur atau defisiensi nutrisi.",
        action: "Pertahankan jadwal penyiraman 2x sehari dan pemupukan NPK minggu depan.",
        risk: "Rendah",
        color: "text-emerald-600 bg-emerald-50 border-emerald-200"
      };
    } else if (statusUpper.includes("EARLY BLIGHT")) {
      return {
        desc: "Terdeteksi bercak cokelat dengan cincin konsentris di daun bagian bawah (Gejala awal Alternaria solani). Jika dibiarkan, daun akan menguning dan rontok dalam 3-5 hari ke depan.",
        action: "1. Pangkas segera daun yang terinfeksi dan jauhkan dari kebun.\n2. Pastikan sirkulasi udara baik (kipas menyala).\n3. Aplikasikan fungisida (Mankozeb/Klorotalonil) besok pagi.",
        risk: "Sedang",
        color: "text-amber-700 bg-amber-50 border-amber-200"
      };
    } else if (statusUpper.includes("LATE BLIGHT")) {
      return {
        desc: "Infeksi agresif terdeteksi (Phytophthora infestans). Tanaman berisiko mati total dalam 24-48 jam jika kondisi lembap terus berlanjut.",
        action: "1. Karantina/cabut tanaman yang sudah parah agar tidak menular.\n2. Kurangi kelembapan ruangan segera di bawah 60%.\n3. Semprotkan fungisida sistemik secara menyeluruh.",
        risk: "Sangat Tinggi",
        color: "text-rose-700 bg-rose-50 border-rose-200"
      };
    } else if (statusUpper.includes("BACTERIAL")) {
      return {
        desc: "Bercak air pada daun, batang, atau buah yang disebabkan bakteri Xanthomonas campestris. Menyebar cepat melalui percikan air.",
        action: "1. Hindari penyiraman dari atas (gunakan irigasi tetes).\n2. Semprotkan bakterisida berbahan tembaga.\n3. Buang dan musnahkan daun yang terinfeksi parah.",
        risk: "Tinggi",
        color: "text-orange-700 bg-orange-50 border-orange-200"
      };
    } else if (statusUpper.includes("SEPTORIA")) {
      return {
        desc: "Bercak kecil bulat berwarna cokelat dengan titik hitam di tengahnya (Septoria lycopersici). Biasa menyerang daun tua lebih dahulu.",
        action: "1. Pangkas daun terinfeksi dari bawah ke atas.\n2. Jaga jarak tanam agar sirkulasi udara baik.\n3. Aplikasikan fungisida berbahan Klorotalonil.",
        risk: "Sedang",
        color: "text-amber-700 bg-amber-50 border-amber-200"
      };
    } else if (statusUpper.includes("LEAF MOLD")) {
      return {
        desc: "Jamur Fulvia fulva menyebabkan bercak kuning di permukaan atas daun dan lapisan jamur abu-abu di bawahnya. Berkembang di kelembapan tinggi.",
        action: "1. Turunkan kelembapan di bawah 70%.\n2. Tingkatkan sirkulasi udara.\n3. Semprotkan fungisida sistemik.",
        risk: "Sedang",
        color: "text-amber-700 bg-amber-50 border-amber-200"
      };
    } else if (statusUpper.includes("SPIDER")) {
      return {
        desc: "Tungau laba-laba (Tetranychus urticae) menyebabkan daun memutih/menguning dengan bintik-bintik kecil. Sering terjadi di musim kemarau.",
        action: "1. Semprotkan air pada daun untuk mengurangi populasi tungau.\n2. Aplikasikan akarisida atau pestisida nabati.\n3. Jaga kelembapan tanah yang cukup.",
        risk: "Sedang",
        color: "text-yellow-700 bg-yellow-50 border-yellow-200"
      };
    } else if (statusUpper.includes("TARGET")) {
      return {
        desc: "Bercak target (Corynespora cassiicola) — lingkaran konsentris mirip sasaran panah pada daun, batang, dan buah.",
        action: "1. Rotasi tanaman di musim tanam berikutnya.\n2. Aplikasikan fungisida yang direkomendasikan.\n3. Buang sisa tanaman yang terinfeksi.",
        risk: "Sedang-Tinggi",
        color: "text-orange-700 bg-orange-50 border-orange-200"
      };
    } else if (statusUpper.includes("YELLOW LEAF") || statusUpper.includes("CURL")) {
      return {
        desc: "Virus Yellow Leaf Curl yang dibawa kutu kebul (Bemisia tabaci). Daun mengkerut, menguning, dan pertumbuhan terhenti.",
        action: "1. Kendalikan populasi kutu kebul dengan insektisida.\n2. Pasang perangkap kuning di sekitar tanaman.\n3. Cabut dan musnahkan tanaman yang terinfeksi parah untuk mencegah penyebaran.",
        risk: "Sangat Tinggi",
        color: "text-rose-700 bg-rose-50 border-rose-200"
      };
    } else if (statusUpper.includes("MOSAIC")) {
      return {
        desc: "Virus mosaik tomat (ToMV) menyebabkan pola warna berbintik-bintik pada daun dan buah. Menyebar melalui kontak langsung dan alat berkebun.",
        action: "1. Sterilkan semua alat berkebun sebelum digunakan.\n2. Cuci tangan sebelum menyentuh tanaman.\n3. Cabut tanaman yang sangat terinfeksi.",
        risk: "Tinggi",
        color: "text-rose-700 bg-rose-50 border-rose-200"
      };
    } else {
      return {
        desc: "Kondisi tanaman memerlukan perhatian lebih lanjut dari ahli agronomi.",
        action: "Lakukan pemeriksaan visual secara menyeluruh dan konsultasikan dengan ahli pertanian.",
        risk: "Tidak Diketahui",
        color: "text-slate-700 bg-slate-50 border-slate-200"
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

    // Also update localStorage so Dashboard can pick it up
    if (response.success && response.data) {
      localStorage.setItem('latestPrediction', JSON.stringify({
        temperature: response.data.sensor.temperature,
        humidity: response.data.sensor.humidity,
        timestamp: new Date().toISOString()
      }));
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

      {/* --- Test Prediction Panel --- */}
      <div className="glass rounded-[32px] p-6 border border-white/60 shadow-sm mb-2">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ActivitySquareIcon className="text-emerald-500" />
          Test Prediksi Manual (Tanpa IoT)
        </h2>
        
        <div className="flex flex-col md:flex-row gap-6">
          {/* Upload Area */}
          <div className="flex-1">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
                ${previewUrl ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/50'}
              `}
              style={{ minHeight: '160px' }}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              
              {previewUrl ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="h-24 w-24 object-cover rounded-xl shadow-sm" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-700">{file?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file?.size ? (file.size / 1024).toFixed(1) : 0)} KB</p>
                    <Button variant="ghost" className="text-emerald-600 px-0 h-auto mt-2 text-xs hover:bg-transparent hover:text-emerald-700 hover:underline" onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}>Ganti Gambar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                    <Upload className="text-slate-400" size={20} />
                  </div>
                  <p className="font-semibold text-slate-700">Klik untuk upload foto daun</p>
                  <p className="text-xs text-slate-500 mt-1">Format: JPG, PNG, WEBP (Maks 5MB)</p>
                </>
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
              disabled={!file || isLoading}
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
                       <AlertCircle size={14} className="text-amber-600"/>
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
