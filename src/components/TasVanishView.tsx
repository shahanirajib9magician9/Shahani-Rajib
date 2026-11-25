import React, { useState } from 'react';
import { Edit2, RotateCcw } from 'lucide-react';
import SubpageBackButton from './SubpageBackButton';

interface TasVanishViewProps {
  title: string;
  desc: string;
  isAdmin: boolean;
  homeIconUrl?: string;
  homeLabel?: string;
  magicIconUrl?: string;
  magicLabel?: string;
  onEditTitle: () => void;
  onEditDesc: () => void;
  onBackHome: () => void;
  onBackMagic: () => void;
  hideHomeButton?: boolean;
}

interface CardSheet {
  id: number;
  src: string;
}

const TAS_VANISH_CARDS: CardSheet[] = [
  { id: 1, src: '/assets/aistudio/1_cd7f2781.png' },
  { id: 2, src: '/assets/aistudio/2_5193a232.png' },
  { id: 3, src: '/assets/aistudio/3_16c6daff.png' },
  { id: 4, src: '/assets/aistudio/4_7252dc1d.png' },
  { id: 5, src: '/assets/aistudio/5_6f875cf7.png' },
  { id: 6, src: '/assets/aistudio/6_bffa8a50.png' },
  { id: 7, src: '/assets/aistudio/7_962ee8f7.png' },
  { id: 8, src: '/assets/aistudio/8_650a9359.png' }
];

const MAX_SELECTIONS = 5;

const toBengaliDigits = (num: number): string =>
  String(num).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)] || d);

export default function TasVanishView({
  title,
  desc,
  isAdmin,
  homeIconUrl = '/assets/aistudio/Home_Logo_deea1969.png',
  homeLabel = 'হোম',
  magicIconUrl = '/assets/aistudio/Headline_Logo_41f367d1.png',
  magicLabel = 'ম্যাজিক',
  onEditTitle,
  onEditDesc,
  onBackHome,
  onBackMagic,
  hideHomeButton = false
}: TasVanishViewProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [limitNotice, setLimitNotice] = useState<boolean>(false);

  const toggleCard = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        setLimitNotice(false);
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_SELECTIONS) {
        setLimitNotice(true);
        return prev;
      }
      setLimitNotice(false);
      return [...prev, id];
    });
  };

  const handleReset = () => {
    setSelectedIds([]);
    setLimitNotice(false);
  };

  const selectedCards = selectedIds
    .map((id) => TAS_VANISH_CARDS.find((card) => card.id === id))
    .filter((card): card is CardSheet => Boolean(card));

  const isComplete = selectedCards.length === MAX_SELECTIONS;

  return (
    <div className="space-y-5">
      {/* Top Navigation Bar */}
      <div className="w-full flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {!hideHomeButton && (
          <SubpageBackButton
            iconUrl={homeIconUrl}
            label={homeLabel}
            onClick={onBackHome}
            variant="home"
          />
        )}
        <SubpageBackButton
          iconUrl={magicIconUrl}
          label={magicLabel}
          onClick={onBackMagic}
          variant="parent"
        />
      </div>

      {/* Header Card with Admin Edit Options */}
      <div className="max-w-4xl mx-auto bg-[#13132b] border border-purple-500/40 rounded-2xl p-4 sm:p-5 shadow-[0_0_25px_rgba(120,50,255,0.15)] space-y-3">
        {isAdmin && (
          <div className="flex flex-wrap justify-end gap-1.5">
            <button
              type="button"
              onClick={onEditTitle}
              className="bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all"
              title="শিরোনাম এডিট"
            >
              <Edit2 size={12} /> শিরোনাম এডিট
            </button>
            <button
              type="button"
              onClick={onEditDesc}
              className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all"
              title="বিবরণ এডিট"
            >
              <Edit2 size={12} /> বিবরণ এডিট
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 sm:gap-4">
          <img
            src="/assets/aistudio/card__Logo_91ce8353.png"
            alt={title || 'তাস ভ্যানিস'}
            className="w-12 h-12 sm:w-16 sm:h-16 object-contain shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
          />
          <div className="min-w-0 space-y-1">
            {title && (
              <h2 className="text-lg sm:text-2xl font-bold text-amber-300 leading-tight whitespace-pre-line">
                {title}
              </h2>
            )}
            {desc && (
              <p className="text-[11px] sm:text-xs text-purple-200/85 leading-relaxed whitespace-pre-line">
                {desc}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 8 Uniform PNG Images Grid (Click directly on image to select) */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {TAS_VANISH_CARDS.map((card) => {
          const isSelected = selectedIds.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => toggleCard(card.id)}
              aria-pressed={isSelected}
              aria-label={`ছবি ${toBengaliDigits(card.id)} নির্বাচন করুন`}
              className={`relative w-full aspect-[6240/3127] bg-white rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer select-none transition-all border-[3px] ${
                isSelected
                  ? 'border-emerald-500 ring-2 ring-amber-400/80 shadow-[0_0_24px_rgba(16,185,129,0.5)] scale-[0.985]'
                  : 'border-purple-500/40 hover:border-amber-300/80 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
              }`}
            >
              <img
                src={card.src}
                alt={`তাস ভ্যানিস ছবি ${toBengaliDigits(card.id)}`}
                draggable={false}
                className="w-full h-full object-contain pointer-events-none select-none"
              />
              {isSelected && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-emerald-500/15 pointer-events-none"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selection Counter & Reset Controls */}
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-1">
        <span
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border ${
            isComplete
              ? 'bg-emerald-950/70 border-emerald-400/60 text-emerald-300'
              : 'bg-[#13132b] border-purple-500/40 text-amber-300'
          }`}
        >
          নির্বাচিত: {toBengaliDigits(selectedCards.length)} / ৫
        </span>
        {selectedCards.length > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="bg-[#1b1b38] hover:bg-purple-900/50 text-purple-100 border border-purple-500/40 px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw size={13} /> রিসেট করুন
          </button>
        )}
      </div>

      {limitNotice && (
        <p className="text-center text-xs text-amber-300 font-medium">
          সর্বোচ্চ ৫টি ছবি নির্বাচন করা যাবে। পরিবর্তন করতে আগের যেকোনো একটি ছবিতে ক্লিক করে বাদ দিন।
        </p>
      )}

      {/* Bottom Overlapping Box (Exact Same Aspect Ratio & Responsive Size as Grid Images) */}
      <div className="max-w-4xl mx-auto pb-2">
        <div
          className={`relative w-full sm:w-[calc(50%-0.5rem)] mx-auto aspect-[6240/3127] bg-white rounded-xl sm:rounded-2xl overflow-hidden transition-all border-2 ${
            isComplete
              ? 'border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.4)]'
              : 'border-dashed border-purple-400/70 shadow-[0_4px_16px_rgba(0,0,0,0.35)]'
          }`}
        >
          {isComplete &&
            selectedCards.map((card) => (
              <img
                key={card.id}
                src={card.src}
                alt={`ওভারল্যাপ ছবি ${toBengaliDigits(card.id)}`}
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              />
            ))}
        </div>
      </div>
    </div>
  );
}
