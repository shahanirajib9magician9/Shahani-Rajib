import React, { useState } from 'react';
import { Edit2, RotateCcw } from 'lucide-react';
import SubpageBackButton from './SubpageBackButton';

interface TasPredictionViewProps {
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

interface BinaryCardSheet {
  id: number;
  value: number;
  src: string;
}

const PREDICTION_SHEETS: BinaryCardSheet[] = [
  { id: 1, value: 1, src: '/assets/aistudio/1C_0fbb70d3.png' },
  { id: 2, value: 2, src: '/assets/aistudio/2C_e9bc55f3.png' },
  { id: 3, value: 4, src: '/assets/aistudio/3C_5d8051fb.png' },
  { id: 4, value: 8, src: '/assets/aistudio/4C_03e21cb3.png' },
  { id: 5, value: 16, src: '/assets/aistudio/5C_6e9e1a50.png' },
  { id: 6, value: 32, src: '/assets/aistudio/6C_3e92b6e3.png' }
];

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const SUITS = [
  { symbol: '♠', fontChar: '}', isRed: false },
  { symbol: '♥', fontChar: '{', isRed: true },
  { symbol: '♦', fontChar: '[', isRed: true },
  { symbol: '♣', fontChar: ']', isRed: false }
] as const;

function getCardFromScore(
  score: number
): { label: string; rank: string; fontRank: string; suit: string; fontSuit: string; isRed: boolean } | null {
  if (score < 1 || score > 52) return null;
  const zeroBased = score - 1;
  const suitInfo = SUITS[Math.floor(zeroBased / 13)];
  const rank = RANKS[zeroBased % 13];
  return {
    label: `${rank}${suitInfo.symbol}`,
    rank,
    fontRank: rank === '10' ? '=' : rank,
    suit: suitInfo.symbol,
    fontSuit: suitInfo.fontChar,
    isRed: suitInfo.isRed
  };
}

const toBengaliDigits = (num: number): string =>
  String(num).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)] || d);

export default function TasPredictionView({
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
}: TasPredictionViewProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSheet = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    setSelectedIds([]);
  };

  const totalScore = selectedIds.reduce((sum, id) => {
    const found = PREDICTION_SHEETS.find((sheet) => sheet.id === id);
    return sum + (found ? found.value : 0);
  }, 0);

  const predictedCard = getCardFromScore(totalScore);

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
            src="/assets/aistudio/Card_PPP_64d477c3.png"
            alt={title || 'তাস প্রেডিকশন'}
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

      {/* 6 Uniform Portrait Images Grid (Click directly on image to select) */}
      <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {PREDICTION_SHEETS.map((sheet) => {
          const isSelected = selectedIds.includes(sheet.id);
          return (
            <button
              key={sheet.id}
              type="button"
              onClick={() => toggleSheet(sheet.id)}
              aria-pressed={isSelected}
              aria-label={`ছবি ${toBengaliDigits(sheet.id)} নির্বাচন করুন`}
              className={`relative w-full aspect-[3127/4690] bg-white rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer select-none transition-all border-[3px] ${
                isSelected
                  ? 'border-emerald-500 ring-2 ring-amber-400/80 shadow-[0_0_24px_rgba(16,185,129,0.5)] scale-[0.985]'
                  : 'border-purple-500/40 hover:border-amber-300/80 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
              }`}
            >
              <img
                src={sheet.src}
                alt={`তাস প্রেডিকশন ছবি ${toBengaliDigits(sheet.id)}`}
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

      {/* Reset Control */}
      {selectedIds.length > 0 && (
        <div className="max-w-4xl mx-auto flex justify-center pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="bg-[#1b1b38] hover:bg-purple-900/50 text-purple-100 border border-purple-500/40 px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw size={13} /> রিসেট করুন
          </button>
        </div>
      )}

      {/* Bicycle Playing Card Result Box (2.5" x 3.5" aspect-[5/7]) */}
      <div className="max-w-4xl mx-auto flex flex-col items-center pb-3">
        <div
          className={`w-44 min-[400px]:w-48 sm:w-56 aspect-[5/7] bg-white rounded-2xl p-2.5 sm:p-3 transition-all border-2 select-none ${
            predictedCard
              ? 'border-slate-200 shadow-[0_14px_38px_rgba(0,0,0,0.55)]'
              : 'border-dashed border-purple-400/70 bg-white/95 shadow-[0_6px_20px_rgba(0,0,0,0.35)]'
          }`}
        >
          <div
            className={`w-full h-full rounded-xl border relative flex items-center justify-center ${
              predictedCard ? 'border-slate-300/90' : 'border-slate-200/70'
            }`}
          >
            {predictedCard ? (
              <div
                aria-label={predictedCard.label}
                className={`w-full h-full relative flex items-center justify-center font-card-characters ${
                  predictedCard.isRed ? 'text-red-600' : 'text-neutral-950'
                }`}
              >
                {/* Top-Left Card Index */}
                <div className="absolute top-1.5 left-2 sm:top-2 sm:left-2.5 flex flex-col items-center gap-0.5 sm:gap-1 leading-[0.95] font-card-characters">
                  <span className="text-2xl sm:text-[28px] leading-[0.95] font-card-characters">
                    {predictedCard.fontRank}
                  </span>
                  <span className="text-lg sm:text-2xl leading-[0.95] font-card-characters">
                    {predictedCard.fontSuit}
                  </span>
                </div>

                {/* Center Playing Card Result */}
                <div className="flex items-center justify-center gap-0.5 text-[68px] min-[400px]:text-[76px] sm:text-[92px] leading-none font-card-characters">
                  <span className="font-card-characters">{predictedCard.fontRank}</span>
                  <span className="font-card-characters">{predictedCard.fontSuit}</span>
                </div>

                {/* Bottom-Right Inverted Card Index */}
                <div className="absolute bottom-1.5 right-2 sm:bottom-2 sm:right-2.5 flex flex-col items-center gap-0.5 sm:gap-1 leading-[0.95] rotate-180 font-card-characters">
                  <span className="text-2xl sm:text-[28px] leading-[0.95] font-card-characters">
                    {predictedCard.fontRank}
                  </span>
                  <span className="text-lg sm:text-2xl leading-[0.95] font-card-characters">
                    {predictedCard.fontSuit}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center px-3 text-slate-400 text-xs font-medium leading-relaxed">
                {totalScore > 52 ? 'সঠিক ছবি নির্বাচন করুন' : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
