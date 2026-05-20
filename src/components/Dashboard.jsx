import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Activity, ShieldCheck, Clock, Server, Plus, Settings, LogOut, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Dashboard({ session }) {
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [metrics, setMetrics] = useState([]);
  
  // Form States
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');

  const API_BASE = import.meta.env.VITE_GO_API_URL || 'http://localhost:8080';

  const fetchTargets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/targets?user_id=${session.user.id}`);
      if (!res.ok) throw new Error('Failed to fetch targets');
      const data = await res.json();
      setTargets(data || []);
      if (!selectedTarget && data && data.length > 0) setSelectedTarget(data[0]);
    } catch(e) {
      console.error(e);
    }
  };

  const fetchNotificationConfig = async () => {
    const { data } = await supabase.from('notification_configs').select('*').eq('user_id', session.user.id).single();
    if (data) {
      setBotToken(data.telegram_bot_token || '');
      setChatId(data.telegram_chat_id || '');
    }
  };

  useEffect(() => {
    fetchTargets();
    fetchNotificationConfig();
  }, [session.user.id]);

  useEffect(() => {
    if (!selectedTarget) return;
    
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metrics/latency?user_id=${session.user.id}&target_id=${selectedTarget.id}`);
        if(res.ok) {
          const data = await res.json();
          setMetrics(Array.isArray(data) ? data : []);
        }
      } catch(e) {
        console.error(e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedTarget, session.user.id]);

  const handleAddTarget = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('targets').insert({
      user_id: session.user.id,
      name: newTargetName,
      url: newTargetUrl,
      expected_status: parseInt(expectedStatus, 10)
    });
    
    if (!error) {
      setNewTargetName('');
      setNewTargetUrl('');
      setExpectedStatus(200);
      fetchTargets();
    } else {
      alert("Error adding target: " + error.message);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('notification_configs').upsert({
      user_id: session.user.id,
      telegram_bot_token: botToken,
      telegram_chat_id: chatId,
      updated_at: new Date().toISOString()
    });
    if (!error) {
      alert("Alert configuration successfully synched.");
    } else {
      alert("Error saving config: " + error.message);
    }
  };

  const chartData = metrics.filter(m => m.field === 'latency_ms').map(m => ({
    time: m.time,
    latency: m.value
  }));

  const latestLatency = chartData.length > 0 ? chartData[chartData.length - 1].latency : 0;
  const latestSSL = metrics.filter(m => m.field === 'ssl_days_remaining').pop()?.value || 0;
  const latestStatus = metrics.filter(m => m.field === 'status_code').pop()?.value || 0;
  const isHealthy = latestStatus >= 200 && latestStatus < 400;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-slate-900/50 flex items-center justify-between px-6 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <h1 className="font-bold text-white tracking-tight">SaaS Dashboard</h1>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-400">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Exit
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Data Entry & Target Selection */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Target List */}
          <div className="bg-slate-900 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 bg-slate-900/50">
              <h3 className="font-semibold text-white flex items-center gap-2"><Server className="w-4 h-4 text-emerald-400"/> Active Endpoints</h3>
            </div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto custom-scrollbar">
              {targets.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No endpoints defined.</div>
              ) : (
                targets.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setSelectedTarget(t)}
                    className={`w-full text-left px-5 py-4 transition-all ${selectedTarget?.id === t.id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
                  >
                    <div className="font-medium text-white text-sm mb-1">{t.name}</div>
                    <div className="text-xs text-slate-500 truncate">{t.url}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Add Target & Configure Alerts Forms */}
          <div className="bg-slate-900 rounded-xl border border-white/5 p-5 space-y-8">
            {/* Add Target */}
            <form onSubmit={handleAddTarget} className="space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                <Plus className="w-4 h-4 text-indigo-400"/> Add Monitoring Target
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <input required placeholder="Service Name (e.g., Auth API)" value={newTargetName} onChange={e => setNewTargetName(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                <input required type="url" placeholder="Endpoint URL (https://...)" value={newTargetUrl} onChange={e => setNewTargetUrl(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 shrink-0">Expected Status:</span>
                  <input required type="number" value={expectedStatus} onChange={e => setExpectedStatus(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full" />
                </div>
              </div>
              <button type="submit" className="w-full bg-white text-slate-900 font-semibold text-sm py-2 rounded-lg hover:bg-slate-200 transition-colors shadow-lg">Save Endpoint</button>
            </form>

            {/* Config Alerts */}
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                <Settings className="w-4 h-4 text-amber-400"/> Telegram Pipeline Override
              </h3>
              <p className="text-xs text-slate-500 pb-1">Define your custom Bot token to receive out-of-band pager alerts completely isolated from other tenants.</p>
              <div className="grid grid-cols-1 gap-3">
                <input placeholder="Telegram Bot Token" value={botToken} onChange={e => setBotToken(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                <input placeholder="Target Chat ID" value={chatId} onChange={e => setChatId(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm py-2 rounded-lg transition-colors border border-white/5">Sync Configuration</button>
            </form>
          </div>

        </div>

        {/* Right Column: Analytics & Visualization */}
        <div className="xl:col-span-8 flex flex-col space-y-6 min-h-0">
          
          {selectedTarget ? (
             <>
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-white/5 p-4 rounded-xl shadow-inner">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Clock className="w-4 h-4"/> Latency (ms)</div>
                    <div className="text-3xl font-light text-white">{latestLatency}</div>
                  </div>
                  <div className="bg-slate-900 border border-white/5 p-4 rounded-xl shadow-inner">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> SSL Validity</div>
                    <div className={`text-3xl font-light ${latestSSL < 14 ? 'text-amber-400' : 'text-emerald-400'}`}>{latestSSL} <span className="text-sm font-normal text-slate-500">days</span></div>
                  </div>
                  <div className="bg-slate-900 border border-white/5 p-4 rounded-xl shadow-inner">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Activity className="w-4 h-4"/> HTTP Status</div>
                    <div className={`text-3xl font-light flex items-center gap-2 ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                      {latestStatus || '--'}
                      {isHealthy ? <CheckCircle2 className="w-5 h-5 opacity-50"/> : null}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-white/5 p-4 rounded-xl shadow-inner flex flex-col justify-center overflow-hidden">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target Identity</div>
                    <div className="text-sm font-medium text-indigo-400 truncate w-full" title={selectedTarget.name}>{selectedTarget.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase truncate font-mono">ID: {selectedTarget.id}</div>
                  </div>
                </div>

                {/* Main Graph Area */}
                <div className="bg-slate-900 border border-white/5 rounded-xl flex flex-col flex-1 shadow-2xl overflow-hidden min-h-[400px]">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-slate-900/50 shrink-0">
                    <div className="overflow-hidden">
                      <h2 className="font-semibold text-white">Global Latency Distribution</h2>
                      <p className="text-xs text-slate-500 tracking-wide mt-1 font-mono truncate max-w-lg">{selectedTarget.url}</p>
                    </div>
                    <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-md text-xs font-semibold uppercase tracking-wider border border-indigo-500/20 whitespace-nowrap">
                      Live Stream
                    </div>
                  </div>
                  
                  <div className="p-6 flex-1 w-full relative">
                     <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                         <XAxis 
                           dataKey="time" 
                           tickFormatter={(val) => val ? format(parseISO(val), 'HH:mm') : ''} 
                           stroke="#ffffff20" 
                           tick={{fill: '#64748b', fontSize: 11}}
                           axisLine={false}
                           tickLine={false}
                         />
                         <YAxis 
                           stroke="#ffffff20" 
                           tick={{fill: '#64748b', fontSize: 11}} 
                           width={40}
                           axisLine={false}
                           tickLine={false}
                         />
                         <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                           itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                           labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                           labelFormatter={(lbl) => lbl ? format(parseISO(lbl), 'HH:mm:ss') : ''}
                         />
                         <Line 
                           type="monotone" 
                           dataKey="latency" 
                           stroke="#818cf8" 
                           strokeWidth={3}
                           dot={false}
                           activeDot={{ r: 6, fill: '#818cf8', stroke: '#0f172a', strokeWidth: 2 }}
                           isAnimationActive={false}
                         />
                       </LineChart>
                     </ResponsiveContainer>
                  </div>
                </div>
             </>
          ) : (
             <div className="h-full min-h-[500px] flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl bg-slate-900/30">
               <div className="text-center">
                 <Server className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                 <h3 className="text-lg font-medium text-slate-300">No Service Selected</h3>
                 <p className="text-sm text-slate-500 mt-2">Create an endpoint in the panel or select an existing target to render metrics.</p>
               </div>
             </div>
          )}

        </div>
      </main>
    </div>
  );
}
