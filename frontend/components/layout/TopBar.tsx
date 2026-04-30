"use client";

import { Bell, Search, Mic, Download, Moon, Sun, Lightbulb, Sparkles, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <Button className="hidden md:flex bg-linear-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 text-white rounded-full shadow-lg shadow-emerald-500/30 border-none px-6">
          <Sparkles className="mr-2 h-4 w-4" /> AI Assistant
        </Button>
        
        <div className="flex items-center gap-2 glass rounded-full p-1 border border-white/60">
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-slate-500 hover:bg-white/50 hover:text-slate-800">
            <Lightbulb className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-slate-500 hover:bg-white/50 hover:text-slate-800">
            <Download className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="relative rounded-full h-10 w-10 text-slate-500 hover:bg-white/50 hover:text-slate-800">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2.5 h-2 w-2 bg-emerald-500 rounded-full border-2 border-white"></span>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-slate-500 hover:bg-white/50 hover:text-slate-800">
            <Moon className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
