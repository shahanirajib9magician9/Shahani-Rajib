import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

interface HtmlCodeSlabProps {
  blockId: string;
  link: string;
  title?: string;
}

type InputMode =
  | { kind: 'empty' }
  | { kind: 'raw-html'; html: string }
  | { kind: 'local-path'; path: string }
  | { kind: 'remote-url'; url: string; isGoogleDriveOrDoc: boolean };

function normalizeRawHtmlCode(raw: string): string {
  let out = raw.replace(/^\uFEFF/, '').trim();

  const fenceMatch = out.match(/^```(?:html?|xml)?\s*\r?\n([\s\S]*?)\r?\n?```$/i);
  if (fenceMatch && fenceMatch[1]) {
    out = fenceMatch[1].trim();
  }
  if (/^html\s*\r?\n\s*(?:<!doctype|<html|<head|<body|<div|<style|<script)/i.test(out)) {
    out = out.replace(/^html\s*\r?\n\s*/i, '').trim();
  }

  // Convert MS Word / Google Docs smart quotes & broken dashes inside pasted HTML
  out = out
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00A0/g, ' ')
    .replace(/<!—/g, '<!--')
    .replace(/—>/g, '-->')
    .replace(/–>/g, '-->');

  if (
    /^\s*&lt;(?:!doctype|html|head|body|div|section|style|script|h[1-6]|p)\b/i.test(out) &&
    !/(?:<!doctype|<html|<body|<div|<style|<script)\b/i.test(out)
  ) {
    out = out
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&#x27;/gi, "'")
      .replace(/&amp;/g, '&')
      .trim();
  }

  return out;
}

function classifyHtmlInput(rawInput: string): InputMode {
  const trimmed = (rawInput || '').replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { kind: 'empty' };

  const normalized = normalizeRawHtmlCode(trimmed);

  // Explicit fenced or entity-encoded HTML or anything starting with '<'
  if (
    normalized.startsWith('<') ||
    /^```(?:html?|xml)?/i.test(trimmed) ||
    /^\s*&lt;(?:!doctype|html|head|body|div|section|style|script)/i.test(trimmed)
  ) {
    return { kind: 'raw-html', html: normalized };
  }

  // Local path under public/ (e.g. /assets/aistudio/...)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !/\s/.test(trimmed)) {
    return { kind: 'local-path', path: trimmed };
  }

  // Multiline text containing HTML tags -> treat as HTML snippet
  const hasHtmlTags = /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?>/i.test(normalized);
  if (hasHtmlTags && (normalized.includes('\n') || /\s/.test(normalized) || !/^https?:\/\//i.test(normalized))) {
    return { kind: 'raw-html', html: normalized };
  }

  // Single URL (with or without protocol)
  const candidateUrl = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^\/\/\S+/.test(trimmed)
      ? `https:${trimmed}`
      : /^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]\S*)?$/i.test(trimmed)
        ? `https://${trimmed}`
        : '';

  if (candidateUrl) {
    const isGoogleDriveOrDoc = /(?:drive\.google\.com|drive\.usercontent\.google\.com|docs\.google\.com)/i.test(
      candidateUrl
    );
    return { kind: 'remote-url', url: candidateUrl, isGoogleDriveOrDoc };
  }

  // Plain HTML / text fallback
  return { kind: 'raw-html', html: normalized };
}

function injectAutoResizeScript(rawHtml: string, blockId: string): string {
  const safeId = JSON.stringify(blockId);
  const helperScript = `
<script>
(function () {
  var id = ${safeId};
  var lastPosted = 0;
  var rafId = 0;

  function measureIntrinsicHeight() {
    var body = document.body;
    var docEl = document.documentElement;
    if (!body || !docEl) return 0;

    var prevHtmlH = docEl.style.getPropertyValue('height');
    var prevHtmlHPrio = docEl.style.getPropertyPriority('height');
    var prevHtmlMinH = docEl.style.getPropertyValue('min-height');
    var prevHtmlMinHPrio = docEl.style.getPropertyPriority('min-height');
    var prevBodyH = body.style.getPropertyValue('height');
    var prevBodyHPrio = body.style.getPropertyPriority('height');
    var prevBodyMinH = body.style.getPropertyValue('min-height');
    var prevBodyMinHPrio = body.style.getPropertyPriority('min-height');

    docEl.style.setProperty('height', 'auto', 'important');
    docEl.style.setProperty('min-height', '0', 'important');
    body.style.setProperty('height', 'auto', 'important');
    body.style.setProperty('min-height', '0', 'important');

    var cs = window.getComputedStyle(body);
    var mt = parseFloat(cs.marginTop) || 0;
    var mb = parseFloat(cs.marginBottom) || 0;
    var bodyRect = body.getBoundingClientRect();
    var docTop = Math.min(0, docEl.getBoundingClientRect().top);
    var maxBottom = bodyRect.bottom + mb;

    var children = body.children;
    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      var elCs = window.getComputedStyle(el);
      if (elCs.display === 'none' || elCs.position === 'fixed') continue;
      var r = el.getBoundingClientRect();
      var elMb = parseFloat(elCs.marginBottom) || 0;
      if (r.height > 0 || el.scrollHeight > 0) {
        var bottomEdge = r.bottom + elMb;
        if (bottomEdge > maxBottom) maxBottom = bottomEdge;
      }
    }

    var bodyScrollH = body.scrollHeight + mt + mb;
    var measured = Math.max(bodyScrollH, maxBottom - docTop);

    if (prevHtmlH) docEl.style.setProperty('height', prevHtmlH, prevHtmlHPrio);
    else docEl.style.removeProperty('height');
    if (prevHtmlMinH) docEl.style.setProperty('min-height', prevHtmlMinH, prevHtmlMinHPrio);
    else docEl.style.removeProperty('min-height');
    if (prevBodyH) body.style.setProperty('height', prevBodyH, prevBodyHPrio);
    else body.style.removeProperty('height');
    if (prevBodyMinH) body.style.setProperty('min-height', prevBodyMinH, prevBodyMinHPrio);
    else body.style.removeProperty('min-height');

    return Math.max(40, Math.min(12000, Math.ceil(measured)));
  }

  function measureAndPost() {
    try {
      var nextH = measureIntrinsicHeight();
      if (nextH > 0 && Math.abs(nextH - lastPosted) >= 2) {
        lastPosted = nextH;
        window.parent.postMessage({ type: 'shahani-html-slab-resize', id: id, height: nextH }, '*');
      }
    } catch (e) {}
  }

  function scheduleMeasure() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(measureAndPost);
  }

  function attachImageListeners() {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (!imgs[i].complete && !imgs[i].__shahaniBound) {
        imgs[i].__shahaniBound = true;
        imgs[i].addEventListener('load', scheduleMeasure);
        imgs[i].addEventListener('error', scheduleMeasure);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    attachImageListeners();
    scheduleMeasure();
  });
  window.addEventListener('load', function () {
    attachImageListeners();
    scheduleMeasure();
  });
  window.addEventListener('resize', scheduleMeasure);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleMeasure).catch(function () {});
  }

  if (typeof ResizeObserver !== 'undefined' && document.body) {
    new ResizeObserver(scheduleMeasure).observe(document.body);
  }
  if (typeof MutationObserver !== 'undefined' && document.body) {
    new MutationObserver(function () {
      attachImageListeners();
      scheduleMeasure();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  }

  attachImageListeners();
  setTimeout(measureAndPost, 30);
  setTimeout(measureAndPost, 150);
  setTimeout(measureAndPost, 500);
})();
</script>`;

  if (/<\/body>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/body>/i, `${helperScript}\n</body>`);
  }
  if (/<\/html>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/html>/i, `${helperScript}\n</html>`);
  }
  return `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${rawHtml}${helperScript}</body></html>`;
}

export default function HtmlCodeSlab({ blockId, link, title }: HtmlCodeSlabProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [fallbackIframeUrl, setFallbackIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [frameHeight, setFrameHeight] = useState<number>(120);

  const parsedInput = useMemo(() => classifyHtmlInput(link), [link]);

  useEffect(() => {
    let cancelled = false;
    setFallbackIframeUrl(null);

    if (parsedInput.kind === 'empty') {
      setHtmlContent(null);
      setLoading(false);
      setErrorMsg('কোনো HTML কোড, ওয়েব লিংক বা গুগল ড্রাইভ লিংক দেওয়া হয়নি।');
      return;
    }

    if (parsedInput.kind === 'raw-html') {
      setHtmlContent(parsedInput.html);
      setLoading(false);
      setErrorMsg('');
      return;
    }

    const loadRemote = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        if (parsedInput.kind === 'local-path') {
          const res = await fetch(parsedInput.path);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          if (!cancelled) {
            setHtmlContent(normalizeRawHtmlCode(text));
          }
          return;
        }

        const res = await fetch(`/api/fetch-html?url=${encodeURIComponent(parsedInput.url)}`);
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;

        if (!res.ok || !data?.html) {
          // For regular public website links (non-Google-Drive/Docs & non-.docx), fall back to live iframe preview
          const looksLikeDocxUrl = /\.docx?(?:[?#]|$)/i.test(parsedInput.url);
          if (!parsedInput.isGoogleDriveOrDoc && !looksLikeDocxUrl) {
            if (!cancelled) {
              setHtmlContent(null);
              setFallbackIframeUrl(parsedInput.url);
              setErrorMsg('');
            }
            return;
          }
          throw new Error(data?.error || 'HTML / DOCX ফাইলটি লোড করা যায়নি।');
        }

        if (!cancelled) {
          setHtmlContent(data.html);
        }
      } catch (err) {
        if (!cancelled) {
          setHtmlContent(null);
          setErrorMsg(err instanceof Error ? err.message : 'HTML লোড করতে সমস্যা হয়েছে।');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRemote();
    return () => {
      cancelled = true;
    };
  }, [parsedInput, reloadNonce]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'shahani-html-slab-resize' && data.id === blockId && typeof data.height === 'number') {
        const clamped = Math.max(40, Math.min(12000, Math.round(data.height)));
        setFrameHeight(clamped);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [blockId]);

  const srcDocHtml = useMemo(() => {
    if (!htmlContent) return '';
    return injectAutoResizeScript(htmlContent, blockId);
  }, [htmlContent, blockId]);

  useEffect(() => {
    setFrameHeight(120);
  }, [srcDocHtml]);

  const externalHref = parsedInput.kind === 'remote-url' ? parsedInput.url : '';

  return (
    <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-3 sm:p-5 shadow-[0_0_25px_rgba(120,50,255,0.15)] space-y-3">
      {title && (
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-sm sm:text-base font-extrabold text-amber-300 font-['Aikya','Poppins',sans-serif]">
            {title}
          </h3>
          {externalHref && (
            <a
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-purple-900/50 hover:bg-purple-800/70 text-amber-300 border border-purple-500/40 px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1"
            >
              <ExternalLink size={12} /> মূল লিংক
            </a>
          )}
        </div>
      )}

      {loading ? (
        <div className="w-full min-h-[120px] rounded-xl border border-purple-500/25 bg-[#0e0e22] flex items-center justify-center gap-2 text-xs text-purple-200">
          <RefreshCw size={15} className="animate-spin text-amber-300" />
          <span>ওয়েবপেজ / HTML লোড হচ্ছে...</span>
        </div>
      ) : errorMsg ? (
        <div className="w-full rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-center space-y-2.5">
          <p className="text-xs text-red-200">{errorMsg}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3 py-1.5 rounded-xl inline-flex items-center gap-1"
            >
              <RefreshCw size={12} /> আবার চেষ্টা করুন
            </button>
            {externalHref && (
              <a
                href={externalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl inline-flex items-center gap-1"
              >
                <ExternalLink size={12} /> নতুন ট্যাবে খুলুন
              </a>
            )}
          </div>
        </div>
      ) : fallbackIframeUrl ? (
        <div className="w-full rounded-xl overflow-hidden border border-purple-500/30 bg-white shadow-inner">
          <iframe
            src={fallbackIframeUrl}
            title={title || 'Web Page Preview'}
            className="w-full h-[520px] sm:h-[640px] border-0 block"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="w-full rounded-xl overflow-hidden border border-purple-500/30 bg-white shadow-inner">
          <iframe
            srcDoc={srcDocHtml}
            title={title || 'HTML Preview'}
            height={frameHeight}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox"
            className="w-full min-h-[40px] border-0 block transition-[height] duration-150"
          />
        </div>
      )}
    </div>
  );
}
