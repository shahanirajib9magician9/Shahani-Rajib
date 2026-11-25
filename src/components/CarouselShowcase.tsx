import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles } from 'lucide-react';

export type SliderStyleType = 'classic' | 'coverflow' | 'stunning' | 'curved' | 'orbit';

export const SLIDER_STYLE_OPTIONS: {
  id: SliderStyleType;
  label: string;
  desc: string;
}[] = [
  { id: 'classic', label: 'Classic Slider', desc: 'সাধারণ ১টি করে স্লাইড' },
  { id: 'coverflow', label: '3D Coverflow Carousel', desc: 'মাঝের কার্ড সামনে ও পাশে ৩ডি কভারফ্লো' },
  { id: 'stunning', label: 'Stunning Carousels', desc: 'সিনেম্যাটিক স্পটলাইট ও থাম্বনেইল প্রিভিউ' },
  { id: 'curved', label: '3D Curved Image Slider', desc: 'বাঁকানো ৩ডি গ্যালারি আর্ক' },
  { id: 'orbit', label: '3D Orbit Carousel', desc: '৩ডি অরবিট রিংয়ে ঘূর্ণায়মান স্লাইডার' }
];

interface CarouselShowcaseProps {
  mode: 'image' | 'video';
  styleType: SliderStyleType;
  slides: string[];
  activeIndex: number;
  onChangeIndex: (nextIdx: number) => void;
  normalizeImageUrl: (url: string) => string;
  getVideoEmbedUrl: (url: string) => string;
  onOpenLightbox?: (url: string) => void;
  frameOpts?: { posY?: number; aspectHeight?: number | null; zoom?: number };
  label: string;
  targetKey: string;
  onVideoIframeRef?: (el: HTMLIFrameElement | null) => void;
  onVideoIframeLoad?: (el: HTMLIFrameElement) => void;
  onVideoNavigate?: () => void;
}

function getCircularOffset(index: number, active: number, total: number): number {
  if (total <= 1) return 0;
  let diff = index - active;
  const half = total / 2;
  if (diff > half) diff -= total;
  if (diff < -half) diff += total;
  return diff;
}

export default function CarouselShowcase({
  mode,
  styleType,
  slides,
  activeIndex,
  onChangeIndex,
  normalizeImageUrl,
  getVideoEmbedUrl,
  onOpenLightbox,
  frameOpts,
  label,
  targetKey,
  onVideoIframeRef,
  onVideoIframeLoad,
  onVideoNavigate
}: CarouselShowcaseProps) {
  const total = slides.length;
  const safeIdx = total > 0 ? ((activeIndex % total) + total) % total : 0;
  const [autoOrbit, setAutoOrbit] = useState<boolean>(mode === 'image' && styleType === 'orbit');
  const [orbitPaused, setOrbitPaused] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setAutoOrbit(mode === 'image' && styleType === 'orbit');
  }, [mode, styleType]);

  useEffect(() => {
    if (styleType !== 'orbit' || !autoOrbit || orbitPaused || total <= 1 || mode === 'video') return;
    const id = window.setInterval(() => {
      onChangeIndex((safeIdx + 1) % total);
    }, 3200);
    return () => window.clearInterval(id);
  }, [styleType, autoOrbit, orbitPaused, total, mode, safeIdx, onChangeIndex]);

  if (total === 0) return null;

  const posY = typeof frameOpts?.posY === 'number' ? frameOpts.posY : 50;
  const zoom = typeof frameOpts?.zoom === 'number' ? frameOpts.zoom : 100;

  const goPrev = () => {
    if (mode === 'video') onVideoNavigate?.();
    onChangeIndex((safeIdx - 1 + total) % total);
  };

  const goNext = () => {
    if (mode === 'video') onVideoNavigate?.();
    onChangeIndex((safeIdx + 1) % total);
  };

  const goTo = (idx: number) => {
    if (idx === safeIdx) return;
    if (mode === 'video') onVideoNavigate?.();
    onChangeIndex(((idx % total) + total) % total);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || total <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 42) {
      if (dx > 0) goPrev();
      else goNext();
    }
  };

  const renderSlideMedia = (rawUrl: string, idx: number, isActive: boolean, compactOverlay?: boolean) => {
    if (mode === 'image') {
      const resolved = normalizeImageUrl(rawUrl);
      return (
        <img
          src={resolved}
          alt={`${label} ${idx + 1}`}
          referrerPolicy="no-referrer"
          draggable={false}
          onClick={(e) => {
            if (isActive && onOpenLightbox) {
              e.stopPropagation();
              onOpenLightbox(resolved);
            }
          }}
          className="w-full h-full object-cover select-none block"
          style={{
            objectPosition: `50% ${posY}%`,
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: zoom < 100 ? '50% 50%' : `50% ${posY}%`
          }}
        />
      );
    }

    if (!isActive) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#1b1538] via-[#110f24] to-[#0a0918] flex items-center justify-center p-3 text-center select-none">
          <div className="w-11 h-11 rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.3)]">
            <Play size={18} className="ml-0.5" />
          </div>
        </div>
      );
    }

    return (
      <iframe
        ref={(el) => onVideoIframeRef?.(el)}
        data-video-slider={targetKey}
        onLoad={(e) => onVideoIframeLoad?.(e.currentTarget)}
        src={getVideoEmbedUrl(rawUrl)}
        title={`${label} ${idx + 1}`}
        className="w-full h-full border-0 bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  };

  // 1. 3D COVERFLOW CAROUSEL
  if (styleType === 'coverflow') {
    return (
      <div
        className="w-full max-w-4xl mx-auto rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#13132b] via-[#0e0d22] to-[#090916] p-3 sm:p-5 shadow-[0_0_32px_rgba(120,50,255,0.24)] overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative w-full h-[230px] min-[420px]:h-[270px] sm:h-[340px] flex items-center justify-center overflow-hidden"
          style={{ perspective: '1100px' }}
        >
          {slides.map((rawUrl, idx) => {
            const offset = getCircularOffset(idx, safeIdx, total);
            const absOffset = Math.abs(offset);
            if (absOffset > 2 && total > 5) return null;
            const isActive = offset === 0;
            const rotateY = offset === 0 ? 0 : offset < 0 ? 38 : -38;
            const translateX = offset * 52;
            const translateZ = isActive ? 45 : -absOffset * 115;
            const scale = isActive ? 1 : Math.max(0.68, 1 - absOffset * 0.16);
            const opacity = isActive ? 1 : Math.max(0.32, 1 - absOffset * 0.3);
            const zIndex = 30 - absOffset * 5;

            return (
              <div
                key={`${targetKey}_cf_${idx}`}
                onClick={() => (!isActive ? goTo(idx) : undefined)}
                className={`absolute transition-all ${mode === 'video' ? 'duration-1000' : 'duration-500'} ease-[cubic-bezier(0.22,1,0.36,1)] rounded-2xl overflow-hidden ${
                  mode === 'video'
                    ? 'w-[78%] sm:w-[62%] aspect-video'
                    : 'w-[62%] min-[420px]:w-[52%] sm:w-[44%] h-[190px] min-[420px]:h-[230px] sm:h-[295px]'
                } ${
                  isActive
                    ? 'border-2 border-amber-400/80 shadow-[0_22px_50px_rgba(0,0,0,0.75),0_0_25px_rgba(245,158,11,0.28)] cursor-pointer'
                    : 'border border-purple-500/40 shadow-[0_14px_30px_rgba(0,0,0,0.65)] cursor-pointer hover:border-amber-300/60'
                }`}
                style={{
                  transform: `translate3d(${translateX}%, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex
                }}
              >
                {renderSlideMedia(rawUrl, idx, isActive)}
              </div>
            );
          })}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous slide"
                className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-40 bg-black/75 hover:bg-amber-500 hover:text-black text-amber-300 border border-purple-500/50 p-2 rounded-full transition-all shadow-lg cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next slide"
                className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-40 bg-black/75 hover:bg-amber-500 hover:text-black text-amber-300 border border-purple-500/50 p-2 rounded-full transition-all shadow-lg cursor-pointer"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  safeIdx === i ? 'w-6 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'w-2 bg-white/30 hover:bg-white/55'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 2. STUNNING CAROUSELS
  if (styleType === 'stunning') {
    return (
      <div
        className="w-full max-w-4xl mx-auto rounded-3xl border border-purple-500/45 bg-gradient-to-br from-[#161334] via-[#100e26] to-[#0b0a1a] p-2.5 sm:p-4 shadow-[0_0_35px_rgba(120,50,255,0.26)] space-y-3 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative rounded-2xl overflow-hidden border border-purple-500/35 bg-black/50 shadow-inner">
          <div
            key={`${targetKey}_stun_${safeIdx}`}
            className={`w-full transition-all ${
              mode === 'video'
                ? 'duration-1000 animate-video-slide aspect-video'
                : 'duration-500 animate-video-slide h-[230px] min-[420px]:h-[290px] sm:h-[380px]'
            }`}
          >
            {renderSlideMedia(slides[safeIdx], safeIdx, true)}
          </div>

          {mode !== 'video' && (
            <>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-200 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-amber-400/30">
                  <Sparkles size={12} className="text-amber-400" />
                  {safeIdx + 1} / {total}
                </span>
              </div>
            </>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous slide"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-amber-500 hover:text-black text-amber-300 border border-amber-400/40 p-2 rounded-full transition-all shadow-lg cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next slide"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-amber-500 hover:text-black text-amber-300 border border-amber-400/40 p-2 rounded-full transition-all shadow-lg cursor-pointer"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 px-1">
            {slides.map((rawUrl, i) => {
              const isSelected = i === safeIdx;
              return (
                <button
                  key={`${targetKey}_thumb_${i}`}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    mode === 'video' ? 'w-20 h-12 sm:w-24 sm:h-14' : 'w-14 h-14 sm:w-16 sm:h-16'
                  } ${
                    isSelected
                      ? 'border-amber-400 scale-105 shadow-[0_0_14px_rgba(245,158,11,0.55)]'
                      : 'border-purple-500/30 opacity-60 hover:opacity-95'
                  }`}
                >
                  {mode === 'image' ? (
                    <img
                      src={normalizeImageUrl(rawUrl)}
                      alt={`Thumb ${i + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1a1638] flex items-center justify-center text-amber-300">
                      <Play size={16} className="ml-0.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 3. 3D CURVED IMAGE / VIDEO SLIDER
  if (styleType === 'curved') {
    return (
      <div
        className="w-full max-w-4xl mx-auto rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#13122b] via-[#0d0c20] to-[#080814] p-3 sm:p-5 shadow-[0_0_32px_rgba(120,50,255,0.24)] overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative w-full h-[230px] min-[420px]:h-[270px] sm:h-[340px] flex items-center justify-center overflow-hidden"
          style={{ perspective: '1250px' }}
        >
          {slides.map((rawUrl, idx) => {
            const offset = getCircularOffset(idx, safeIdx, total);
            const absOffset = Math.abs(offset);
            if (absOffset > 2 && total > 5) return null;
            const isActive = offset === 0;
            // Curved panoramic arc: outer slides angle toward the center and rise slightly forward
            const rotateY = offset * -24;
            const translateX = offset * 60;
            const translateZ = absOffset * 55 - 40;
            const scale = isActive ? 0.96 : 1 + absOffset * 0.04;
            const opacity = isActive ? 1 : Math.max(0.45, 1 - absOffset * 0.22);
            const zIndex = 20 + absOffset * 2 + (isActive ? 12 : 0);

            return (
              <div
                key={`${targetKey}_curved_${idx}`}
                onClick={() => (!isActive ? goTo(idx) : undefined)}
                className={`absolute transition-all ${mode === 'video' ? 'duration-1000' : 'duration-500'} ease-[cubic-bezier(0.22,1,0.36,1)] rounded-2xl overflow-hidden ${
                  mode === 'video'
                    ? 'w-[74%] sm:w-[58%] aspect-video'
                    : 'w-[58%] min-[420px]:w-[48%] sm:w-[40%] h-[185px] min-[420px]:h-[225px] sm:h-[285px]'
                } ${
                  isActive
                    ? 'border-2 border-cyan-400/80 shadow-[0_18px_45px_rgba(0,0,0,0.8),0_0_24px_rgba(34,211,238,0.28)] cursor-pointer'
                    : 'border border-purple-500/45 shadow-[0_16px_36px_rgba(0,0,0,0.7)] cursor-pointer hover:border-cyan-300/70'
                }`}
                style={{
                  transform: `translate3d(${translateX}%, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex
                }}
              >
                {renderSlideMedia(rawUrl, idx, isActive)}
              </div>
            );
          })}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous slide"
                className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-40 bg-black/75 hover:bg-cyan-400 hover:text-black text-cyan-200 border border-cyan-400/45 p-2 rounded-full transition-all shadow-lg cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next slide"
                className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-40 bg-black/75 hover:bg-cyan-400 hover:text-black text-cyan-200 border border-cyan-400/45 p-2 rounded-full transition-all shadow-lg cursor-pointer"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  safeIdx === i ? 'w-6 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'w-2 bg-white/30 hover:bg-white/55'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 4. 3D ORBIT CAROUSEL
  const visibleOrbitIndices = slides.map((_, idx) => idx);
  const angleStep = 360 / Math.max(total, 1);

  return (
    <div
      className="w-full max-w-4xl mx-auto rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#151232] via-[#0e0c22] to-[#080714] p-3 sm:p-5 shadow-[0_0_32px_rgba(120,50,255,0.25)] overflow-hidden select-none"
      onMouseEnter={() => setOrbitPaused(true)}
      onMouseLeave={() => setOrbitPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="relative w-full h-[245px] min-[420px]:h-[285px] sm:h-[350px] flex items-center justify-center overflow-hidden"
        style={{ perspective: '1100px' }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute w-[86%] h-[90px] sm:h-[115px] bottom-5 rounded-[100%] border border-purple-500/25 shadow-[inset_0_0_30px_rgba(168,85,247,0.18)]"
          style={{ transform: 'rotateX(76deg)' }}
        />

        {visibleOrbitIndices.map((idx) => {
          const offset = getCircularOffset(idx, safeIdx, total);
          const angleDeg = offset * angleStep;
          const angleRad = (angleDeg * Math.PI) / 180;
          const sinVal = Math.sin(angleRad);
          const cosVal = Math.cos(angleRad);
          const isActive = offset === 0;
          const translateX = sinVal * 108;
          const translateY = -cosVal * 12 + 8;
          const translateZ = cosVal * 130 - 60;
          const scale = 0.62 + ((cosVal + 1) / 2) * 0.42;
          const opacity = Math.max(0.28, 0.35 + ((cosVal + 1) / 2) * 0.65);
          const zIndex = Math.round(((cosVal + 1) / 2) * 40);

          return (
            <div
              key={`${targetKey}_orbit_${idx}`}
              onClick={() => (!isActive ? goTo(idx) : undefined)}
              className={`absolute transition-all ${mode === 'video' ? 'duration-1000' : 'duration-700'} ease-[cubic-bezier(0.22,1,0.36,1)] rounded-2xl overflow-hidden ${
                mode === 'video'
                  ? 'w-[70%] sm:w-[54%] aspect-video'
                  : 'w-[50%] min-[420px]:w-[42%] sm:w-[36%] h-[175px] min-[420px]:h-[210px] sm:h-[260px]'
              } ${
                isActive
                  ? 'border-2 border-amber-400/85 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_24px_rgba(245,158,11,0.32)] cursor-pointer'
                  : 'border border-purple-500/40 shadow-[0_12px_28px_rgba(0,0,0,0.65)] cursor-pointer hover:border-amber-300/65'
              }`}
              style={{
                transform: `translate3d(${translateX}%, ${translateY}px, ${translateZ}px) rotateY(${sinVal * 26}deg) scale(${scale})`,
                opacity,
                zIndex
              }}
            >
              {renderSlideMedia(slides[idx], idx, isActive, true)}
            </div>
          );
        })}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-50 bg-black/75 hover:bg-amber-500 hover:text-black text-amber-300 border border-purple-500/50 p-2 rounded-full transition-all shadow-lg cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-50 bg-black/75 hover:bg-amber-500 hover:text-black text-amber-300 border border-purple-500/50 p-2 rounded-full transition-all shadow-lg cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {mode === 'image' && (
            <button
              type="button"
              onClick={() => setAutoOrbit((v) => !v)}
              title={autoOrbit ? 'অরবিট থামান' : 'অটো অরবিট চালু করুন'}
              className="bg-purple-900/50 hover:bg-purple-800/70 text-amber-300 border border-purple-500/40 px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              {autoOrbit ? <Pause size={10} /> : <Play size={10} />}
              {autoOrbit ? 'পজ' : 'অরবিট'}
            </button>
          )}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  safeIdx === i ? 'w-6 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'w-2 bg-white/30 hover:bg-white/55'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
