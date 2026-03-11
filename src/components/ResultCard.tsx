import React from 'react';
import ISPBadge from './ISPBadge';
import StatusBadge from './StatusBadge';

export default function ResultCard({ result }) {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Simple feedback could be added here
  };

  const v2rayConfig = `serverName: "${result.domain}"\nHost: "${result.domain}"`;
  const colors = result.ispColors || { bg: '#111', border: '#333', text: '#666', dot: '#444' };

  return (
    <div 
      className="w-full bg-[#0a0a0a] border-2 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ borderColor: colors.border }}
    >
      {/* Header */}
      <div className="p-6 flex justify-between items-start border-b border-zinc-900 bg-black/20">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🌐</span>
            <h2 className="text-xl font-black text-white tracking-tight">{result.domain}</h2>
          </div>
          <div className="flex gap-4 text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
            <span>IP: {result.ip}</span>
            <span>PING: {result.ping}</span>
          </div>
        </div>
        <ISPBadge isp={result.isp} colors={colors} />
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 divide-x divide-zinc-900 border-b border-zinc-900">
        <div className="p-4 space-y-1">
          <p className="text-[10px] text-zinc-600 tracking-widest uppercase">HTTP Status</p>
          <StatusBadge type={result.httpStatus.type} label={result.httpStatus.label} />
        </div>
        <div className="p-4 space-y-1">
          <p className="text-[10px] text-zinc-600 tracking-widest uppercase">SSL Status</p>
          <StatusBadge type={result.ssl.valid ? 'working' : 'dead'} label={result.ssl.label} />
        </div>
      </div>

      {/* Server Info */}
      <div className="grid grid-cols-2 divide-x divide-zinc-900 border-b border-zinc-900 bg-black/10">
        <div className="p-4 space-y-1">
          <p className="text-[10px] text-zinc-600 tracking-widest uppercase">Server</p>
          <p className="text-sm font-mono text-zinc-300">{result.server}</p>
        </div>
        <div className="p-4 space-y-1">
          <p className="text-[10px] text-zinc-600 tracking-widest uppercase">CDN</p>
          <p className="text-sm font-mono text-zinc-300">{result.cdn || 'None'}</p>
        </div>
      </div>

      {/* ISP Info */}
      <div className="p-4 flex justify-between items-center border-b border-zinc-900">
        <div className="space-y-1">
          <p className="text-[10px] text-zinc-600 tracking-widest uppercase">ISP Detected</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold" style={{ color: colors.text }}>{result.isp}</p>
            <span className="text-[8px] px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 font-bold">
              {result.confidence}% CONFIDENCE
            </span>
          </div>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[10px] text-zinc-600 tracking-widest uppercase">Detected From</p>
          <p className="text-[10px] font-mono text-zinc-400 uppercase">{result.ispDetectedFrom} match</p>
        </div>
      </div>

      {/* Recharge Status */}
      <div className="p-6 space-y-4 border-b border-zinc-900 bg-green-500/5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black tracking-[0.2em] text-green-500 uppercase">Recharge Status</h3>
          <span className={`text-xs font-bold ${result.bypassStatus.recharge.working ? 'text-green-400' : 'text-red-400'}`}>
            {result.bypassStatus.recharge.label}
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed italic">
          {result.bypassStatus.recharge.working 
            ? "Domain is reachable. Data available hone pe kaam karta hai." 
            : "Domain is currently unreachable or blocked."}
        </p>
      </div>

      {/* Bypass Status */}
      <div className="p-6 space-y-4 border-b border-zinc-900 bg-blue-500/5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black tracking-[0.2em] text-blue-500 uppercase">Bypass Status (No Recharge)</h3>
          <span className={`text-xs font-bold ${result.bypassStatus.bypass.working ? 'text-blue-400' : 'text-zinc-500'}`}>
            {result.bypassStatus.bypass.label}
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed italic">
          {result.bypassStatus.bypass.working 
            ? "✅ Bina recharge data bypass karta hai. High probability for free internet." 
            : "❌ Bina recharge bypass uncertain ya working nahi hai."}
        </p>
      </div>

      {/* V2Ray Config */}
      <div className="p-6 bg-black/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black tracking-[0.2em] text-zinc-500 uppercase">V2Ray SNI Config Ready</h3>
          <button 
            onClick={() => copyToClipboard(v2rayConfig)}
            className="text-[10px] px-3 py-1 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors rounded uppercase font-bold"
          >
            Copy
          </button>
        </div>
        <pre className="text-[11px] font-mono text-green-500/80 bg-black p-3 rounded border border-zinc-900 overflow-x-auto">
          {v2rayConfig}
        </pre>
      </div>

      {/* Footer */}
      <div className="p-3 bg-black/60 border-t border-zinc-900 flex justify-between items-center">
        <p className="text-[8px] text-zinc-700 tracking-widest uppercase">Checked At: {new Date(result.checkedAt).toLocaleString()}</p>
        <p className="text-[8px] text-zinc-700 tracking-widest uppercase">SSL Expiry: {result.ssl.expiry}</p>
      </div>
    </div>
  );
}
