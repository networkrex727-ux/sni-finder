import React from 'react';

export default function StatusBadge({ type, label }) {
  const styles = {
    working: 'bg-green-500/10 border-green-500/50 text-green-400',
    dead: 'bg-red-500/10 border-red-500/50 text-red-400',
    maybe: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
  };

  const icons = {
    working: '✅',
    dead: '❌',
    maybe: '⚠️'
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border text-xs font-bold ${styles[type] || styles.dead}`}>
      <span>{icons[type] || icons.dead}</span>
      {label}
    </div>
  );
}
