import React, { useEffect, useRef, useState } from 'react';
import { Delete, Download, Edit2, Lock, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import SubpageBackButton from './SubpageBackButton';

interface PinCardViewProps {
  title: string;
  desc: string;
  isAdmin: boolean;
  homeIconUrl?: string;
  homeLabel?: string;
  magicIconUrl?: string;
  magicLabel?: string;
  onLockChange?: (locked: boolean) => void;
  onEditTitle: () => void;
  onEditDesc: () => void;
  onBackHome: () => void;
  onBackMagic: () => void;
  hideHomeButton?: boolean;
}

interface PlayingCardInfo {
  pin: string;
  label: string;
  rank: string;
  fontRank: string;
  suit: string;
  fontSuit: string;
  isRed: boolean;
}

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

const SUIT_BY_CODE: Record<string, { symbol: string; fontChar: string; isRed: boolean }> = {
  '01': { symbol: '♠', fontChar: '}', isRed: false },
  '02': { symbol: '♥', fontChar: '{', isRed: true },
  '03': { symbol: '♦', fontChar: '[', isRed: true },
  '04': { symbol: '♣', fontChar: ']', isRed: false }
};

function getCardFromPin(pin: string): PlayingCardInfo | null {
  if (!/^\d{4}$/.test(pin)) return null;
  const suitCode = pin.slice(0, 2);
  const rankNum = parseInt(pin.slice(2, 4), 10);
  const suitInfo = SUIT_BY_CODE[suitCode];
  if (!suitInfo || rankNum < 1 || rankNum > 13) return null;
  const rank = RANKS[rankNum - 1];
  return {
    pin,
    label: `${rank}${suitInfo.symbol}`,
    rank,
    fontRank: rank === '10' ? '=' : rank,
    suit: suitInfo.symbol,
    fontSuit: suitInfo.fontChar,
    isRed: suitInfo.isRed
  };
}

export default function PinCardView({
  title,
  desc,
  isAdmin,
  homeIconUrl = '/assets/aistudio/Home_Logo_deea1969.png',
  homeLabel = 'হোম',
  magicIconUrl = '/assets/aistudio/Headline_Logo_41f367d1.png',
  magicLabel = 'ম্যাজিক',
  onLockChange,
  onEditTitle,
  onEditDesc,
  onBackHome,
  onBackMagic,
  hideHomeButton = false
}: PinCardViewProps) {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const [unlockedCard, setUnlockedCard] = useState<PlayingCardInfo | null>(null);
  const [isCardFullscreen, setIsCardFullscreen] = useState<boolean>(false);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);

  const requestNativeFullscreen = () => {
    try {
      const target = document.documentElement || fullscreenRef.current;
      if (target && target.requestFullscreen && !document.fullscreenElement) {
        void target.requestFullscreen().catch(() => {});
      }
    } catch {
      // Fallback CSS fullscreen overlay still handles mobile/iframe cleanly
    }
  };

  const exitNativeFullscreen = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore fullscreen exit errors
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsCardFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      exitNativeFullscreen();
    };
  }, []);

  const handleDigitPress = (digit: string) => {
    if (!isLocked || pinError) return;
    if (pinInput.length >= 4) return;
    const nextPin = pinInput + digit;
    setPinInput(nextPin);

    if (nextPin.length === 4) {
      const matched = getCardFromPin(nextPin);
      if (matched) {
        setUnlockedCard(matched);
        setIsLocked(false);
        onLockChange?.(false);
        setIsCardFullscreen(true);
        setPinInput('');
        setPinError(false);
        requestNativeFullscreen();
      } else {
        setPinError(true);
        window.setTimeout(() => {
          setPinInput('');
          setPinError(false);
        }, 650);
      }
    }
  };

  const handleBackspace = () => {
    if (!isLocked || pinError) return;
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handleCancelLock = () => {
    exitNativeFullscreen();
    onLockChange?.(false);
    onBackMagic();
  };

  const handleRelock = () => {
    requestNativeFullscreen();
    setIsCardFullscreen(false);
    setPinInput('');
    setPinError(false);
    setIsLocked(true);
    onLockChange?.(true);
  };

  const handleEnterFullscreen = () => {
    setIsCardFullscreen(true);
    requestNativeFullscreen();
  };

  const handleExitFullscreen = () => {
    exitNativeFullscreen();
    setIsCardFullscreen(false);
  };

  const handleDownloadCard = async () => {
    if (!unlockedCard) return;
    const width = 750;
    const height = 1050;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      await document.fonts.load('100px "Card Characters"');
      await document.fonts.ready;
    } catch {
      // Proceed with available font
    }

    const drawRoundedRectPath = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // Outer white Bicycle playing card body (2.5" x 3.5" -> 750x1050 at 300 DPI)
    drawRoundedRectPath(2, 2, width - 4, height - 4, 46);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    // Inner thin card frame
    drawRoundedRectPath(36, 36, width - 72, height - 72, 28);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    const inkColor = unlockedCard.isRed ? '#dc2626' : '#0a0a0a';
    ctx.fillStyle = inkColor;

    const drawCornerIndex = () => {
      const cornerCenterX = 90;
      const topPaddingY = 66;
      const rankSuitGap = 14;

      ctx.font = '96px "Card Characters", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const rankMetrics = ctx.measureText(unlockedCard.fontRank);
      const rankAscent = rankMetrics.actualBoundingBoxAscent || 76;
      const rankDescent = rankMetrics.actualBoundingBoxDescent || 4;
      const rankBaselineY = topPaddingY + rankAscent;
      ctx.fillText(unlockedCard.fontRank, cornerCenterX, rankBaselineY);

      ctx.font = '76px "Card Characters", serif';
      const suitMetrics = ctx.measureText(unlockedCard.fontSuit);
      const suitAscent = suitMetrics.actualBoundingBoxAscent || 60;
      const suitBaselineY = rankBaselineY + rankDescent + rankSuitGap + suitAscent;
      ctx.fillText(unlockedCard.fontSuit, cornerCenterX, suitBaselineY);
    };

    // Top-left index
    drawCornerIndex();

    // Bottom-right inverted index
    ctx.save();
    ctx.translate(width, height);
    ctx.rotate(Math.PI);
    drawCornerIndex();
    ctx.restore();

    // Center playing card rank + suit
    ctx.font = '290px "Card Characters", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const centerRankMetrics = ctx.measureText(unlockedCard.fontRank);
    const centerSuitMetrics = ctx.measureText(unlockedCard.fontSuit);
    const centerGap = 12;
    const totalCenterWidth = centerRankMetrics.width + centerGap + centerSuitMetrics.width;
    const startX = (width - totalCenterWidth) / 2;
    const maxAscent = Math.max(
      centerRankMetrics.actualBoundingBoxAscent || 225,
      centerSuitMetrics.actualBoundingBoxAscent || 225
    );
    const maxDescent = Math.max(
      centerRankMetrics.actualBoundingBoxDescent || 14,
      centerSuitMetrics.actualBoundingBoxDescent || 14
    );
    const centerBaselineY = height / 2 + (maxAscent - maxDescent) / 2;

    ctx.fillText(unlockedCard.fontRank, startX, centerBaselineY);
    ctx.fillText(
      unlockedCard.fontSuit,
      startX + centerRankMetrics.width + centerGap,
      centerBaselineY
    );

    const suitSlugMap: Record<string, string> = {
      '♠': 'spade',
      '♥': 'heart',
      '♦': 'diamond',
      '♣': 'club'
    };
    const fileName = `bicycle-card-${unlockedCard.rank}-${suitSlugMap[unlockedCard.suit] || 'card'}.png`;

    const triggerDownload = (url: string, revokeAfter: boolean) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (revokeAfter) {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    };

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          triggerDownload(url, true);
        } else {
          triggerDownload(canvas.toDataURL('image/png'), false);
        }
      }, 'image/png');
    } else {
      triggerDownload(canvas.toDataURL('image/png'), false);
    }
  };

  useEffect(() => {
    if (!isLocked && !isCardFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isLocked) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleDigitPress(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleBackspace();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancelLock();
        }
      } else if (isCardFullscreen && e.key === 'Escape') {
        setIsCardFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const renderPlayingCard = (card: PlayingCardInfo, fullscreenSize: boolean) => (
    <div
      className={`${
        fullscreenSize
          ? 'w-[min(76vw,calc(72vh*5/7))] max-w-[340px] p-3.5 sm:p-4 rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.85)]'
          : 'w-44 min-[400px]:w-48 sm:w-56 p-2.5 sm:p-3 rounded-2xl shadow-[0_14px_38px_rgba(0,0,0,0.55)]'
      } aspect-[5/7] bg-white border-2 border-slate-200 transition-all select-none`}
    >
      <div className="w-full h-full rounded-xl border border-slate-300/90 relative flex items-center justify-center">
        <div
          aria-label={card.label}
          className={`w-full h-full relative flex items-center justify-center font-card-characters ${
            card.isRed ? 'text-red-600' : 'text-neutral-950'
          }`}
        >
          {/* Top-Left Card Index */}
          <div
            className={`absolute ${
              fullscreenSize
                ? 'top-2.5 left-3 sm:top-3 sm:left-3.5 gap-1'
                : 'top-1.5 left-2 sm:top-2 sm:left-2.5 gap-0.5 sm:gap-1'
            } flex flex-col items-center leading-[0.95] font-card-characters`}
          >
            <span
              className={`${
                fullscreenSize ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-[28px]'
              } leading-[0.95] font-card-characters`}
            >
              {card.fontRank}
            </span>
            <span
              className={`${
                fullscreenSize ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl'
              } leading-[0.95] font-card-characters`}
            >
              {card.fontSuit}
            </span>
          </div>

          {/* Center Playing Card Result */}
          <div
            className={`flex items-center justify-center gap-0.5 ${
              fullscreenSize
                ? 'text-[92px] min-[400px]:text-[106px] sm:text-[124px]'
                : 'text-[68px] min-[400px]:text-[76px] sm:text-[92px]'
            } leading-none font-card-characters`}
          >
            <span className="font-card-characters">{card.fontRank}</span>
            <span className="font-card-characters">{card.fontSuit}</span>
          </div>

          {/* Bottom-Right Inverted Card Index */}
          <div
            className={`absolute ${
              fullscreenSize
                ? 'bottom-2.5 right-3 sm:bottom-3 sm:right-3.5 gap-1'
                : 'bottom-1.5 right-2 sm:bottom-2 sm:right-2.5 gap-0.5 sm:gap-1'
            } flex flex-col items-center leading-[0.95] rotate-180 font-card-characters`}
          >
            <span
              className={`${
                fullscreenSize ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-[28px]'
              } leading-[0.95] font-card-characters`}
            >
              {card.fontRank}
            </span>
            <span
              className={`${
                fullscreenSize ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl'
              } leading-[0.95] font-card-characters`}
            >
              {card.fontSuit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={fullscreenRef} className="space-y-5">
      {/* App Lock Screen Overlay (Locks immediately on open) */}
      {isLocked && (
        <div className="fixed inset-0 z-[9990] bg-gradient-to-b from-[#070713] via-[#0d0d22] to-[#05050d] text-white flex flex-col items-center justify-center px-4 py-6 select-none overflow-y-auto">
          <div className="w-full max-w-xs flex flex-col items-center space-y-6">
            {/* Lock Icon Only (No text below) */}
            <div className="flex flex-col items-center justify-center">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
                  pinError
                    ? 'bg-red-500/20 border-red-400 text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.4)]'
                    : 'bg-purple-900/40 border-purple-400/40 text-amber-300 shadow-[0_0_24px_rgba(168,85,247,0.3)]'
                }`}
              >
                <Lock size={26} />
              </div>
            </div>

            {/* 4 PIN Dots */}
            <div className={`flex items-center justify-center gap-4 py-1 ${pinError ? 'translate-x-1 transition-transform' : ''}`}>
              {[0, 1, 2, 3].map((idx) => {
                const filled = idx < pinInput.length;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                      pinError
                        ? 'bg-red-500 border-red-400 scale-110'
                        : filled
                          ? 'bg-amber-400 border-amber-300 scale-110 shadow-[0_0_12px_rgba(251,191,36,0.75)]'
                          : 'bg-transparent border-purple-300/50'
                    }`}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3.5 sm:gap-4 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigitPress(digit)}
                  className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 text-2xl font-semibold text-white flex items-center justify-center transition-all cursor-pointer shadow-lg backdrop-blur-md"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleCancelLock}
                className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full bg-transparent hover:bg-white/10 active:scale-95 text-xs font-semibold text-purple-200/85 flex items-center justify-center transition-all cursor-pointer"
              >
                ফিরে যান
              </button>

              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 text-2xl font-semibold text-white flex items-center justify-center transition-all cursor-pointer shadow-lg backdrop-blur-md"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                aria-label="মুছুন"
                className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full bg-transparent hover:bg-white/10 active:scale-90 text-purple-200 flex items-center justify-center transition-all cursor-pointer"
              >
                <Delete size={22} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Playing Card Stage */}
      {!isLocked && isCardFullscreen && unlockedCard && (
        <div className="fixed inset-0 z-[9995] bg-[#04040a] flex flex-col items-center justify-center p-4 select-none">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRelock}
              className="bg-[#1b1b38]/90 hover:bg-purple-900/70 text-amber-300 border border-purple-500/40 px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-lg"
            >
              <Lock size={14} /> আবার লক করুন
            </button>
            <button
              type="button"
              onClick={handleExitFullscreen}
              className="bg-[#1b1b38]/90 hover:bg-purple-900/70 text-purple-100 border border-purple-500/40 px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-lg"
            >
              <Minimize2 size={14} /> ফুলস্ক্রিন বন্ধ
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:gap-5">
            {renderPlayingCard(unlockedCard, true)}
            <button
              type="button"
              onClick={handleDownloadCard}
              className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-lg"
            >
              <Download size={15} /> ডাউনলোড
            </button>
          </div>
        </div>
      )}

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
            src="/assets/aistudio/Pin_Card_3fbe59ac.png"
            alt={title || 'পিন কার্ড'}
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

      {/* Controls & Bicycle Playing Card Display Box */}
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4 pb-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {unlockedCard && (
            <button
              type="button"
              onClick={handleEnterFullscreen}
              className="bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Maximize2 size={14} /> ফুলস্ক্রিন দেখুন
            </button>
          )}
          <button
            type="button"
            onClick={handleRelock}
            className="bg-[#1b1b38] hover:bg-purple-900/50 text-purple-100 border border-purple-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw size={13} /> পিন লক চালু করুন
          </button>
          {unlockedCard && (
            <button
              type="button"
              onClick={handleDownloadCard}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Download size={14} /> ডাউনলোড
            </button>
          )}
        </div>

        {unlockedCard ? (
          renderPlayingCard(unlockedCard, false)
        ) : (
          <div className="w-44 min-[400px]:w-48 sm:w-56 aspect-[5/7] bg-white/95 rounded-2xl p-2.5 sm:p-3 border-2 border-dashed border-purple-400/70 shadow-[0_6px_20px_rgba(0,0,0,0.35)] flex items-center justify-center">
            <div className="w-full h-full rounded-xl border border-slate-200/70 flex items-center justify-center px-3 text-center text-xs text-slate-400 font-medium">
              পিন নম্বর দিয়ে কার্ড আনলক করুন
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
