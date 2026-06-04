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



      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* AI Assistant and other icons removed as requested */}
      </div>
    </div>
  );
}
