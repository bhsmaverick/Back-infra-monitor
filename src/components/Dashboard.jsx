import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Activity, ShieldCheck, Clock, Server, Plus, Settings, LogOut, CheckCircle2, Folder, FolderPlus, Trash2, Bell, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useTranslation } from 'react-i18next';

export default function Dashboard({ session }) {
  const { t } = useTranslation();
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [projects, setProjects] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Form States
  const [newProjectName, setNewProjectName] = useState('');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [checkInterval, setCheckInterval] = useState('30');
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');

  const API_BASE = import.meta.env.VITE_GO_API_URL || 'http://localhost:8080';

  const fetchTargets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/targets?user_id=${session.user.id}`);
      if (!res.ok) throw new Error(`Go API returned status ${res.status}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setTargets(data);
        // Optimize: Only set selectedTarget if we don't have one, or if it was removed
        setSelectedTarget(prev => {
          if (!prev && data.length > 0) return data[0];
          if (prev && !data.find(t => t.id === prev.id) && data.length > 0) return data[0];
          return prev;
        });
      } else {
        console.warn('Go API returned non-array data:', data);
        setTargets([]);
      }
    } catch(e) {
      console.error('Error in fetchTargets:', e);
    }
  };

  const fetchNotificationConfig = async () => {
    const { data } = await supabase.from('notification_configs').select('*').eq('user_id', session.user.id).single();
    if (data) {
      setBotToken(data.telegram_bot_token || '');
      setChatId(data.telegram_chat_id || '');
    }
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (data) {
      setProjects(data);
      // expand all by default
      const exp = {};
      data.forEach(p => exp[p.id] = true);
      setExpandedProjects(exp);
      if (data.length > 0 && !targetProjectId) {
        setTargetProjectId(data[0].id);
      }
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications?user_id=${session.user.id}`);
      if(res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch(e) {}
  };

  useEffect(() => {
    fetchTargets();
    fetchNotificationConfig();
    fetchProjects();
    fetchNotifications();
    const notifInterval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(notifInterval);
  }, [session.user.id]);

  useEffect(() => {
    if (!selectedTarget) return;
    
    // Clear metrics when target changes while loading new ones
    setMetrics([]);

    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metrics/latency?user_id=${session.user.id}&target_id=${selectedTarget.id}`);
        if(res.ok) {
          const data = await res.json();
          setMetrics(Array.isArray(data) ? data : []);
        }
      } catch(e) {
        console.error('Error fetching metrics:', e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedTarget, session.user.id]);

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!newProjectName) return;
    const { data, error } = await supabase.from('projects').insert({
      user_id: session.user.id,
      name: newProjectName
    }).select().single();
    if (data) {
      setProjects(prev => [data, ...prev]);
      setExpandedProjects(prev => ({ ...prev, [data.id]: true }));
      setNewProjectName('');
      if (!targetProjectId) setTargetProjectId(data.id);
    }
  };

  const handleDeleteTarget = async (e, target) => {
    e.stopPropagation();
    if (!window.confirm(`Delete target ${target.name}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/targets?id=${target.id}&user_id=${session.user.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTargets(prev => prev.filter(t => t.id !== target.id));
        if (selectedTarget?.id === target.id) {
          setSelectedTarget(null);
          setMetrics([]);
        }
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleAddTarget = async (e) => {
    e.preventDefault();
    const { data: newTarget, error } = await supabase.from('targets').insert({
      user_id: session.user.id,
      project_id: targetProjectId || null,
      name: newTargetName,
      url: newTargetUrl,
      check_interval: parseInt(checkInterval, 10),
      expected_status: parseInt(expectedStatus, 10)
    }).select().single();
    
    if (!error && newTarget) {
      setNewTargetName('');
      setNewTargetUrl('');
      setExpectedStatus(200);
      
      // Optimitstic update
      setTargets(prev => [...prev, newTarget]);
      setSelectedTarget(newTarget);

      // Async sync from Go API to be sure we are up to date
      fetchTargets();
    } else {
      alert(t('errorAddTarget') + (error?.message || 'Unknown error'));
    }
  };

  // --- WEB PUSH SUBSCRIPTION ---
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleEnableWebPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Web Push is not supported in this browser.");
      return;
    }
    try {
      const perms = await window.Notification.requestPermission();
      if (perms !== 'granted') {
        alert("Notification permission denied by user.");
        return;
      }

      const vapidRes = await fetch(`${API_BASE}/api/webpush/vapid-key`);
      if (!vapidRes.ok) {
        throw new Error("Failed to get VAPID key. Did you configure VAPID_PUBLIC_KEY in backend?");
      }
      const { publicKey } = await vapidRes.json();

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const subData = subscription.toJSON();
      
      const res = await fetch(`${API_BASE}/api/webpush/subscribe?user_id=${session.user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subData.endpoint,
          p256dh: subData.keys.p256dh,
          auth: subData.keys.auth
        })
      });

      if (res.ok) {
        alert("Web Push enabled successfully!");
      } else {
        alert("Failed to save subscription on backend.");
      }
    } catch(err) {
      console.error(err);
      alert("Error enabling Web Push: " + err.message);
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
      alert(t('alertConfigSaved'));
    } else {
      alert(t('errorSaveConfig') + error.message);
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
  const isHttps = selectedTarget?.url?.startsWith('https');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-slate-900/50 flex items-center justify-between px-6 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <h1 className="font-bold text-white tracking-tight">{t('dashboardHeader')}</h1>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="relative">
             <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-900 animate-pulse"></span>}
             </button>
             {showNotifications && (
               <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50">
                 <div className="px-4 py-3 border-b border-white/10 bg-slate-800/50 font-semibold text-white">Notifications</div>
                 <div className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col divide-y divide-white/5">
                    {notifications.length === 0 ? (
                       <div className="p-4 text-center text-slate-500 text-sm">No new alerts</div>
                    ) : notifications.slice(0, 20).map((n) => (
                       <div key={n.id} className="p-3 bg-slate-900 hover:bg-white/5 transition-colors flex flex-col gap-1 cursor-default">
                          <span className="text-sm text-slate-300">{n.message}</span>
                          <span className="text-[10px] text-slate-500 uppercase">{format(parseISO(n.created_at), 'MMM dd, HH:mm:ss')}</span>
                       </div>
                    ))}
                 </div>
               </div>
             )}
          </div>
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-slate-900 border border-white/10 text-slate-300 text-sm rounded focus:border-indigo-500 focus:ring-indigo-500 block p-1 cursor-pointer outline-none"
          >
            <option value="en">English</option>
            <option value="uk">Українська</option>
            <option value="es">Español</option>
            <option value="pt">Português</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="pl">Polski</option>
            <option value="ja">日本語</option>
            <option value="ar">العربية</option>
            <option value="tr">Türkçe</option>
            <option value="hi">हिन्दी</option>
            <option value="it">Italiano</option>
            <option value="ko">한국어</option>
            <option value="id">Bahasa Indonesia</option>
          </select>
          <span className="text-slate-400">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> {t('exit')}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Data Entry & Target Selection */}
        <div className="xl:col-span-4 space-y-4">
          
          {/* Add Project Form */}
          <form onSubmit={handleAddProject} className="bg-slate-900 rounded-xl border border-white/5 p-3 flex items-center gap-2">
            <input required placeholder="New Project Folder" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 flex-1" />
            <button type="submit" className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 p-2 rounded-lg transition-colors border border-indigo-500/20"><FolderPlus className="w-5 h-5"/></button>
          </form>

          {/* Target List */}
          <div className="bg-slate-900 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 bg-slate-900/50">
              <h3 className="font-semibold text-white flex items-center gap-2"><Server className="w-4 h-4 text-emerald-400"/> {t('activeEndpoints')}</h3>
            </div>
            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar pb-2">
              {projects.map(p => {
                const projectTargets = targets.filter(t => t.project_id === p.id);
                const isExpanded = expandedProjects[p.id];
                return (
                  <div key={p.id} className="flex flex-col">
                    <button 
                      onClick={() => setExpandedProjects(prev => ({...prev, [p.id]: !prev[p.id]}))}
                      className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors bg-slate-900"
                    >
                      <div className="flex items-center gap-2 text-indigo-300">
                        <Folder className="w-4 h-4" />
                        <span className="font-semibold text-sm">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-xs text-slate-500">{projectTargets.length}</span>
                         {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="bg-slate-950/30 flex flex-col">
                        {projectTargets.length === 0 ? (
                           <div className="px-5 py-3 text-xs text-slate-600 pl-11">No endpoints</div>
                        ) : projectTargets.map(t => (
                          <div key={t.id} className={`w-full text-left px-5 py-3 transition-all flex items-center justify-between group ${selectedTarget?.id === t.id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'hover:bg-white/5 border-l-2 border-transparent'}`}>
                             <button onClick={() => setSelectedTarget(t)} className="flex flex-col flex-1 pl-6 overflow-hidden">
                                <div className="font-medium text-slate-200 text-sm mb-1 truncate w-full flex items-center gap-2">
                                   {t.name}
                                   <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 whitespace-nowrap">{t.check_interval || 30}s</span>
                                </div>
                                <div className="text-xs text-slate-500 truncate max-w-[220px]">{t.url}</div>
                             </button>
                             <button onClick={(e) => handleDeleteTarget(e, t)} className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete endpoint">
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Uncategorized Targets */}
              {targets.filter(t => !t.project_id).map(t => (
                  <div key={t.id} className={`w-full text-left px-5 py-3 transition-all flex items-center justify-between group ${selectedTarget?.id === t.id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'hover:bg-white/5 border-l-2 border-transparent'}`}>
                     <button onClick={() => setSelectedTarget(t)} className="flex flex-col flex-1 pl-2 overflow-hidden">
                        <div className="font-medium text-slate-200 text-sm mb-1 truncate w-full flex items-center gap-2">
                           {t.name}
                           <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 whitespace-nowrap">{t.check_interval || 30}s</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[220px]">{t.url}</div>
                     </button>
                     <button onClick={(e) => handleDeleteTarget(e, t)} className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete endpoint">
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
              ))}
              
              {targets.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">{t('noEndpoints')}</div>
              )}
            </div>
          </div>

          {/* Add Target & Configure Alerts Forms */}
          <div className="bg-slate-900 rounded-xl border border-white/5 p-5 space-y-8">
            {/* Add Target */}
            <form onSubmit={handleAddTarget} className="space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                <Plus className="w-4 h-4 text-indigo-400"/> {t('addTargetTitle')}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <select value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500">
                   <option value="">No Project (Uncategorized)</option>
                   {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input required placeholder={t('serviceNameField')} value={newTargetName} onChange={e => setNewTargetName(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                <input required type="url" placeholder={t('endpointUrlField')} value={newTargetUrl} onChange={e => setNewTargetUrl(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                <div className="flex flex-col xl:flex-row items-center gap-3">
                  <select value={checkInterval} onChange={e => setCheckInterval(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 w-full xl:w-auto flex-1">
                    <option value="30">Every 30s</option>
                    <option value="60">Every 1m</option>
                    <option value="300">Every 5m</option>
                    <option value="900">Every 15m</option>
                  </select>
                  <label className="text-xs text-slate-500 shrink-0 flex items-center gap-2 w-full xl:w-auto">
                    {t('expectedStatus')}:
                    <input required type="number" value={expectedStatus} onChange={e => setExpectedStatus(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-full xl:w-20" />
                  </label>
                </div>
              </div>
              <button type="submit" className="w-full bg-white text-slate-900 font-semibold text-sm py-2 rounded-lg hover:bg-slate-200 transition-colors shadow-lg">{t('saveEndpoint')}</button>
            </form>

            {/* Config Alerts */}
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                <Bell className="w-4 h-4 text-amber-400"/> {t('telegramOverrideTitle') || "Notifications Configurations"}
              </h3>
              
              {/* Web Push */}
              <div className="bg-slate-950 border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-200">Browser Push Notifications</div>
                </div>
                <button type="button" onClick={handleEnableWebPush} className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold py-2 rounded transition-colors border border-indigo-500/20">
                  Enable Browser Notifications
                </button>
              </div>

              {/* Telegram */}
              <div className="bg-slate-950 border border-white/10 rounded-lg p-3 space-y-3 mt-3">
                 <div className="text-sm font-medium text-slate-200">Telegram Override</div>
                 <p className="text-xs text-slate-500">{t('telegramOverrideDesc')}</p>
                 <input placeholder={t('botTokenField')} value={botToken} onChange={e => setBotToken(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                 <input placeholder={t('chatIdField')} value={chatId} onChange={e => setChatId(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                 <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2 rounded-lg transition-colors border border-white/5">{t('syncConfig')}</button>
              </div>
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
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Clock className="w-4 h-4"/> {t('latencyLabel')}</div>
                    <div className="text-3xl font-light text-white">{latestLatency}</div>
                  </div>
                  <div className="bg-slate-900 border border-white/5 p-4 rounded-xl shadow-inner">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> {t('sslValidityLabel')}</div>
                    {isHttps ? (
                      <div className={`text-3xl font-light ${latestSSL < 14 ? 'text-amber-400' : 'text-emerald-400'}`}>{latestSSL} <span className="text-sm font-normal text-slate-500">{t('days')}</span></div>
                    ) : (
                      <div className="text-xl font-medium text-slate-500 mt-1 uppercase tracking-widest">N/A</div>
                    )}
                  </div>
                  <div className="bg-slate-900 border border-white/5 p-4 rounded-xl shadow-inner">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Activity className="w-4 h-4"/> {t('httpStatusLabel')}</div>
                    <div className={`text-3xl font-light flex items-center gap-2 ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                      {latestStatus || '--'}
                      {isHealthy ? <CheckCircle2 className="w-5 h-5 opacity-50"/> : null}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-white/5 p-4 rounded-xl shadow-inner flex flex-col justify-center overflow-hidden">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('targetIdentity')}</div>
                    <div className="text-sm font-medium text-indigo-400 truncate w-full" title={selectedTarget.name}>{selectedTarget.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase truncate font-mono">ID: {selectedTarget.id}</div>
                  </div>
                </div>

                {/* Main Graph Area */}
                <div className="bg-slate-900 border border-white/5 rounded-xl flex flex-col flex-1 shadow-2xl overflow-hidden min-h-[400px]">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-slate-900/50 shrink-0">
                    <div className="overflow-hidden">
                      <h2 className="font-semibold text-white">{t('globalLatency')}</h2>
                      <p className="text-xs text-slate-500 tracking-wide mt-1 font-mono truncate max-w-lg">{selectedTarget.url}</p>
                    </div>
                    <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-md text-xs font-semibold uppercase tracking-wider border border-indigo-500/20 whitespace-nowrap">
                      {t('liveStream')}
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
                 <h3 className="text-lg font-medium text-slate-300">{t('noServiceSelected')}</h3>
                 <p className="text-sm text-slate-500 mt-2">{t('noServiceDesc')}</p>
               </div>
             </div>
          )}

        </div>
      </main>
    </div>
  );
}
