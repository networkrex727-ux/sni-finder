import React from 'react';

export default function DomainInput({ value, onChange, onSubmit, loading }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSubmit();
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="relative group">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter domain e.g. airtel.in or jio.com"
          className="w-full bg-black/40 border border-zinc-800 focus:border-green-500/50 outline-none px-6 py-4 text-green-400 font-mono text-lg transition-all rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:border-zinc-700"
          disabled={loading}
        />
        <div className="absolute inset-0 rounded-lg bg-green-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
      </div>
      
      <button
        onClick={onSubmit}
        disabled={loading || !value.trim()}
        className={`w-full py-4 font-black tracking-[0.3em] border transition-all rounded-lg ${
          loading || !value.trim()
            ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
            : 'border-green-500 text-green-500 hover:bg-green-500/10 hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] active:scale-[0.98]'
        }`}
      >
        {loading ? 'SCANNING...' : 'CHECK SNI'}
      </button>

      <p className="text-[10px] text-zinc-600 text-center tracking-widest uppercase">
        Supports: airtel.in, jio.com, bsnl.co.in, custom domains
      </p>
    </div>
  );
}
