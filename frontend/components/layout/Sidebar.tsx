"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  History, 
  ActivitySquare, 
  CheckSquare, 
  Settings,
  Sprout,
  User
} from "lucide-react";

const routes = [
  { href: "/dashboard", icon: LayoutDashboard },
  { href: "/history", icon: History },
  { href: "/predictions", icon: ActivitySquare },
  { href: "/review", icon: CheckSquare },
  { href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full justify-between items-center py-2">
      
      {/* Top Logo Pill */}
      <Link href="/dashboard" className="glass w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-600 hover:scale-105 transition-transform">
        <Sprout size={28} strokeWidth={2.5} />
      </Link>

      {/* Middle Navigation Pill */}
      <div className="glass rounded-full py-6 px-2 flex flex-col gap-4 items-center">
        {routes.map((route) => {
          const isActive = pathname.startsWith(route.href);
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                isActive 
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-110" 
                  : "text-slate-500 hover:bg-white/50 hover:text-slate-800"
              )}
            >
              <route.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </Link>
          );
        })}
      </div>

      {/* Bottom Profile Pill */}
      <div className="glass w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="https://i.pravatar.cc/150?img=11" 
          alt="Profile" 
          className="w-full h-full object-cover"
        />
      </div>

    </div>
  );
}
