import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Edit2, RotateCcw } from 'lucide-react';
import SubpageBackButton from './SubpageBackButton';

interface IskaponerTekkaViewProps {
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

type SlotId = 'left' | 'center' | 'right';

interface MonteCard {
  id: 'ace-spade' | 'three-heart' | 'two-club';
  label: string;
  rank: string;
  fontRank: string;
  suit: string;
  fontSuit: string;
  isRed: boolean;
}

const CARDS_BY_ID: Record<MonteCard['id'], MonteCard> = {
  'ace-spade': {
    id: 'ace-spade',
    label: 'A♠',
    rank: 'A',
    fontRank: 'A',
    suit: '♠',
    fontSuit: '}',
    isRed: false
  },
  'three-heart': {
    id: 'three-heart',
    label: '3♥',
    rank: '3',
    fontRank: '3',
    suit: '♥',
    fontSuit: '{',
    isRed: true
  },
  'two-club': {
    id: 'two-club',
    label: '2♣',
    rank: '2',
    fontRank: '2',
    suit: '♣',
    fontSuit: ']',
    isRed: false
  }
};

const INITIAL_SLOTS: Record<SlotId, MonteCard['id'] | null> = {
  left: 'ace-spade',
  center: 'three-heart',
  right: 'two-club'
};

const ALL_SLOTS: SlotId[] = ['left', 'center', 'right'];
const BACK_CARD_IMAGE = '/assets/aistudio/bicycle-card-Back_6c13a06d.png';

interface DragPreviewState {
  cardId: MonteCard['id'];
  sourceSlot: SlotId;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface PendingFlipData {
  rects: Record<string, { left: number; top: number }>;
  draggedCardId?: MonteCard['id'];
}

export default function IskaponerTekkaView({
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
}: IskaponerTekkaViewProps) {
  const [slots, setSlots] = useState<Record<SlotId, MonteCard['id'] | null>>({ ...INITIAL_SLOTS });
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({});
  const [flashingCardId, setFlashingCardId] = useState<MonteCard['id'] | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<SlotId | null>(null);
  const [swappedSlots, setSwappedSlots] = useState<SlotId[]>([]);

  const slotRefs = useRef<Record<SlotId, HTMLDivElement | null>>({
    left: null,
    center: null,
    right: null
  });
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingFlipRef = useRef<PendingFlipData | null>(null);

  const lastTapRef = useRef<Record<string, number>>({});
  const flashTimerRef = useRef<number | null>(null);
  const swapGlowTimerRef = useRef<number | null>(null);
  const dragSessionRef = useRef<{
    pointerId: number;
    cardId: MonteCard['id'];
    sourceSlot: SlotId;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    isDragging: boolean;
  } | null>(null);

  const captureCurrentCardRects = (overrideCardId?: string, overridePos?: { left: number; top: number }) => {
    const rects: Record<string, { left: number; top: number }> = {};
    (Object.keys(CARDS_BY_ID) as MonteCard['id'][]).forEach((cid) => {
      if (overrideCardId === cid && overridePos) {
        rects[cid] = overridePos;
        return;
      }
      const el = cardRefs.current[cid];
      if (el) {
        const r = el.getBoundingClientRect();
        rects[cid] = { left: r.left, top: r.top };
      }
    });
    return rects;
  };

  useLayoutEffect(() => {
    const pending = pendingFlipRef.current;
    if (!pending) return;
    pendingFlipRef.current = null;

    (Object.keys(CARDS_BY_ID) as MonteCard['id'][]).forEach((cid) => {
      const el = cardRefs.current[cid];
      const prev = pending.rects[cid];
      if (!el || !prev || typeof el.animate !== 'function') return;

      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      if (cid === pending.draggedCardId) {
        // Smooth glide from drop point into target slot
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(1.07)` },
            { transform: 'translate(0px, 0px) scale(1)' }
          ],
          {
            duration: 280,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }
        );
      } else {
        // Raised arc switch animation for the displaced card moving to the empty border
        const tilt = dx > 0 ? -5 : 5;
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(0deg)` },
            {
              transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 26}px) scale(1.08) rotate(${tilt}deg)`,
              offset: 0.45
            },
            { transform: 'translate(0px, 0px) scale(1) rotate(0deg)' }
          ],
          {
            duration: 460,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }
        );
      }
    });
  }, [slots]);

  const findSlotAtPoint = (clientX: number, clientY: number): SlotId | null => {
    for (const slotId of ALL_SLOTS) {
      const el = slotRefs.current[slotId];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return slotId;
      }
    }
    return null;
  };

  const triggerFlashAndFlip = (cardId: MonteCard['id']) => {
    setFlashingCardId(cardId);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashingCardId(null);
    }, 450);

    setFlippedMap((prev) => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const dist = Math.hypot(e.clientX - session.startX, e.clientY - session.startY);
      if (!session.isDragging && dist > 6) {
        session.isDragging = true;
      }

      if (session.isDragging) {
        setDragPreview({
          cardId: session.cardId,
          sourceSlot: session.sourceSlot,
          x: e.clientX - session.offsetX,
          y: e.clientY - session.offsetY,
          offsetX: session.offsetX,
          offsetY: session.offsetY,
          width: session.width,
          height: session.height
        });
        setHoveredSlot(findSlotAtPoint(e.clientX, e.clientY));
      }
    };

    const finishPointer = (e: PointerEvent, cancelled: boolean) => {
      const session = dragSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;
      dragSessionRef.current = null;

      if (session.isDragging) {
        const targetSlot = !cancelled ? findSlotAtPoint(e.clientX, e.clientY) : null;
        if (targetSlot && targetSlot !== session.sourceSlot) {
          const rects = captureCurrentCardRects(session.cardId, {
            left: e.clientX - session.offsetX,
            top: e.clientY - session.offsetY
          });
          pendingFlipRef.current = {
            rects,
            draggedCardId: session.cardId
          };

          setSwappedSlots([session.sourceSlot, targetSlot]);
          if (swapGlowTimerRef.current) window.clearTimeout(swapGlowTimerRef.current);
          swapGlowTimerRef.current = window.setTimeout(() => {
            setSwappedSlots([]);
          }, 560);

          setSlots((prev) => {
            const next = { ...prev };
            const displaced = next[targetSlot];
            next[targetSlot] = session.cardId;
            next[session.sourceSlot] = displaced ?? null;
            return next;
          });
        }
        setDragPreview(null);
        setHoveredSlot(null);
      } else if (!cancelled) {
        // Click / Tap -> Detect Double Click / Double Tap for Flash & Flip
        const now = Date.now();
        const prevTap = lastTapRef.current[session.cardId] || 0;
        if (now - prevTap <= 360) {
          lastTapRef.current[session.cardId] = 0;
          triggerFlashAndFlip(session.cardId);
        } else {
          lastTapRef.current[session.cardId] = now;
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => finishPointer(e, false);
    const handlePointerCancel = (e: PointerEvent) => finishPointer(e, true);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, []);

  const handleCardPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    cardId: MonteCard['id'],
    sourceSlot: SlotId
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    dragSessionRef.current = {
      pointerId: e.pointerId,
      cardId,
      sourceSlot,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      isDragging: false
    };
  };

  const handleReset = () => {
    pendingFlipRef.current = {
      rects: captureCurrentCardRects()
    };
    setSlots({ ...INITIAL_SLOTS });
    setFlippedMap({});
    setFlashingCardId(null);
    setDragPreview(null);
    setHoveredSlot(null);
    setSwappedSlots([]);
  };

  const renderCardBody = (card: MonteCard, isFlipped: boolean, isFlashing: boolean) => (
    <div className="w-full h-full relative [perspective:900px]">
      <div
        className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
          isFlipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* Back Side */}
        <div className="absolute inset-0 [backface-visibility:hidden] rounded-lg sm:rounded-xl overflow-hidden bg-white border border-slate-200 shadow-[0_6px_18px_rgba(0,0,0,0.55)]">
          <img
            src={BACK_CARD_IMAGE}
            alt="তাসের ব্যাক সাইড"
            draggable={false}
            className="w-full h-full object-cover pointer-events-none select-none"
          />
        </div>

        {/* Front Side */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-lg sm:rounded-xl bg-white border border-slate-200 p-1 sm:p-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.5)]">
          <div
            className={`w-full h-full rounded-md sm:rounded-lg border border-slate-300/85 relative flex items-center justify-center font-card-characters ${
              card.isRed ? 'text-red-600' : 'text-neutral-950'
            }`}
          >
            {/* Top-Left Corner */}
            <div className="absolute top-1 left-1 sm:top-1.5 sm:left-1.5 flex flex-col items-center gap-[1px] sm:gap-0.5 leading-[0.92] font-card-characters">
              <span className="text-xs min-[400px]:text-sm sm:text-lg leading-[0.92] font-card-characters">
                {card.fontRank}
              </span>
              <span className="text-[10px] min-[400px]:text-xs sm:text-base leading-[0.92] font-card-characters">
                {card.fontSuit}
              </span>
            </div>

            {/* Center Playing Card Rank + Suit */}
            <div className="flex items-center justify-center gap-0.5 text-[28px] min-[400px]:text-[34px] sm:text-[46px] leading-none font-card-characters">
              <span className="font-card-characters">{card.fontRank}</span>
              <span className="font-card-characters">{card.fontSuit}</span>
            </div>

            {/* Bottom-Right Inverted Corner */}
            <div className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 flex flex-col items-center gap-[1px] sm:gap-0.5 leading-[0.92] rotate-180 font-card-characters">
              <span className="text-xs min-[400px]:text-sm sm:text-lg leading-[0.92] font-card-characters">
                {card.fontRank}
              </span>
              <span className="text-[10px] min-[400px]:text-xs sm:text-base leading-[0.92] font-card-characters">
                {card.fontSuit}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Flash Burst Overlay on Double Click */}
      {isFlashing && (
        <div
          aria-hidden="true"
          className="absolute -inset-1 rounded-xl bg-gradient-to-br from-white via-amber-200 to-white pointer-events-none animate-clock-flash z-20 shadow-[0_0_26px_rgba(255,255,255,0.95)]"
        />
      )}
    </div>
  );

  const renderSlot = (slotId: SlotId) => {
    const cardId = slots[slotId];
    const card = cardId ? CARDS_BY_ID[cardId] : null;
    const isBeingDragged = Boolean(dragPreview && dragPreview.sourceSlot === slotId);
    const isHovered = Boolean(hoveredSlot === slotId && dragPreview && dragPreview.sourceSlot !== slotId);
    const isSwappedNow = swappedSlots.includes(slotId);

    return (
      <div
        key={slotId}
        ref={(el) => {
          slotRefs.current[slotId] = el;
        }}
        className={`w-full aspect-[5/7] rounded-xl sm:rounded-2xl border-2 p-1 sm:p-1.5 transition-all duration-200 relative ${
          isHovered
            ? 'border-amber-400 bg-amber-400/15 scale-[1.03] shadow-[0_0_24px_rgba(251,191,36,0.4)]'
            : isBeingDragged
              ? 'border-amber-400/50 border-dashed bg-amber-400/5'
              : isSwappedNow
                ? 'border-emerald-400/85 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                : 'border-neutral-700/90 bg-[#111120]/70 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55)]'
        }`}
      >
        {card && (
          <div
            ref={(el) => {
              cardRefs.current[card.id] = el;
            }}
            role="button"
            tabIndex={0}
            aria-label={`তাস ${card.label}`}
            onPointerDown={(e) => handleCardPointerDown(e, card.id, slotId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerFlashAndFlip(card.id);
              }
            }}
            className={`w-full h-full cursor-grab active:cursor-grabbing touch-none select-none focus:outline-none transition-all duration-200 ${
              isBeingDragged
                ? 'opacity-15 scale-95'
                : isHovered
                  ? '-translate-y-2 scale-[0.94] opacity-85'
                  : 'opacity-100'
            }`}
          >
            {renderCardBody(
              card,
              Boolean(flippedMap[card.id]),
              flashingCardId === card.id
            )}
          </div>
        )}
      </div>
    );
  };

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
            src="/assets/aistudio/df_e0688293.png"
            alt={title || 'ইস্কাপনের টেক্কা'}
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

      {/* 3 Side-by-Side Bicycle Playing Card Borders */}
      <div className="max-w-[330px] min-[400px]:max-w-[370px] sm:max-w-[450px] md:max-w-[490px] mx-auto pt-2 pb-2">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 items-center justify-items-center">
          {renderSlot('left')}
          {renderSlot('center')}
          {renderSlot('right')}
        </div>
      </div>

      {/* Reset Control */}
      <div className="flex justify-center pb-3">
        <button
          type="button"
          onClick={handleReset}
          className="bg-[#1b1b38] hover:bg-purple-900/50 text-purple-100 border border-purple-500/40 px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RotateCcw size={13} /> রিসেট করুন
        </button>
      </div>

      {/* Floating Drag Preview */}
      {dragPreview && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: dragPreview.x,
            top: dragPreview.y,
            width: dragPreview.width,
            height: dragPreview.height,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: 'scale(1.06)'
          }}
          className="drop-shadow-[0_18px_28px_rgba(0,0,0,0.75)]"
        >
          {renderCardBody(
            CARDS_BY_ID[dragPreview.cardId],
            Boolean(flippedMap[dragPreview.cardId]),
            false
          )}
        </div>
      )}
    </div>
  );
}
