import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TomatoHealth AI",
  description: "Sistem monitoring dan prediksi kesehatan tanaman tomat berbasis IoT + Machine Learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex h-screen overflow-hidden font-sans p-4 md:p-6 gap-6">
        <aside className="w-16 md:w-20 hidden md:flex flex-col z-50 shrink-0">
          <Sidebar />
        </aside>
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto mt-6 pb-6 no-scrollbar">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
