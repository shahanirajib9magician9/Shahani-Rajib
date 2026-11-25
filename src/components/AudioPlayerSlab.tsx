import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Music, Pause, Play, RefreshCw, Square, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerSlabProps {
  blockId: string;
  link: string;
  title?: string;
}

function normalizeAudioSourceInput(rawInput: string): {
  playSrc: string;
  drivePreviewUrl: string | null;
  directUrl: string | null;
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return { playSrc: '', drivePreviewUrl: null, directUrl: null };
  }

  // Local workspace asset path
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { playSrc: trimmed, drivePreviewUrl: null, directUrl: trimmed };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^\/\/\S+/.test(trimmed)
      ? `https:${trimmed}`
      : `https://${trimmed}`;

  const driveFileMatch = withProtocol.match(/drive\.google\.com\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i);
  const driveIdMatch = withProtocol.match(
    /(?:drive\.google\.com|drive\.usercontent\.google\.com)\/[^\s]*[?&]id=([a-zA-Z0-9_-]+)/i
  );
  const driveId = driveFileMatch?.[1] || driveIdMatch?.[1] || null;

  return {
    playSrc: `/api/audio-stream?url=${encodeURIComponent(withProtocol)}`,
    drivePreviewUrl: driveId ? `https://drive.google.com/file/d/${driveId}/preview` : null,
    directUrl: withProtocol
  };
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const AudioPlayerSlab: React.FC<AudioPlayerSlabProps> = ({ link, title }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const { playSrc, drivePreviewUrl, directUrl } = useMemo(
    () => normalizeAudioSourceInput(link),
    [link]
  );

  const effectiveSrc = useMemo(() => {
    if (!playSrc) return '';
    if (reloadNonce === 0) return playSrc;
    const sep = playSrc.includes('?') ? '&' : '?';
    return `${playSrc}${sep}_r=${reloadNonce}`;
  }, [playSrc, reloadNonce]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setErrorMsg(null);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.load();
    }
  }, [effectiveSrc]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = isMuted;
    try {
      el.volume = isMuted ? 0 : volume;
    } catch {
      // Some mobile browsers treat element.volume as read-only
    }
  }, [volume, isMuted]);

  if (!playSrc) return null;

  const trimmedTitle = (title || '').trim();
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const displayVolumePct = Math.round((isMuted ? 0 : volume) * 100);

  const handleTogglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await el.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (val: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(val)) return;
    el.currentTime = val;
    setCurrentTime(val);
  };

  const handleVolumeChange = (nextVol: number) => {
    const clamped = Math.min(1, Math.max(0, Math.round(nextVol * 100) / 100));
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    } else if (clamped === 0) {
      setIsMuted(true);
    }
  };

  const inspectAudioError = async () => {
    setIsPlaying(false);
    setIsLoading(false);
    if (playSrc.startsWith('/api/audio-stream')) {
      try {
        const res = await fetch(playSrc, { headers: { Range: 'bytes=0-1' } });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.error) {
            setErrorMsg(data.error);
            return;
          }
        }
      } catch {
        // Fallback generic message below
      }
    }
    setErrorMsg('অডিও লোড করা যায়নি। গুগল ড্রাইভ ফাইলে "Anyone with the link" (Viewer) পারমিশন আছে কিনা যাচাই করুন।');
  };

  return (
    <div className="w-full bg-[#13132b] border border-purple-500/40 rounded-2xl p-3.5 sm:p-4 shadow-[0_0_22px_rgba(120,50,255,0.18)] space-y-3">
      <audio
        ref={audioRef}
        src={effectiveSrc}
        preload="metadata"
        onLoadStart={() => {
          if (isPlaying) setIsLoading(true);
        }}
        onCanPlay={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
          setIsLoading(false);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime || 0);
        }}
        onError={() => {
          inspectAudioError();
        }}
      />

      {trimmedTitle && (
        <div className="flex items-center gap-2 border-b border-purple-500/25 pb-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600/40 to-amber-500/30 border border-amber-400/40 flex items-center justify-center shrink-0">
            <Music size={14} className="text-amber-300" />
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-amber-300 font-['Aikya','Poppins',sans-serif] leading-snug break-words">
            {trimmedTitle}
          </h3>
        </div>
      )}

      {/* Responsive Elongated Player Bar */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Row 1 on mobile / Left+Center on desktop: Play, Stop & Timeline */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="h-10 px-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 text-black font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.35)] hover:brightness-110 active:scale-95 transition-all shrink-0 cursor-pointer"
            title={isPlaying ? 'পজ করুন' : 'চালান'}
            aria-label={isPlaying ? 'পজ করুন' : 'চালান'}
          >
            {isLoading ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={15} className="fill-current" />
            ) : (
              <Play size={15} className="fill-current" />
            )}
            <span>{isPlaying ? 'পজ' : 'প্লে'}</span>
          </button>

          <button
            type="button"
            onClick={handleStop}
            className="h-10 px-3 rounded-xl bg-[#1b1b38] hover:bg-red-500/20 border border-purple-500/40 hover:border-red-400/60 text-purple-100 hover:text-red-200 font-bold text-xs inline-flex items-center justify-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer"
            title="স্টপ করুন"
            aria-label="স্টপ করুন"
          >
            <Square size={13} className="fill-current" />
            <span>স্টপ</span>
          </button>

          <div className="flex-1 min-w-0 flex flex-col gap-1 px-1">
            <div className="relative w-full h-2.5 flex items-center">
              <div className="w-full h-1.5 bg-[#090915] border border-purple-500/30 rounded-full overflow-hidden pointer-events-none">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-amber-400 rounded-full transition-[width] duration-100"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 100}
                step={0.1}
                value={duration > 0 ? Math.min(currentTime, duration) : 0}
                disabled={duration <= 0}
                onChange={(e) => handleSeek(Number(e.target.value))}
                aria-label="অডিও পজিশন"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-purple-200/80 leading-none">
              <span>{formatAudioTime(currentTime)}</span>
              <span>{duration > 0 ? formatAudioTime(duration) : '--:--'}</span>
            </div>
          </div>
        </div>

        {/* Row 2 on mobile / Right side on desktop: Volume Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 bg-[#0e0e22] border border-purple-500/30 rounded-xl px-2.5 py-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            className="text-amber-300 hover:text-amber-200 p-1 rounded-lg hover:bg-purple-900/40 transition-colors cursor-pointer"
            title={isMuted || volume === 0 ? 'সাউন্ড চালু করুন' : 'মিউট করুন'}
            aria-label={isMuted || volume === 0 ? 'সাউন্ড চালু করুন' : 'মিউট করুন'}
          >
            {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <button
            type="button"
            onClick={() => handleVolumeChange((isMuted ? 0 : volume) - 0.1)}
            className="w-6 h-6 rounded-md bg-[#1b1b38] hover:bg-purple-700/60 border border-purple-500/30 text-purple-100 text-xs font-extrabold flex items-center justify-center cursor-pointer"
            title="ভলিউম কমান"
            aria-label="ভলিউম কমান"
          >
            -
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            aria-label="ভলিউম"
            className="w-24 sm:w-20 accent-amber-400 cursor-pointer"
          />

          <button
            type="button"
            onClick={() => handleVolumeChange((isMuted ? 0 : volume) + 0.1)}
            className="w-6 h-6 rounded-md bg-[#1b1b38] hover:bg-purple-700/60 border border-purple-500/30 text-purple-100 text-xs font-extrabold flex items-center justify-center cursor-pointer"
            title="ভলিউম বাড়ান"
            aria-label="ভলিউম বাড়ান"
          >
            +
          </button>

          <span className="text-[10px] font-mono text-amber-300 font-bold w-8 text-right select-none">
            {displayVolumePct}%
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-red-200">
          <span>{errorMsg}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setReloadNonce((n) => n + 1);
              }}
              className="bg-purple-700/60 hover:bg-purple-600 text-white px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1"
            >
              <RefreshCw size={11} /> আবার চেষ্টা
            </button>
            {(drivePreviewUrl || directUrl) && (
              <a
                href={drivePreviewUrl || directUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-amber-500 text-black px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1"
              >
                <ExternalLink size={11} /> ওপেন করুন
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayerSlab;
