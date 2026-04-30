import { Thermometer, Droplets, Leaf, ArrowUpRight, Activity, Camera, Wind, Zap } from "lucide-react";

export default function DashboardPage() {
  const placeholderImg = "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=1200&auto=format&fit=crop";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      
      {/* --- ROW 1 & 2 --- */}
      
      {/* Hero Image (Spans 2 columns, 2 rows) */}
      <div className="lg:col-span-2 lg:row-span-2 relative rounded-[32px] overflow-hidden shadow-sm border border-white/40 group">
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
          <Camera size={14} /> ESP32-CAM Feed
        </div>
      </div>

      {/* Right Card 1: Image History Count */}
      <div className="glass rounded-[32px] p-6 flex flex-col h-full border border-white/60 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <div className="p-1.5 bg-white/60 rounded-full"><Zap size={16} /></div> 
            Riwayat Scan
          </div>
          <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
            <ArrowUpRight size={16} className="text-slate-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-800 mb-1">1,250 <span className="text-sm font-medium text-slate-500">Foto</span></div>
        <div className="flex-1 mt-6 flex items-end gap-1.5 h-24">
          {/* Mock Bar Chart */}
          {[40, 60, 45, 80, 50, 90, 70, 85, 60, 75].map((h, i) => (
            <div key={i} className="flex-1 bg-linear-to-t from-emerald-400 to-emerald-200 rounded-t-sm" style={{ height: `${h}%` }}></div>
          ))}
        </div>
      </div>

      {/* Right Card 2: Confidence Levels */}
      <div className="glass rounded-[32px] p-6 flex flex-col h-full border border-white/60 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <div className="p-1.5 bg-white/60 rounded-full"><Activity size={16} /></div> 
            Rata-rata Confidence
          </div>
          <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
            <ArrowUpRight size={16} className="text-slate-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-800 mb-1">92.4 <span className="text-sm font-medium text-slate-500">%</span></div>
        <div className="flex-1 mt-6 flex items-end gap-1.5 h-24">
          {/* Mock Bar Chart */}
          {[60, 40, 70, 50, 85, 65, 45, 80, 55, 90].map((h, i) => (
            <div key={i} className={`flex-1 rounded-t-sm ${i % 2 === 0 ? 'bg-orange-400' : 'bg-slate-300/50'}`} style={{ height: `${h}%` }}></div>
          ))}
        </div>
      </div>

      {/* --- ROW 3 --- */}

      {/* 4 Small Metric Cards */}
      <div className="grid grid-cols-2 grid-rows-2 gap-4">
        {/* Card 1 */}
        <div className="glass rounded-[24px] p-5 flex flex-col justify-between border border-white/60 hover:bg-white/40 transition-colors">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
              <Thermometer size={16} /> Suhu Udara
            </div>
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-2xl font-bold text-slate-800">28<span className="text-lg">°C</span></div>
            <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center"><ArrowUpRight size={12} className="text-slate-600" /></div>
          </div>
        </div>
        
        {/* Card 2 */}
        <div className="glass rounded-[24px] p-5 flex flex-col justify-between border border-white/60 hover:bg-white/40 transition-colors">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
              <Droplets size={16} /> Kelembapan
            </div>
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-2xl font-bold text-slate-800">68<span className="text-lg">%</span></div>
            <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center"><ArrowUpRight size={12} className="text-slate-600" /></div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass rounded-[24px] p-5 flex flex-col justify-between border border-white/60 hover:bg-white/40 transition-colors">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
              <Wind size={16} /> Status Kipas
            </div>
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-2xl font-bold text-slate-800">ON</div>
            <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center"><ArrowUpRight size={12} className="text-slate-600" /></div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass rounded-[24px] p-5 flex flex-col justify-between border border-white/60 hover:bg-white/40 transition-colors">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
              <Leaf size={16} /> Model Val
            </div>
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-2xl font-bold text-slate-800">92.5<span className="text-lg">%</span></div>
            <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center"><ArrowUpRight size={12} className="text-slate-600" /></div>
          </div>
        </div>
      </div>

      {/* Middle Bottom Card: Suhu Historis */}
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
        <div className="text-3xl font-bold text-slate-800 mb-2">26.8 <span className="text-sm font-medium text-slate-500">Rata-rata</span></div>
        <div className="flex-1 flex items-end gap-1 h-32 mt-4">
          {[30, 45, 25, 60, 50, 80, 90, 70, 50, 60, 85, 40, 50, 70, 60, 45].map((h, i) => (
            <div key={i} className="flex-1 bg-slate-300/50 rounded-t-sm relative group">
              <div className="absolute bottom-0 w-full bg-emerald-500/80 rounded-t-sm" style={{ height: `${h}%` }}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Bottom Card: Area Chart */}
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
        <div className="text-3xl font-bold text-slate-800 mb-2">68 <span className="text-sm font-medium text-slate-500">%</span></div>
        <div className="flex-1 flex items-end h-32 mt-4 relative overflow-hidden">
          {/* Mock Area Chart using CSS */}
          <div className="w-full h-full bg-linear-to-t from-emerald-100 to-transparent" style={{ clipPath: "polygon(0 100%, 0 60%, 20% 50%, 40% 70%, 60% 40%, 80% 60%, 100% 30%, 100% 100%)" }}></div>
          <div className="absolute w-full h-full border-t-2 border-emerald-500" style={{ clipPath: "polygon(0 60%, 20% 50%, 40% 70%, 60% 40%, 80% 60%, 100% 30%, 100% 0, 0 0)" }}></div>
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
