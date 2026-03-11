import React from 'react';

export default function ISPBadge({ isp, colors }) {
  const emojis = {
    Airtel: '🔴',
    Jio: '🟢',
    Vi: '🟣',
    BSNL: '🔵',
    Cloudflare: '🟠',
    Unknown: '⚫'
  };

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black tracking-widest uppercase"
      style={{ 
        backgroundColor: colors.bg, 
        borderColor: colors.border,
        color: colors.text
      }}
    >
      <span className="text-xs">{emojis[isp] || emojis.Unknown}</span>
      {isp}
    </div>
  );
}
