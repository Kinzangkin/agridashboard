"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const dummyData = [
  { time: "08:00", suhu: 26, kelembaban: 60, tanah: 45 },
  { time: "09:00", suhu: 27, kelembaban: 58, tanah: 44 },
  { time: "10:00", suhu: 29, kelembaban: 55, tanah: 43 },
  { time: "11:00", suhu: 31, kelembaban: 52, tanah: 41 },
  { time: "12:00", suhu: 32, kelembaban: 50, tanah: 40 },
  { time: "13:00", suhu: 33, kelembaban: 48, tanah: 38 },
  { time: "14:00", suhu: 32, kelembaban: 50, tanah: 42 }, // disiram
];

export function SensorChart() {
  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dummyData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="time" 
            tickLine={false} 
            axisLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            tickLine={false} 
            axisLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Line 
            type="monotone" 
            dataKey="suhu" 
            name="Suhu (°C)"
            stroke="#f43f5e" 
            strokeWidth={3} 
            dot={{ r: 4, strokeWidth: 2 }} 
            activeDot={{ r: 6 }} 
          />
          <Line 
            type="monotone" 
            dataKey="kelembaban" 
            name="Kelembaban Udara (%)"
            stroke="#0ea5e9" 
            strokeWidth={3} 
            dot={{ r: 4, strokeWidth: 2 }} 
          />
          <Line 
            type="monotone" 
            dataKey="tanah" 
            name="Kelembaban Tanah (%)"
            stroke="#3b82f6" 
            strokeWidth={3} 
            dot={{ r: 4, strokeWidth: 2 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
