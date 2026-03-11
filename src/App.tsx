/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import DomainInput from './components/DomainInput';
import ResultCard from './components/ResultCard';
import MatrixRain from './components/MatrixRain';

export default function App() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [subdomains, setSubdomains] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('check'); // 'check', 'subdomains', 'bulk', 'history', 'auto'
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('sni_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [logs, setLogs] = useState([]);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkResults, setBulkResults] = useState([]);
  const [autoResults, setAutoResults] = useState([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');

  React.useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setServerStatus('online');
        else setServerStatus('error');
      } catch (e) {
        setServerStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const saveToHistory = (data) => {
    const newHistory = [data, ...history.filter(h => h.domain !== data.domain)].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem('sni_history', JSON.stringify(newHistory));
  };

  const safeFetch = async (url, options) => {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        return { data: await res.json(), ok: res.ok };
      } else {
        const text = await res.text();
        console.error(`Non-JSON response from ${url}:`, text);
        return { error: `Server returned non-JSON response: ${text.substring(0, 100)}...`, ok: false };
      }
    } catch (e) {
      console.error(`Fetch error for ${url}:`, e);
      return { error: `Network error: ${e.message}`, ok: false };
    }
  };

  const checkDomain = async (targetDomain = domain) => {
    const cleanDomain = targetDomain.trim();
    if (!cleanDomain) return;
    
    setLoading(true);
    setResult(null);
    setError(null);
    setLogs([]);
    addLog(`Initializing scan for: ${cleanDomain}`);
    addLog(`Resolving DNS...`);

    try {
      const { data, error, ok } = await safeFetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanDomain }),
      });

      if (error) throw new Error(error);

      addLog(`HTTPS Handshake initiated...`);
      if (!ok) throw new Error(data?.error || 'Scan failed');
      
      addLog(`ISP Detected: ${data.isp}`);
      addLog(`Status: ${data.httpStatus.label}`);
      setResult(data);
      saveToHistory(data);
      addLog(`Scan completed successfully.`);

    } catch (err) {
      setError(err.message);
      addLog(`ERROR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const findSubdomains = async () => {
    if (!domain.trim()) return;
    setSubLoading(true);
    setSubdomains([]);
    setError(null);
    setLogs([]);
    addLog(`Starting subdomain discovery for: ${domain}`);

    try {
      const { data, error, ok } = await safeFetch('/api/subdomains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      if (error) throw new Error(error);
      if (!ok) throw new Error(data?.error || 'Discovery failed');
      
      addLog(`Found ${data.subdomains.length} active subdomains.`);
      setSubdomains(data.subdomains);
    } catch (err) {
      setError(err.message);
      addLog(`ERROR: ${err.message}`);
    } finally {
      setSubLoading(false);
    }
  };

  const runBulkCheck = async () => {
    const domains = bulkInput.split('\n').map(d => d.trim()).filter(d => d.length > 3);
    if (domains.length === 0) return;

    setLoading(true);
    setBulkResults([]);
    addLog(`Starting bulk scan for ${domains.length} domains...`);

    for (const d of domains) {
      addLog(`Scanning: ${d}...`);
      try {
        const res = await fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: d }),
        });
        const data = await res.json();
        if (res.ok) {
          setBulkResults(prev => [...prev, data]);
          addLog(`${d} -> ${data.httpStatus.label}`);
        } else {
          addLog(`${d} -> FAILED`);
        }
      } catch (e) {
        addLog(`${d} -> ERROR`);
      }
    }
    setLoading(false);
    addLog(`Bulk scan finished.`);
  };

  const runAutoDiscover = async () => {
    setAutoLoading(true);
    setAutoResults([]);
    setError(null);
    setLogs([]);
    addLog(`Detecting user ISP and scanning for compatible SNIs...`);

    try {
      const { data, error, ok } = await safeFetch('/api/auto-discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) throw new Error(error);
      if (!ok) throw new Error(data?.error || 'Discovery failed');
      
      addLog(`ISP Detected: ${data.isp}`);
      addLog(`Scan complete. Found ${data.found} working SNIs.`);
      setAutoResults(data.results);
    } catch (err) {
      setError(err.message);
      addLog(`ERROR: ${err.message}`);
    } finally {
      setAutoLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] font-mono text-white relative overflow-hidden flex flex-col items-center justify-start pt-12 px-4 pb-20">
      <MatrixRain />

      {/* Header */}
      <div className="relative z-10 text-center mb-8">
        <div className={`inline-block px-3 py-1 border rounded-full mb-4 bg-opacity-5 ${serverStatus === 'online' ? 'border-green-500/30 bg-green-500' : serverStatus === 'offline' ? 'border-red-500/30 bg-red-500' : 'border-yellow-500/30 bg-yellow-500'}`}>
          <span className={`text-[8px] tracking-[0.5em] font-black uppercase ${serverStatus === 'online' ? 'text-green-500' : serverStatus === 'offline' ? 'text-red-500' : 'text-yellow-500'}`}>
            System {serverStatus} • {serverStatus === 'online' ? 'Secure Connection' : 'Check Server Logs'}
          </span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-green-400 tracking-[0.3em] mb-4 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]">
          SNI MASTER
        </h1>
        <p className="text-[10px] md:text-xs text-zinc-500 tracking-[0.4em] uppercase font-bold">
          ADVANCED DOMAIN INTELLIGENCE & ISP ANALYSIS
        </p>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex flex-wrap gap-2 mb-8 w-full max-w-2xl justify-center">
        {[
          { id: 'check', label: 'SNI Checker', icon: '🔍' },
          { id: 'subdomains', label: 'Subdomains', icon: '🌐' },
          { id: 'auto', label: 'Auto Finder', icon: '⚡' },
          { id: 'bulk', label: 'Bulk Scan', icon: '📦' },
          { id: 'history', label: 'History', icon: '🕒' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[9px] font-black tracking-widest uppercase border transition-all rounded-md flex items-center gap-2 ${activeTab === tab.id ? 'border-green-500 text-green-500 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'}`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-2xl space-y-6">
        
        {/* Input Section (Hidden for History/Auto) */}
        {activeTab !== 'history' && activeTab !== 'bulk' && activeTab !== 'auto' && (
          <DomainInput
            value={domain}
            onChange={setDomain}
            onSubmit={activeTab === 'check' ? () => checkDomain() : findSubdomains}
            loading={loading || subLoading}
          />
        )}

        {/* Auto Finder Section */}
        {activeTab === 'auto' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                <span className="text-4xl">⚡</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-green-400 tracking-widest uppercase">ISP Auto-Discovery</h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] max-w-sm mx-auto leading-relaxed">
                  Our engine will detect your ISP and automatically scan millions of potential SNI hosts to find working bypasses for your network.
                </p>
              </div>
              <button
                onClick={runAutoDiscover}
                disabled={autoLoading}
                className={`w-full py-5 font-black tracking-[0.4em] border-2 transition-all rounded-xl text-xs ${autoLoading ? 'border-zinc-800 text-zinc-700 cursor-not-allowed' : 'border-green-500 text-green-500 hover:bg-green-500/10 hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] active:scale-[0.98]'}`}
              >
                {autoLoading ? 'DISCOVERING...' : 'START AUTO DISCOVERY'}
              </button>
            </div>

            {autoResults.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-[10px] font-black tracking-[0.2em] text-green-500 uppercase">Working SNIs for your ISP</h3>
                  <span className="text-[10px] text-zinc-600 uppercase">{autoResults.length} Found</span>
                </div>
                {autoResults.map((res, i) => (
                  <div key={i} className="bg-black/40 border border-zinc-900 p-4 rounded-lg flex justify-between items-center hover:border-zinc-700 transition-all group">
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-green-400 transition-colors">{res.domain}</p>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{res.isp} • {res.ping}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-1 rounded text-[9px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/30">
                        WORKING
                      </div>
                      <button 
                        onClick={() => {
                          setResult(res);
                          setActiveTab('check');
                        }}
                        className="p-2 border border-zinc-800 hover:border-zinc-600 rounded text-zinc-500 hover:text-white transition-all"
                      >
                        VIEW
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bulk Input */}
        {activeTab === 'bulk' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Enter domains (one per line)...&#10;airtel.in&#10;jio.com&#10;myvi.in"
              className="w-full h-40 bg-black/40 border border-zinc-800 focus:border-green-500/50 outline-none px-6 py-4 text-green-400 font-mono text-sm transition-all rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)]"
              disabled={loading}
            />
            <button
              onClick={runBulkCheck}
              disabled={loading || !bulkInput.trim()}
              className={`w-full py-4 font-black tracking-[0.3em] border transition-all rounded-lg ${loading ? 'border-zinc-800 text-zinc-700' : 'border-green-500 text-green-500 hover:bg-green-500/10'}`}
            >
              {loading ? 'PROCESSING BULK...' : 'START BULK SCAN'}
            </button>
          </div>
        )}

        {/* Terminal Logs */}
        {(loading || subLoading || autoLoading || logs.length > 0) && (
          <div className="bg-black/80 border border-zinc-900 rounded-lg p-3 font-mono text-[10px] text-green-500/70 shadow-inner overflow-hidden">
            <div className="flex items-center gap-2 mb-2 border-b border-zinc-900 pb-1">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
              <div className="w-2 h-2 rounded-full bg-green-500/50" />
              <span className="ml-2 text-[8px] text-zinc-600 uppercase tracking-widest">Live Scan Logs</span>
            </div>
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-200">
                  <span className="text-zinc-700 mr-2">❯</span>
                  {log}
                </div>
              ))}
              {(loading || subLoading || autoLoading) && <div className="animate-pulse">_</div>}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-950/30 border border-red-800/50 rounded-lg text-red-400 text-sm font-bold flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
            <span className="text-lg">❌</span>
            {error}
          </div>
        )}

        {/* Results Display */}
        {activeTab === 'check' && result && !loading && (
          <ResultCard result={result} />
        )}

        {/* Subdomain Results */}
        {activeTab === 'subdomains' && subdomains.length > 0 && !subLoading && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black tracking-[0.2em] text-blue-500 uppercase">Found {subdomains.length} Subdomains</h3>
                <button 
                  onClick={() => {
                    const text = subdomains.map(s => s.subdomain).join('\n');
                    navigator.clipboard.writeText(text);
                  }}
                  className="text-[9px] px-3 py-1 border border-zinc-800 text-zinc-500 hover:text-white rounded uppercase font-bold"
                >
                  Copy All
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {subdomains.map((sub, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 border border-zinc-900 rounded bg-black/20 hover:border-zinc-700 transition-colors group">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-zinc-300 font-mono group-hover:text-white truncate max-w-[150px]">{sub.subdomain}</span>
                      <span className="text-[8px] text-zinc-600 font-mono">{sub.ip}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setDomain(sub.subdomain);
                        setActiveTab('check');
                        setTimeout(() => checkDomain(sub.subdomain), 100);
                      }}
                      className="text-[8px] px-2 py-1 border border-zinc-800 hover:border-green-500 text-zinc-500 hover:text-green-500 rounded uppercase font-bold transition-all"
                    >
                      Check
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bulk Results */}
        {activeTab === 'bulk' && bulkResults.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-[10px] font-black tracking-[0.2em] text-green-500 uppercase">Bulk Scan Results</h3>
              <span className="text-[10px] text-zinc-600 uppercase">{bulkResults.length} Success</span>
            </div>
            {bulkResults.map((res, i) => (
              <div key={i} className="bg-black/40 border border-zinc-900 p-4 rounded-lg flex justify-between items-center hover:border-zinc-700 transition-all">
                <div>
                  <p className="text-sm font-bold text-white">{res.domain}</p>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{res.isp} • {res.ping}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${res.httpStatus.type === 'working' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                    {res.httpStatus.label}
                  </div>
                  <button 
                    onClick={() => {
                      setResult(res);
                      setActiveTab('check');
                    }}
                    className="p-2 border border-zinc-800 hover:border-zinc-600 rounded text-zinc-500 hover:text-white transition-all"
                  >
                    👁️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-[10px] font-black tracking-[0.2em] text-zinc-500 uppercase">Recent Scans</h3>
              <button 
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem('sni_history');
                }}
                className="text-[9px] text-zinc-700 hover:text-red-500 uppercase font-bold"
              >
                Clear All
              </button>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-zinc-900 rounded-xl">
                <p className="text-zinc-700 text-[10px] tracking-widest uppercase">No history found</p>
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="bg-black/40 border border-zinc-900 p-4 rounded-lg flex justify-between items-center hover:border-zinc-700 transition-all group">
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-green-400 transition-colors">{h.domain}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{h.isp} • {h.ping} • {new Date(h.checkedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${h.httpStatus.type === 'working' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                      {h.httpStatus.label}
                    </div>
                    <button 
                      onClick={() => {
                        setResult(h);
                        setActiveTab('check');
                      }}
                      className="p-2 border border-zinc-800 hover:border-zinc-600 rounded text-zinc-500 hover:text-white transition-all"
                    >
                      VIEW
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Footer Info */}
      <div className="relative z-10 mt-auto pt-16 text-center space-y-4">
        <div className="flex justify-center gap-6">
          <div className="text-center">
            <p className="text-[12px] font-black text-green-500">100%</p>
            <p className="text-[7px] text-zinc-700 uppercase tracking-widest">Uptime</p>
          </div>
          <div className="text-center">
            <p className="text-[12px] font-black text-blue-500">256-bit</p>
            <p className="text-[7px] text-zinc-700 uppercase tracking-widest">Encryption</p>
          </div>
          <div className="text-center">
            <p className="text-[12px] font-black text-purple-500">Global</p>
            <p className="text-[7px] text-zinc-700 uppercase tracking-widest">Nodes</p>
          </div>
        </div>
        <p className="text-[9px] text-zinc-800 tracking-[0.5em] uppercase font-black">
          SNI MASTER v2.0 — REX UCHIA — PROFESSIONAL EDITION
        </p>
      </div>

      <style>{`
        @keyframes barPulse {
          0%, 100% { transform: scaleY(0.3); opacity: 0.3; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        
        ::selection {
          background: rgba(34, 197, 94, 0.3);
          color: #fff;
        }

        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #050505;
        }
        ::-webkit-scrollbar-thumb {
          background: #1a1a1a;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #222;
        }
      `}</style>
    </main>
  );
}
