import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import { Activity, ShieldCheck, Zap, BellRing, ChevronRight, LineChart, CheckCircle2, Lock, XCircle, MessageSquare, Webhook, ChevronDown, ArrowUpRight } from 'lucide-react';
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
          
          <h1 className="text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.05]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">
              {t('subtitlePart1')}
            </span>
            <br />
            {t('subtitlePart2')}
          </h1>
          
          <p className="text-xl text-slate-400 leading-relaxed max-w-xl text-balance">
            {t('description')}
          </p>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-3">
              <img className="w-10 h-10 rounded-full border-2 border-slate-950" src="https://i.pravatar.cc/100?img=33" alt="" />
              <img className="w-10 h-10 rounded-full border-2 border-slate-950" src="https://i.pravatar.cc/100?img=47" alt="" />
              <img className="w-10 h-10 rounded-full border-2 border-slate-950" src="https://i.pravatar.cc/100?img=12" alt="" />
              <img className="w-10 h-10 rounded-full border-2 border-slate-950" src="https://i.pravatar.cc/100?img=68" alt="" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => <Zap key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
              </div>
              <span className="text-sm font-medium text-slate-300">{t('socialProof', 'Trusted by 500+ developers')}</span>
            </div>
          </div>
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

        {/* Problem / Solution (Pain Points) */}
        <div className="mt-32 pt-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">{t('painPointsTitle', 'Why you need proactive monitoring')}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <XCircle className="w-48 h-48 text-red-500 translate-x-1/4 -translate-y-1/4" />
              </div>
              <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> {t('painPointOld', 'The Old Way')}
              </h3>
              <ul className="space-y-4">
                {[1,2,3].map(i => (
                  <li key={i} className="flex gap-3 text-slate-300">
                    <XCircle className="w-5 h-5 text-red-500/50 flex-shrink-0" /> 
                    <span>{t(`oldWay${i}`, ['Finding out about downtime from angry customers.', 'Staring at dashboards waiting for issues.', 'Complex setup taking hours.'][i-1])}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 relative overflow-hidden shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)]">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CheckCircle2 className="w-48 h-48 text-emerald-500 translate-x-1/4 -translate-y-1/4" />
              </div>
              <h3 className="text-xl font-bold text-emerald-400 mb-6 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> {t('painPointNew', 'The InfraMonitor Way')}
              </h3>
              <ul className="space-y-4">
                {[1,2,3].map(i => (
                  <li key={i} className="flex gap-3 text-slate-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" /> 
                    <span>{t(`newWay${i}`, ['Instant alerts via Telegram before customers notice.', 'Automated 30-second interval polling.', 'Deploy your first monitor in 30 seconds.'][i-1])}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Integrations Block */}
        <div className="mt-32 pt-16 border-t border-white/5 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">{t('integrationsTitle', 'Seamless Integrations')}</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed text-lg">
            {t('integrationsDesc', 'Currently supporting Telegram for instant notifications, with Discord, Slack, and Webhooks on the roadmap.')}
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-[#2AABEE]/10 border border-[#2AABEE]/30 text-white shadow-[0_0_20px_-5px_rgba(42,171,238,0.4)]">
              <BellRing className="w-6 h-6 text-[#2AABEE]" /> Telegram
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-indigo-500/5 border border-indigo-500/10 text-slate-400 grayscale opacity-50 relative group overflow-hidden">
              <MessageSquare className="w-6 h-6" /> Discord
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-rose-500/5 border border-rose-500/10 text-slate-400 grayscale opacity-50 relative group overflow-hidden">
              <MessageSquare className="w-6 h-6" /> Slack
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-slate-400 grayscale opacity-50">
              <Webhook className="w-6 h-6" /> Webhooks
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div className="mt-32 pt-16 border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">{t('howItWorksTitle', 'How it Works in 3 Simple Steps')}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0" />
            
            <div className="relative text-center z-10 p-6">
              <div className="w-16 h-16 mx-auto bg-slate-900 border-2 border-indigo-500/30 rounded-full flex items-center justify-center text-xl font-bold text-indigo-400 mb-6 shadow-xl shadow-indigo-500/10">1</div>
              <h3 className="text-xl font-bold text-white mb-3">{t('step1Title', '1. Register')}</h3>
              <p className="text-slate-400 leading-relaxed">{t('step1Desc', 'Create an account in one click and access the dashboard.')}</p>
            </div>
            
            <div className="relative text-center z-10 p-6">
              <div className="w-16 h-16 mx-auto bg-slate-900 border-2 border-indigo-500/30 rounded-full flex items-center justify-center text-xl font-bold text-indigo-400 mb-6 shadow-xl shadow-indigo-500/10">2</div>
              <h3 className="text-xl font-bold text-white mb-3">{t('step2Title', '2. Add URLs')}</h3>
              <p className="text-slate-400 leading-relaxed">{t('step2Desc', 'Configure your endpoints and expected HTTP status code.')}</p>
            </div>
            
            <div className="relative text-center z-10 p-6">
              <div className="w-16 h-16 mx-auto bg-slate-900 border-2 border-indigo-500/30 rounded-full flex items-center justify-center text-xl font-bold text-indigo-400 mb-6 shadow-xl shadow-indigo-500/10">3</div>
              <h3 className="text-xl font-bold text-white mb-3">{t('step3Title', '3. Relax')}</h3>
              <p className="text-slate-400 leading-relaxed">{t('step3Desc', "We'll notify you on Telegram as soon as something breaks.")}</p>
            </div>
          </div>
        </div>

        {/* FAQ Area */}
        <div className="mt-32 pt-16 border-t border-white/5 mb-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">{t('faqTitle', 'Frequently Asked Questions')}</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {[1,2,3].map(i => (
              <details key={i} className="group bg-slate-900/50 border border-white/5 rounded-xl [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-semibold text-white">
                  {t(`faq${i}Q`, [
                    'How often are the checks performed?',
                    'Is my data secure?',
                    'How do I configure the Telegram bot?'
                  ][i-1])}
                  <ChevronDown className="w-5 h-5 text-slate-400 group-open:-rotate-180 transition-transform duration-300" />
                </summary>
                <div className="px-6 pb-6 text-slate-400 leading-relaxed border-t border-white/5 pt-4">
                  {t(`faq${i}A`, [
                    'Our distributed workers ping your endpoints every 30 seconds for precise monitoring.',
                    'Yes, we use a secure isolated per-tenant architecture. Your metrics are strictly private.',
                    'Simply paste your custom Telegram Bot Token and Chat ID in the settings pane.'
                  ][i-1])}
                </div>
              </details>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950/50 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-white font-bold tracking-tight">
            <Activity className="w-5 h-5 text-indigo-500" />
            {t('appName', 'InfraMonitor SaaS')}
          </div>
          <div className="text-slate-400 text-sm">
            {t('footerCopyright', '© 2026 InfraMonitor SaaS. All rights reserved.')}
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-white transition-colors flex items-center gap-1">{t('footerDoc', 'Documentation')} <ArrowUpRight className="w-3 h-3" /></a>
            <a href="#" className="hover:text-white transition-colors">{t('footerStatus', 'Status')}</a>
            <a href="#" className="hover:text-white transition-colors">{t('footerPrivacy', 'Privacy')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
