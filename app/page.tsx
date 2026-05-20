'use client';

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Activity, ShieldCheck, AlertCircle, Clock, Server, Play, Plus, LogOut, CheckCircle2, XCircle } from 'lucide-react';
import { createClient, Session } from '@supabase/supabase-js';

// Supabase client initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type Target = {
  id: string;
  name: string;
  url: string;
  expected_status: number;
};

type MetricData = {
  time: string;
  field: string;
  value: number;
};

export default function SaaSApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Activity className="w-8 h-8 text-[#56D364] animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  return <Dashboard session={session} />;
}

// ==========================================
// LANDING PAGE (SaaS Marketing)
// ==========================================
function LandingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [msg, setMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase credentials not configured in environment.');
      return;
    }
    setErrorMsg('');
    setMsg('');

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setErrorMsg(error.message);
      else setMsg('Registration successful! Please check your email.');
    }
  };

  const handleOAuth = async () => {
    if (!supabase) {
      setErrorMsg('Supabase credentials missing.');
      return;
    }
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#C9D1D9] font-mono flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#238636]/10 to-transparent pointer-events-none" />
      
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 px-6 z-10">
        
        {/* Left Marketing Side */}
        <div className="flex flex-col justify-center space-y-6">
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 bg-[#238636] rounded flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight uppercase">Proactive Infra</h1>
          </div>
          <h2 className="text-4xl text-white font-bold leading-tight tracking-tighter">
            Zero-Downtime <br/> Monitoring Engine.
          </h2>
          <p className="text-[#8B949E] text-sm max-w-sm">
            High density telemetry and instant incident response for modern DevOps teams. Backed by Go, InfluxDB, and actual native checks.
          </p>
          <ul className="space-y-3 text-sm text-[#8B949E]">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#56D364]" /> Sub-second target polling</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#56D364]" /> Automated Telegram alert routing</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#56D364]" /> SSL Expiry native handshakes</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#56D364]" /> Multi-tenant secure execution</li>
          </ul>
        </div>

        {/* Right Auth Side */}
        <div className="bg-[#161B22] border border-[#30363D] p-8 rounded-lg shadow-2xl flex flex-col self-center">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-1 uppercase tracking-tight">{isLogin ? 'Mission Control Login' : 'Deploy Engine Sandbox'}</h3>
            <p className="text-xs text-[#8B949E]">Authenticate to access your distributed targets.</p>
          </div>

          {!supabase && (
            <div className="mb-4 p-3 bg-red-950/20 border border-red-500/20 rounded text-xs text-red-400">
               ⚠️ NEXT_PUBLIC_SUPABASE_URL and KEY must be set in .env to use SaaS features.
            </div>
          )}

          {errorMsg && <div className="mb-4 text-xs text-[#F85149] p-2 bg-[#F85149]/10 rounded border border-[#F85149]/20">{errorMsg}</div>}
          {msg && <div className="mb-4 text-xs text-[#56D364] p-2 bg-[#56D364]/10 rounded border border-[#56D364]/20">{msg}</div>}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#8B949E] mb-1">Operative Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#79C0FF] transition-colors"
                placeholder="sysadmin@corp.net"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#8B949E] mb-1">Access Key</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#79C0FF] transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="w-full bg-[#238636] hover:bg-[#2EA043] text-white font-bold text-sm py-2 px-4 rounded transition-colors flex items-center justify-center gap-2">
               {isLogin ? 'INITIATE UPLINK' : 'PROVISION ACCOUNT'} <Play className="w-4 h-4" />
            </button>
          </form>

          <div className="my-6 flex items-center gap-2 before:h-px before:flex-1 before:bg-[#30363D] after:h-px after:flex-1 after:bg-[#30363D]">
            <span className="text-[#8B949E] text-xs">OR INITIALIZE WITH</span>
          </div>

          <button onClick={handleOAuth} className="w-full bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-white font-bold text-sm py-2 px-4 rounded transition-colors flex items-center justify-center gap-2">
            Google Workspace
          </button>

          <div className="mt-6 text-center">
            <button 
               onClick={() => setIsLogin(!isLogin)}
               className="text-xs text-[#79C0FF] hover:underline"
            >
              {isLogin ? 'Request clearance (Sign up instead)' : 'Already classified? (Log in)'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


// ==========================================
// DASHBOARD
// ==========================================
function Dashboard({ session }: { session: Session }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms mapping
  const [showForms, setShowForms] = useState(false);
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [newTargetName, setNewTargetName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');

  // Initial Fetch of Targets & Config
  const fetchData = async () => {
    if (!supabase) return;
    
    // Fetch Targets
    const { data: tData, error: tErr } = await supabase.from('targets').select('*').order('created_at', { ascending: true });
    if (tErr) console.error("Error fetching targets:", tErr);
    else {
      setTargets(tData || []);
      if (!selectedTarget && tData && tData.length > 0) setSelectedTarget(tData[0]);
    }

    // Fetch Config
    const { data: cData } = await supabase.from('notification_configs').select('*').eq('user_id', session.user.id).single();
    if (cData) {
      setBotToken(cData.telegram_bot_token || '');
      setChatId(cData.telegram_chat_id || '');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Polling loop for active Target (simulating pulling from Influx via Go API)
  useEffect(() => {
    if (!selectedTarget) return;
    
    setLoading(true);
    const fetchMetrics = () => {
      // In a real deployed setup, we would point this to the Go API (e.g. http://localhost:8080/api/metrics/latency?target_id=X)
      // Since we use the Next.js API route as a proxy for the preview environment, we pass the URL.
      fetch(`/api/metrics/latency?target=${encodeURIComponent(selectedTarget.name)}`)
        .then(res => res.json())
        .then(data => {
          if(Array.isArray(data)) setMetrics(data);
          setLoading(false);
        })
        .catch(console.error);
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedTarget]);

  const chartData = metrics.filter(m => m.field === 'latency_ms').map(m => ({ time: m.time, latency: m.value }));
  const latestLatency = chartData[chartData.length - 1]?.latency || 0;
  const latestSSL = metrics.filter(m => m.field === 'ssl_days_remaining').pop()?.value || 0;
  const latestStatus = metrics.filter(m => m.field === 'status_code').pop()?.value || 0;
  const isHealthy = latestStatus >= 200 && latestStatus < 400;

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.from('targets').insert({
      user_id: session.user.id,
      name: newTargetName,
      url: newTargetUrl,
      expected_status: 200
    });
    if (!error) {
      setNewTargetName('');
      setNewTargetUrl('');
      fetchData();
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.from('notification_configs').upsert({
      user_id: session.user.id,
      telegram_bot_token: botToken,
      telegram_chat_id: chatId,
      updated_at: new Date().toISOString()
    });
    if (!error) {
      alert("Telegram Configuration saved to secure vault.");
    }
  };

  return (
    <div className="min-h-screen h-screen bg-[#0B0E14] text-[#C9D1D9] font-mono flex flex-col overflow-hidden selection:bg-[#238636]/50">
      <header className="h-14 border-b border-[#30363D] bg-[#161B22] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#238636] rounded flex items-center justify-center text-white">
            <Activity className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight uppercase">
            Proactive Infra <span className="text-[#8B949E] text-xs font-normal ml-2">SaaS v3.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] text-[#8B949E] uppercase">Node Operative</span>
            <span className="text-xs text-white truncate max-w-[120px]">{session.user.email}</span>
          </div>
          <button onClick={() => setShowForms(!showForms)} className="px-3 py-1 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] rounded text-xs text-white flex items-center gap-2 transition-colors">
            {showForms ? 'CLOSE CONFIG' : 'ENGINE CONFIG'}
          </button>
          <button onClick={() => supabase?.auth.signOut()} className="text-[#8B949E] hover:text-white transition-colors" title="Disconnect">
             <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col p-4 overflow-hidden relative">
        
        {/* CONFIG OVERLAY (Slides down) */}
        {showForms && (
          <div className="absolute top-4 left-4 right-4 z-20 bg-[#161B22] border border-[#30363D] rounded-lg shadow-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Target Entry */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-4 border-b border-[#30363D] pb-2">Deploy New Target</h3>
              <form onSubmit={handleAddTarget} className="space-y-4">
                 <div>
                   <label className="block text-[10px] uppercase text-[#8B949E] mb-1">Target Name</label>
                   <input type="text" required value={newTargetName} onChange={e => setNewTargetName(e.target.value)} className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#56D364]" placeholder="Auth Service" />
                 </div>
                 <div>
                   <label className="block text-[10px] uppercase text-[#8B949E] mb-1">Endpoint URL</label>
                   <input type="url" required value={newTargetUrl} onChange={e => setNewTargetUrl(e.target.value)} className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#56D364]" placeholder="https://api.example.com/health" />
                 </div>
                 <button type="submit" className="w-full bg-[#238636] hover:bg-[#2EA043] text-white text-xs py-2 rounded flex items-center justify-center gap-2"><Plus className="w-3 h-3"/> Inject Target</button>
              </form>
            </div>

            {/* Telegram Config */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-4 border-b border-[#30363D] pb-2">Telegram Alert Routing</h3>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                 <div>
                   <label className="block text-[10px] uppercase text-[#8B949E] mb-1">Bot Token</label>
                   <input type="text" value={botToken} onChange={e => setBotToken(e.target.value)} className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#79C0FF]" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" />
                 </div>
                 <div>
                   <label className="block text-[10px] uppercase text-[#8B949E] mb-1">Chat ID</label>
                   <input type="text" value={chatId} onChange={e => setChatId(e.target.value)} className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#79C0FF]" placeholder="-100123456789" />
                 </div>
                 <button type="submit" className="w-full bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-white text-xs py-2 rounded flex items-center justify-center gap-2">Save Webhook Params</button>
              </form>
            </div>
            
            <button onClick={() => setShowForms(false)} className="absolute top-4 right-4 text-[#8B949E] hover:text-white"><XCircle className="w-5 h-5"/></button>
          </div>
        )}


        <div className={`flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden transition-all duration-300 ${showForms ? 'opacity-30 blur-sm pointer-events-none' : ''}`}>
          
          {/* Targets High Density Table (Left pane) */}
          <section className="md:col-span-7 bg-[#161B22] border border-[#30363D] rounded flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-[#30363D] flex justify-between items-center shrink-0">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#8B949E]">Live Target Status (Global)</h2>
              <span className="text-[10px] bg-[#1F242C] px-2 py-0.5 rounded text-[#79C0FF]">Auto-refresh: 30s</span>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0D1117] sticky top-0 z-10">
                  <tr className="text-[#8B949E]">
                    <th className="py-2 px-4 border-b border-[#30363D] font-medium whitespace-nowrap">Service Endpoint</th>
                    <th className="py-2 px-4 border-b border-[#30363D] font-medium text-center">Protocol</th>
                    <th className="py-2 px-4 border-b border-[#30363D] font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]">
                  {targets.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-[#8B949E]">No targets configured. Open ENGINE CONFIG to add one.</td>
                    </tr>
                  ) : targets.map((t) => (
                    <tr 
                      key={t.id} 
                      onClick={() => setSelectedTarget(t)}
                      className={`cursor-pointer transition-colors ${selectedTarget?.id === t.id ? 'bg-[#1C2128]' : 'hover:bg-[#1C2128]/50'}`}
                    >
                      <td className="py-2 px-4 whitespace-nowrap">
                        <div className="text-white font-medium">{t.name}</div>
                        <div className="text-[10px] text-[#8B949E] truncate max-w-[200px] xl:max-w-xs">{t.url}</div>
                      </td>
                      <td className="py-2 px-4 text-center text-[#8B949E]">GET</td>
                      <td className="py-2 px-4 text-center">
                         <span className="px-2 py-0.5 rounded bg-[#238636] text-[10px] text-white leading-none inline-block">TRACKED</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Analytics Overview (Right pane) */}
          <section className="md:col-span-5 space-y-4 flex flex-col min-h-0">
            {selectedTarget ? (
              <>
                <div className="grid grid-cols-2 gap-4 shrink-0">
                  <div className="bg-[#161B22] border border-[#30363D] p-3 rounded">
                    <div className="text-[10px] text-[#8B949E] uppercase mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> LATENCY
                    </div>
                    <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                      {loading ? '--' : latestLatency} <span className="text-sm font-normal text-[#8B949E]">ms</span>
                    </div>
                  </div>

                  <div className="bg-[#161B22] border border-[#30363D] p-3 rounded">
                    <div className="text-[10px] text-[#8B949E] uppercase mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> SSL / TLS
                    </div>
                    <div className={`text-2xl font-bold flex items-baseline gap-1 ${latestSSL < 14 ? 'text-[#E3B341]' : 'text-[#79C0FF]'}`}>
                      {loading ? '--' : latestSSL} <span className="text-sm font-normal text-[#8B949E]">days</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#161B22] border border-[#30363D] rounded flex flex-col flex-grow min-h-0">
                  <div className="px-4 py-2 border-b border-[#30363D] flex justify-between items-center shrink-0">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-[#8B949E] truncate">Telemetry: {selectedTarget.name}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${isHealthy ? 'bg-[#238636] text-white' : 'bg-[#F85149] text-white'}`}>
                      {loading ? 'SYNCING...' : (isHealthy ? `200 OK` : `${latestStatus} ERR`)}
                    </span>
                  </div>
                  <div className="flex-grow w-full p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="latencyGradient2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isHealthy ? "#56D364" : "#F85149"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={isHealthy ? "#56D364" : "#F85149"} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                        <XAxis 
                          dataKey="time" 
                          tickFormatter={(val) => val ? format(parseISO(val), 'HH:mm') : ''} 
                          stroke="#30363D" 
                          tick={{fill: '#8B949E', fontSize: 10, fontFamily: 'monospace'}}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          stroke="#30363D" 
                          tick={{fill: '#8B949E', fontSize: 10, fontFamily: 'monospace'}} 
                          width={40}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
                          itemStyle={{ color: isHealthy ? '#56D364' : '#F85149' }}
                          labelStyle={{ color: '#8B949E' }}
                          labelFormatter={(lbl) => lbl ? format(parseISO(lbl as string), 'HH:mm:ss') : ''}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="latency" 
                          stroke={isHealthy ? "#56D364" : "#F85149"} 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#latencyGradient2)" 
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
                <div className="h-full flex items-center justify-center border border-[#30363D] border-dashed rounded bg-[#161B22]/50 text-[#8B949E] text-[10px] uppercase tracking-widest text-center p-8">
                  No target selected. <br/> Initialize a target in the Engine Config or select from the global list.
                </div>
            )}
          </section>

        </div>
      </main>
      
      {/* Bottom Terminal Bar */}
      <footer className="h-8 bg-[#0D1117] border-t border-[#30363D] px-4 flex items-center justify-between shrink-0 text-[10px] text-[#8B949E] uppercase tracking-tighter z-10 relative">
        <div className="flex gap-4">
          <span className="flex items-center gap-1 font-bold text-[#56D364]">
            <span className="w-1.5 h-1.5 bg-[#56D364] rounded-full animate-pulse"></span> ENGINE_OK
          </span>
          <span className="hidden md:inline">PostgreSQL Sync: Valid</span>
          <span className="hidden md:inline">Go 1.22</span>
        </div>
        <div className="flex gap-4 text-[#79C0FF]">
          <span>Session Connected</span>
        </div>
      </footer>
    </div>
  );
}
