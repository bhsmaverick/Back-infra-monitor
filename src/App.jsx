import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import { Activity, ShieldCheck, Zap, BellRing, ChevronRight, LineChart, CheckCircle2, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function App() {
  const { t, i18n } = useTranslation();
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
      else setMsg(t('regSuccess'));
    }
  };

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

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
            {t('appName')}
          </div>
          <div className="flex items-center gap-4">
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-slate-900 border border-white/10 text-white text-xs font-semibold uppercase rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="en">EN</option>
              <option value="uk">UA</option>
              <option value="es">ES</option>
              <option value="pt">PT</option>
              <option value="de">DE</option>
              <option value="fr">FR</option>
              <option value="pl">PL</option>
              <option value="ja">JA</option>
              <option value="ar">AR</option>
              <option value="tr">TR</option>
              <option value="hi">HI</option>
              <option value="it">IT</option>
              <option value="ko">KO</option>
              <option value="id">ID</option>
            </select>
            <button onClick={() => setIsLogin(true)} className="text-sm font-medium hover:text-white transition-colors">{t('signIn')}</button>
            <button onClick={() => setIsLogin(false)} className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md transition-colors shadow-lg shadow-indigo-500/20">{t('getStarted')}</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: JTBD Marketing Copy */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-widest">
             <BellRing className="w-3 h-3" /> {t('zeroDowntime')}
          </div>
          
          <h1 className="text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
              {t('subtitlePart1')}
            </span>
            <br />
            {t('subtitlePart2')}
          </h1>
          
          <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
            {t('description')}
          </p>
        </div>

        {/* Right: Auth Form Component */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {/* subtle glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">{isLogin ? t('welcomeBack') : t('createAccount')}</h2>
            <p className="text-slate-400 text-sm mb-8">{isLogin ? t('loginDesc') : t('registerDesc')}</p>

            {errorMsg && <div className="mb-6 text-sm text-red-400 p-3 bg-red-400/10 rounded-lg border border-red-400/20">{errorMsg}</div>}
            {msg && <div className="mb-6 text-sm text-emerald-400 p-3 bg-emerald-400/10 rounded-lg border border-emerald-400/20">{msg}</div>}

            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('devEmail')}</label>
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
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('securePassword')}</label>
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
                {isLogin ? t('signInDashboard') : t('deployInfra')} <ChevronRight className="w-4 h-4" />
              </button>
            </form>
            
            <div className="mt-8 text-center border-t border-white/10 pt-6">
              <button 
                 onClick={() => setIsLogin(!isLogin)}
                 className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {isLogin ? t('needAccount') : t('alreadyDeployed')}
              </button>
            </div>
          </div>
        </div>
        </div>

        {/* Expanded 6-Feature Grid */}
        <div className="mt-32 pt-16 border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">{t('allFeaturesTitle')}</h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl hover:bg-slate-900 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 shadow-inner group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white mb-2">{t('asyncPolling')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{t('asyncDesc')}</p>
            </div>
            
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl hover:bg-slate-900 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 shadow-inner group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white mb-2">{t('sslTracking')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{t('sslDesc')}</p>
            </div>
            
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl hover:bg-slate-900 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 shadow-inner group-hover:scale-110 transition-transform">
                <BellRing className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white mb-2">{t('featureTelegram')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{t('featureTelegramDesc')}</p>
            </div>

            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl hover:bg-slate-900 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6 shadow-inner group-hover:scale-110 transition-transform">
                <LineChart className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white mb-2">{t('featureAnalytics')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{t('featureAnalyticsDesc')}</p>
            </div>

            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl hover:bg-slate-900 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 shadow-inner group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white mb-2">{t('featureStatus')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{t('featureStatusDesc')}</p>
            </div>

            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl hover:bg-slate-900 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6 shadow-inner group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white mb-2">{t('featureSecure')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{t('featureSecureDesc')}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
