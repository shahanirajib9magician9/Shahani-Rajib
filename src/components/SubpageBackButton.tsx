import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface SubpageBackButtonProps {
  iconUrl?: string;
  label: string;
  onClick: () => void;
  title?: string;
  variant?: 'home' | 'parent';
  compact?: boolean;
  fluid?: boolean;
}

export default function SubpageBackButton({
  iconUrl,
  label,
  onClick,
  title,
  variant = 'home',
  compact = false,
  fluid = false
}: SubpageBackButtonProps) {
  const isHome = variant === 'home';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      className={`relative bg-[#1b1b38]/95 hover:bg-purple-900/45 border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all shadow-sm overflow-hidden ${
        fluid
          ? 'w-full aspect-square min-w-0 px-0.5 sm:px-1.5 py-1 rounded-xl'
          : compact
            ? 'shrink-0 w-[64px] h-[64px] min-[380px]:w-[68px] min-[380px]:h-[68px] sm:w-[76px] sm:h-[76px] px-1 py-1 rounded-xl'
            : 'shrink-0 w-[72px] h-[72px] min-[380px]:w-[78px] min-[380px]:h-[78px] sm:w-[88px] sm:h-[88px] px-1.5 py-1.5 rounded-xl'
      } ${
        isHome
          ? 'border-purple-500/45 hover:border-amber-400/75 text-amber-200'
          : 'border-purple-500/35 hover:border-purple-300/70 text-purple-100'
      }`}
    >
      <ArrowLeft
        size={fluid ? 10 : compact ? 11 : 12}
        className={`absolute top-1 left-1 shrink-0 opacity-85 ${isHome ? 'text-amber-300' : 'text-purple-200'}`}
      />
      {iconUrl && (
        <img
          src={iconUrl}
          alt={label}
          className={`${
            fluid
              ? 'w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 min-[430px]:w-8 min-[430px]:h-8 sm:w-11 sm:h-11'
              : compact
                ? 'w-7 h-7 min-[380px]:w-8 min-[380px]:h-8 sm:w-9 sm:h-9'
                : 'w-9 h-9 min-[380px]:w-10 min-[380px]:h-10 sm:w-11 sm:h-11'
          } object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0`}
        />
      )}
      <span
        className={`${
          fluid
            ? 'text-[7.5px] min-[370px]:text-[8.5px] min-[430px]:text-[9.5px] sm:text-[11px]'
            : compact
              ? 'text-[8.5px] min-[390px]:text-[9px] sm:text-[10px]'
              : 'text-[9.5px] min-[390px]:text-[10px] sm:text-[11px]'
        } font-['Aikya','Poppins',sans-serif] font-bold leading-tight whitespace-nowrap max-w-full truncate px-0.5`}
      >
        {label}
      </span>
    </button>
  );
}
