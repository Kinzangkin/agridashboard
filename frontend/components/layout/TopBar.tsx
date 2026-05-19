"use client";

import { Search, Mic, Sprout } from "lucide-react";

export function TopBar() {
  return (
    <div className="h-16 flex items-center justify-between w-full">
      {/* Left: Title */}
      <div className="flex items-center gap-3">
        <div className="text-emerald-600 bg-emerald-100 p-2 rounded-xl">
          <Sprout size={24} />
        </div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">TomatoHealth AI</h1>
      </div>

      {/* Middle: Search */}
      <div className="hidden md:flex items-center glass rounded-full px-4 py-2 w-96 shadow-sm border border-white/60">
        <Search className="text-slate-400 h-4 w-4 mr-2" />
        <input 
          type="text" 
          placeholder="Search..." 
          className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 text-slate-700"
        />
        <Mic className="text-slate-400 h-4 w-4 ml-2 cursor-pointer hover:text-slate-700" />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* AI Assistant and other icons removed as requested */}
      </div>
    </div>
  );
}
