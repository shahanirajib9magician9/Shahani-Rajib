import React, { useRef, useState } from 'react';
import { Edit2, RotateCcw } from 'lucide-react';
import SubpageBackButton from './SubpageBackButton';

interface TaserGhoriViewProps {
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

interface ClockCardSpec {
  id: string;
  hour: number;
  rank: string;
  fontRank: string;
  suit: string;
  fontSuit: string;
}

// Top 6x2 grid order: J♠, 10♠, 9♠, 8♠, 7♠, 6♠, 5♠, 4♠, 3♠, 2♠, A♠, Q♠
const TOP_GRID_CARDS: ClockCardSpec[] = [
  { id: 'c1', hour: 1, rank: 'J', fontRank: 'J', suit: '♠', fontSuit: '}' },
  { id: 'c2', hour: 2, rank: '10', fontRank: '=', suit: '♠', fontSuit: '}' },
  { id: 'c3', hour: 3, rank: '9', fontRank: '9', suit: '♠', fontSuit: '}' },
  { id: 'c4', hour: 4, rank: '8', fontRank: '8', suit: '♠', fontSuit: '}' },
  { id: 'c5', hour: 5, rank: '7', fontRank: '7', suit: '♠', fontSuit: '}' },
  { id: 'c6', hour: 6, rank: '6', fontRank: '6', suit: '♠', fontSuit: '}' },
  { id: 'c7', hour: 7, rank: '5', fontRank: '5', suit: '♠', fontSuit: '}' },
  { id: 'c8', hour: 8, rank: '4', fontRank: '4', suit: '♠', fontSuit: '}' },
  { id: 'c9', hour: 9, rank: '3', fontRank: '3', suit: '♠', fontSuit: '}' },
  { id: 'c10', hour: 10, rank: '2', fontRank: '2', suit: '♠', fontSuit: '}' },
  { id: 'c11', hour: 11, rank: 'A', fontRank: 'A', suit: '♠', fontSuit: '}' },
  { id: 'c12', hour: 12, rank: 'Q', fontRank: 'Q', suit: '♠', fontSuit: '}' }
];

// Clock arrangement starting at 12 (top) clockwise 1..11
const CLOCK_ORDER_CARDS: ClockCardSpec[] = [
  TOP_GRID_CARDS[11], // 12 -> Q♠
  TOP_GRID_CARDS[0],  // 1  -> J♠
  TOP_GRID_CARDS[1],  // 2  -> 10♠
  TOP_GRID_CARDS[2],  // 3  -> 9♠
  TOP_GRID_CARDS[3],  // 4  -> 8♠
  TOP_GRID_CARDS[4],  // 5  -> 7♠
  TOP_GRID_CARDS[5],  // 6  -> 6♠
  TOP_GRID_CARDS[6],  // 7  -> 5♠
  TOP_GRID_CARDS[7],  // 8  -> 4♠
  TOP_GRID_CARDS[8],  // 9  -> 3♠
  TOP_GRID_CARDS[9],  // 10 -> 2♠
  TOP_GRID_CARDS[10]  // 11 -> A♠
];

const BACK_CARD_IMAGE = '/assets/aistudio/bicycle-card-Back_6c13a06d.png';

export default function TaserGhoriView({
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
}: TaserGhoriViewProps) {
  const [flippedHours, setFlippedHours] = useState<number[]>([]);
  const [nudgingHour, setNudgingHour] = useState<number | null>(null);
  const [flashingHour, setFlashingHour] = useState<number | null>(null);
  const [minuteAngle, setMinuteAngle] = useState<number>(0);
  const lastTapRef = useRef<Record<number, number>>({});
  const nudgeTimeoutRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  const rotateMinuteHandToHour = (hour: number) => {
    const target = (hour % 12) * 30;
    setMinuteAngle((prev) => {
      const normalizedPrev = ((prev % 360) + 360) % 360;
      const shortestDelta = ((target - normalizedPrev + 540) % 360) - 180;
      return prev + shortestDelta;
    });
  };

  const handleClockCardClick = (hour: number) => {
    // Rotate golden minute hand toward the clicked card on both single & double click
    rotateMinuteHandToHour(hour);

    const now = Date.now();
    const prevTap = lastTapRef.current[hour] || 0;

    if (now - prevTap <= 360) {
      // Double click / double tap -> Flash & Flip
      lastTapRef.current[hour] = 0;
      setNudgingHour(null);
      setFlashingHour(hour);
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = window.setTimeout(() => {
        setFlashingHour(null);
      }, 450);

      setFlippedHours((prev) =>
        prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]
      );
    } else {
      // Single click / tap -> Gentle nudge/wiggle
      lastTapRef.current[hour] = now;
      setNudgingHour(null);
      window.requestAnimationFrame(() => {
        setNudgingHour(hour);
      });
      if (nudgeTimeoutRef.current) window.clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = window.setTimeout(() => {
        setNudgingHour(null);
      }, 440);
    }
  };

  const handleResetClock = () => {
    setFlippedHours([]);
    setNudgingHour(null);
    setFlashingHour(null);
    rotateMinuteHandToHour(12);
  };

  return (
    <div className="space-y-6">
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
            src="/assets/aistudio/Card_Clock_e1f093bf.png"
            alt={title || 'তাসের ঘড়ি'}
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

      {/* Top 12 Bicycle Playing Cards Grid: 6 on Top, 6 on Bottom */}
      <div className="max-w-4xl mx-auto grid grid-cols-6 gap-1.5 min-[400px]:gap-2 sm:gap-3">
        {TOP_GRID_CARDS.map((card) => (
          <div
            key={card.id}
            aria-label={`${card.rank}${card.suit}`}
            className="w-full aspect-[5/7] bg-white rounded-md sm:rounded-xl border border-slate-200 p-0.5 min-[400px]:p-1 sm:p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.45)] select-none"
          >
            <div className="w-full h-full rounded-[4px] sm:rounded-lg border border-slate-300/85 relative flex items-center justify-center text-neutral-950 font-card-characters">
              {/* Top-Left Corner */}
              <div className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 flex flex-col items-center gap-[1px] leading-[0.9] font-card-characters">
                <span className="text-[8px] min-[380px]:text-[10px] sm:text-sm md:text-base leading-[0.9] font-card-characters">
                  {card.fontRank}
                </span>
                <span className="text-[7px] min-[380px]:text-[8px] sm:text-xs md:text-sm leading-[0.9] font-card-characters">
                  {card.fontSuit}
                </span>
              </div>

              {/* Center Rank + Suit */}
              <div className="flex items-center justify-center gap-[1px] text-[13px] min-[380px]:text-[16px] sm:text-[26px] md:text-[32px] leading-none font-card-characters">
                <span className="font-card-characters">{card.fontRank}</span>
                <span className="font-card-characters">{card.fontSuit}</span>
              </div>

              {/* Bottom-Right Inverted Corner */}
              <div className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 flex flex-col items-center gap-[1px] leading-[0.9] rotate-180 font-card-characters">
                <span className="text-[8px] min-[380px]:text-[10px] sm:text-sm md:text-base leading-[0.9] font-card-characters">
                  {card.fontRank}
                </span>
                <span className="text-[7px] min-[380px]:text-[8px] sm:text-xs md:text-sm leading-[0.9] font-card-characters">
                  {card.fontSuit}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Circular 12-Card Clock with Golden Vintage Clock Hands */}
      <div className="max-w-2xl mx-auto pt-2 pb-4 space-y-4">
        <div className="relative w-full max-w-[540px] aspect-square mx-auto select-none">
          {/* Subtle Clock Dial Rings */}
          <div
            aria-hidden="true"
            className="absolute inset-[9.5%] rounded-full border border-purple-500/25 pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute inset-[26%] rounded-full border border-dashed border-amber-400/25 pointer-events-none"
          />

          {/* Golden Vintage Hour Hand (Fixed at 12), Rotating Minute Hand (Points to clicked card), & Center Pivot */}
          {/* 1. Hour Hand - Shorter ornate vintage golden hand, always fixed at 12 */}
          <svg
            viewBox="0 0 200 200"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
          >
            <defs>
              <linearGradient id="vintageGoldHour" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="35%" stopColor="#fde047" />
                <stop offset="70%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <filter id="goldHourShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.7" />
              </filter>
            </defs>
            <g filter="url(#goldHourShadow)">
              <path
                d="M100 114 C96.8 114 95.8 110.8 97.3 107.2 L98 81 C95.6 78.2 94.8 75 97 71.2 C98.5 68.5 99.4 63.5 100 57 C100.6 63.5 101.5 68.5 103 71.2 C105.2 75 104.4 78.2 102 81 L102.7 107.2 C104.2 110.8 103.2 114 100 114 Z"
                fill="url(#vintageGoldHour)"
                stroke="#451a03"
                strokeWidth="0.9"
              />
              <circle cx="100" cy="75" r="1.6" fill="#451a03" />
            </g>
          </svg>

          {/* 2. Minute Hand - Longer ornate vintage golden hand, rotates smoothly to clicked card */}
          <div
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none z-10 will-change-transform"
            style={{
              transform: `rotate(${minuteAngle}deg)`,
              transformOrigin: '50% 50%',
              transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="vintageGoldMinute" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef9c3" />
                  <stop offset="35%" stopColor="#fde047" />
                  <stop offset="72%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <filter id="goldMinuteShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.7" />
                </filter>
              </defs>
              <g filter="url(#goldMinuteShadow)">
                <path
                  d="M100 118 C97.5 118 96.8 115 98 111.5 L98.6 64 C96.8 61.6 96.3 58.8 98 55.6 L100 37 L102 55.6 C103.7 58.8 103.2 61.6 101.4 64 L102 111.5 C103.2 115 102.5 118 100 118 Z"
                  fill="url(#vintageGoldMinute)"
                  stroke="#451a03"
                  strokeWidth="0.85"
                />
                <circle cx="100" cy="59" r="1.3" fill="#451a03" />
              </g>
            </svg>
          </div>

          {/* 3. Vintage Golden Center Pivot Cap */}
          <svg
            viewBox="0 0 200 200"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
          >
            <defs>
              <radialGradient id="vintageGoldCap" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>
            </defs>
            <circle
              cx="100"
              cy="100"
              r="5.6"
              fill="url(#vintageGoldCap)"
              stroke="#451a03"
              strokeWidth="1"
            />
            <circle cx="100" cy="100" r="2" fill="#fef3c7" opacity="0.95" />
          </svg>

          {/* 12 Circular Clock Cards */}
          {CLOCK_ORDER_CARDS.map((card) => {
            const angleRad = (((card.hour % 12) * 30 - 90) * Math.PI) / 180;
            const radiusPct = 40.5;
            const left = `${50 + radiusPct * Math.cos(angleRad)}%`;
            const top = `${50 + radiusPct * Math.sin(angleRad)}%`;
            const isFlipped = flippedHours.includes(card.hour);
            const isNudging = nudgingHour === card.hour;
            const isFlashing = flashingHour === card.hour;

            return (
              <button
                key={`clock-${card.hour}`}
                type="button"
                onClick={() => handleClockCardClick(card.hour)}
                aria-label={`ঘড়ির ${card.hour} নম্বর তাস`}
                style={{ left, top, transform: 'translate(-50%, -50%)' }}
                className="absolute w-[13.2%] aspect-[5/7] cursor-pointer touch-manipulation focus:outline-none group z-20"
              >
                <div
                  className={`w-full h-full relative [perspective:900px] ${
                    isNudging ? 'animate-clock-nudge' : ''
                  }`}
                >
                  <div
                    className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
                      isFlipped ? '[transform:rotateY(180deg)]' : ''
                    }`}
                  >
                    {/* Back Side (Visible Initially) */}
                    <div className="absolute inset-0 [backface-visibility:hidden] rounded-[4px] sm:rounded-lg overflow-hidden bg-white border border-slate-200 shadow-[0_5px_14px_rgba(0,0,0,0.65)] group-hover:ring-2 group-hover:ring-amber-300/60 transition-shadow">
                      <img
                        src={BACK_CARD_IMAGE}
                        alt={`তাসের ব্যাক ${card.hour}`}
                        draggable={false}
                        className="w-full h-full object-cover pointer-events-none select-none"
                      />
                    </div>

                    {/* Front Side (Revealed on Double Click with Flash & Flip) */}
                    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-[4px] sm:rounded-lg bg-white border border-slate-200 p-[2px] sm:p-1 shadow-[0_8px_22px_rgba(251,191,36,0.45)]">
                      <div className="w-full h-full rounded-[3px] sm:rounded-md border border-slate-300/85 relative flex items-center justify-center text-neutral-950 font-card-characters">
                        {/* Top-Left Corner */}
                        <div className="absolute top-[1px] left-[2px] sm:top-0.5 sm:left-0.5 flex flex-col items-center gap-[1px] leading-[0.88] font-card-characters">
                          <span className="text-[7px] min-[380px]:text-[8px] sm:text-xs leading-[0.88] font-card-characters">
                            {card.fontRank}
                          </span>
                          <span className="text-[6px] min-[380px]:text-[7px] sm:text-[10px] leading-[0.88] font-card-characters">
                            {card.fontSuit}
                          </span>
                        </div>

                        {/* Center Card Text */}
                        <div className="flex items-center justify-center gap-[1px] text-[12px] min-[380px]:text-[15px] sm:text-[22px] leading-none font-card-characters">
                          <span className="font-card-characters">{card.fontRank}</span>
                          <span className="font-card-characters">{card.fontSuit}</span>
                        </div>

                        {/* Bottom-Right Inverted Corner */}
                        <div className="absolute bottom-[1px] right-[2px] sm:bottom-0.5 sm:right-0.5 flex flex-col items-center gap-[1px] leading-[0.88] rotate-180 font-card-characters">
                          <span className="text-[7px] min-[380px]:text-[8px] sm:text-xs leading-[0.88] font-card-characters">
                            {card.fontRank}
                          </span>
                          <span className="text-[6px] min-[380px]:text-[7px] sm:text-[10px] leading-[0.88] font-card-characters">
                            {card.fontSuit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Magic Flash Burst on Double Click */}
                  {isFlashing && (
                    <div
                      aria-hidden="true"
                      className="absolute -inset-1 rounded-lg bg-gradient-to-br from-white via-amber-200 to-white pointer-events-none animate-clock-flash z-20 shadow-[0_0_24px_rgba(255,255,255,0.95)]"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Clean Reset Control below clock when any card is flipped */}
        {flippedHours.length > 0 && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleResetClock}
              className="bg-[#1b1b38] hover:bg-purple-900/50 text-amber-300 border border-amber-400/45 px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(245,158,11,0.2)] cursor-pointer transition-all active:scale-95"
            >
              <RotateCcw size={13} /> সব তাস উল্টান
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
