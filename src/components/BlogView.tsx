import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  Bold,
  Check,
  ClipboardPaste,
  Edit2,
  Image as ImageIcon,
  MoveVertical,
  Palette,
  Plus,
  Trash2,
  Type,
  Video,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import SubpageBackButton from './SubpageBackButton';

export type BlogBlock =
  | {
      id: string;
      type: 'text';
      html: string;
    }
  | {
      id: string;
      type: 'image';
      url: string;
      widthPct?: number;
      aspectHeight?: number | null;
      zoom?: number;
      posX?: number;
      posY?: number;
    }
  | {
      id: string;
      type: 'video';
      url: string;
    };

export interface BlogPostRecord {
  id: string;
  title: string;
  excerpt: string;
  blocks: BlogBlock[];
  published: boolean;
  authorUid?: string;
  createdAtMs: number;
  updatedAtMs: number;
  dateLabel?: string;
}

interface BlogViewProps {
  blogs: BlogPostRecord[];
  isAdmin: boolean;
  homeIconUrl: string;
  homeLabel: string;
  blogIconUrl: string;
  blogLabel: string;
  onBackHome: () => void;
  hideHomeButton?: boolean;
  onSaveBlog: (post: { id?: string; title: string; excerpt: string; blocks: BlogBlock[] }) => Promise<void> | void;
  onDeleteBlog: (blogId: string) => Promise<void> | void;
  onOpenLightbox?: (url: string) => void;
}

function isSafeHttpUrl(url: string): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/assets/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function normalizeBlogImageUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }
  const idMatch = trimmed.match(/(?:drive\.google\.com|drive\.usercontent\.google\.com)\/[^\s]*[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }
  return isSafeHttpUrl(trimmed) ? trimmed : '';
}

export function getBlogVideoEmbedUrl(link: string): string {
  const trimmed = (link || '').trim();
  if (!trimmed || !isSafeHttpUrl(trimmed)) return '';
  if (trimmed.includes('youtube.com/embed/') || trimmed.includes('facebook.com/plugins/video.php')) {
    return trimmed;
  }
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }
  const driveIdMatch = trimmed.match(/(?:drive\.google\.com|drive\.usercontent\.google\.com)\/[^\s]*[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    return `https://drive.google.com/file/d/${driveIdMatch[1]}/preview`;
  }
  if (trimmed.includes('youtube.com/shorts/')) {
    const parts = trimmed.split('youtube.com/shorts/');
    if (parts[1]) {
      const id = parts[1].split(/[?/#&]/)[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  }
  if (trimmed.includes('youtube.com/watch')) {
    const vMatch = trimmed.match(/[?&]v=([^&#]+)/);
    if (vMatch && vMatch[1]) {
      return `https://www.youtube.com/embed/${vMatch[1]}`;
    }
  }
  if (trimmed.includes('youtu.be/')) {
    const parts = trimmed.split('youtu.be/');
    if (parts[1]) {
      const id = parts[1].split(/[?/#&]/)[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  }
  if (trimmed.includes('facebook.com') || trimmed.includes('fb.watch')) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false&width=560`;
  }
  return '';
}

function classifyMediaUrl(rawUrl: string): 'image' | 'video' | null {
  const trimmed = rawUrl.trim();
  if (!isSafeHttpUrl(trimmed)) return null;
  if (
    /youtube\.com\/(watch|shorts|embed)|youtu\.be\/|facebook\.com\/|fb\.watch\//i.test(trimmed)
  ) {
    return 'video';
  }
  if (
    /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?)|lh3\.googleusercontent\.com\/d\//i.test(trimmed) ||
    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmed)
  ) {
    return 'image';
  }
  return null;
}

const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'br',
  'span',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ul',
  'ol',
  'li'
]);

function parseSafeStyle(el: HTMLElement): React.CSSProperties {
  const style: React.CSSProperties = {};
  const rawFontSize = el.style.fontSize?.trim() || '';
  if (/^\d{2,3}%$/.test(rawFontSize)) {
    style.fontSize = rawFontSize;
  } else if (/^\d{1,3}(\.\d+)?px$/.test(rawFontSize)) {
    style.fontSize = rawFontSize;
  }
  const rawColor = el.style.color?.trim() || '';
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(rawColor)
  ) {
    style.color = rawColor;
  }
  const rawAlign = el.style.textAlign?.trim().toLowerCase() || '';
  if (rawAlign === 'left' || rawAlign === 'center' || rawAlign === 'right' || rawAlign === 'justify') {
    style.textAlign = rawAlign;
  }
  const rawWeight = el.style.fontWeight?.trim().toLowerCase() || '';
  if (rawWeight === 'bold' || rawWeight === 'normal' || rawWeight === '600' || rawWeight === '700' || rawWeight === '400') {
    style.fontWeight = rawWeight;
  }
  const tag = el.tagName.toLowerCase();
  if (tag === 'font') {
    const attrColor = el.getAttribute('color')?.trim() || '';
    if (/^#[0-9a-fA-F]{3,8}$/.test(attrColor)) {
      style.color = attrColor;
    }
  }
  if (tag === 'div' || tag === 'p') {
    const alignAttr = el.getAttribute('align')?.trim().toLowerCase() || '';
    if (alignAttr === 'left' || alignAttr === 'center' || alignAttr === 'right' || alignAttr === 'justify') {
      style.textAlign = alignAttr;
    }
  }
  return style;
}

export function sanitizeBlogHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof DOMParser === 'undefined') return rawHtml.replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  const serializeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') return '';

    const childrenHtml = Array.from(el.childNodes).map(serializeNode).join('');
    if (tag === 'br') return '<br>';

    const safeTag = tag === 'font' ? 'span' : ALLOWED_TAGS.has(tag) ? tag : 'span';
    const css = parseSafeStyle(el);
    const styleParts: string[] = [];
    if (css.fontSize) styleParts.push(`font-size: ${css.fontSize}`);
    if (css.color) styleParts.push(`color: ${css.color}`);
    if (css.textAlign) styleParts.push(`text-align: ${css.textAlign}`);
    if (css.fontWeight) styleParts.push(`font-weight: ${css.fontWeight}`);

    const styleAttr = styleParts.length > 0 ? ` style="${styleParts.join('; ')}"` : '';
    if (safeTag === 'span' && !styleAttr && !ALLOWED_TAGS.has(tag)) {
      return childrenHtml;
    }
    return `<${safeTag}${styleAttr}>${childrenHtml}</${safeTag}>`;
  };

  return Array.from(doc.body.childNodes).map(serializeNode).join('');
}

function htmlToPlainText(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, ' ').trim();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function renderSanitizedRichText(html: string): React.ReactNode {
  if (!html) return null;
  if (typeof DOMParser === 'undefined') return htmlToPlainText(html);
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const walk = (node: Node, key: string): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') return null;
    if (tag === 'br') return <br key={key} />;

    const children = Array.from(el.childNodes).map((child, idx) => walk(child, `${key}_${idx}`));
    const style = parseSafeStyle(el);

    switch (tag) {
      case 'p':
        return (
          <p key={key} style={style} className="mb-2 last:mb-0 leading-relaxed">
            {children}
          </p>
        );
      case 'div':
        return (
          <div key={key} style={style} className="min-h-[1.35em] leading-relaxed">
            {children}
          </div>
        );
      case 'b':
      case 'strong':
        return (
          <strong key={key} style={style} className="font-bold">
            {children}
          </strong>
        );
      case 'i':
      case 'em':
        return (
          <em key={key} style={style} className="italic">
            {children}
          </em>
        );
      case 'u':
        return (
          <u key={key} style={style}>
            {children}
          </u>
        );
      case 'ul':
        return (
          <ul key={key} style={style} className="list-disc pl-5 my-1.5 space-y-1">
            {children}
          </ul>
        );
      case 'ol':
        return (
          <ol key={key} style={style} className="list-decimal pl-5 my-1.5 space-y-1">
            {children}
          </ol>
        );
      case 'li':
        return (
          <li key={key} style={style}>
            {children}
          </li>
        );
      default:
        return (
          <span key={key} style={style}>
            {children}
          </span>
        );
    }
  };

  return Array.from(doc.body.childNodes).map((node, idx) => walk(node, `rn_${idx}`));
}

const MEDIA_URL_REGEX =
  /(https?:\/\/(?:drive\.google\.com|drive\.usercontent\.google\.com|lh3\.googleusercontent\.com|(?:www\.|m\.)?youtube\.com|youtu\.be|(?:www\.|m\.)?facebook\.com|fb\.watch)[^\s<>"']+)/gi;

function splitTextBlockByEmbeddedUrls(blocks: BlogBlock[]): BlogBlock[] {
  const result: BlogBlock[] = [];
  for (const blk of blocks) {
    if (blk.type !== 'text') {
      result.push(blk);
      continue;
    }
    const cleanHtml = sanitizeBlogHtml(blk.html);
    if (!cleanHtml.match(MEDIA_URL_REGEX)) {
      result.push({ ...blk, html: cleanHtml });
      continue;
    }

    // Parse into top-level or inline segments splitting strictly around detected media URLs
    const doc = new DOMParser().parseFromString(cleanHtml, 'text/html');
    let currentHtmlChunk = '';

    const flushTextChunk = () => {
      const sanitized = sanitizeBlogHtml(currentHtmlChunk);
      if (htmlToPlainText(sanitized).length > 0) {
        result.push({
          id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'text',
          html: sanitized
        });
      }
      currentHtmlChunk = '';
    };

    const processTextString = (text: string) => {
      let lastIdx = 0;
      const re = new RegExp(MEDIA_URL_REGEX.source, 'gi');
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        const url = match[1].replace(/[.,;!?)]+$/, '');
        const mediaKind = classifyMediaUrl(url);
        if (!mediaKind) continue;

        const before = text.slice(lastIdx, match.index);
        if (before) {
          currentHtmlChunk += before.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        flushTextChunk();
        if (mediaKind === 'image') {
          result.push({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: 'image',
            url,
            widthPct: 100,
            aspectHeight: null,
            zoom: 100,
            posX: 50,
            posY: 50
          });
        } else {
          result.push({
            id: `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: 'video',
            url
          });
        }
        lastIdx = match.index + url.length;
      }
      const rest = text.slice(lastIdx);
      if (rest) {
        currentHtmlChunk += rest.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    };

    const walkAndSplit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        processTextString(node.textContent || '');
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') {
        currentHtmlChunk += '<br>';
        return;
      }
      const elText = el.textContent || '';
      if (!elText.match(MEDIA_URL_REGEX)) {
        currentHtmlChunk += el.outerHTML;
        return;
      }
      const isBlockWrapper = tag === 'div' || tag === 'p';
      Array.from(el.childNodes).forEach(walkAndSplit);
      if (isBlockWrapper && currentHtmlChunk && !currentHtmlChunk.endsWith('<br>')) {
        currentHtmlChunk += '<br>';
      }
    };

    Array.from(doc.body.childNodes).forEach(walkAndSplit);
    flushTextChunk();
  }
  return result.length > 0 ? result : [{ id: `txt_${Date.now()}`, type: 'text', html: '' }];
}

const FORMAT_COLOR_SWATCHES = [
  { label: 'সাদা', hex: '#f8fafc' },
  { label: 'সোনালী', hex: '#fbbf24' },
  { label: 'আকাশী', hex: '#38bdf8' },
  { label: 'সবুজ', hex: '#34d399' },
  { label: 'গোলাপী', hex: '#fb7185' },
  { label: 'বেগুনি', hex: '#c084fc' },
  { label: 'কমলা', hex: '#fb923c' },
  { label: 'কালো', hex: '#111827' }
];

interface RichTextBlockEditorProps {
  blockId: string;
  html: string;
  placeholder?: string;
  autoFocus?: boolean;
  onFocusBlock: (blockId: string) => void;
  onChangeHtml: (blockId: string, nextHtml: string) => void;
  onInsertMediaFromText: (blockId: string, beforeHtml: string, mediaType: 'image' | 'video', url: string, afterHtml: string) => void;
  onOpenFormatMenu: (payload: {
    blockId: string;
    x: number;
    y: number;
    range: Range | null;
    currentSizePct: number;
    isBold: boolean;
    align: 'left' | 'center' | 'right' | 'justify';
  }) => void;
  registerEditorRef: (blockId: string, el: HTMLDivElement | null) => void;
}

function RichTextBlockEditor({
  blockId,
  html,
  placeholder,
  autoFocus,
  onFocusBlock,
  onChangeHtml,
  onInsertMediaFromText,
  onOpenFormatMenu,
  registerEditorRef
}: RichTextBlockEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastHtmlRef = useRef<string>(html);
  const longPressTimerRef = useRef<number | null>(null);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const lastNonCollapsedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    registerEditorRef(blockId, editorRef.current);
    return () => registerEditorRef(blockId, null);
  }, [blockId, registerEditorRef]);

  useEffect(() => {
    const handleSelChange = () => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      if (el.contains(sel.anchorNode) && !sel.isCollapsed) {
        lastNonCollapsedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener('selectionchange', handleSelChange);
    return () => document.removeEventListener('selectionchange', handleSelChange);
  }, []);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (html !== lastHtmlRef.current && el.innerHTML !== html) {
      el.innerHTML = html;
      lastHtmlRef.current = html;
    }
  }, [html]);

  useEffect(() => {
    const el = editorRef.current;
    if (el && html && el.innerHTML === '') {
      el.innerHTML = html;
      lastHtmlRef.current = html;
    }
    if (autoFocus && el) {
      el.focus();
    }
  }, []);

  const readSelectionFormatState = (): {
    range: Range | null;
    currentSizePct: number;
    isBold: boolean;
    align: 'left' | 'center' | 'right' | 'justify';
  } => {
    const sel = window.getSelection();
    let range: Range | null = null;
    const editorEl = editorRef.current;
    if (sel && sel.rangeCount > 0 && editorEl && editorEl.contains(sel.anchorNode) && !sel.isCollapsed) {
      range = sel.getRangeAt(0).cloneRange();
    } else if (lastNonCollapsedRangeRef.current && editorEl && editorEl.contains(lastNonCollapsedRangeRef.current.commonAncestorContainer)) {
      range = lastNonCollapsedRangeRef.current.cloneRange();
    } else if (sel && sel.rangeCount > 0 && editorEl && editorEl.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0).cloneRange();
    } else if (editorEl) {
      range = document.createRange();
      range.selectNodeContents(editorEl);
      range.collapse(false);
    }

    let currentSizePct = 100;
    let align: 'left' | 'center' | 'right' | 'justify' = 'left';
    let isBold = false;
    try {
      isBold = document.queryCommandState('bold');
    } catch {
      isBold = false;
    }
    if (range) {
      const node =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as HTMLElement)
          : range.commonAncestorContainer.parentElement;
      if (node) {
        let cur: HTMLElement | null = node;
        while (cur && editorEl && editorEl.contains(cur)) {
          if (cur.style?.fontSize && /^\d{2,3}%$/.test(cur.style.fontSize)) {
            currentSizePct = parseInt(cur.style.fontSize, 10) || 100;
            break;
          }
          cur = cur.parentElement;
        }
        const computedAlign = window.getComputedStyle(node).textAlign;
        if (computedAlign === 'center' || computedAlign === 'justify' || computedAlign === 'right') {
          align = computedAlign;
        }
      }
    }
    return { range, currentSizePct, isBold, align };
  };

  const tryDetectCompletedMediaUrl = (triggerOnWhitespace: boolean) => {
    const el = editorRef.current;
    if (!el) return false;
    const rawHtml = el.innerHTML;
    const plain = el.innerText || '';
    const match = plain.match(MEDIA_URL_REGEX);
    if (!match) return false;
    const url = match[0].replace(/[.,;!?)]+$/, '');
    const mediaType = classifyMediaUrl(url);
    if (!mediaType) return false;

    if (triggerOnWhitespace) {
      const idx = plain.indexOf(url);
      const afterChar = plain.slice(idx + url.length, idx + url.length + 1);
      if (!afterChar || !/\s/.test(afterChar)) {
        return false;
      }
    }

    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const urlPos = rawHtml.search(new RegExp(escaped));
    if (urlPos === -1) return false;
    const beforeHtml = sanitizeBlogHtml(rawHtml.slice(0, urlPos));
    const afterHtml = sanitizeBlogHtml(rawHtml.slice(urlPos + url.length).replace(/^(&nbsp;|\s|<br\s*\/?>)+/i, ''));
    onInsertMediaFromText(blockId, beforeHtml, mediaType, url, afterHtml);
    return true;
  };

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    if (tryDetectCompletedMediaUrl(true)) return;
    const next = el.innerHTML;
    lastHtmlRef.current = next;
    onChangeHtml(blockId, next);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedText = e.clipboardData?.getData('text/plain')?.trim() || '';
    if (!pastedText) return;

    const singleMediaKind = !/\s/.test(pastedText) ? classifyMediaUrl(pastedText) : null;
    if (singleMediaKind) {
      e.preventDefault();
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      let beforeHtml = el.innerHTML;
      let afterHtml = '';
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(el);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        const beforeFrag = beforeRange.cloneContents();
        const beforeDiv = document.createElement('div');
        beforeDiv.appendChild(beforeFrag);
        beforeHtml = sanitizeBlogHtml(beforeDiv.innerHTML);

        const afterRange = document.createRange();
        afterRange.selectNodeContents(el);
        afterRange.setStart(range.endContainer, range.endOffset);
        const afterFrag = afterRange.cloneContents();
        const afterDiv = document.createElement('div');
        afterDiv.appendChild(afterFrag);
        afterHtml = sanitizeBlogHtml(afterDiv.innerHTML);
      }
      onInsertMediaFromText(blockId, beforeHtml, singleMediaKind, pastedText, afterHtml);
      return;
    }

    // Paste plain clean text at selection
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    handleInput();
  };

  const triggerContextFormatting = (x: number, y: number) => {
    const state = readSelectionFormatState();
    onOpenFormatMenu({
      blockId,
      x,
      y,
      range: state.range,
      currentSizePct: state.currentSizePct,
      isBold: state.isBold,
      align: state.align
    });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onFocusBlock(blockId);
    triggerContextFormatting(e.clientX, e.clientY);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onFocusBlock(blockId);
    if (e.pointerType !== 'touch') return;
    pressOriginRef.current = { x: e.clientX, y: e.clientY };
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    const clientX = e.clientX;
    const clientY = e.clientY;
    longPressTimerRef.current = window.setTimeout(() => {
      triggerContextFormatting(clientX, clientY);
    }, 520);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pressOriginRef.current || !longPressTimerRef.current) return;
    const dist = Math.hypot(e.clientX - pressOriginRef.current.x, e.clientY - pressOriginRef.current.y);
    if (dist > 10) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const isEmpty = !html || htmlToPlainText(html).length === 0;

  return (
    <div className="relative">
      {isEmpty && placeholder && (
        <div className="pointer-events-none absolute top-3 left-3.5 text-xs sm:text-sm text-purple-300/40 select-none">
          {placeholder}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => onFocusBlock(blockId)}
        onInput={handleInput}
        onPaste={handlePaste}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        className="min-h-[120px] w-full bg-[#12122a] border border-purple-500/35 focus:border-amber-400/75 rounded-xl p-3.5 text-sm sm:text-base text-purple-50 leading-relaxed focus:outline-none transition-colors break-words"
      />
    </div>
  );
}

interface ResizableBlogImageEditorProps {
  block: Extract<BlogBlock, { type: 'image' }>;
  onChange: (updated: Extract<BlogBlock, { type: 'image' }>) => void;
  onRemove: () => void;
}

function ResizableBlogImageEditor({ block, onChange, onRemove }: ResizableBlogImageEditorProps) {
  const widthPct = typeof block.widthPct === 'number' ? Math.min(100, Math.max(25, block.widthPct)) : 100;
  const zoom = typeof block.zoom === 'number' ? Math.min(250, Math.max(50, block.zoom)) : 100;
  const posX = typeof block.posX === 'number' ? Math.min(100, Math.max(0, block.posX)) : 50;
  const posY = typeof block.posY === 'number' ? Math.min(100, Math.max(0, block.posY)) : 50;
  const aspectHeight = typeof block.aspectHeight === 'number' && block.aspectHeight > 0 ? block.aspectHeight : null;
  const hasCustomCrop = Boolean(aspectHeight || posX !== 50 || posY !== 50);

  const outerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    mode: 'width' | 'height' | 'corner' | 'pan';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startPosX: number;
    startPosY: number;
    parentWidth: number;
    containerHeight: number;
  } | null>(null);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (drag.mode === 'width') {
        const nextW = Math.round(Math.min(100, Math.max(25, drag.startW + (dx / Math.max(drag.parentWidth, 160)) * 100)));
        onChange({ ...block, widthPct: nextW });
      } else if (drag.mode === 'height') {
        const nextH = Math.round(Math.min(1200, Math.max(180, drag.startH + dy * 1.6)));
        onChange({ ...block, aspectHeight: nextH });
      } else if (drag.mode === 'corner') {
        const nextW = Math.round(Math.min(100, Math.max(25, drag.startW + (dx / Math.max(drag.parentWidth, 160)) * 100)));
        const nextH = Math.round(Math.min(1200, Math.max(180, drag.startH + dy * 1.6)));
        onChange({ ...block, widthPct: nextW, aspectHeight: nextH });
      } else if (drag.mode === 'pan') {
        const nextPosX = Math.round(Math.min(100, Math.max(0, drag.startPosX - (dx / Math.max(drag.parentWidth, 120)) * 100)));
        const nextPosY = Math.round(Math.min(100, Math.max(0, drag.startPosY - (dy / Math.max(drag.containerHeight, 120)) * 100)));
        onChange({ ...block, posX: nextPosX, posY: nextPosY });
      }
    };

    const onPointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [block, onChange]);

  const resolvedUrl = normalizeBlogImageUrl(block.url);

  return (
    <div ref={outerRef} className="bg-[#141430] border border-purple-500/40 rounded-2xl p-2.5 sm:p-3 space-y-2.5">
      {/* Compact Image Controls: Zoom In/Out + Reset + Delete */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onChange({ ...block, zoom: Math.max(50, zoom - 10) })}
            className="bg-[#1e1e42] hover:bg-purple-900/60 text-purple-100 border border-purple-500/35 px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            title="জুম আউট"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-[11px] font-mono tabular-nums text-amber-300 font-bold min-w-[40px] text-center">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...block, zoom: Math.min(250, zoom + 10) })}
            className="bg-[#1e1e42] hover:bg-purple-900/60 text-purple-100 border border-purple-500/35 px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            title="জুম ইন"
          >
            <ZoomIn size={13} />
          </button>
          <input
            type="range"
            min={50}
            max={250}
            value={zoom}
            onChange={(e) => onChange({ ...block, zoom: Number(e.target.value) })}
            className="w-20 sm:w-28 accent-amber-400 cursor-pointer"
            aria-label="জুম স্লাইডার"
          />
          <span className="text-[10px] text-purple-200/75 tabular-nums">প্রস্থ {widthPct}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(widthPct !== 100 || zoom !== 100 || aspectHeight !== null || posX !== 50 || posY !== 50) && (
            <button
              type="button"
              onClick={() => onChange({ ...block, widthPct: 100, aspectHeight: null, zoom: 100, posX: 50, posY: 50 })}
              className="bg-purple-900/50 hover:bg-purple-800/70 text-purple-200 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
            >
              অটো সাইজ
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-lg text-xs cursor-pointer"
            title="ইমেজ মুছুন"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Interactive Drag-Resize & Pan Canvas */}
      <div className="mx-auto relative select-none" style={{ width: `${widthPct}%` }}>
        <div
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
            e.preventDefault();
            const parentW = outerRef.current?.getBoundingClientRect().width || 320;
            const rect = e.currentTarget.getBoundingClientRect();
            dragRef.current = {
              mode: 'pan',
              startX: e.clientX,
              startY: e.clientY,
              startW: widthPct,
              startH: aspectHeight || Math.round((rect.height / Math.max(rect.width, 1)) * 1000),
              startPosX: posX,
              startPosY: posY,
              parentWidth: parentW,
              containerHeight: rect.height || 240
            };
          }}
          className="relative w-full overflow-hidden rounded-xl border-2 border-amber-400/70 bg-black/40 touch-none cursor-grab active:cursor-grabbing"
          style={aspectHeight ? { aspectRatio: `1000 / ${aspectHeight}` } : undefined}
        >
          {resolvedUrl ? (
            <img
              src={resolvedUrl}
              alt="ব্লগ ইমেজ প্রিভিউ"
              referrerPolicy="no-referrer"
              draggable={false}
              className={
                hasCustomCrop
                  ? 'w-full h-full object-cover select-none block pointer-events-none'
                  : 'w-full h-auto object-contain select-none block pointer-events-none'
              }
              style={{
                objectPosition: `${posX}% ${posY}%`,
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                transformOrigin: `${posX}% ${posY}%`
              }}
            />
          ) : (
            <div className="h-36 flex items-center justify-center text-xs text-red-300">
              সঠিক গুগল ড্রাইভ ইমেজ লিংক দিন
            </div>
          )}

          {/* Top Drag Hint */}
          <div className="pointer-events-none absolute inset-x-0 top-1.5 flex justify-center">
            <span className="bg-black/75 text-amber-200 text-[9.5px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
              <MoveVertical size={10} /> পাশে/নিচে বা কোনায় টেনে ছোট-বড় করুন
            </span>
          </div>

          {/* Right Edge Width Resize Handle */}
          <div
            data-resize-handle="width"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const parentW = outerRef.current?.getBoundingClientRect().width || 320;
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              dragRef.current = {
                mode: 'width',
                startX: e.clientX,
                startY: e.clientY,
                startW: widthPct,
                startH: aspectHeight || Math.round(((rect?.height || 260) / Math.max(rect?.width || 320, 1)) * 1000),
                startPosX: posX,
                startPosY: posY,
                parentWidth: parentW,
                containerHeight: rect?.height || 260
              };
            }}
            title="টেনে প্রস্থ বড়ো/ছোট করুন"
            className="absolute inset-y-0 right-0 w-3.5 bg-gradient-to-l from-cyan-400/85 to-cyan-400/20 hover:from-cyan-300 cursor-col-resize touch-none flex items-center justify-center z-20"
          >
            <span className="h-9 w-1 rounded-full bg-black/80" />
          </div>

          {/* Bottom Edge Height Resize Handle */}
          <div
            data-resize-handle="height"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const parentW = outerRef.current?.getBoundingClientRect().width || 320;
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              dragRef.current = {
                mode: 'height',
                startX: e.clientX,
                startY: e.clientY,
                startW: widthPct,
                startH: aspectHeight || Math.round(((rect?.height || 260) / Math.max(rect?.width || 320, 1)) * 1000),
                startPosX: posX,
                startPosY: posY,
                parentWidth: parentW,
                containerHeight: rect?.height || 260
              };
            }}
            title="টেনে উচ্চতা বড়ো/ছোট করুন"
            className="absolute inset-x-0 bottom-0 h-3.5 bg-gradient-to-t from-amber-500/85 to-amber-500/20 hover:from-amber-400 cursor-row-resize touch-none flex items-center justify-center z-20"
          >
            <span className="w-9 h-1 rounded-full bg-black/80" />
          </div>

          {/* Bottom-Right Corner Resize Handle */}
          <div
            data-resize-handle="corner"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const parentW = outerRef.current?.getBoundingClientRect().width || 320;
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              dragRef.current = {
                mode: 'corner',
                startX: e.clientX,
                startY: e.clientY,
                startW: widthPct,
                startH: aspectHeight || Math.round(((rect?.height || 260) / Math.max(rect?.width || 320, 1)) * 1000),
                startPosX: posX,
                startPosY: posY,
                parentWidth: parentW,
                containerHeight: rect?.height || 260
              };
            }}
            title="কোনা ধরে ছোট/বড় করুন"
            className="absolute bottom-0 right-0 w-5 h-5 bg-amber-400 hover:bg-amber-300 cursor-nwse-resize touch-none rounded-tl-lg flex items-center justify-center z-30 shadow"
          >
            <span className="w-2 h-2 border-r-2 border-b-2 border-black" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlogView({
  blogs,
  isAdmin,
  homeIconUrl,
  homeLabel,
  blogIconUrl,
  blogLabel,
  onBackHome,
  hideHomeButton = false,
  onSaveBlog,
  onDeleteBlog,
  onOpenLightbox
}: BlogViewProps) {
  const [mode, setMode] = useState<'list' | 'detail' | 'compose'>('list');
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(null);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);

  // Composer state
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftBlocks, setDraftBlocks] = useState<BlogBlock[]>([]);
  const [activeTextBlockId, setActiveTextBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [composerError, setComposerError] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Right-side menu state (Google Drive image or YouTube/Facebook video)
  const [sideMenuTool, setSideMenuTool] = useState<'image' | 'video' | null>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState<string>('');
  const [mediaInputError, setMediaInputError] = useState<string>('');

  // Context Formatting Menu (Right-click / Long-press on selected text)
  const [contextMenu, setContextMenu] = useState<{
    blockId: string;
    x: number;
    y: number;
    currentSizePct: number;
    isBold: boolean;
    align: 'left' | 'center' | 'right' | 'justify';
  } | null>(null);
  const [fontSizePctInput, setFontSizePctInput] = useState<string>('100');
  const [manualPasteVisible, setManualPasteVisible] = useState<boolean>(false);
  const [manualPasteText, setManualPasteText] = useState<string>('');
  const [customHexColor, setCustomHexColor] = useState<string>('#fbbf24');

  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const savedRangeRef = useRef<Range | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const registerEditorRef = (blockId: string, el: HTMLDivElement | null) => {
    editorRefs.current[blockId] = el;
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setManualPasteVisible(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [contextMenu]);

  const sortedBlogs = [...blogs].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const selectedBlog = sortedBlogs.find((b) => b.id === selectedBlogId) || null;

  const openNewComposer = () => {
    const firstTxtId = `txt_${Date.now()}`;
    setEditingBlogId(null);
    setDraftTitle('');
    setDraftBlocks([{ id: firstTxtId, type: 'text', html: '' }]);
    setActiveTextBlockId(firstTxtId);
    setComposerError('');
    setSideMenuTool(null);
    setContextMenu(null);
    setMode('compose');
  };

  const openEditComposer = (post: BlogPostRecord) => {
    const clonedBlocks: BlogBlock[] =
      Array.isArray(post.blocks) && post.blocks.length > 0
        ? post.blocks.map((b) => ({ ...b }))
        : [{ id: `txt_${Date.now()}`, type: 'text', html: '' }];
    if (clonedBlocks[clonedBlocks.length - 1]?.type !== 'text') {
      clonedBlocks.push({ id: `txt_${Date.now()}_end`, type: 'text', html: '' });
    }
    const firstTxt = clonedBlocks.find((b) => b.type === 'text');
    setEditingBlogId(post.id);
    setDraftTitle(post.title);
    setDraftBlocks(clonedBlocks);
    setActiveTextBlockId(firstTxt ? firstTxt.id : null);
    setComposerError('');
    setSideMenuTool(null);
    setContextMenu(null);
    setMode('compose');
  };

  const handleInsertMediaIntoBlock = (
    targetBlockId: string,
    beforeHtml: string,
    mediaType: 'image' | 'video',
    url: string,
    afterHtml: string
  ) => {
    const newMediaBlock: BlogBlock =
      mediaType === 'image'
        ? {
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'image',
            url,
            widthPct: 100,
            aspectHeight: null,
            zoom: 100,
            posX: 50,
            posY: 50
          }
        : {
            id: `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'video',
            url
          };

    const nextTextId = `txt_${Date.now()}_after_${Math.random().toString(36).slice(2, 6)}`;
    setDraftBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === targetBlockId);
      const inserted: BlogBlock[] = [];
      if (htmlToPlainText(beforeHtml).length > 0) {
        inserted.push({ id: targetBlockId, type: 'text', html: beforeHtml });
      }
      inserted.push(newMediaBlock);
      inserted.push({ id: nextTextId, type: 'text', html: afterHtml });

      if (idx === -1) {
        return [...prev, ...inserted];
      }
      return [...prev.slice(0, idx), ...inserted, ...prev.slice(idx + 1)];
    });
    setActiveTextBlockId(nextTextId);
  };

  const handleAddMediaFromSideMenu = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = mediaUrlInput.trim();
    if (!raw || !isSafeHttpUrl(raw)) {
      setMediaInputError('সঠিক http/https লিংক দিন।');
      return;
    }

    if (sideMenuTool === 'image') {
      if (!normalizeBlogImageUrl(raw)) {
        setMediaInputError('সঠিক গুগল ড্রাইভ ইমেজ লিংক দিন।');
        return;
      }
    } else if (sideMenuTool === 'video') {
      if (!getBlogVideoEmbedUrl(raw)) {
        setMediaInputError('সঠিক ইউটিউব বা ফেসবুক ভিডিও লিংক দিন।');
        return;
      }
    } else {
      return;
    }

    // Determine split point in active text block if cursor is inside it
    const targetId =
      activeTextBlockId ||
      [...draftBlocks].reverse().find((b) => b.type === 'text')?.id ||
      '';
    const editorEl = targetId ? editorRefs.current[targetId] : null;
    const mediaType = sideMenuTool;

    if (editorEl && targetId) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(editorEl);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        const bDiv = document.createElement('div');
        bDiv.appendChild(beforeRange.cloneContents());

        const afterRange = document.createRange();
        afterRange.selectNodeContents(editorEl);
        afterRange.setStart(range.endContainer, range.endOffset);
        const aDiv = document.createElement('div');
        aDiv.appendChild(afterRange.cloneContents());

        handleInsertMediaIntoBlock(
          targetId,
          sanitizeBlogHtml(bDiv.innerHTML),
          mediaType,
          raw,
          sanitizeBlogHtml(aDiv.innerHTML)
        );
      } else {
        handleInsertMediaIntoBlock(
          targetId,
          sanitizeBlogHtml(editorEl.innerHTML),
          mediaType,
          raw,
          ''
        );
      }
    } else {
      const nextTextId = `txt_${Date.now()}_next`;
      const mediaBlk: BlogBlock =
        mediaType === 'image'
          ? {
              id: `img_${Date.now()}`,
              type: 'image',
              url: raw,
              widthPct: 100,
              aspectHeight: null,
              zoom: 100,
              posX: 50,
              posY: 50
            }
          : {
              id: `vid_${Date.now()}`,
              type: 'video',
              url: raw
            };
      setDraftBlocks((prev) => [...prev, mediaBlk, { id: nextTextId, type: 'text', html: '' }]);
      setActiveTextBlockId(nextTextId);
    }

    setMediaUrlInput('');
    setMediaInputError('');
    setSideMenuTool(null);
  };

  const syncEditorDomToState = (blockId: string) => {
    const el = editorRefs.current[blockId];
    if (!el) return;
    const updatedHtml = el.innerHTML;
    setDraftBlocks((prev) =>
      prev.map((b) => (b.id === blockId && b.type === 'text' ? { ...b, html: updatedHtml } : b))
    );
  };

  const restoreSavedSelection = (): boolean => {
    if (!contextMenu) return false;
    const editorEl = editorRefs.current[contextMenu.blockId];
    if (!editorEl) return false;
    editorEl.focus();
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    if (savedRangeRef.current) {
      try {
        sel.addRange(savedRangeRef.current);
        return true;
      } catch {
        // fallback below
      }
    }
    return false;
  };

  const applyFontSizePercent = (pctValue: number) => {
    if (!contextMenu) return;
    const clamped = Math.min(400, Math.max(40, Math.round(pctValue)));
    const editorEl = editorRefs.current[contextMenu.blockId];
    if (!editorEl) return;
    restoreSavedSelection();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = `${clamped}%`;
      try {
        const extracted = range.extractContents();
        span.appendChild(extracted);
        range.insertNode(span);
        const nextRange = document.createRange();
        nextRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(nextRange);
        savedRangeRef.current = nextRange.cloneRange();
      } catch {
        // Fallback if selection crosses boundaries
        document.execCommand('fontSize', false, '4');
        editorEl.querySelectorAll('font[size="4"]').forEach((fontNode) => {
          const s = document.createElement('span');
          s.style.fontSize = `${clamped}%`;
          s.innerHTML = fontNode.innerHTML;
          fontNode.replaceWith(s);
        });
      }
      syncEditorDomToState(contextMenu.blockId);
      setFontSizePctInput(String(clamped));
      setContextMenu((prev) => (prev ? { ...prev, currentSizePct: clamped } : null));
    } else {
      // No selection -> wrap entire block text or apply to block
      editorEl.style.fontSize = `${clamped}%`;
      setFontSizePctInput(String(clamped));
    }
  };

  const applyTextAlignment = (align: 'left' | 'center' | 'justify') => {
    if (!contextMenu) return;
    restoreSavedSelection();
    const cmd = align === 'center' ? 'justifyCenter' : align === 'justify' ? 'justifyFull' : 'justifyLeft';
    document.execCommand(cmd, false);
    syncEditorDomToState(contextMenu.blockId);
    setContextMenu((prev) => (prev ? { ...prev, align } : null));
  };

  const applyTextColor = (hex: string) => {
    if (!contextMenu) return;
    restoreSavedSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, hex);
    syncEditorDomToState(contextMenu.blockId);
    setCustomHexColor(hex);
  };

  const toggleBoldSelection = () => {
    if (!contextMenu) return;
    restoreSavedSelection();
    document.execCommand('bold', false);
    let nowBold = false;
    try {
      nowBold = document.queryCommandState('bold');
    } catch {
      nowBold = !contextMenu.isBold;
    }
    syncEditorDomToState(contextMenu.blockId);
    setContextMenu((prev) => (prev ? { ...prev, isBold: nowBold } : null));
  };

  const insertPastedTextIntoSelection = (text: string) => {
    if (!contextMenu || !text) return;
    const trimmed = text.trim();
    const mediaType = !/\s/.test(trimmed) ? classifyMediaUrl(trimmed) : null;
    const editorEl = editorRefs.current[contextMenu.blockId];
    if (mediaType && editorEl) {
      restoreSavedSelection();
      const sel = window.getSelection();
      let beforeHtml = editorEl.innerHTML;
      let afterHtml = '';
      if (sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(editorEl);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        const bDiv = document.createElement('div');
        bDiv.appendChild(beforeRange.cloneContents());
        beforeHtml = sanitizeBlogHtml(bDiv.innerHTML);

        const afterRange = document.createRange();
        afterRange.selectNodeContents(editorEl);
        afterRange.setStart(range.endContainer, range.endOffset);
        const aDiv = document.createElement('div');
        aDiv.appendChild(afterRange.cloneContents());
        afterHtml = sanitizeBlogHtml(aDiv.innerHTML);
      }
      handleInsertMediaIntoBlock(contextMenu.blockId, beforeHtml, mediaType, trimmed, afterHtml);
      setContextMenu(null);
      setManualPasteVisible(false);
      setManualPasteText('');
      return;
    }

    restoreSavedSelection();
    document.execCommand('insertText', false, text);
    syncEditorDomToState(contextMenu.blockId);
    setContextMenu(null);
    setManualPasteVisible(false);
    setManualPasteText('');
  };

  const handleContextPasteClick = async () => {
    if (!contextMenu) return;
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          insertPastedTextIntoSelection(txt);
          return;
        }
      }
    } catch {
      // Clipboard read blocked inside iframe -> open inline manual paste field
    }
    setManualPasteVisible(true);
  };

  const handleSaveDraft = async () => {
    const cleanTitle = draftTitle.trim();
    if (!cleanTitle) {
      setComposerError('ব্লগের শিরোনাম (হেডলাইন) লিখুন।');
      return;
    }

    // Flush latest DOM innerHTML from all mounted editors
    const latestBlocks: BlogBlock[] = draftBlocks.map((b) => {
      if (b.type === 'text') {
        const el = editorRefs.current[b.id];
        return { ...b, html: el ? el.innerHTML : b.html };
      }
      return b;
    });

    // Convert any remaining Drive/YouTube/Facebook links inside text into image/video blocks
    const normalizedBlocks = splitTextBlockByEmbeddedUrls(latestBlocks).filter((b) => {
      if (b.type === 'text') return htmlToPlainText(b.html).length > 0;
      if (b.type === 'image') return Boolean(normalizeBlogImageUrl(b.url));
      if (b.type === 'video') return Boolean(getBlogVideoEmbedUrl(b.url));
      return false;
    });

    if (normalizedBlocks.length === 0) {
      setComposerError('অনুগ্রহ করে কিছু টেক্সট, ইমেজ বা ভিডিও যোগ করুন।');
      return;
    }

    const excerptText = normalizedBlocks
      .filter((b): b is Extract<BlogBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => htmlToPlainText(b.html))
      .join(' ')
      .trim()
      .slice(0, 220);

    setSaving(true);
    setComposerError('');
    try {
      await onSaveBlog({
        id: editingBlogId || undefined,
        title: cleanTitle,
        excerpt: excerptText || cleanTitle,
        blocks: normalizedBlocks
      });
      setMode('list');
      setEditingBlogId(null);
      setSelectedBlogId(null);
    } catch {
      setComposerError('ব্লগটি সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  };

  const formatDateDisplay = (post: BlogPostRecord): string => {
    if (post.dateLabel) return post.dateLabel;
    if (!post.createdAtMs) return '';
    try {
      return new Intl.DateTimeFormat('bn-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(new Date(post.createdAtMs));
    } catch {
      return new Date(post.createdAtMs).toLocaleDateString();
    }
  };

  const clampedContextPos = contextMenu
    ? {
        left:
          typeof window !== 'undefined'
            ? Math.min(Math.max(8, contextMenu.x), Math.max(8, window.innerWidth - 268))
            : contextMenu.x,
        top:
          typeof window !== 'undefined'
            ? Math.min(Math.max(8, contextMenu.y), Math.max(8, window.innerHeight - 310))
            : contextMenu.y
      }
    : { left: 16, top: 16 };

  return (
    <div className="space-y-5">
      {/* Top Bar: Home Icon Back + Context Actions */}
      <div className="w-full flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {!hideHomeButton && (
            <SubpageBackButton
              iconUrl={homeIconUrl}
              label={homeLabel || 'হোম'}
              onClick={onBackHome}
              variant="home"
            />
          )}
          {mode !== 'list' && (
            <SubpageBackButton
              iconUrl={blogIconUrl}
              label="ব্লগ তালিকা"
              onClick={() => {
                setMode('list');
                setSelectedBlogId(null);
                setContextMenu(null);
                setSideMenuTool(null);
              }}
              variant="parent"
            />
          )}
        </div>

        {isAdmin && mode === 'list' && (
          <button
            type="button"
            onClick={openNewComposer}
            className="bg-gradient-to-r from-purple-600 to-amber-500 hover:brightness-110 text-black font-bold text-xs px-3 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer transition-all"
          >
            <Plus size={14} /> নতুন ব্লগ লিখুন
          </button>
        )}
      </div>

      {/* MODE 1: BLOG LIST VIEW */}
      {mode === 'list' && (
        <div className="space-y-4">
          <div className="bg-[#13132b] border border-purple-500/35 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-[0_0_25px_rgba(120,50,255,0.12)]">
            <img
              src={blogIconUrl}
              alt={blogLabel || 'ব্লগ'}
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-amber-300 font-['Aikya','Poppins',sans-serif] leading-tight">
                {blogLabel || 'ব্লগ'}
              </h1>
            </div>
          </div>

          {sortedBlogs.length === 0 ? (
            <div className="bg-[#13132b] border border-purple-500/30 rounded-2xl p-8 text-center space-y-3">
              <p className="text-sm text-purple-200/75">এখনও কোনো ব্লগ প্রকাশ করা হয়নি।</p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={openNewComposer}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> প্রথম ব্লগ লিখুন
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedBlogs.map((post) => {
                const firstImageBlk = (post.blocks || []).find(
                  (b): b is Extract<BlogBlock, { type: 'image' }> =>
                    b.type === 'image' && Boolean(normalizeBlogImageUrl(b.url))
                );
                const thumbUrl = firstImageBlk ? normalizeBlogImageUrl(firstImageBlk.url) : '';
                const dateStr = formatDateDisplay(post);

                return (
                  <article
                    key={post.id}
                    onClick={() => {
                      setSelectedBlogId(post.id);
                      setMode('detail');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group bg-[#13132b] hover:bg-[#171737] border border-purple-500/35 hover:border-amber-400/70 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer shadow-[0_6px_22px_rgba(0,0,0,0.3)] flex items-start gap-3.5 sm:gap-4"
                  >
                    {thumbUrl && (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-black/40 border border-purple-500/25 shrink-0">
                        <img
                          src={thumbUrl}
                          alt={post.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-amber-200 group-hover:text-amber-300 leading-snug line-clamp-2">
                          {post.title}
                        </h2>
                        {isAdmin && (
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openEditComposer(post)}
                              className="bg-amber-500 hover:bg-amber-400 text-black p-1.5 rounded-lg text-xs cursor-pointer"
                              title="এডিট করুন"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(post.id)}
                              className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg text-xs cursor-pointer"
                              title="ডিলিট করুন"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {post.excerpt && (
                        <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}

                      {dateStr && (
                        <div className="text-[11px] text-purple-300/60 pt-0.5">
                          <span>{dateStr}</span>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: BLOG DETAIL READER VIEW */}
      {mode === 'detail' && selectedBlog && (
        <article className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-4 sm:p-7 shadow-[0_0_30px_rgba(120,50,255,0.14)] space-y-5">
          <div className="space-y-2 border-b border-purple-500/20 pb-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl sm:text-3xl font-extrabold text-amber-300 leading-snug">
                {selectedBlog.title}
              </h1>
              {isAdmin && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditComposer(selectedBlog)}
                    className="bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={12} /> এডিট
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(selectedBlog.id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} /> ডিলিট
                  </button>
                </div>
              )}
            </div>
            {formatDateDisplay(selectedBlog) && (
              <div className="text-xs text-purple-300/65">{formatDateDisplay(selectedBlog)}</div>
            )}
          </div>

          <div className="space-y-4">
            {(selectedBlog.blocks || []).map((blk) => {
              if (blk.type === 'text') {
                return (
                  <div key={blk.id} className="text-sm sm:text-base text-purple-100 leading-relaxed break-words">
                    {renderSanitizedRichText(blk.html)}
                  </div>
                );
              }
              if (blk.type === 'image') {
                const imgSrc = normalizeBlogImageUrl(blk.url);
                if (!imgSrc) return null;
                const widthPct = typeof blk.widthPct === 'number' ? Math.min(100, Math.max(25, blk.widthPct)) : 100;
                const zoom = typeof blk.zoom === 'number' ? Math.min(250, Math.max(50, blk.zoom)) : 100;
                const posX = typeof blk.posX === 'number' ? blk.posX : 50;
                const posY = typeof blk.posY === 'number' ? blk.posY : 50;
                const aspectHeight =
                  typeof blk.aspectHeight === 'number' && blk.aspectHeight > 0 ? blk.aspectHeight : null;
                const hasCustomCrop = Boolean(aspectHeight || posX !== 50 || posY !== 50);

                return (
                  <div key={blk.id} className="mx-auto overflow-hidden rounded-xl" style={{ width: `${widthPct}%` }}>
                    <div
                      className="w-full overflow-hidden rounded-xl border border-purple-500/30 bg-black/30"
                      style={aspectHeight ? { aspectRatio: `1000 / ${aspectHeight}` } : undefined}
                    >
                      <img
                        src={imgSrc}
                        alt={selectedBlog.title}
                        referrerPolicy="no-referrer"
                        onClick={onOpenLightbox ? () => onOpenLightbox(imgSrc) : undefined}
                        className={`${
                          hasCustomCrop
                            ? 'w-full h-full object-cover'
                            : 'w-full h-auto object-contain'
                        } block ${onOpenLightbox ? 'cursor-pointer' : ''}`}
                        style={{
                          objectPosition: `${posX}% ${posY}%`,
                          transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                          transformOrigin: `${posX}% ${posY}%`
                        }}
                      />
                    </div>
                  </div>
                );
              }
              if (blk.type === 'video') {
                const embedSrc = getBlogVideoEmbedUrl(blk.url);
                if (!embedSrc) return null;
                return (
                  <div
                    key={blk.id}
                    className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-purple-500/35 shadow-inner"
                  >
                    <iframe
                      src={embedSrc}
                      title={selectedBlog.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                );
              }
              return null;
            })}
          </div>
        </article>
      )}

      {/* MODE 3: ADMIN BLOG COMPOSER WITH RIGHT-SIDE FLOATING MENU & CONTEXT FORMATTING */}
      {isAdmin && mode === 'compose' && (
        <div className="space-y-4">
          <div className="bg-[#13132b] border border-purple-500/45 rounded-2xl p-3.5 sm:p-5 shadow-[0_0_25px_rgba(120,50,255,0.16)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-bold text-amber-300">
                {editingBlogId ? 'ব্লগ এডিট করুন' : 'নতুন ব্লগ লিখুন'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode(editingBlogId && selectedBlog ? 'detail' : 'list');
                    setContextMenu(null);
                    setSideMenuTool(null);
                  }}
                  className="bg-white/10 hover:bg-white/20 text-purple-100 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 disabled:opacity-60 text-black text-xs font-extrabold px-4 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check size={14} /> {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
                </button>
              </div>
            </div>

            {composerError && (
              <div className="bg-red-950/60 border border-red-500/50 text-red-200 text-xs px-3 py-2 rounded-xl">
                {composerError}
              </div>
            )}

            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="ব্লগের শিরোনাম (হেডলাইন) লিখুন..."
              className="w-full bg-[#1b1b38] border border-purple-500/35 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm sm:text-base font-bold text-white placeholder-purple-300/45 focus:outline-none"
            />

            <p className="text-[11px] text-purple-200/70">
              টেক্সট সিলেক্ট করে মাউসের রাইট বাটন ক্লিক অথবা মোবাইল লং-প্রেস করলে ফন্ট সাইজ (%), কালার, বোল্ড, পেস্ট ও এলাইনমেন্ট মেনু আসবে। ডান পাশের মেনু থেকে ইমেজ বা ভিডিও যোগ করুন।
            </p>

            {/* Editor Workspace + Right-Side Small Menu */}
            <div className="flex flex-row items-start gap-2 sm:gap-3 relative">
              {/* Main Content Blocks Column */}
              <div className="flex-1 min-w-0 space-y-3">
                {draftBlocks.map((blk, idx) => {
                  if (blk.type === 'text') {
                    return (
                      <RichTextBlockEditor
                        key={blk.id}
                        blockId={blk.id}
                        html={blk.html}
                        autoFocus={idx === 0 && !editingBlogId}
                        placeholder={
                          idx === 0
                            ? 'এখানে ব্লগের মূল লেখা লিখুন... (ইমেজ বা ভিডিও লিংক পেস্ট করলেও সরাসরি প্রিভিউ আসবে)'
                            : 'পরবর্তী অংশ লিখুন...'
                        }
                        onFocusBlock={(id) => setActiveTextBlockId(id)}
                        onChangeHtml={(id, nextHtml) =>
                          setDraftBlocks((prev) =>
                            prev.map((item) =>
                              item.id === id && item.type === 'text' ? { ...item, html: nextHtml } : item
                            )
                          )
                        }
                        onInsertMediaFromText={handleInsertMediaIntoBlock}
                        onOpenFormatMenu={(payload) => {
                          savedRangeRef.current = payload.range;
                          setFontSizePctInput(String(payload.currentSizePct || 100));
                          setManualPasteVisible(false);
                          setContextMenu({
                            blockId: payload.blockId,
                            x: payload.x,
                            y: payload.y,
                            currentSizePct: payload.currentSizePct,
                            isBold: payload.isBold,
                            align: payload.align
                          });
                        }}
                        registerEditorRef={registerEditorRef}
                      />
                    );
                  }

                  if (blk.type === 'image') {
                    return (
                      <ResizableBlogImageEditor
                        key={blk.id}
                        block={blk}
                        onChange={(updated) =>
                          setDraftBlocks((prev) => prev.map((item) => (item.id === blk.id ? updated : item)))
                        }
                        onRemove={() =>
                          setDraftBlocks((prev) => {
                            const filtered = prev.filter((item) => item.id !== blk.id);
                            return filtered.length > 0
                              ? filtered
                              : [{ id: `txt_${Date.now()}`, type: 'text', html: '' }];
                          })
                        }
                      />
                    );
                  }

                  if (blk.type === 'video') {
                    const embedSrc = getBlogVideoEmbedUrl(blk.url);
                    return (
                      <div
                        key={blk.id}
                        className="bg-[#141430] border border-purple-500/40 rounded-2xl p-2.5 sm:p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-amber-300 inline-flex items-center gap-1">
                            <Video size={13} /> ভিডিও প্রিভিউ
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftBlocks((prev) => {
                                const filtered = prev.filter((item) => item.id !== blk.id);
                                return filtered.length > 0
                                  ? filtered
                                  : [{ id: `txt_${Date.now()}`, type: 'text', html: '' }];
                              })
                            }
                            className="bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-lg text-xs cursor-pointer"
                            title="ভিডিও মুছুন"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {embedSrc ? (
                          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-purple-500/30">
                            <iframe
                              src={embedSrc}
                              title="ব্লগ ভিডিও প্রিভিউ"
                              className="w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-red-300 py-4 text-center">
                            ভিডিও প্রিভিউ লোড করা যায়নি
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>

              {/* Small Right-Side Floating Menu (Google Drive Image + YouTube/Facebook Video) */}
              <aside className="sticky top-20 shrink-0 z-20 flex flex-col gap-2 bg-[#1a1a3a] border border-purple-500/45 rounded-2xl p-1.5 sm:p-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] w-[54px] sm:w-[144px]">
                <button
                  type="button"
                  onClick={() => {
                    setMediaUrlInput('');
                    setMediaInputError('');
                    setSideMenuTool((prev) => (prev === 'image' ? null : 'image'));
                  }}
                  title="গুগল ড্রাইভ ইমেজ লিংক অ্যাড"
                  className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                    sideMenuTool === 'image'
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#25254d] hover:bg-purple-800/70 text-amber-200'
                  }`}
                >
                  <ImageIcon size={15} className="shrink-0" />
                  <span className="leading-tight text-center sm:text-left">ইমেজ লিংক</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMediaUrlInput('');
                    setMediaInputError('');
                    setSideMenuTool((prev) => (prev === 'video' ? null : 'video'));
                  }}
                  title="ইউটিউব বা ফেসবুক ভিডিও লিংক অ্যাড"
                  className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                    sideMenuTool === 'video'
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#25254d] hover:bg-purple-800/70 text-cyan-200'
                  }`}
                >
                  <Video size={15} className="shrink-0" />
                  <span className="leading-tight text-center sm:text-left">ভিডিও লিংক</span>
                </button>

                {/* Inline Link Input Popover anchored left of the right-side menu */}
                {sideMenuTool && (
                  <form
                    onSubmit={handleAddMediaFromSideMenu}
                    className="absolute right-full top-0 mr-2 w-[228px] sm:w-80 bg-[#14142e] border border-amber-400/60 rounded-2xl p-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.85)] space-y-2.5 z-30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-300">
                        {sideMenuTool === 'image'
                          ? 'গুগল ড্রাইভ ইমেজ লিংক'
                          : 'ইউটিউব / ফেসবুক ভিডিও লিংক'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSideMenuTool(null)}
                        className="text-gray-400 hover:text-white cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      autoFocus
                      value={mediaUrlInput}
                      onChange={(e) => {
                        setMediaUrlInput(e.target.value);
                        setMediaInputError('');
                      }}
                      placeholder={
                        sideMenuTool === 'image'
                          ? 'https://drive.google.com/file/d/...'
                          : 'https://youtu.be/... বা facebook.com/...'
                      }
                      className="w-full bg-[#1d1d40] border border-purple-500/40 rounded-xl px-2.5 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-amber-400"
                    />
                    {mediaInputError && (
                      <p className="text-[11px] text-red-300">{mediaInputError}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:brightness-110 text-black font-bold text-xs py-2 rounded-xl cursor-pointer"
                    >
                      ব্লগে যোগ করুন
                    </button>
                  </form>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM RIGHT-CLICK / LONG-PRESS FORMATTING MENU */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ left: clampedContextPos.left, top: clampedContextPos.top }}
          className="fixed z-[9995] w-64 bg-[#14142f] border border-amber-400/60 rounded-2xl p-3 shadow-[0_16px_42px_rgba(0,0,0,0.88)] space-y-2.5 text-white"
        >
          <div className="flex items-center justify-between border-b border-purple-500/25 pb-1.5">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
              <Type size={13} /> টেক্সট ফরম্যাট অপশন
            </span>
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                setManualPasteVisible(false);
              }}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* 1.4.1 Font Size by typing % */}
          <div className="space-y-1">
            <label className="text-[10.5px] font-semibold text-purple-200/85 block">
              ফন্ট সাইজ (% লিখে পরিবর্তন করুন):
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyFontSizePercent((parseInt(fontSizePctInput, 10) || 100) - 10)}
                className="bg-[#23234b] hover:bg-purple-800/70 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer"
              >
                -
              </button>
              <div className="relative flex-1">
                <input
                  type="number"
                  min={40}
                  max={400}
                  value={fontSizePctInput}
                  onChange={(e) => setFontSizePctInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyFontSizePercent(parseInt(fontSizePctInput, 10) || 100);
                    }
                  }}
                  className="w-full bg-[#1e1e3e] border border-purple-500/40 rounded-lg pl-2 pr-6 py-1 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-amber-400"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-amber-300 font-bold">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={() => applyFontSizePercent((parseInt(fontSizePctInput, 10) || 100) + 10)}
                className="bg-[#23234b] hover:bg-purple-800/70 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => applyFontSizePercent(parseInt(fontSizePctInput, 10) || 100)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] px-2 py-1 rounded-lg cursor-pointer"
              >
                সেট
              </button>
            </div>
          </div>

          {/* 1.4.2 Paste + 1.4.6 Bold/Unbold */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleContextPasteClick}
              className="bg-[#23234b] hover:bg-purple-800/70 border border-purple-500/35 text-purple-100 py-1.5 px-2 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ClipboardPaste size={13} className="text-cyan-300" /> পেস্ট
            </button>
            <button
              type="button"
              onClick={toggleBoldSelection}
              className={`border py-1.5 px-2 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                contextMenu.isBold
                  ? 'bg-amber-500 border-amber-400 text-black'
                  : 'bg-[#23234b] hover:bg-purple-800/70 border-purple-500/35 text-purple-100'
              }`}
            >
              <Bold size={13} /> {contextMenu.isBold ? 'আন-বোল্ড' : 'বোল্ড'}
            </button>
          </div>

          {manualPasteVisible && (
            <div className="bg-[#1b1b38] border border-cyan-400/40 rounded-xl p-2 space-y-1.5">
              <input
                type="text"
                autoFocus
                value={manualPasteText}
                onChange={(e) => setManualPasteText(e.target.value)}
                placeholder="এখানে পেস্ট করে বসান চাপুন..."
                className="w-full bg-[#101026] border border-purple-500/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => insertPastedTextIntoSelection(manualPasteText)}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[11px] py-1 rounded-lg cursor-pointer"
              >
                টেক্সটে বসান
              </button>
            </div>
          )}

          {/* 1.4.3 Alignment: Left, Center, Justify */}
          <div className="space-y-1">
            <span className="text-[10.5px] font-semibold text-purple-200/85 block">টেক্সট এলাইনমেন্ট:</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => applyTextAlignment('left')}
                className={`py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer border ${
                  contextMenu.align === 'left'
                    ? 'bg-amber-500 border-amber-400 text-black'
                    : 'bg-[#23234b] hover:bg-purple-800/70 border-purple-500/35 text-purple-100'
                }`}
              >
                <AlignLeft size={12} /> বামে
              </button>
              <button
                type="button"
                onClick={() => applyTextAlignment('center')}
                className={`py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer border ${
                  contextMenu.align === 'center'
                    ? 'bg-amber-500 border-amber-400 text-black'
                    : 'bg-[#23234b] hover:bg-purple-800/70 border-purple-500/35 text-purple-100'
                }`}
              >
                <AlignCenter size={12} /> সেন্টার
              </button>
              <button
                type="button"
                onClick={() => applyTextAlignment('justify')}
                className={`py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer border ${
                  contextMenu.align === 'justify'
                    ? 'bg-amber-500 border-amber-400 text-black'
                    : 'bg-[#23234b] hover:bg-purple-800/70 border-purple-500/35 text-purple-100'
                }`}
              >
                <AlignJustify size={12} /> জাস্টিফাই
              </button>
            </div>
          </div>

          {/* 1.4.5 Text Color Change */}
          <div className="space-y-1.5">
            <span className="text-[10.5px] font-semibold text-purple-200/85 flex items-center gap-1">
              <Palette size={12} className="text-amber-300" /> টেক্সট কালার:
            </span>
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {FORMAT_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.label}
                    onClick={() => applyTextColor(swatch.hex)}
                    style={{ backgroundColor: swatch.hex }}
                    className="w-5 h-5 rounded-full border border-white/40 cursor-pointer hover:scale-110 transition-transform"
                  />
                ))}
              </div>
              <label className="inline-flex items-center gap-1 cursor-pointer text-[10px] text-purple-200 bg-[#23234b] px-1.5 py-0.5 rounded-lg border border-purple-500/35">
                <input
                  type="color"
                  value={customHexColor}
                  onChange={(e) => applyTextColor(e.target.value)}
                  className="w-4 h-4 bg-transparent border-0 p-0 cursor-pointer"
                />
                কাস্টম
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DELETE BLOG CONFIRMATION MODAL */}
      {isAdmin && deleteConfirmId && (
        <div className="fixed inset-0 z-[9996] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14142e] border border-purple-500/50 rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-2xl text-center">
            <p className="text-sm font-bold text-white">এই ব্লগটি ডিলিট করতে চান?</p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="bg-white/10 hover:bg-white/20 text-purple-100 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                না
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteConfirmId;
                  setDeleteConfirmId(null);
                  await onDeleteBlog(id);
                  if (selectedBlogId === id) {
                    setSelectedBlogId(null);
                    setMode('list');
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                হ্যাঁ, ডিলিট
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
