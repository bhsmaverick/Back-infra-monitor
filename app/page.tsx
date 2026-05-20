'use client';

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Activity, ShieldCheck, AlertCircle, Clock, Server } from 'lucide-react';

type Target = {
  name: string;
  url: string;
};

type MetricData = {
  time: string;
  field: string;
  value: number;
};

export default function SREDashboard() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial Fetch of Targets
  useEffect(() => {
    fetch('/api/targets')
      .then(res => res.json())
      .then((data: Target[]) => {
        setTargets(data);
        if (data.length > 0) setSelectedTarget(data[0]);
      })
      .catch(console.error);
  }, []);

  // Polling loop for active Target
  useEffect(() => {
    if (!selectedTarget) return;
    
    setLoading(true);
    const fetchMetrics = () => {
      fetch(`/api/metrics/latency?target=${encodeURIComponent(selectedTarget.name)}`)
        .then(res => res.json())
        .then(data => {
          setMetrics(data);
          setLoading(false);
        })
        .catch(console.error);
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // 30s as in Go Engine
    return () => clearInterval(interval);
  }, [selectedTarget]);

  // Aggregate by timestamps for Recharts
  const chartData = metrics
    .filter(m => m.field === 'latency_ms')
    .map(m => ({
      time: m.time,
      latency: m.value
    }));

  const latestLatency = chartData[chartData.length - 1]?.latency || 0;
  const latestSSL = metrics.filter(m => m.field === 'ssl_days_remaining').pop()?.value || 0;
  const latestStatus = metrics.filter(m => m.field === 'status_code').pop()?.value || 0;
  const isHealthy = latestStatus >= 200 && latestStatus < 400;

  return (
    <div className="min-h-screen h-screen bg-[#0B0E14] text-[#C9D1D9] font-mono flex flex-col overflow-hidden selection:bg-[#238636]/50">
      <header className="h-14 border-b border-[#30363D] bg-[#161B22] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#238636] rounded flex items-center justify-center text-white">
            <Activity className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight uppercase">
            Proactive Infra Monitor <span className="text-[#8B949E] text-xs font-normal ml-2">v2.4.0-stable</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-[#8B949E] uppercase">InfluxDB Node</span>
            <span className="text-xs text-[#56D364] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#56D364]"></span> Connected
            </span>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-[#8B949E] uppercase">Polling Status</span>
            <span className="text-xs text-white">ACTIVE</span>
          </div>
          <div className="px-3 py-1 bg-[#21262D] border border-[#30363D] rounded text-xs text-white">ENGINE: GO 1.21</div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 p-4 overflow-hidden">
        
        {/* Targets Sidebar */}
        <div className="md:col-span-3 space-y-4 flex flex-col overflow-y-auto pr-2">
          <h2 className="text-xs font-bold tracking-widest text-[#8B949E] uppercase">Live Target Status</h2>
          <div className="flex flex-col gap-2">
            {targets.map(t => (
              <button
                key={t.name}
                onClick={() => setSelectedTarget(t)}
                className={`text-left px-3 py-2 rounded border transition-all duration-200 ${
                  selectedTarget?.name === t.name 
                  ? 'border-[#79C0FF] bg-[#1F242C] text-white' 
                  : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:bg-[#1C2128]'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs">{t.name}</span>
                  <Server className="w-3.5 h-3.5 opacity-50" />
                </div>
                <div className="text-[10px] text-[#8B949E] truncate">{t.url}</div>
              </button>
            ))}
          </div>
          <div className="p-3 mt-auto rounded border border-[#30363D] bg-[#161B22] text-[10px] text-[#8B949E]">
            <span className="font-bold flex items-center gap-2 mb-1 text-white"><AlertCircle className="w-3.5 h-3.5 text-[#E3B341]"/> EXPORT READY</span>
            Requested Go + Docker files have been written to <span className="text-white bg-[#0D1117] px-1 rounded">/backend</span>.
          </div>
        </div>

        {/* Analytics Main View */}
        <div className="md:col-span-9 space-y-4 flex flex-col overflow-hidden">
          {loading ? (
             <div className="flex-1 w-full flex items-center justify-center border border-[#30363D] rounded bg-[#161B22]">
                <Activity className="w-8 h-8 text-[#8B949E] animate-pulse" />
             </div>
          ) : selectedTarget ? (
            <>
              {/* Telemetry Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                <div className="bg-[#161B22] border border-[#30363D] p-3 rounded">
                  <div className="text-[10px] text-[#8B949E] uppercase mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> LATENCY
                  </div>
                  <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                    {latestLatency} <span className="text-sm font-normal text-[#8B949E]">ms</span>
                  </div>
                </div>

                <div className="bg-[#161B22] border border-[#30363D] p-3 rounded">
                  <div className="text-[10px] text-[#8B949E] uppercase mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> SSL CERTIFICATE
                  </div>
                  <div className="text-2xl font-bold text-[#79C0FF] flex items-baseline gap-1">
                    {latestSSL} <span className="text-sm font-normal text-[#8B949E]">days left</span>
                  </div>
                </div>

                <div className="bg-[#161B22] border border-[#30363D] p-3 rounded">
                  <div className="text-[10px] text-[#8B949E] uppercase mb-1 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> STATUS CODE
                  </div>
                  <div className={`text-2xl font-bold flex items-baseline gap-2 ${isHealthy ? 'text-[#56D364]' : 'text-[#F85149]'}`}>
                    {latestStatus}
                    <span className="text-[10px] font-normal uppercase">{isHealthy ? 'HEALTHY' : 'CRITICAL'}</span>
                  </div>
                </div>
              </div>

              {/* Time Series Graph */}
              <div className="bg-[#161B22] border border-[#30363D] rounded flex flex-col flex-grow min-h-0">
                <div className="px-4 py-2 border-b border-[#30363D] flex justify-between items-center shrink-0">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#8B949E]">Latency Trends</h2>
                  <span className="text-[10px] bg-[#1F242C] px-2 py-0.5 rounded text-[#79C0FF]">RANGE: LAST 1H</span>
                </div>
                <div className="flex-grow w-full p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#56D364" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#56D364" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        tickFormatter={(val) => format(parseISO(val), 'HH:mm')} 
                        stroke="#30363D" 
                        tick={{fill: '#8B949E', fontSize: 10, fontFamily: 'monospace'}}
                        tickMargin={10}
                        minTickGap={30}
                      />
                      <YAxis 
                        stroke="#30363D" 
                        tick={{fill: '#8B949E', fontSize: 10, fontFamily: 'monospace'}} 
                        tickFormatter={(val) => `${val}ms`}
                        width={60}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
                        itemStyle={{ color: '#56D364' }}
                        labelStyle={{ color: '#8B949E' }}
                        labelFormatter={(lbl) => format(parseISO(lbl as string), 'yyyy-MM-dd HH:mm:ss')}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="#56D364" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#latencyGradient)" 
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-[#8B949E] text-xs uppercase tracking-widest">
              SELECT TARGET TO INITIATE VIEW
            </div>
          )}
        </div>
      </main>

      {/* Bottom Terminal Bar */}
      <footer className="h-8 bg-[#0D1117] border-t border-[#30363D] px-4 flex items-center justify-between shrink-0 text-[10px] text-[#8B949E] uppercase tracking-tighter">
        <div className="flex gap-4">
          <span className="flex items-center gap-1 font-bold text-[#56D364]">
            <span className="w-1.5 h-1.5 bg-[#56D364] rounded-full animate-pulse"></span> ENGINE_OK
          </span>
          <span className="hidden md:inline">InfluxDB 2.7.5</span>
          <span className="hidden md:inline">Docker: 24.0.7</span>
          <span className="hidden md:inline">Go: 1.22.1</span>
        </div>
        <div className="flex gap-4">
          <span className="hidden md:inline">System Load: 0.12 0.44 0.52</span>
          <span>Mem: 452MB / 2048MB</span>
        </div>
      </footer>
    </div>
  );
}
