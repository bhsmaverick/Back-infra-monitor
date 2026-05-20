import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import { Activity, ShieldCheck, Zap, BellRing, ChevronRight } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Marketing + Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
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

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setMsg('');

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setErrorMsg(error.message);
      else setMsg('Registration successful! Check your email.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Activity className="w-8 h-8 text-indigo-500 animate-pulse" />
      </div>
    );
  }

  if (session) {
    return <Dashboard session={session} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold tracking-tight">
            <Activity className="w-5 h-5 text-indigo-500" />
            InfraMonitor SaaS
          </div>
          <div className="flex gap-4">
            <button onClick={() => setIsLogin(true)} className="text-sm font-medium hover:text-white transition-colors">Sign In</button>
            <button onClick={() => setIsLogin(false)} className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md transition-colors shadow-lg shadow-indigo-500/20">Get Started</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left: JTBD Marketing Copy */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-widest">
             <BellRing className="w-3 h-3" /> Zero-Downtime Pipeline
          </div>
          
          <h1 className="text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
              Hire this tool to sleep peacefully
            </span>
            <br />
            while it automates your DevOps alerts.
          </h1>
          
          <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
            Stop relying on manual checks and delayed customer complaints. Proactive Infra Monitor polls your critical endpoints asynchronously every 30 seconds and pipes instant incident alerts directly to your Telegram.
          </p>

          {/* Feature Grid */}
          <div className="grid sm:grid-cols-2 gap-6 pt-4">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white">Async Polling Engine</h3>
              <p className="text-sm text-slate-500">Go-powered workers ping endpoints with precise ms accuracy.</p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white">SSL/TLS Tracking</h3>
              <p className="text-sm text-slate-500">Native TLS handshakes detect expiring certificates early.</p>
            </div>
          </div>
        </div>

        {/* Right: Auth Form Component */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {/* subtle glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">{isLogin ? 'Welcome Back' : 'Create Sandbox Account'}</h2>
            <p className="text-slate-400 text-sm mb-8">{isLogin ? 'Access your mission control dashboard.' : 'Deploy your first monitoring node in 30 seconds.'}</p>

            {errorMsg && <div className="mb-6 text-sm text-red-400 p-3 bg-red-400/10 rounded-lg border border-red-400/20">{errorMsg}</div>}
            {msg && <div className="mb-6 text-sm text-emerald-400 p-3 bg-emerald-400/10 rounded-lg border border-emerald-400/20">{msg}</div>}

            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Developer Email</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  placeholder="admin@startup.io"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Secure Password</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="w-full bg-white text-slate-950 hover:bg-slate-200 font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4 shadow-xl">
                {isLogin ? 'Sign In to Dashboard' : 'Deploy Infrastructure'} <ChevronRight className="w-4 h-4" />
              </button>
            </form>
            
            <div className="mt-8 text-center border-t border-white/10 pt-6">
              <button 
                 onClick={() => setIsLogin(!isLogin)}
                 className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {isLogin ? 'Need an instance? Sign up.' : 'Already deployed? Log in.'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
