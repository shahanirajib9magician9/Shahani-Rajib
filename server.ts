import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface GoogleSource {
  kind: 'gdrive' | 'gdoc';
  id: string;
}

function extractGoogleSource(rawUrl: string): GoogleSource | null {
  const trimmed = rawUrl.trim();
  const docMatch = trimmed.match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i);
  if (docMatch && docMatch[1]) {
    return { kind: 'gdoc', id: docMatch[1] };
  }
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i);
  if (driveFileMatch && driveFileMatch[1]) {
    return { kind: 'gdrive', id: driveFileMatch[1] };
  }
  const paramMatch = trimmed.match(
    /(?:drive\.google\.com|drive\.usercontent\.google\.com|docs\.google\.com)\/[^\s]*[?&]id=([a-zA-Z0-9_-]+)/i
  );
  if (paramMatch && paramMatch[1]) {
    return { kind: 'gdrive', id: paramMatch[1] };
  }
  return null;
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  if (/^127\./.test(lower) || /^10\./.test(lower) || /^169\.254\./.test(lower) || /^192\.168\./.test(lower)) {
    return true;
  }
  const m172 = lower.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function looksLikeDriveAuthOrAccessError(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes('accounts.google.com/servicelogin') || lower.includes('accounts.google.com/v3/signin')) {
    return true;
  }
  if (
    (lower.includes('<title>google drive') || lower.includes('<title>sign in')) &&
    (lower.includes('you need access') || lower.includes('request access') || lower.includes('sign in'))
  ) {
    return true;
  }
  return false;
}

function looksLikeDriveVirusConfirmPage(text: string): boolean {
  return (
    text.includes('id="download-form"') ||
    text.includes('uc-download-link') ||
    (text.includes('drive.usercontent.google.com/download') && text.includes('confirm'))
  );
}

function extractDriveConfirmUrl(html: string, fallbackOrigin: string): string | null {
  const formMatch = html.match(/<form[^>]*id=["']download-form["'][^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
  if (formMatch) {
    const rawAction = formMatch[1].replace(/&amp;/g, '&');
    const body = formMatch[2];
    const params = new URLSearchParams();
    const inputRegex = /<input[^>]*type=["']hidden["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = inputRegex.exec(body)) !== null) {
      const tag = m[0];
      const nameMatch = tag.match(/name=["']([^"']+)["']/i);
      const valMatch = tag.match(/value=["']([^"']*)["']/i);
      if (nameMatch && nameMatch[1]) {
        params.set(nameMatch[1], valMatch ? valMatch[1] : '');
      }
    }
    try {
      const target = new URL(rawAction, fallbackOrigin);
      params.forEach((v, k) => target.searchParams.set(k, v));
      return target.toString();
    } catch {
      return null;
    }
  }
  const linkMatch = html.match(/href=["']([^"']*confirm=[^"']+)["']/i);
  if (linkMatch && linkMatch[1]) {
    try {
      return new URL(linkMatch[1].replace(/&amp;/g, '&'), fallbackOrigin).toString();
    } catch {
      return null;
    }
  }
  return null;
}

function isZipDocxBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05);
}

function normalizeExtractedCode(raw: string): string {
  let out = raw.replace(/^\uFEFF/, '').trim();

  // Strip optional leading word "html" or markdown fence copied from docs/AI
  const fenceMatch = out.match(/^```(?:html?|xml)?\s*\r?\n([\s\S]*?)\r?\n?```$/i);
  if (fenceMatch && fenceMatch[1]) {
    out = fenceMatch[1].trim();
  }
  if (/^html\s*\r?\n\s*(?:<!doctype|<html|<head|<body|<div|<style)/i.test(out)) {
    out = out.replace(/^html\s*\r?\n\s*/i, '').trim();
  }

  // Fix MS Word / Google Docs smart quotes & broken comment dashes when text is HTML code
  out = out
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00A0/g, ' ')
    .replace(/<!—/g, '<!--')
    .replace(/—>/g, '-->')
    .replace(/–>/g, '-->');

  // Unescape if the entire HTML document was HTML-entity-encoded inside Word/Docs
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

function injectBaseTag(html: string, finalUrl: string): string {
  if (!html || /<base\s+href=/i.test(html)) return html;
  const safeBase = finalUrl.replace(/"/g, '&quot;');
  const baseTag = `<base href="${safeBase}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n  ${baseTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1>\n<head>${baseTag}</head>`);
  }
  return `<head>${baseTag}</head>\n${html}`;
}

interface RemoteBinaryResult {
  buffer: Buffer;
  status: number;
  contentType: string;
  contentDisposition: string;
  finalUrl: string;
}

async function fetchRemoteBinary(targetUrl: string, allowConfirmFollow = true): Promise<RemoteBinaryResult> {
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });

  const arrayBuf = await response.arrayBuffer();
  if (arrayBuf.byteLength > 8 * 1024 * 1024) {
    throw new Error('ফাইলের সাইজ 8MB এর বেশি হওয়ায় লোড করা যায়নি।');
  }
  const buffer = Buffer.from(arrayBuf);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const contentDisposition = response.headers.get('content-disposition') || '';
  const finalUrl = response.url || targetUrl;

  if (allowConfirmFollow && !isZipDocxBuffer(buffer) && contentType.includes('text/html')) {
    const htmlPreview = buffer.toString('utf8');
    if (looksLikeDriveVirusConfirmPage(htmlPreview)) {
      const confirmUrl = extractDriveConfirmUrl(htmlPreview, finalUrl);
      if (confirmUrl) {
        return fetchRemoteBinary(confirmUrl, false);
      }
    }
  }

  return { buffer, status: response.status, contentType, contentDisposition, finalUrl };
}

async function decodeBufferToHtml(
  buffer: Buffer,
  contentType: string,
  contentDisposition: string,
  isGoogleSource: boolean,
  finalUrl: string
): Promise<{ html: string; sourceType: 'docx' | 'html' | 'web' }> {
  if (isZipDocxBuffer(buffer)) {
    const extracted = await mammoth.extractRawText({ buffer });
    const cleaned = normalizeExtractedCode(extracted.value || '');
    if (!cleaned) {
      throw new Error('DOCX ফাইলটির ভেতর কোনো HTML কোড পাওয়া যায়নি।');
    }
    return { html: cleaned, sourceType: 'docx' };
  }

  const rawText = buffer.toString('utf8');
  if (contentType.includes('application/pdf') || rawText.startsWith('%PDF-')) {
    throw new Error('এটি একটি PDF ফাইল। PDF দেখাতে মেনু থেকে "পিডিএফ যোগ" অপশন ব্যবহার করুন।');
  }

  if (isGoogleSource) {
    const cleaned = normalizeExtractedCode(rawText);
    return { html: cleaned, sourceType: 'html' };
  }

  const normalized = normalizeExtractedCode(rawText);
  return { html: injectBaseTag(normalized, finalUrl), sourceType: 'web' };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const port = Number(process.env.PORT) || 3000;

  app.get('/api/fetch-html', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: 'লিংক দেওয়া হয়নি।' });
      return;
    }

    const googleSource = extractGoogleSource(rawUrl);
    if (googleSource) {
      const encodedId = encodeURIComponent(googleSource.id);
      const candidates =
        googleSource.kind === 'gdoc'
          ? [
              `https://docs.google.com/document/d/${encodedId}/export?format=txt`,
              `https://docs.google.com/document/d/${encodedId}/export?format=docx`,
              `https://drive.usercontent.google.com/download?id=${encodedId}&export=download&confirm=t`,
              `https://drive.google.com/uc?export=download&confirm=t&id=${encodedId}`
            ]
          : [
              `https://drive.usercontent.google.com/download?id=${encodedId}&export=download&confirm=t`,
              `https://drive.google.com/uc?export=download&confirm=t&id=${encodedId}`,
              `https://drive.google.com/uc?export=download&id=${encodedId}`,
              `https://docs.google.com/document/d/${encodedId}/export?format=txt`,
              `https://docs.google.com/document/d/${encodedId}/export?format=docx`
            ];

      let sawAuthError = false;
      let lastErrorMsg = '';

      for (const candidate of candidates) {
        try {
          const { buffer, status, contentType, contentDisposition, finalUrl } = await fetchRemoteBinary(candidate);
          if (status < 200 || status >= 400 || buffer.length === 0) continue;

          if (!isZipDocxBuffer(buffer)) {
            const textPreview = buffer.toString('utf8');
            if (looksLikeDriveAuthOrAccessError(textPreview)) {
              sawAuthError = true;
              continue;
            }
            if (looksLikeDriveVirusConfirmPage(textPreview)) {
              continue;
            }
            // Google Doc viewer wrapper shell shouldn't be treated as valid user HTML
            if (
              finalUrl.includes('docs.google.com/document/') &&
              !finalUrl.includes('/export') &&
              textPreview.includes('DOCS_modelChunk')
            ) {
              continue;
            }
          }

          const { html, sourceType } = await decodeBufferToHtml(
            buffer,
            contentType,
            contentDisposition,
            true,
            finalUrl
          );
          if (html.trim().length > 0) {
            res.json({ html, sourceType });
            return;
          }
        } catch (err) {
          lastErrorMsg = err instanceof Error ? err.message : String(err);
        }
      }

      if (sawAuthError) {
        res.status(403).json({
          error: 'গুগল ড্রাইভ ফাইলটি পাবলিক করা নেই। ফাইলে Share → "Anyone with the link" (Viewer) পারমিশন দিন।'
        });
        return;
      }

      res.status(502).json({
        error:
          lastErrorMsg ||
          'গুগল ড্রাইভ থেকে HTML / DOCX ফাইল লোড করা যায়নি। ফাইলটিতে "Anyone with the link" পারমিশন দেওয়া আছে কিনা নিশ্চিত করুন।'
      });
      return;
    }

    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    let parsed: URL;
    try {
      parsed = new URL(withProtocol);
    } catch {
      res.status(400).json({ error: 'সঠিক ওয়েব লিংক বা HTML কোড দিন।' });
      return;
    }

    if (!['http:', 'https:'].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) {
      res.status(400).json({ error: 'এই লিংকটি অনুমোদিত নয়।' });
      return;
    }

    try {
      const { buffer, status, contentType, contentDisposition, finalUrl } = await fetchRemoteBinary(parsed.toString());
      if (status < 200 || status >= 400) {
        res.status(502).json({ error: `ওয়েবসাইট থেকে HTTP ${status} ত্রুটি এসেছে।` });
        return;
      }
      const { html, sourceType } = await decodeBufferToHtml(
        buffer,
        contentType,
        contentDisposition,
        false,
        finalUrl
      );
      res.json({ html, sourceType, finalUrl });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'ওয়েবপেজ লোড করতে সমস্যা হয়েছে।' });
    }
  });

  const inferAudioMimeType = (contentType: string, contentDisposition: string, sourceUrl: string): string => {
    const cleanCt = (contentType || '').split(';')[0].trim().toLowerCase();
    if (cleanCt.startsWith('audio/') || cleanCt === 'video/mp4' || cleanCt === 'video/webm') {
      return cleanCt;
    }
    const hint = `${contentDisposition} ${sourceUrl}`.toLowerCase();
    if (hint.includes('.m4a') || hint.includes('.mp4')) return 'audio/mp4';
    if (hint.includes('.wav')) return 'audio/wav';
    if (hint.includes('.ogg') || hint.includes('.oga')) return 'audio/ogg';
    if (hint.includes('.aac')) return 'audio/aac';
    if (hint.includes('.flac')) return 'audio/flac';
    if (hint.includes('.webm')) return 'audio/webm';
    return 'audio/mpeg';
  };

  app.get('/api/audio-stream', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: 'অডিও লিংক দেওয়া হয়নি।' });
      return;
    }

    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const googleSource = extractGoogleSource(rawUrl);

    let candidates: string[] = [];
    if (googleSource) {
      const encodedId = encodeURIComponent(googleSource.id);
      candidates = [
        `https://drive.usercontent.google.com/download?id=${encodedId}&export=download&confirm=t`,
        `https://drive.google.com/uc?export=download&confirm=t&id=${encodedId}`,
        `https://drive.google.com/uc?export=download&id=${encodedId}`
      ];
    } else {
      const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      let parsed: URL;
      try {
        parsed = new URL(withProtocol);
      } catch {
        res.status(400).json({ error: 'সঠিক অডিও লিংক দিন।' });
        return;
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) {
        res.status(400).json({ error: 'এই লিংকটি অনুমোদিত নয়।' });
        return;
      }
      candidates = [parsed.toString()];
    }

    let sawAuthError = false;
    let lastStatus = 0;

    for (const candidate of candidates) {
      try {
        const fetchAudio = async (target: string, followConfirm: boolean): Promise<Response | null> => {
          const headers: Record<string, string> = {
            'User-Agent': BROWSER_USER_AGENT,
            Accept: 'audio/*,*/*;q=0.9'
          };
          if (rangeHeader) {
            headers.Range = rangeHeader;
          }
          const upstream = await fetch(target, {
            headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(20000)
          });

          const ct = (upstream.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('text/html')) {
            const htmlText = await upstream.text();
            if (looksLikeDriveAuthOrAccessError(htmlText)) {
              sawAuthError = true;
              return null;
            }
            if (followConfirm && looksLikeDriveVirusConfirmPage(htmlText)) {
              const confirmUrl = extractDriveConfirmUrl(htmlText, upstream.url || target);
              if (confirmUrl) {
                return fetchAudio(confirmUrl, false);
              }
            }
            return null;
          }

          return upstream;
        };

        const upstreamRes = await fetchAudio(candidate, true);
        if (!upstreamRes) continue;
        lastStatus = upstreamRes.status;
        if (!upstreamRes.ok && upstreamRes.status !== 206) {
          try {
            await upstreamRes.body?.cancel();
          } catch {
            // ignore
          }
          continue;
        }
        if (!upstreamRes.body) continue;

        const ct = upstreamRes.headers.get('content-type') || '';
        const cd = upstreamRes.headers.get('content-disposition') || '';
        const mimeType = inferAudioMimeType(ct, cd, rawUrl);

        res.status(upstreamRes.status);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Accept-Ranges', upstreamRes.headers.get('accept-ranges') || 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=300');
        const contentLen = upstreamRes.headers.get('content-length');
        if (contentLen) res.setHeader('Content-Length', contentLen);
        const contentRange = upstreamRes.headers.get('content-range');
        if (contentRange) res.setHeader('Content-Range', contentRange);

        const nodeStream = Readable.fromWeb(upstreamRes.body as unknown as import('node:stream/web').ReadableStream);
        req.on('close', () => {
          nodeStream.destroy();
        });
        nodeStream.on('error', () => {
          if (!res.headersSent) {
            res.status(502).end();
          } else {
            res.end();
          }
        });
        nodeStream.pipe(res);
        return;
      } catch {
        // try next candidate
      }
    }

    if (sawAuthError) {
      res.status(403).json({
        error: 'গুগল ড্রাইভ অডিও ফাইলটি পাবলিক করা নেই। ফাইলে Share → "Anyone with the link" (Viewer) পারমিশন দিন।'
      });
      return;
    }

    res.status(502).json({
      error:
        lastStatus === 404
          ? 'অডিও ফাইলটি পাওয়া যায়নি।'
          : 'গুগল ড্রাইভ বা লিংক থেকে অডিও লোড করা যায়নি। ফাইলটিতে "Anyone with the link" পারমিশন দেওয়া আছে কিনা দেখুন।'
    });
  });

  app.get('/api/drive-download', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const requestedName = typeof req.query.filename === 'string' ? req.query.filename.trim() : 'Shahani_Rajib_CV.pdf';
    const safeFilename = (requestedName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document.pdf').slice(0, 120);
    if (!rawUrl) {
      res.status(400).json({ error: 'ডাউনলোড লিংক দেওয়া হয়নি।' });
      return;
    }

    const googleSource = extractGoogleSource(rawUrl);
    let candidates: string[] = [];
    if (googleSource) {
      const encodedId = encodeURIComponent(googleSource.id);
      candidates =
        googleSource.kind === 'gdoc'
          ? [
              `https://docs.google.com/document/d/${encodedId}/export?format=pdf`,
              `https://drive.usercontent.google.com/download?id=${encodedId}&export=download&confirm=t`,
              `https://drive.google.com/uc?export=download&confirm=t&id=${encodedId}`
            ]
          : [
              `https://drive.usercontent.google.com/download?id=${encodedId}&export=download&confirm=t`,
              `https://drive.google.com/uc?export=download&confirm=t&id=${encodedId}`,
              `https://drive.google.com/uc?export=download&id=${encodedId}`
            ];
    } else {
      const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      let parsed: URL;
      try {
        parsed = new URL(withProtocol);
      } catch {
        res.status(400).json({ error: 'সঠিক ডাউনলোড লিংক দিন।' });
        return;
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) {
        res.status(400).json({ error: 'এই লিংকটি অনুমোদিত নয়।' });
        return;
      }
      candidates = [parsed.toString()];
    }

    let sawAuthError = false;
    for (const candidate of candidates) {
      try {
        const fetchFile = async (target: string, followConfirm: boolean): Promise<Response | null> => {
          const upstream = await fetch(target, {
            headers: {
              'User-Agent': BROWSER_USER_AGENT,
              Accept: 'application/pdf,application/octet-stream,*/*;q=0.9'
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(25000)
          });
          const ct = (upstream.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('text/html')) {
            const htmlText = await upstream.text();
            if (looksLikeDriveAuthOrAccessError(htmlText)) {
              sawAuthError = true;
              return null;
            }
            if (followConfirm && looksLikeDriveVirusConfirmPage(htmlText)) {
              const confirmUrl = extractDriveConfirmUrl(htmlText, upstream.url || target);
              if (confirmUrl) {
                return fetchFile(confirmUrl, false);
              }
            }
            return null;
          }
          return upstream;
        };

        const upstreamRes = await fetchFile(candidate, true);
        if (!upstreamRes || !upstreamRes.ok || !upstreamRes.body) continue;

        const ct = upstreamRes.headers.get('content-type') || 'application/pdf';
        const cd = upstreamRes.headers.get('content-disposition') || '';
        const contentLen = upstreamRes.headers.get('content-length');

        res.status(200);
        res.setHeader('Content-Type', ct);
        res.setHeader('Content-Disposition', cd.includes('filename') ? cd.replace(/^inline/i, 'attachment') : `attachment; filename="${safeFilename}"`);
        if (contentLen) res.setHeader('Content-Length', contentLen);

        const nodeStream = Readable.fromWeb(upstreamRes.body as unknown as import('node:stream/web').ReadableStream);
        req.on('close', () => nodeStream.destroy());
        nodeStream.on('error', () => {
          if (!res.headersSent) res.status(502).end();
          else res.end();
        });
        nodeStream.pipe(res);
        return;
      } catch {
        // try next candidate
      }
    }

    if (sawAuthError) {
      res.status(403).json({
        error: 'গুগল ড্রাইভ ফাইলটি পাবলিক করা নেই। ফাইলে Share → "Anyone with the link" (Viewer) পারমিশন দিন।'
      });
      return;
    }
    res.status(502).json({ error: 'পিডিএফ ডাউনলোড করা যায়নি।' });
  });

  const getRequestOrigin = (req: express.Request): string => {
    const rawProto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const rawHost = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    if (!rawHost) return '';
    return `${rawProto === 'http' ? 'http' : 'https'}://${rawHost}`;
  };

  app.get('/robots.txt', (req, res) => {
    const origin = getRequestOrigin(req);
    const sitemapLine = origin ? `${origin}/sitemap.xml` : '/sitemap.xml';
    res.type('text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapLine}\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = getRequestOrigin(req);
    const base = origin || '';
    const today = new Date().toISOString().split('T')[0];
    const pages = [
      { loc: `${base}/`, priority: '1.0', freq: 'daily' },
      { loc: `${base}/?page=raj-magic-show`, priority: '0.9', freq: 'weekly' },
      { loc: `${base}/?page=books`, priority: '0.9', freq: 'weekly' },
      { loc: `${base}/?page=blog`, priority: '0.9', freq: 'daily' },
      { loc: `${base}/?page=rubiks-cube`, priority: '0.8', freq: 'weekly' },
      { loc: `${base}/?page=ms-excel`, priority: '0.8', freq: 'weekly' },
      { loc: `${base}/?page=match-box`, priority: '0.8', freq: 'weekly' },
      { loc: `${base}/?page=chess`, priority: '0.8', freq: 'weekly' },
      { loc: `${base}/?page=about-shahani`, priority: '0.8', freq: 'monthly' }
    ];
    const urlsXml = pages
      .map(
        (p) =>
          `  <url>\n    <loc>${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
      )
      .join('\n');
    res.type('application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        etag: true,
        setHeaders: (res, filePath) => {
          const baseName = path.basename(filePath);
          if (baseName === 'index.html' || baseName === 'sw.js' || baseName === 'registerSW.js' || baseName === 'manifest.webmanifest') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`) && /\.(js|css|woff2?)$/i.test(baseName)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        }
      })
    );
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
