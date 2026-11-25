/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, FileSpreadsheet, Award, 
  Search, ArrowUpRight, ChevronLeft, ChevronRight, Briefcase, Youtube, 
  Sparkles, Book, CheckCircle, Clock, Play, 
  Share2, ExternalLink, RefreshCw, X,
  Lock, Unlock, LogOut, Edit2, Trash2, Plus, Save, Image as ImageIcon, Video, PlusCircle, Moon, Star, Menu,
  BookMarked, Download, FileText, ArrowUp, ArrowDown, MoveVertical, RotateCcw, Type,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Layers, Palette, LayoutGrid, Code,
  UserPlus, Users, CopyPlus, Smartphone, Globe, ShieldCheck, Copy, Check, ZoomIn, ZoomOut, Music,
  Phone, Send
} from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import type { BlogBlock, BlogPostRecord } from './components/BlogView';
import SubpageBackButton from './components/SubpageBackButton';
import CarouselShowcase, { SLIDER_STYLE_OPTIONS, type SliderStyleType } from './components/CarouselShowcase';
import { bengaliToLatinPhonetic, matchesBilingualSearch } from './utils/bilingualSearch';
const BooksSheetReader = React.lazy(() => import('./components/BooksSheetReader'));
const HtmlCodeSlab = React.lazy(() => import('./components/HtmlCodeSlab'));
const AudioPlayerSlab = React.lazy(() => import('./components/AudioPlayerSlab'));
const TasVanishView = React.lazy(() => import('./components/TasVanishView'));
const TasPredictionView = React.lazy(() => import('./components/TasPredictionView'));
const PinCardView = React.lazy(() => import('./components/PinCardView'));
const TaserGhoriView = React.lazy(() => import('./components/TaserGhoriView'));
const IskaponerTekkaView = React.lazy(() => import('./components/IskaponerTekkaView'));
const BlogView = React.lazy(() => import('./components/BlogView'));
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import {
  db,
  auth,
  googleProvider,
  ADMIN_EMAILS,
  OperationType,
  handleFirestoreError,
  stripUndefinedDeep,
  sha256Hex
} from './firebase';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'অপ্রত্যাশিত সমস্যা হয়েছে' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070711] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#121225] border border-purple-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-amber-300">অ্যাপটি লোড করতে সমস্যা হয়েছে</h2>
            <p className="text-xs text-purple-200/80 break-words">
              অনুগ্রহ করে পেজটি রিলোড করুন অথবা আবার চেষ্টা করুন।
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
            >
              পুনরায় লোড করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface CustomBlock {
  id: string;
  type: 'video' | 'video-slider' | 'image-slider' | 'text-slab' | 'drive-image' | 'pdf' | 'html-code' | 'audio';
  link?: string;
  slides?: string[];
  headline?: string;
  body?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  linkUrl?: string;
  images?: string[];
  imageWidthIdx?: number;
  imageHeightIdx?: number;
  mergeTop?: boolean;
  mergeBottom?: boolean;
  pdfTitle?: string;
  pdfWidthIdx?: number;
  pdfHeightIdx?: number;
  pdfDownloadable?: boolean;
  htmlTitle?: string;
  audioTitle?: string;
  posY?: number;
  aspectHeight?: number | null;
  zoom?: number;
  sliderStyle?: SliderStyleType;
}

function normalizeExternalUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const DRIVE_IMG_WIDTHS = [
  { label: '২৫%', cls: 'w-[25%]' },
  { label: '৩৫%', cls: 'w-[35%]' },
  { label: '৫০%', cls: 'w-[50%]' },
  { label: '৬৫%', cls: 'w-[65%]' },
  { label: '৭৫%', cls: 'w-[75%]' },
  { label: '৮৫%', cls: 'w-[85%]' },
  { label: '১০০%', cls: 'w-full' }
];

const DRIVE_IMG_HEIGHTS = [
  { label: 'খুব ছোট', maxCls: 'max-h-[150px]', gridCls: 'h-[140px]' },
  { label: 'ছোট', maxCls: 'max-h-[220px]', gridCls: 'h-[190px]' },
  { label: 'মাঝারি', maxCls: 'max-h-[320px]', gridCls: 'h-[240px]' },
  { label: 'স্বাভাবিক', maxCls: 'max-h-[420px]', gridCls: 'h-[300px]' },
  { label: 'বড়', maxCls: 'max-h-[560px]', gridCls: 'h-[380px]' },
  { label: 'খুব বড়', maxCls: 'max-h-[740px]', gridCls: 'h-[480px]' }
];

const PDF_VIEWER_HEIGHTS = [
  { label: 'খুব ছোট', cls: 'h-[240px]' },
  { label: 'ছোট', cls: 'h-[340px]' },
  { label: 'মাঝারি', cls: 'h-[440px]' },
  { label: 'স্বাভাবিক', cls: 'h-[540px]' },
  { label: 'বড়', cls: 'h-[680px]' },
  { label: 'খুব বড়', cls: 'h-[820px]' }
];

const ABOUT_BTN_WIDTHS = [
  { label: 'খুব ছোট', cls: 'max-w-[220px]' },
  { label: 'ছোট', cls: 'max-w-xs' },
  { label: 'মাঝারি', cls: 'max-w-sm' },
  { label: 'স্বাভাবিক', cls: 'max-w-md' },
  { label: 'বড়', cls: 'max-w-lg' },
  { label: 'খুব বড়', cls: 'max-w-2xl' }
];

interface AppThemeConfig {
  preset: string;
  bgColor: string;
  surfaceColor: string;
  headerColor: string;
  accentColor: string;
  secondaryColor: string;
  textColor: string;
}

const DEFAULT_APP_THEME: AppThemeConfig = {
  preset: 'default',
  bgColor: '#070711',
  surfaceColor: '#13132b',
  headerColor: '#0d0d1f',
  accentColor: '#f59e0b',
  secondaryColor: '#9333ea',
  textColor: '#f0f0f5'
};

const APP_THEME_PRESETS: { id: string; name: string; swatchCls: [string, string, string]; theme: AppThemeConfig }[] = [
  {
    id: 'default',
    name: 'ডিফল্ট (মিডনাইট ম্যাজিশিয়ান)',
    swatchCls: ['bg-[#070711]', 'bg-[#9333ea]', 'bg-[#f59e0b]'],
    theme: { ...DEFAULT_APP_THEME }
  },
  {
    id: 'emerald',
    name: 'পান্না সবুজ (Emerald Night)',
    swatchCls: ['bg-[#04120d]', 'bg-[#10b981]', 'bg-[#34d399]'],
    theme: {
      preset: 'emerald',
      bgColor: '#04120d',
      surfaceColor: '#0a231a',
      headerColor: '#061912',
      accentColor: '#34d399',
      secondaryColor: '#10b981',
      textColor: '#ecfdf5'
    }
  },
  {
    id: 'ocean',
    name: 'গভীর সমুদ্র নীল (Ocean Blue)',
    swatchCls: ['bg-[#050d1a]', 'bg-[#3b82f6]', 'bg-[#38bdf8]'],
    theme: {
      preset: 'ocean',
      bgColor: '#050d1a',
      surfaceColor: '#0c1c36',
      headerColor: '#081428',
      accentColor: '#38bdf8',
      secondaryColor: '#3b82f6',
      textColor: '#f0f9ff'
    }
  },
  {
    id: 'royal-gold',
    name: 'রয়্যাল ব্ল্যাক ও গোল্ড',
    swatchCls: ['bg-[#09090b]', 'bg-[#d97706]', 'bg-[#fbbf24]'],
    theme: {
      preset: 'royal-gold',
      bgColor: '#09090b',
      surfaceColor: '#18181b',
      headerColor: '#111114',
      accentColor: '#fbbf24',
      secondaryColor: '#d97706',
      textColor: '#fafafa'
    }
  },
  {
    id: 'crimson',
    name: 'গাঢ় রুবি ভেলভেট (Crimson)',
    swatchCls: ['bg-[#14060b]', 'bg-[#e11d48]', 'bg-[#fb7185]'],
    theme: {
      preset: 'crimson',
      bgColor: '#14060b',
      surfaceColor: '#260c16',
      headerColor: '#1c0810',
      accentColor: '#fb7185',
      secondaryColor: '#e11d48',
      textColor: '#fff1f2'
    }
  },
  {
    id: 'cyber-teal',
    name: 'ডার্ক সায়ান (Cyber Teal)',
    swatchCls: ['bg-[#061217]', 'bg-[#0891b2]', 'bg-[#22d3ee]'],
    theme: {
      preset: 'cyber-teal',
      bgColor: '#061217',
      surfaceColor: '#0e242e',
      headerColor: '#091a21',
      accentColor: '#22d3ee',
      secondaryColor: '#0891b2',
      textColor: '#ecfeff'
    }
  },
  {
    id: 'light-classic',
    name: 'লাইট ক্লাসিক (সাদা ও গোল্ড)',
    swatchCls: ['bg-[#f8fafc]', 'bg-[#6d28d9]', 'bg-[#d97706]'],
    theme: {
      preset: 'light-classic',
      bgColor: '#f8fafc',
      surfaceColor: '#ffffff',
      headerColor: '#f1f5f9',
      accentColor: '#d97706',
      secondaryColor: '#6d28d9',
      textColor: '#0f172a'
    }
  }
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#070711').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 7, g: 7, b: 17 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbaStr(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(hexA: string, hexB: string, ratioB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const t = Math.min(1, Math.max(0, ratioB));
  const r = Math.round(a.r * (1 - t) + b.r * t);
  const g = Math.round(a.g * (1 - t) + b.g * t);
  const bl = Math.round(a.b * (1 - t) + b.b * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function isLightHex(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.58;
}

interface BannerFrame {
  posY?: number;
  aspectHeight?: number;
  zoom?: number;
  widthPct?: number;
}

interface SubPageItem {
  id: string;
  title: string;
  desc: string;
  yt?: string;
  category?: string;
  image?: string;
  pdfUrl?: string;
  price?: string;
}

interface PageData {
  id: string;
  title: string;
  category: string;
  desc: string;
  items: SubPageItem[];
}

// Helper to convert YouTube, Facebook, or Google Drive video link to embed iframe src
function getEmbedUrl(link: string) {
  if (!link) return '';
  const trimmed = link.trim();
  if (trimmed.includes('embed/') || trimmed.includes('plugins/video.php')) {
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
      const id = parts[1].split('?')[0].split('/')[0];
      return `https://www.youtube.com/embed/${id}`;
    }
  }
  if (trimmed.includes('youtube.com/watch?v=')) {
    const vMatch = trimmed.match(/[?&]v=([^&]+)/);
    if (vMatch && vMatch[1]) {
      return `https://www.youtube.com/embed/${vMatch[1]}`;
    }
  }
  if (trimmed.includes('youtu.be/')) {
    const parts = trimmed.split('youtu.be/');
    if (parts[1]) {
      const id = parts[1].split('?')[0];
      return `https://www.youtube.com/embed/${id}`;
    }
  }
  if (trimmed.includes('facebook.com')) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false&width=560`;
  }
  if (trimmed.length === 11 && !trimmed.includes('/')) {
    return `https://www.youtube.com/embed/${trimmed}`;
  }
  return trimmed;
}

// Helper for video slider embed URL (adds YouTube JS API flag to detect play/pause)
function getSliderEmbedUrl(link: string): string {
  const base = getEmbedUrl(link);
  if (!base) return '';
  if (base.includes('youtube.com/embed/')) {
    const sep = base.includes('?') ? '&' : '?';
    const originParam =
      typeof window !== 'undefined' && window.location?.origin
        ? `&origin=${encodeURIComponent(window.location.origin)}`
        : '';
    return `${base}${sep}enablejsapi=1&rel=0${originParam}`;
  }
  return base;
}

// Helper to convert Google Drive share links to direct displayable image URLs
function normalizeImageUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }
  const idMatch = trimmed.match(/(?:drive\.google\.com|drive\.usercontent\.google\.com)\/[^\s]*[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }
  return trimmed;
}

// Helper to convert Google Drive PDF links to embeddable preview URLs
function normalizePdfEmbedUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }
  const idMatch = trimmed.match(/(?:drive\.google\.com|drive\.usercontent\.google\.com)\/[^\s]*[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }
  return trimmed;
}

const DEFAULT_SITE_CONTENT = {
  heroTitle: "শাহানী রাজীব (Shahani Rajib)",
  heroBadge: "🌙 নিশিপাওয়া জাদুকর • প্রজেক্ট ম্যানেজার • প্রভাষক",
  poeticQuote: `"আমি রাজ; কালো একটি ছেলে। হলুদ পাঞ্জাবি পড়ে রাতের পর রাত রাস্তায় ঘুরি। ইঞ্জিনিয়ারিং পড়েছি কোন সেমিস্টারে বই না কিনে, বই কেনার টাকায় কিনেছি গল্পের বই! ঘরের দেওয়ালে রঙিন কালি দিয়ে কবিতা লিখি। কাগজে-ক্যানভাসে ছবি আঁকতে ইচ্ছা করে না বলে শার্টে গেঞ্জিতে ছবি আঁকি। লজিক যদিও ভালো বুঝি না তবুও হাতে সারাদিন রুবিক্স কিউব ঘুরাই। ভুত ভালো লাগলেও অদ্ভুত কিছু ভালো লাগে না বলে মাথায় পতাকা বেঁধে ম্যাজিক দেখিয়ে বেড়াই। নিশিপাওয়া রাতে সাদা-কালো ছক সামনে নিয়ে ভাবি সিসিলিয়ান ডিফেন্সে একটা নাইট কম হলে কিভাবে চেক-মেট দেয়া যাবে!আর এখন? রাজত্ব বিসর্জন দিয়ে যাবজ্জীবন অজ্ঞাতবাস! নাগরিক ঢাকা শহরে আহত সাদা ঘোড়া নিয়ে খুঁজে চলেছি জাদুর প্রদীপ!!!"`,
  careerText: "ব্যক্তিগত জীবনে চাকুরীরত আছেন আকিজ গ্রুপে (Akij Group) প্রজেক্ট ম্যানেজার হিসাবে। একই সাথে শিক্ষকতা করছেন সোনারগাঁও বিশ্ববিদ্যালয়ে (Sonargaon University)।",
  publicationText: "লেখালেখি করছেন ছেলেবেলা থেকেই। প্রথম আলো, কালের কণ্ঠ, আজকের কাগজ, সমকাল জাতীয় দৈনিক ছাড়াও লিখেছেন মাসিক রহস্য পত্রিকা, কম্পিউটার জগত, ভারত বিচিত্রা ও অবসর ম্যাগাজিনে।",
  careerText2: "কর্পোরেট প্রজেক্ট ম্যানেজমেন্ট এবং বুদ্ধিবৃত্তিক পাজল ও ম্যাজিক পারফরম্যান্সে দীর্ঘ ১৫ বছরেরও বেশি অভিজ্ঞতা রয়েছে। দেশ বিদেশে বিভিন্ন কর্মশালা ও সেমিনারে নিয়মিত অংশ নেন।",
  awardsText: "পুরস্কার ও সম্মাননা: জাতীয় পর্যায়ে বিভিন্ন সাংস্কৃতিক ও উদ্ভাবনী প্রতিযোগিতায় বিশেষ সম্মাননা প্রাপ্ত।",
  sliderImages: [
    { url: "https://lh3.googleusercontent.com/d/1adnhLHTGMaWGQYjyX9EDZzYASqvAzvFN", caption: "🌙 মিডনাইট ম্যাজিক ও অফিশিয়াল মোমেন্ট" },
    { url: "https://lh3.googleusercontent.com/d/1784LKDE8IHTm7Z96xlVuXwqx3jqIO3LB", caption: "রুবিক্স কিউব ও পাজল রহস্য" },
    { url: "https://lh3.googleusercontent.com/d/1hGPUZZ-in0bhhIVljiU9nkuCwgTYfVhj", caption: "ম্যাজিক শো ও মিস্টিক লেকচার" },
    { url: "https://lh3.googleusercontent.com/d/1bmmpWvMd0R0FjhrbPtJ_mADNtkAzd6ID", caption: "সাহিত্য ও ক্যানভাস আর্ট" }
  ],
  profileImage: "/assets/aistudio/shahani_wiki_9794c1e7.png",
  wikiProfileVideo: "",
  featuredVideos: [] as { id: string, title: string, yt: string }[],
  headerBrandName: "Shahani Rajib",
  headerBrandLogo: "https://lh3.googleusercontent.com/d/1jqU1ivOslQkqB2YZDhuxRkW8kQOyWPd5",
  aboutButtonImage: "/assets/aistudio/About_Shahani_6595dec1.png",
  aboutButtonWidthIdx: 3,
  topNavTabs: [
    { id: 'home', label: 'হোম', iconUrl: '/assets/aistudio/Home_Logo_deea1969.png' },
    { id: 'raj-magic-show', label: 'ম্যাজিক', iconUrl: '/assets/aistudio/Headline_Logo_41f367d1.png' },
    { id: 'books', label: 'বই', iconUrl: '/assets/aistudio/Books_05f65e05.png' },
    { id: 'rubiks-cube', label: 'কিউব', iconUrl: '/assets/aistudio/Rubiks_Logo_831d5a35.png' },
    { id: 'ms-excel', label: 'এক্সেল', iconUrl: '/assets/aistudio/Excel_Logo_02662bc4.png' },
    { id: 'match-box', label: 'সংগ্রহ', iconUrl: '/assets/aistudio/Collection_Logo_1603a52d.png' },
    { id: 'chess', label: 'দাবা', iconUrl: '/assets/aistudio/Daba_Logo_e68aa727.png' },
    { id: 'blog', label: 'ব্লগ', iconUrl: '/assets/aistudio/blog_logo_632001ae.png' }
  ] as { id: string; label: string; iconUrl: string; isCustom?: boolean }[],
  pageBanners: {
    'default': "",
    'raj-magic-show': "",
    'rubiks-cube': "",
    'match-box': "",
    'chess': "",
    'books': "",
    'ms-excel': "",
    'blog': "",
    'certificate': "",
    'certificates-tab': "",
    'trainer-tab': "",
    'career-tab': "",
    'art-tab': "",
    'education-tab': "",
    'award-tab': "",
    'inner_tab_matchbox': ""
  },
  subpageInfo: {
    'raj-magic-show': { title: "রাজ ম্যাজিক শো", category: "কন্টাক্ট ফর ম্যাজিক শো", desc: "হাতসাফাই, ক্লোজ-আপ ইল্যুশন, কার্ড ট্রিকস এবং ম্যাজিকের বিজ্ঞানসম্মত কৌশল।" },
    'rubiks-cube': { title: "রুবিক্স কিউব", category: "পাজল ও লজিক", desc: "হাজারেরও বেশি রুবিক্স কিউবের সংগ্রহশালা, অ্যালগরিদম সমাধান এবং গাণিতিক প্যাটার্ন।" },
    'match-box': { title: "ম্যাচবক্স সংগ্রহ", category: "সংগ্রহ ও শখ", desc: "পাঁচ শতাধিক ভিন্টেজ, অ্যান্টিক এবং আধুনিক দিয়াশলাই বাক্সের দুর্লভ সংগ্রহ।" },
    'inner_tab_matchbox': { title: "ম্যাচবক্স", category: "সংগ্রহ ও শখ", desc: "ভিন্টেজ, অ্যান্টিক ও দুর্লভ ম্যাচবক্সের সংগ্রহ।" },
    'chess': { title: "দাবা খেলা", category: "নিশিপাওয়া রাত", desc: "সিসিলিয়ান ডিফেন্স, চেক-মেট ট্যাকটিক্স এবং নিশিপাওয়া রাতের দাবা ভাবনা।" },
    'books': { title: "বই ও প্রকাশনা", category: "সাহিত্য", desc: "প্রকাশিত মৌলিক বই, প্রবন্ধ ও জাতীয় দৈনিক ও ম্যাগাজিনের লেখালেখি।" },
    'ms-excel': { title: "এমএস এক্সেল", category: "প্রফেশনাল স্কিলস", desc: "প্রজেক্ট ম্যানেজারদের জন্য এক্সেল শর্টকাট, অটোমেশন এবং ডেটা অ্যানালাইসিস।" },
    'blog': { title: "ব্লগ", category: "গল্প ও ভাবনা", desc: "প্রবন্ধ, অভিজ্ঞতা, ম্যাজিক ভাবনা ও নানা বিষয়ের লেখালেখি।" },
    'certificate': { title: "সিভি ও কর্মজীবন", category: "ক্যারিয়ার প্রোফাইল", desc: "কর্মজীবন, শিক্ষাগত যোগ্যতা, পুরস্কার এবং প্রফেশনাল জীবনবৃত্তান্ত।" },
    'education-tab': { title: "এডুকেশন", category: "শিক্ষাগত যোগ্যতা", desc: "একাডেমিক পড়াশোনা, ডিগ্রি এবং শিক্ষা জীবন সংক্রান্ত তথ্য।" },
    'certificates-tab': { title: "সার্টিফিকেট", category: "সম্মাননা ও সনদপত্র", desc: "অর্জিত বিভিন্ন সার্টিফিকেট, রেকর্ডস ও সম্মাননার সংগ্রহ।" },
    'trainer-tab': { title: "ট্রেইনার", category: "প্রশিক্ষণ ও কর্মশালা", desc: "প্রশিক্ষণ সেশন, ওয়ার্কশপ এবং কর্পোরেট ট্রেনিং সংক্রান্ত তথ্য।" },
    'career-tab': { title: "ক্যারিয়ার", category: "পেশাগত জীবন", desc: "কর্মজীবন, অভিজ্ঞতা ও প্রজেক্ট ম্যানেজমেন্ট যাত্রা।" },
    'art-tab': { title: "আর্ট", category: "আর্ট গ্যালারি", desc: "আর্ট বাই রাজ সংগ্রহ।" },
    'award-tab': { title: "অ্যাওয়ার্ড", category: "পুরস্কার ও সম্মাননা", desc: "জাতীয় ও আন্তর্জাতিক পর্যায়ের অর্জন, পুরস্কার এবং সম্মাননা।" },
    'tas-vanish': {
      title: "তাস ভ্যানিস",
      category: "ম্যাজিক কার্ড ট্রিক",
      desc: "৮টি ছবির মধ্য থেকে যেকোনো ৫টি ছবির উপরে ক্লিক করে নির্বাচন করুন। ৫টি নির্বাচন সম্পূর্ণ হলে নিচের বাক্সে ছবিগুলো একে অপরের ওপর দেখা যাবে।"
    },
    'tas-prediction': {
      title: "তাস প্রেডিকশন",
      category: "ম্যাজিক কার্ড ট্রিক",
      desc: "যেকোনো কার্ড মনে মনে বেছে নিন এবং যে যে ছবিতে সেই কার্ডটি আছে সেগুলোর উপরে ক্লিক করুন। নিচের কার্ড বক্সে আপনার নির্বাচিত তাসটি দেখা যাবে।"
    },
    'pin-card': {
      title: "পিন কার্ড",
      category: "ম্যাজিক কার্ড ট্রিক",
      desc: "অ্যাপ আনলক করে ৪ ডিজিটের পিন নম্বর অনুযায়ী নির্ধারিত বাইসাইকেল প্লেয়িং কার্ড ফুলস্ক্রিনে দেখুন।"
    },
    'taser-ghori': {
      title: "তাসের ঘড়ি",
      category: "ম্যাজিক কার্ড ট্রিক",
      desc: "ঘড়ির মতো সাজানো ১২টি তাসের ওপর একবার ক্লিক করলে হালকা নড়বে এবং ডাবল ক্লিক করলে ফ্ল্যাশ ও ফ্লিপ হয়ে সামনের তাস দেখা যাবে।"
    },
    'iskaponer-tekka': {
      title: "ইস্কাপনের টেক্কা",
      category: "ম্যাজিক কার্ড ট্রিক",
      desc: "তাসগুলো টেনে যেকোনো বর্ডারে বসান এবং যেকোনো তাসে ডাবল ক্লিক করলে ফ্ল্যাশ ও ফ্লিপ হয়ে সামনের বা পেছনের দিক দেখা যাবে।"
    }
  },
  homeFeatureTabs: [
    { id: 'education-tab', label: 'এডুকেশন', iconUrl: '/assets/aistudio/Education_Card_5c874c48.png' },
    { id: 'certificates-tab', label: 'সার্টিফিকেট', iconUrl: '/assets/certificate-logo.svg' },
    { id: 'trainer-tab', label: 'ট্রেইনার', iconUrl: '/assets/aistudio/Training_Logo_a8b5b931.png' },
    { id: 'career-tab', label: 'ক্যারিয়ার', iconUrl: '/assets/job-history-logo.svg' },
    { id: 'art-tab', label: 'আর্ট', iconUrl: '/assets/aistudio/Arts_Logo_c274ecaf.png' },
    { id: 'award-tab', label: 'অ্যাওয়ার্ড', iconUrl: '/assets/aistudio/Award_logo_6005637d.png' }
  ] as { id: string; label: string; iconUrl: string; isCustom?: boolean }[],
  socialLinks: [
    { id: 'facebook', name: 'Facebook', icon: 'fa-brands fa-facebook-f', color: '#1877F2', bg: 'from-blue-600/30 to-blue-900/50', border: 'border-blue-500/50', url: 'https://www.facebook.com/shahani.rajib/' },
    { id: 'youtube', name: 'YouTube', icon: 'fa-brands fa-youtube', color: '#FF0000', bg: 'from-red-600/30 to-red-900/50', border: 'border-red-500/50', url: 'https://www.youtube.com/@shahanirajib38' },
    { id: 'instagram', name: 'Instagram', icon: 'fa-brands fa-instagram', color: '#E4405F', bg: 'from-pink-600/30 to-purple-900/50', border: 'border-pink-500/50', url: 'https://www.instagram.com/shahani_rajib/' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'fa-brands fa-linkedin-in', color: '#0A66C2', bg: 'from-sky-600/30 to-blue-900/50', border: 'border-sky-500/50', url: 'http://www.linkedin.com/in/rajib-shahani-131088' },
    { id: 'twitter', name: 'X (Twitter)', isX: true, icon: '', color: '#ffffff', bg: 'from-slate-600/40 to-slate-900/80', border: 'border-white/40', url: 'https://twitter.com/RajibShahani9' },
    { id: 'whatsapp', name: 'WhatsApp', icon: 'fa-brands fa-whatsapp', color: '#25D366', bg: 'from-green-600/30 to-emerald-900/50', border: 'border-green-500/50', url: 'https://wa.me/8801923866283' }
  ] as { id: string; name: string; icon: string; isX?: boolean; color: string; bg: string; border: string; url: string }[],
  certGalleryImages: [] as string[],
  careerJobHeading: "জব হিস্ট্রি",
  careerJobImages: [] as string[],
  careerCvHeading: "রেজ্যুমে/সিভি",
  careerCvImages: ["", ""] as string[],
  careerCvPdf: "",
  artHeading: "আর্ট বাই রাজ",
  artImages: [] as string[],
  collectionGalleryImages: [] as string[],
  videoSliders: {} as Record<string, string[]>,
  imageSliders: {} as Record<string, string[]>,
  imageSizes: {} as Record<string, { width?: string, height?: string }>,
  bannerFrames: {} as Record<string, BannerFrame>,
  customBlocks: {} as Record<string, CustomBlock[]>,
  pageSectionOrders: {} as Record<string, string[]>,
  booksCovers: [] as { id: string; title: string; imageUrl: string }[],
  deletedBookIds: [] as string[],
  footerLine1: "© শাহানী রাজীব (Shahani Rajib) • সর্বস্বত্ব সংরক্ষিত",
  footerSiteLabel: "আসল গুগল সাইট:",
  footerSiteLinkText: "sites.google.com/view/shahani9",
  footerSiteUrl: "https://sites.google.com/view/shahani9/home",
  appTheme: { ...DEFAULT_APP_THEME } as AppThemeConfig,
  customSubPages: [] as {
    id: string;
    title: string;
    category: string;
    desc: string;
    showInHomeGrid?: boolean;
    showInMenu?: boolean;
  }[],
  hiddenHomeGridPages: [] as string[],
  pageInnerTabs: {
    'rubiks-cube': [
      {
        id: 'inner_tab_rubiks_2x2',
        label: '2x2',
        iconUrl: '/assets/aistudio/2x2_Logo_22e89a61.png'
      }
    ],
    'match-box': [
      {
        id: 'inner_tab_matchbox',
        label: 'ম্যাচবক্স',
        iconUrl: '/assets/aistudio/matchbox_logo_b26099e1.png'
      }
    ]
  } as Record<string, { id: string; label: string; iconUrl: string }[]>,
  deletedSystemBlockIds: [] as string[],
  blogPosts: [] as BlogPostRecord[],
  aboutStats: [
    { id: 'st_1', value: '১, ৫০০+', label: 'রুবিক্স কিউব' },
    { id: 'st_2', value: '৫০০+', label: 'ম্যাচবক্স সংগ্রহ' },
    { id: 'st_3', value: '৫০০+', label: 'পেপার কাপ আর্ট' },
    { id: 'st_4', value: '৩৯টি', label: 'কলা ও নৈপুণ্য' }
  ] as { id: string; value: string; label: string }[],
  cloneLinks: [] as { id: string; label: string; createdAt: string }[],
  subCloneLinks: [] as {
    id: string;
    label: string;
    targetTabId: string;
    targetTabLabel: string;
    assignedCoAdminEmail?: string;
    createdAt: string;
  }[],
  subCloneConfig: null as {
    targetTabId: string;
    targetTabLabel: string;
    allowedPageIds: string[];
    assignedCoAdminEmail?: string;
  } | null,
  magicBookConfig: {
    visible: true,
    imageUrl: '/assets/aistudio/Book_With_MSOB_f0f5abe2.png',
    linkUrl: 'https://magicschoolofbangladesh.com/raj'
  }
};

function mergeSiteContent(parsed: any) {
  if (!parsed || typeof parsed !== 'object') return DEFAULT_SITE_CONTENT;
  const deletedSystemIds: string[] = Array.isArray(parsed.deletedSystemBlockIds)
    ? parsed.deletedSystemBlockIds
    : [];
  const migratedProfile =
    !parsed.profileImage ||
    parsed.profileImage === '/assets/aistudio/wiki.shahani_62116ca5.png' ||
    parsed.profileImage === '/assets/aistudio/wiki_shahani_black.jpg'
      ? DEFAULT_SITE_CONTENT.profileImage
      : parsed.profileImage;

  let migratedCareer = parsed.careerText || DEFAULT_SITE_CONTENT.careerText;
  let migratedPublication = parsed.publicationText;
  if (!migratedPublication) {
    if (typeof migratedCareer === 'string' && migratedCareer.includes('লেখালেখি করছেন ছেলেবেলা থেকেই')) {
      const splitIdx = migratedCareer.indexOf('লেখালেখি করছেন ছেলেবেলা থেকেই');
      migratedPublication = migratedCareer.slice(splitIdx).trim();
      migratedCareer = migratedCareer.slice(0, splitIdx).trim();
    } else {
      migratedPublication = DEFAULT_SITE_CONTENT.publicationText;
    }
  }

  const savedTabs = Array.isArray(parsed.homeFeatureTabs)
    ? [...parsed.homeFeatureTabs]
    : [...DEFAULT_SITE_CONTENT.homeFeatureTabs];
  if (!deletedSystemIds.includes('sys_tab_trainer-tab') && !savedTabs.some((t: any) => t.id === 'trainer-tab')) {
    const certIdx = savedTabs.findIndex((t: any) => t.id === 'certificates-tab');
    const trainerTabObj = { id: 'trainer-tab', label: 'ট্রেইনার', iconUrl: '/assets/aistudio/Training_Logo_a8b5b931.png' };
    if (certIdx !== -1) {
      savedTabs.splice(certIdx + 1, 0, trainerTabObj);
    } else {
      savedTabs.unshift(trainerTabObj);
    }
  }
  if (!deletedSystemIds.includes('sys_tab_art-tab') && !savedTabs.some((t: any) => t.id === 'art-tab')) {
    savedTabs.push({ id: 'art-tab', label: 'আর্ট', iconUrl: '/assets/aistudio/Arts_Logo_c274ecaf.png' });
  }
  if (!deletedSystemIds.includes('sys_tab_education-tab') && !savedTabs.some((t: any) => t.id === 'education-tab')) {
    savedTabs.unshift({
      id: 'education-tab',
      label: 'এডুকেশন',
      iconUrl: '/assets/aistudio/Education_Card_5c874c48.png'
    });
  }
  if (!deletedSystemIds.includes('sys_tab_award-tab') && !savedTabs.some((t: any) => t.id === 'award-tab')) {
    savedTabs.push({
      id: 'award-tab',
      label: 'অ্যাওয়ার্ড',
      iconUrl: '/assets/aistudio/Award_logo_6005637d.png'
    });
  }

  const savedTopNavTabs = Array.isArray(parsed.topNavTabs) && parsed.topNavTabs.length > 0
    ? [...parsed.topNavTabs]
    : [...DEFAULT_SITE_CONTENT.topNavTabs];
  if (!deletedSystemIds.includes('sys_tab_blog') && !savedTopNavTabs.some((t: any) => t.id === 'blog')) {
    savedTopNavTabs.push({
      id: 'blog',
      label: 'ব্লগ',
      iconUrl: '/assets/aistudio/blog_logo_632001ae.png'
    });
  }

  const savedSocialLinks = Array.isArray(parsed.socialLinks) && parsed.socialLinks.length > 0
    ? parsed.socialLinks
    : DEFAULT_SITE_CONTENT.socialLinks;

  const savedCvImages = Array.isArray(parsed.careerCvImages) ? parsed.careerCvImages : ["", ""];
  const mergedSubpageInfo = { ...DEFAULT_SITE_CONTENT.subpageInfo, ...(parsed.subpageInfo || {}) };
  if (mergedSubpageInfo['raj-magic-show']?.category === '🌙 মিডনাইট ম্যাজিক') {
    mergedSubpageInfo['raj-magic-show'] = {
      ...mergedSubpageInfo['raj-magic-show'],
      category: 'কন্টাক্ট ফর ম্যাজিক শো'
    };
  }
  const savedPageInnerTabs: Record<string, { id: string; label: string; iconUrl: string }[]> =
    parsed.pageInnerTabs && typeof parsed.pageInnerTabs === 'object' ? { ...parsed.pageInnerTabs } : {};
  if (!Array.isArray(savedPageInnerTabs['rubiks-cube'])) {
    savedPageInnerTabs['rubiks-cube'] = [...DEFAULT_SITE_CONTENT.pageInnerTabs['rubiks-cube']];
  }
  if (!Array.isArray(savedPageInnerTabs['match-box'])) {
    savedPageInnerTabs['match-box'] = [...DEFAULT_SITE_CONTENT.pageInnerTabs['match-box']];
  } else if (
    !deletedSystemIds.includes('sys_inner_inner_tab_matchbox') &&
    !savedPageInnerTabs['match-box'].some((t: any) => t.id === 'inner_tab_matchbox')
  ) {
    savedPageInnerTabs['match-box'] = [
      ...savedPageInnerTabs['match-box'],
      ...DEFAULT_SITE_CONTENT.pageInnerTabs['match-box']
    ];
  }

  const savedBooksCovers = Array.isArray(parsed.booksCovers) ? parsed.booksCovers : [];
  const nextCustomBlocks: Record<string, CustomBlock[]> =
    parsed.customBlocks && typeof parsed.customBlocks === 'object' ? { ...parsed.customBlocks } : {};
  const wordPocketBook = savedBooksCovers.find((b: any) =>
    /words?\s+in\s+my\s+pocket/i.test((b?.title || '').trim())
  );
  if (wordPocketBook && !deletedSystemIds.includes('cb_word_in_my_pocket_html')) {
    const bookPageId = `book_${wordPocketBook.id}`;
    const existingBookBlocks = Array.isArray(nextCustomBlocks[bookPageId]) ? nextCustomBlocks[bookPageId] : [];
    if (!existingBookBlocks.some((blk: any) => blk.id === 'cb_word_in_my_pocket_html')) {
      nextCustomBlocks[bookPageId] = [
        ...existingBookBlocks,
        {
          id: 'cb_word_in_my_pocket_html',
          type: 'html-code',
          htmlTitle: '',
          link: '/assets/aistudio/index_bcb1494a.html'
        }
      ];
    }
  }

  const { dataCollectForms: _removedDataCollectForms, ...cleanParsed } = parsed;

  return {
    ...DEFAULT_SITE_CONTENT,
    ...cleanParsed,
    headerBrandName: typeof parsed.headerBrandName === 'string' && parsed.headerBrandName.trim() ? parsed.headerBrandName : DEFAULT_SITE_CONTENT.headerBrandName,
    headerBrandLogo: typeof parsed.headerBrandLogo === 'string' && parsed.headerBrandLogo.trim() ? parsed.headerBrandLogo : DEFAULT_SITE_CONTENT.headerBrandLogo,
    aboutButtonImage: typeof parsed.aboutButtonImage === 'string' && parsed.aboutButtonImage.trim() ? parsed.aboutButtonImage : DEFAULT_SITE_CONTENT.aboutButtonImage,
    aboutButtonWidthIdx: typeof parsed.aboutButtonWidthIdx === 'number' ? parsed.aboutButtonWidthIdx : DEFAULT_SITE_CONTENT.aboutButtonWidthIdx,
    topNavTabs: savedTopNavTabs,
    socialLinks: savedSocialLinks,
    careerText: migratedCareer,
    publicationText: migratedPublication,
    profileImage: migratedProfile,
    wikiProfileVideo: typeof parsed.wikiProfileVideo === 'string' ? parsed.wikiProfileVideo : "",
    sliderImages: Array.isArray(parsed.sliderImages) && parsed.sliderImages.length > 0 ? parsed.sliderImages : DEFAULT_SITE_CONTENT.sliderImages,
    featuredVideos: Array.isArray(parsed.featuredVideos) ? parsed.featuredVideos : DEFAULT_SITE_CONTENT.featuredVideos,
    pageBanners: { ...DEFAULT_SITE_CONTENT.pageBanners, ...(parsed.pageBanners || {}) },
    subpageInfo: mergedSubpageInfo,
    homeFeatureTabs: savedTabs,
    certGalleryImages: Array.isArray(parsed.certGalleryImages) ? parsed.certGalleryImages : [],
    careerCvHeading:
      typeof parsed.careerCvHeading === 'string' && parsed.careerCvHeading.trim() && parsed.careerCvHeading.trim() !== 'সিভি'
        ? parsed.careerCvHeading
        : 'রেজ্যুমে/সিভি',
    careerJobImages: Array.isArray(parsed.careerJobImages) ? parsed.careerJobImages : [],
    careerCvImages: [savedCvImages[0] || "", savedCvImages[1] || ""],
    artImages: Array.isArray(parsed.artImages) ? parsed.artImages : [],
    collectionGalleryImages: Array.isArray(parsed.collectionGalleryImages) ? parsed.collectionGalleryImages : [],
    videoSliders: parsed.videoSliders && typeof parsed.videoSliders === 'object' ? parsed.videoSliders : {},
    imageSliders: parsed.imageSliders && typeof parsed.imageSliders === 'object' ? parsed.imageSliders : {},
    imageSizes: parsed.imageSizes || {},
    bannerFrames: parsed.bannerFrames && typeof parsed.bannerFrames === 'object' ? parsed.bannerFrames : {},
    customBlocks: nextCustomBlocks,
    pageSectionOrders: parsed.pageSectionOrders && typeof parsed.pageSectionOrders === 'object' ? parsed.pageSectionOrders : {},
    booksCovers: savedBooksCovers,
    deletedBookIds: Array.isArray(parsed.deletedBookIds) ? parsed.deletedBookIds : [],
    footerLine1: typeof parsed.footerLine1 === 'string' ? parsed.footerLine1 : DEFAULT_SITE_CONTENT.footerLine1,
    footerSiteLabel: typeof parsed.footerSiteLabel === 'string' ? parsed.footerSiteLabel : DEFAULT_SITE_CONTENT.footerSiteLabel,
    footerSiteLinkText: typeof parsed.footerSiteLinkText === 'string' ? parsed.footerSiteLinkText : DEFAULT_SITE_CONTENT.footerSiteLinkText,
    footerSiteUrl: typeof parsed.footerSiteUrl === 'string' ? parsed.footerSiteUrl : DEFAULT_SITE_CONTENT.footerSiteUrl,
    appTheme: parsed.appTheme && typeof parsed.appTheme === 'object' ? { ...DEFAULT_APP_THEME, ...parsed.appTheme } : { ...DEFAULT_APP_THEME },
    customSubPages: Array.isArray(parsed.customSubPages) ? parsed.customSubPages : [],
    hiddenHomeGridPages: Array.isArray(parsed.hiddenHomeGridPages) ? parsed.hiddenHomeGridPages : [],
    pageInnerTabs: savedPageInnerTabs,
    deletedSystemBlockIds: deletedSystemIds,
    blogPosts: Array.isArray(parsed.blogPosts) ? parsed.blogPosts : [],
    aboutStats: Array.isArray(parsed.aboutStats) ? parsed.aboutStats : DEFAULT_SITE_CONTENT.aboutStats,
    cloneLinks: Array.isArray(parsed.cloneLinks) ? parsed.cloneLinks : [],
    subCloneLinks: Array.isArray(parsed.subCloneLinks) ? parsed.subCloneLinks : [],
    subCloneConfig:
      parsed.subCloneConfig && typeof parsed.subCloneConfig === 'object' && typeof parsed.subCloneConfig.targetTabId === 'string'
        ? {
            targetTabId: parsed.subCloneConfig.targetTabId,
            targetTabLabel: typeof parsed.subCloneConfig.targetTabLabel === 'string' ? parsed.subCloneConfig.targetTabLabel : parsed.subCloneConfig.targetTabId,
            allowedPageIds: Array.isArray(parsed.subCloneConfig.allowedPageIds) ? parsed.subCloneConfig.allowedPageIds : [parsed.subCloneConfig.targetTabId],
            assignedCoAdminEmail: typeof parsed.subCloneConfig.assignedCoAdminEmail === 'string' ? parsed.subCloneConfig.assignedCoAdminEmail : ''
          }
        : null,
    magicBookConfig:
      parsed.magicBookConfig && typeof parsed.magicBookConfig === 'object'
        ? {
            visible: parsed.magicBookConfig.visible !== false,
            imageUrl:
              typeof parsed.magicBookConfig.imageUrl === 'string' && parsed.magicBookConfig.imageUrl.trim()
                ? parsed.magicBookConfig.imageUrl
                : DEFAULT_SITE_CONTENT.magicBookConfig.imageUrl,
            linkUrl:
              typeof parsed.magicBookConfig.linkUrl === 'string' && parsed.magicBookConfig.linkUrl.trim()
                ? parsed.magicBookConfig.linkUrl
                : DEFAULT_SITE_CONTENT.magicBookConfig.linkUrl
          }
        : { ...DEFAULT_SITE_CONTENT.magicBookConfig }
  };
}

const DEFAULT_SUBPAGES_CONTENT: Record<string, SubPageItem[]> = {
  "raj-magic-show": [],
  "rubiks-cube": [],
  "match-box": [],
  "inner_tab_matchbox": [],
  "chess": [],
  "books": [
    { id: 'book_1', title: "মেঘমালতী - ১", desc: "বিশেষ রহস্য ও অনুভূতির উপন্যাস।", price: "৩৫০ টাকা", pdfUrl: "" }
  ],
  "ms-excel": [],
  "blog": [],
  "certificate": [],
  "education-tab": [],
  "certificates-tab": [],
  "career-tab": [],
  "art-tab": [],
  "award-tab": []
};

const resolvePageFromLocation = (): string => {
  if (typeof window === 'undefined') return 'home';
  const qPage = new URLSearchParams(window.location.search).get('page')?.trim();
  if (qPage) return qPage;
  if (window.location.hash) {
    const h = window.location.hash.replace(/^#/, '').trim();
    if (h) return h;
  }
  return 'home';
};

function AppContent() {
  const [activeCloneId, setActiveCloneId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const c = new URLSearchParams(window.location.search).get('clone');
    return c && /^[a-zA-Z0-9_-]{1,128}$/.test(c.trim()) ? c.trim() : null;
  });
  const isCloneMode = Boolean(activeCloneId);

  const [currentPage, setCurrentPage] = useState<string>(() => resolvePageFromLocation());
  const [isPinCardLocked, setIsPinCardLocked] = useState<boolean>(() => resolvePageFromLocation() === 'pin-card');
  const hideChromeForPinLock = currentPage === 'pin-card' && isPinCardLocked;
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [activeMenuFlyout, setActiveMenuFlyout] = useState<'add' | 'settings' | 'adminClone' | null>(null);
  const [shareToast, setShareToast] = useState<boolean>(false);
  const [shareFallbackUrl, setShareFallbackUrl] = useState<string | null>(null);
  const { isInstallable: isPwaInstallable, isInstalled: isPwaInstalled, isIOS: isIOSDevice, install: installPwa } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [websiteLinkCopied, setWebsiteLinkCopied] = useState<boolean>(false);

  // Admin & Co-Admin Authentication State
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState<boolean>(() => {
    return localStorage.getItem('shahani_is_admin') === 'true';
  });
  const [coAdminSession, setCoAdminSession] = useState<{ email: string; tokenHash: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const c = new URLSearchParams(window.location.search).get('clone');
    if (!c) return null;
    try {
      const raw = localStorage.getItem(`shahani_co_admin_session_${c.trim()}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [firebaseAdminUser, setFirebaseAdminUser] = useState<User | null>(null);
  const [firebaseCloneSyncUser, setFirebaseCloneSyncUser] = useState<User | null>(null);
  const activeCloudUser = isCloneMode ? (firebaseAdminUser || firebaseCloneSyncUser) : firebaseAdminUser;

  const [googleLoginLoading, setGoogleLoginLoading] = useState<boolean>(false);
  const [cloudSyncing, setCloudSyncing] = useState<boolean>(false);
  const [cloudFatalError, setCloudFatalError] = useState<Error | null>(null);
  const [cloudBlogs, setCloudBlogs] = useState<BlogPostRecord[]>([]);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loginSubmitting, setLoginSubmitting] = useState<boolean>(false);

  // Co-Admin Directory & Clone Manager State (Primary Admin Only)
  const [coAdminsList, setCoAdminsList] = useState<
    { id: string; email: string; tokenHash: string; note: string; createdAtLabel: string }[]
  >(() => {
    try {
      const raw = localStorage.getItem('shahani_co_admins_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showCoAdminModal, setShowCoAdminModal] = useState<boolean>(false);
  const [coAdminEmailInput, setCoAdminEmailInput] = useState<string>('');
  const [coAdminPasswordInput, setCoAdminPasswordInput] = useState<string>('');
  const [coAdminNoteInput, setCoAdminNoteInput] = useState<string>('');
  const [coAdminSaving, setCoAdminSaving] = useState<boolean>(false);
  const [coAdminStatusMsg, setCoAdminStatusMsg] = useState<string>('');

  const [showCloneModal, setShowCloneModal] = useState<boolean>(false);
  const [cloneLabelInput, setCloneLabelInput] = useState<string>('');
  const [latestCloneUrl, setLatestCloneUrl] = useState<string>('');
  const [cloneCreating, setCloneCreating] = useState<boolean>(false);
  const [cloneCopiedId, setCloneCopiedId] = useState<string | null>(null);

  const [showSubCloneModal, setShowSubCloneModal] = useState<boolean>(false);
  const [subCloneTargetTabId, setSubCloneTargetTabId] = useState<string>('books');
  const [subCloneLabelInput, setSubCloneLabelInput] = useState<string>('');
  const [subCloneCoAdminMode, setSubCloneCoAdminMode] = useState<'new' | 'existing' | 'any'>('new');
  const [subCloneCoAdminEmail, setSubCloneCoAdminEmail] = useState<string>('');
  const [subCloneCoAdminPassword, setSubCloneCoAdminPassword] = useState<string>('');
  const [subCloneCoAdminNote, setSubCloneCoAdminNote] = useState<string>('');
  const [subCloneSelectedCoAdminEmail, setSubCloneSelectedCoAdminEmail] = useState<string>('');
  const [subCloneCreating, setSubCloneCreating] = useState<boolean>(false);
  const [subCloneStatusMsg, setSubCloneStatusMsg] = useState<string>('');
  const [latestSubCloneUrl, setLatestSubCloneUrl] = useState<string>('');
  const [subCloneCopiedId, setSubCloneCopiedId] = useState<string | null>(null);

  const siteStorageKey = activeCloneId ? `shahani_clone_site_v5_${activeCloneId}` : 'shahani_site_content_v5';
  const subpagesStorageKey = activeCloneId ? `shahani_clone_subpages_v5_${activeCloneId}` : 'shahani_subpages_content_v5';

  // Editable Content State (Isolated per Clone Workspace when activeCloneId is present)
  const [siteContent, setSiteContent] = useState(() => {
    const saved = localStorage.getItem(siteStorageKey) || (activeCloneId ? localStorage.getItem('shahani_site_content_v5') : null);
    if (saved) {
      try {
        return mergeSiteContent(JSON.parse(saved));
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_SITE_CONTENT;
  });

  // Dynamic Subpages Items State (Isolated per Clone Workspace when activeCloneId is present)
  const [subpagesContent, setSubpagesContent] = useState<Record<string, SubPageItem[]>>(() => {
    const saved = localStorage.getItem(subpagesStorageKey) || (activeCloneId ? localStorage.getItem('shahani_subpages_content_v5') : null);
    if (saved) {
      try { return { ...DEFAULT_SUBPAGES_CONTENT, ...JSON.parse(saved) }; } catch(e) {}
    }
    return DEFAULT_SUBPAGES_CONTENT;
  });

  const activeSubClone =
    isCloneMode && siteContent.subCloneConfig && typeof siteContent.subCloneConfig.targetTabId === 'string' && siteContent.subCloneConfig.targetTabId
      ? (siteContent.subCloneConfig as {
          targetTabId: string;
          targetTabLabel: string;
          allowedPageIds: string[];
          assignedCoAdminEmail?: string;
        })
      : null;
  const isSubCloneMode = Boolean(activeSubClone);
  const assignedSubCloneEmail = (activeSubClone?.assignedCoAdminEmail || '').trim().toLowerCase();
  const isCoAdmin = Boolean(
    isCloneMode &&
      coAdminSession &&
      (!assignedSubCloneEmail || (coAdminSession.email || '').trim().toLowerCase() === assignedSubCloneEmail)
  );
  const isAdmin = isCloneMode ? isPrimaryAdmin || isCoAdmin : isPrimaryAdmin;
  const activeSubCloneRef = useRef(activeSubClone);
  activeSubCloneRef.current = activeSubClone;
  const innerTabParentLookupRef = useRef<Record<string, string>>({});
  const isPageAllowedInSubClone = (pageId: string, subClone = activeSubCloneRef.current): boolean => {
    if (!subClone || !subClone.targetTabId) return true;
    if (pageId === subClone.targetTabId) return true;
    if (Array.isArray(subClone.allowedPageIds) && subClone.allowedPageIds.includes(pageId)) return true;
    if (subClone.targetTabId === 'books' && pageId.startsWith('book_')) return true;
    if (innerTabParentLookupRef.current[pageId] === subClone.targetTabId) return true;
    return false;
  };

  // Typing animation state for Home Hero Title (dynamically reflects siteContent.heroTitle edits)
  const fullTypingText = siteContent.heroTitle || "শাহানী রাজীব (Shahani Rajib)";
  const [typedText, setTypedText] = useState<string>("");
  const [typingIndex, setTypingIndex] = useState<number>(0);

  useEffect(() => {
    setTypingIndex(0);
    setTypedText("");
  }, [fullTypingText]);

  useEffect(() => {
    if (typingIndex <= fullTypingText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullTypingText.slice(0, typingIndex));
        setTypingIndex(prev => prev + 1);
      }, 120);
      return () => clearTimeout(timeout);
    } else {
      const resetTimeout = setTimeout(() => {
        setTypingIndex(0);
      }, 4000);
      return () => clearTimeout(resetTimeout);
    }
  }, [typingIndex, fullTypingText]);

  const lastSyncedPayloadRef = useRef<string>('');
  const cloudHasDocRef = useRef<boolean>(false);
  const cloneOwnerUidRef = useRef<string>('');
  const isMountedRef = useRef<boolean>(false);
  const activeCloudUserRef = useRef<User | null>(activeCloudUser);
  activeCloudUserRef.current = activeCloudUser;
  const isPrimaryAdminRef = useRef<boolean>(isPrimaryAdmin);
  isPrimaryAdminRef.current = isPrimaryAdmin;
  const pendingCloudFlushRef = useRef<boolean>(false);
  const latestStateRef = useRef<{ siteContent: any; subpagesContent: Record<string, SubPageItem[]> }>({
    siteContent,
    subpagesContent
  });
  latestStateRef.current = { siteContent, subpagesContent };

  const pushStateToCloud = async (
    user: User,
    nextSite = latestStateRef.current.siteContent,
    nextSub = latestStateRef.current.subpagesContent
  ) => {
    const cleanedSite = stripUndefinedDeep(nextSite);
    const cleanedSub = stripUndefinedDeep(nextSub);
    const payload = {
      siteContent: cleanedSite,
      subpagesContent: cleanedSub
    };
    const serialized = JSON.stringify(payload);
    setCloudSyncing(true);
    try {
      if (activeCloneId) {
        let targetCloneId = activeCloneId;
        const isPrimaryCloud = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
        // If another Google user already owns this clone workspace, fork into a personal clone workspace for this Co-Admin
        if (!isPrimaryCloud && cloneOwnerUidRef.current && cloneOwnerUidRef.current !== user.uid) {
          targetCloneId = `cl_${user.uid.slice(0, 8)}_${Date.now().toString(36)}`;
          cloneOwnerUidRef.current = user.uid;
          setActiveCloneId(targetCloneId);
          if (coAdminSession) {
            localStorage.setItem(`shahani_co_admin_session_${targetCloneId}`, JSON.stringify(coAdminSession));
          }
          if (typeof window !== 'undefined') {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('clone', targetCloneId);
            window.history.replaceState(null, '', nextUrl.toString());
          }
        }
        const nextOwnerUid = isPrimaryCloud ? (cloneOwnerUidRef.current || '') : user.uid;
        await setDoc(doc(db, 'clone_states', targetCloneId), {
          ...payload,
          ownerUid: nextOwnerUid,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        cloneOwnerUidRef.current = nextOwnerUid;
        if (!isPrimaryCloud) {
          await setDoc(doc(db, 'co_admin_sync', user.uid), {
            googleEmail: user.email || '',
            coAdminEmail: coAdminSession?.email || '',
            activeCloneId: targetCloneId,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        await setDoc(doc(db, 'site_state', 'main'), {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        localStorage.setItem('shahani_cloud_migrated_books', 'true');
        localStorage.removeItem('shahani_pending_local_sync');
      }
      lastSyncedPayloadRef.current = serialized;
      pendingCloudFlushRef.current = false;
      cloudHasDocRef.current = true;
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, activeCloneId ? `clone_states/${activeCloneId}` : 'site_state/main');
      } catch (err) {
        setCloudFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setCloudSyncing(false);
    }
  };

  // Track Firebase Google Auth state for Primary Admin & Clone Co-Admin Cloud Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const email = (user?.email || '').toLowerCase();
      const isVerifiedPrimary = Boolean(user && user.emailVerified && ADMIN_EMAILS.includes(email));
      if (isVerifiedPrimary && user) {
        setFirebaseAdminUser(user);
        setFirebaseCloneSyncUser(null);
        setIsPrimaryAdmin(true);
      } else if (user && user.emailVerified) {
        setFirebaseAdminUser(null);
        setFirebaseCloneSyncUser(user);
      } else {
        setFirebaseAdminUser(null);
        setFirebaseCloneSyncUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load and sync Co-Admin directory when Primary Admin is signed into Google
  useEffect(() => {
    if (!firebaseAdminUser) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'co_admins'));
        if (cancelled) return;
        const remoteMap = new Map<string, { id: string; email: string; tokenHash: string; note: string; createdAtLabel: string }>();
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          if (data && data.active !== false && data.email && data.tokenHash) {
            remoteMap.set(d.id, {
              id: d.id,
              email: String(data.email),
              tokenHash: String(data.tokenHash),
              note: String(data.note || ''),
              createdAtLabel: 'সিঙ্কড'
            });
          }
        });
        // Push any local-only Co-Admins to Firestore so clone links on other devices recognize them immediately
        let curLocal: { id: string; email: string; tokenHash: string; note: string; createdAtLabel: string }[] = [];
        try {
          const raw = localStorage.getItem('shahani_co_admins_v1');
          curLocal = raw ? JSON.parse(raw) : [];
        } catch {
          curLocal = [];
        }
        for (const item of curLocal) {
          if (item?.id && item?.email && item?.tokenHash && !remoteMap.has(item.id)) {
            await setDoc(doc(db, 'co_admins', item.id), {
              email: item.email,
              tokenHash: item.tokenHash,
              note: item.note || '',
              active: true,
              createdBy: firebaseAdminUser.uid,
              createdAt: serverTimestamp()
            });
            await setDoc(doc(db, 'co_admin_tokens', item.tokenHash), {
              coAdminId: item.id,
              active: true,
              createdBy: firebaseAdminUser.uid,
              createdAt: serverTimestamp()
            });
            remoteMap.set(item.id, item);
          }
        }
        if (!cancelled && remoteMap.size > 0) {
          const mergedList = Array.from(remoteMap.values());
          setCoAdminsList(mergedList);
          localStorage.setItem('shahani_co_admins_v1', JSON.stringify(mergedList));
        }
      } catch {
        // Ignore transient fetch issues cleanly
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminUser]);

  // Subscribe to Main or Isolated Clone Firestore Document
  useEffect(() => {
    cloudHasDocRef.current = false;
    cloneOwnerUidRef.current = '';
    lastSyncedPayloadRef.current = '';

    if (!activeCloneId) {
      const siteDocRef = doc(db, 'site_state', 'main');
      const unsubscribe = onSnapshot(
        siteDocRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            cloudHasDocRef.current = false;
            return;
          }
          if (snapshot.metadata.hasPendingWrites && activeCloudUserRef.current) {
            return;
          }
          cloudHasDocRef.current = true;
          if (
            isPrimaryAdminRef.current &&
            !activeCloudUserRef.current &&
            localStorage.getItem('shahani_pending_local_sync') === 'true'
          ) {
            return;
          }
          const data = snapshot.data() as {
            siteContent?: any;
            subpagesContent?: Record<string, SubPageItem[]>;
          };
          const mergedSite =
            data?.siteContent && typeof data.siteContent === 'object'
              ? mergeSiteContent(data.siteContent)
              : latestStateRef.current.siteContent;
          const localBooks = Array.isArray(latestStateRef.current.siteContent?.booksCovers)
            ? latestStateRef.current.siteContent.booksCovers
            : [];
          const remoteBooks = Array.isArray(mergedSite.booksCovers) ? mergedSite.booksCovers : [];
          const remoteBookIds = new Set(remoteBooks.map((b: any) => b?.id).filter(Boolean));
          const allDeletedBookIds = new Set<string>([
            ...(Array.isArray(mergedSite.deletedBookIds) ? mergedSite.deletedBookIds : []),
            ...(Array.isArray(latestStateRef.current.siteContent?.deletedBookIds) ? latestStateRef.current.siteContent.deletedBookIds : [])
          ]);
          const unsyncedLocalBooks = localBooks.filter(
            (b: any) => b?.id && !remoteBookIds.has(b.id) && !allDeletedBookIds.has(b.id)
          );
          mergedSite.booksCovers = [
            ...remoteBooks.filter((b: any) => !allDeletedBookIds.has(b?.id)),
            ...unsyncedLocalBooks
          ];
          mergedSite.deletedBookIds = Array.from(allDeletedBookIds);

          const mergedSub =
            data?.subpagesContent && typeof data.subpagesContent === 'object'
              ? { ...DEFAULT_SUBPAGES_CONTENT, ...data.subpagesContent }
              : latestStateRef.current.subpagesContent;

          const hadLegacyDataCollect = Boolean(
            data?.siteContent &&
            typeof data.siteContent === 'object' &&
            'dataCollectForms' in data.siteContent
          );
          if (activeCloudUserRef.current && unsyncedLocalBooks.length === 0 && !hadLegacyDataCollect) {
            lastSyncedPayloadRef.current = JSON.stringify({
              siteContent: stripUndefinedDeep(mergedSite),
              subpagesContent: stripUndefinedDeep(mergedSub)
            });
          }

          setSiteContent(mergedSite);
          setSubpagesContent(mergedSub);
        },
        (error) => {
          const code = (error as { code?: string })?.code;
          if (code === 'unavailable' || code === 'aborted') {
            return;
          }
          try {
            handleFirestoreError(error, OperationType.GET, 'site_state/main');
          } catch (err) {
            setCloudFatalError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      );
      return () => unsubscribe();
    } else {
      let unsubscribed = false;
      const cloneDocRef = doc(db, 'clone_states', activeCloneId);
      const unsubscribe = onSnapshot(
        cloneDocRef,
        async (snapshot) => {
          if (unsubscribed) return;
          if (!snapshot.exists()) {
            cloudHasDocRef.current = false;
            cloneOwnerUidRef.current = '';
            // If no local clone edits exist yet, initialize cloned state from main site snapshot
            if (!localStorage.getItem(`shahani_clone_site_v5_${activeCloneId}`)) {
              try {
                const mainSnap = await getDoc(doc(db, 'site_state', 'main'));
                if (!unsubscribed && mainSnap.exists()) {
                  const mainData = mainSnap.data() as { siteContent?: any; subpagesContent?: Record<string, SubPageItem[]> };
                  if (mainData?.siteContent) {
                    const clonedSite = mergeSiteContent(mainData.siteContent);
                    clonedSite.cloneLinks = [];
                    setSiteContent(clonedSite);
                  }
                  if (mainData?.subpagesContent) {
                    setSubpagesContent({ ...DEFAULT_SUBPAGES_CONTENT, ...mainData.subpagesContent });
                  }
                }
              } catch {
                // ignore baseline fallback error
              }
            }
            return;
          }
          cloudHasDocRef.current = true;
          const data = snapshot.data() as {
            siteContent?: any;
            subpagesContent?: Record<string, SubPageItem[]>;
            ownerUid?: string;
          };
          cloneOwnerUidRef.current = typeof data?.ownerUid === 'string' ? data.ownerUid : '';
          const mergedSite =
            data?.siteContent && typeof data.siteContent === 'object'
              ? mergeSiteContent(data.siteContent)
              : latestStateRef.current.siteContent;
          const mergedSub =
            data?.subpagesContent && typeof data.subpagesContent === 'object'
              ? { ...DEFAULT_SUBPAGES_CONTENT, ...data.subpagesContent }
              : latestStateRef.current.subpagesContent;

          const hadLegacyDataCollect = Boolean(
            data?.siteContent &&
            typeof data.siteContent === 'object' &&
            'dataCollectForms' in data.siteContent
          );
          if (!hadLegacyDataCollect) {
            lastSyncedPayloadRef.current = JSON.stringify({
              siteContent: stripUndefinedDeep(mergedSite),
              subpagesContent: stripUndefinedDeep(mergedSub)
            });
          }
          setSiteContent(mergedSite);
          setSubpagesContent(mergedSub);
        },
        (error) => {
          const code = (error as { code?: string })?.code;
          if (code === 'unavailable' || code === 'aborted') {
            return;
          }
          try {
            handleFirestoreError(error, OperationType.GET, `clone_states/${activeCloneId}`);
          } catch (err) {
            setCloudFatalError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      );
      return () => {
        unsubscribed = true;
        unsubscribe();
      };
    }
  }, [activeCloneId]);

  // Real-time auto-save to Firestore (200ms debounce + flush on page hide) whenever Primary Admin (rajibshahani9@gmail.com) or Co-Admin edits content
  useEffect(() => {
    if (!activeCloudUser) {
      if (isMountedRef.current && isPrimaryAdmin && !activeCloneId) {
        localStorage.setItem('shahani_pending_local_sync', 'true');
      }
      isMountedRef.current = true;
      return;
    }
    isMountedRef.current = true;
    if (activeCloneId && !isAdmin) return;
    const hasPendingFlag = !activeCloneId && localStorage.getItem('shahani_pending_local_sync') === 'true';
    const serialized = JSON.stringify({
      siteContent: stripUndefinedDeep(siteContent),
      subpagesContent: stripUndefinedDeep(subpagesContent)
    });
    if (cloudHasDocRef.current && !hasPendingFlag && serialized === lastSyncedPayloadRef.current) {
      pendingCloudFlushRef.current = false;
      return;
    }
    pendingCloudFlushRef.current = true;
    const timer = setTimeout(() => {
      pushStateToCloud(activeCloudUser, siteContent, subpagesContent);
    }, 200);
    return () => clearTimeout(timer);
  }, [siteContent, subpagesContent, activeCloudUser, activeCloneId, isAdmin, isPrimaryAdmin]);

  useEffect(() => {
    const flushNow = () => {
      const u = activeCloudUserRef.current;
      if (!u || !pendingCloudFlushRef.current) return;
      void pushStateToCloud(u, latestStateRef.current.siteContent, latestStateRef.current.subpagesContent);
    };
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, []);

  // Subscribe to Firestore /blogs collection (published blogs for visitors, all blogs for verified admin)
  useEffect(() => {
    if (activeCloneId) {
      setCloudBlogs([]);
      return;
    }
    const blogsQuery = firebaseAdminUser
      ? collection(db, 'blogs')
      : query(collection(db, 'blogs'), where('published', '==', true));

    const unsubscribe = onSnapshot(
      blogsQuery,
      (snapshot) => {
        const list: BlogPostRecord[] = snapshot.docs.map((d) => {
          const data = d.data() as any;
          const createdMs =
            data?.createdAt && typeof data.createdAt.toMillis === 'function'
              ? data.createdAt.toMillis()
              : Date.now();
          const updatedMs =
            data?.updatedAt && typeof data.updatedAt.toMillis === 'function'
              ? data.updatedAt.toMillis()
              : createdMs;
          return {
            id: d.id,
            title: String(data?.title || ''),
            excerpt: String(data?.excerpt || ''),
            blocks: Array.isArray(data?.blocks) ? data.blocks : [],
            published: data?.published !== false,
            authorUid: typeof data?.authorUid === 'string' ? data.authorUid : undefined,
            createdAtMs: createdMs,
            updatedAtMs: updatedMs
          };
        });
        setCloudBlogs(list);
      },
      (error) => {
        const code = (error as { code?: string })?.code;
        if (code === 'unavailable' || code === 'aborted') {
          return;
        }
        try {
          handleFirestoreError(error, OperationType.LIST, 'blogs');
        } catch (err) {
          setCloudFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    );
    return () => unsubscribe();
  }, [activeCloneId, firebaseAdminUser]);

  // Auto-sync any locally authored blogs into Firestore /blogs when Primary Admin is signed into Google
  useEffect(() => {
    if (activeCloneId || !firebaseAdminUser) return;
    const localPosts: BlogPostRecord[] = Array.isArray(siteContent.blogPosts) ? siteContent.blogPosts : [];
    if (localPosts.length === 0) return;
    let cancelled = false;
    (async () => {
      const cloudIds = new Set(cloudBlogs.map((b) => b.id));
      const unsynced = localPosts.filter((p) => p?.id && !cloudIds.has(p.id));
      if (unsynced.length === 0) return;
      for (const post of unsynced) {
        if (cancelled) return;
        const cleanId = /^[a-zA-Z0-9_-]{1,128}$/.test(post.id) ? post.id : `blog_${Date.now()}`;
        try {
          await setDoc(doc(db, 'blogs', cleanId), {
            id: cleanId,
            title: String(post.title || '').slice(0, 300),
            excerpt: String(post.excerpt || '').slice(0, 600),
            blocks: stripUndefinedDeep(post.blocks || []),
            published: post.published !== false,
            authorUid: firebaseAdminUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `blogs/${cleanId}`);
        }
      }
      if (!cancelled) {
        setSiteContent((prev: any) => ({
          ...prev,
          blogPosts: (prev.blogPosts || []).filter((p: any) => !unsynced.some((u) => u.id === p.id))
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCloneId, firebaseAdminUser, cloudBlogs, siteContent.blogPosts]);

  const handleSaveBlogPost = async (input: {
    id?: string;
    title: string;
    excerpt: string;
    blocks: BlogBlock[];
  }) => {
    const blogId = input.id && /^[a-zA-Z0-9_-]{1,128}$/.test(input.id)
      ? input.id
      : `blog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cleanTitle = input.title.trim().slice(0, 300);
    const cleanExcerpt = input.excerpt.trim().slice(0, 600);
    const cleanBlocks = stripUndefinedDeep(input.blocks).slice(0, 100);
    const nowMs = Date.now();

    if (!activeCloneId && firebaseAdminUser) {
      const existsInCloud = cloudBlogs.some((b) => b.id === blogId);
      const targetRef = doc(db, 'blogs', blogId);
      try {
        if (existsInCloud) {
          await setDoc(
            targetRef,
            {
              title: cleanTitle,
              excerpt: cleanExcerpt,
              blocks: cleanBlocks,
              published: true,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        } else {
          await setDoc(targetRef, {
            id: blogId,
            title: cleanTitle,
            excerpt: cleanExcerpt,
            blocks: cleanBlocks,
            published: true,
            authorUid: firebaseAdminUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        handleFirestoreError(err, existsInCloud ? OperationType.UPDATE : OperationType.CREATE, `blogs/${blogId}`);
      }
      return;
    }

    // Clone mode or local admin fallback before Google sync
    setSiteContent((prev: any) => {
      const existing: BlogPostRecord[] = Array.isArray(prev.blogPosts) ? prev.blogPosts : [];
      const found = existing.find((b) => b.id === blogId);
      const nextRecord: BlogPostRecord = {
        id: blogId,
        title: cleanTitle,
        excerpt: cleanExcerpt,
        blocks: cleanBlocks,
        published: true,
        createdAtMs: found ? found.createdAtMs : nowMs,
        updatedAtMs: nowMs
      };
      return {
        ...prev,
        blogPosts: found
          ? existing.map((b) => (b.id === blogId ? nextRecord : b))
          : [nextRecord, ...existing]
      };
    });
  };

  const handleDeleteBlogPost = async (blogId: string) => {
    if (!activeCloneId && firebaseAdminUser && cloudBlogs.some((b) => b.id === blogId)) {
      try {
        await deleteDoc(doc(db, 'blogs', blogId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `blogs/${blogId}`);
      }
    }
    setSiteContent((prev: any) => ({
      ...prev,
      blogPosts: (prev.blogPosts || []).filter((b: any) => b.id !== blogId)
    }));
  };

  const mergedBlogPosts: BlogPostRecord[] = React.useMemo(() => {
    const map = new Map<string, BlogPostRecord>();
    (Array.isArray(siteContent.blogPosts) ? siteContent.blogPosts : []).forEach((p: BlogPostRecord) => {
      if (p?.id) map.set(p.id, p);
    });
    cloudBlogs.forEach((p) => {
      if (p?.id) map.set(p.id, p);
    });
    return Array.from(map.values());
  }, [siteContent.blogPosts, cloudBlogs]);

  if (cloudFatalError) {
    throw cloudFatalError;
  }

  useEffect(() => {
    localStorage.setItem(siteStorageKey, JSON.stringify(siteContent));
  }, [siteContent, siteStorageKey]);

  useEffect(() => {
    localStorage.setItem(subpagesStorageKey, JSON.stringify(subpagesContent));
  }, [subpagesContent, subpagesStorageKey]);

  useEffect(() => {
    localStorage.setItem('shahani_is_admin', isPrimaryAdmin ? 'true' : 'false');
  }, [isPrimaryAdmin]);

  useEffect(() => {
    localStorage.setItem('shahani_co_admins_v1', JSON.stringify(coAdminsList));
  }, [coAdminsList]);

  // Inline Edit State for Admin
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempEditValue, setTempEditValue] = useState<string>('');

  // Add new video modal state
  const [showAddVideoModal, setShowAddVideoModal] = useState<boolean>(false);
  const [newVideoTargetPage, setNewVideoTargetPage] = useState<string>('home');
  const [newVideoLink, setNewVideoLink] = useState<string>('');

  // Add new book modal state (for books page tab)
  const [showAddBookModal, setShowAddBookModal] = useState<boolean>(false);
  const [newBookTitle, setNewBookTitle] = useState<string>('');
  const [newBookDesc, setNewBookDesc] = useState<string>('');
  const [newBookPrice, setNewBookPrice] = useState<string>('');
  const [newBookPdf, setNewBookPdf] = useState<string>('');
  const [newBookCover, setNewBookCover] = useState<string>('');

  // Custom Modals (Replacing native prompt/confirm so iframe & Drive links always work)
  const [imageModal, setImageModal] = useState<{
    imgKey: string;
    title: string;
    url: string;
    width: string;
    height: string;
    showSizeFields?: boolean;
  } | null>(null);
  const [videoEditModal, setVideoEditModal] = useState<{
    target: 'home' | string;
    id: string;
    link: string;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [galleryBulkInput, setGalleryBulkInput] = useState<string>('');
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [cvPdfOpen, setCvPdfOpen] = useState<boolean>(true);
  const [cvPdfInput, setCvPdfInput] = useState<string>('');
  const [wikiVideoInput, setWikiVideoInput] = useState<string>('');
  const [videoSliderIndices, setVideoSliderIndices] = useState<Record<string, number>>({});
  const [imageSliderIndices, setImageSliderIndices] = useState<Record<string, number>>({});
  const [playingVideoSliders, setPlayingVideoSliders] = useState<Record<string, boolean>>({});
  const videoSliderIframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const [sliderBuilderModal, setSliderBuilderModal] = useState<{
    type: 'video' | 'image';
    targetKey: string;
    title: string;
    countInput: string;
    links: string[];
  } | null>(null);
  const [bannerAdjustKey, setBannerAdjustKey] = useState<string | null>(null);
  const bannerDragRef = useRef<{
    imgKey: string;
    mode: 'position' | 'height' | 'width';
    startY: number;
    startX?: number;
    startVal: number;
    containerHeight: number;
    containerWidth?: number;
  } | null>(null);
  const [showHomeSliderModal, setShowHomeSliderModal] = useState<boolean>(false);
  const [homeSliderDraft, setHomeSliderDraft] = useState<{ url: string; caption?: string }[]>([]);
  const [homeSliderBulkInput, setHomeSliderBulkInput] = useState<string>('');
  const [homeSliderCountInput, setHomeSliderCountInput] = useState<string>('');
  const [customBlockModal, setCustomBlockModal] = useState<{
    mode: 'add' | 'edit';
    pageId: string;
    blockId?: string;
    type: 'video' | 'video-slider' | 'image-slider' | 'text-slab' | 'drive-image' | 'pdf' | 'html-code' | 'audio';
    link: string;
    countInput: string;
    slides: string[];
    headline: string;
    body: string;
    align: 'left' | 'center' | 'right' | 'justify';
    linkUrl: string;
    driveInput: string;
    imageWidthIdx: number;
    imageHeightIdx: number;
    mergeTop: boolean;
    mergeBottom: boolean;
    pdfTitle: string;
    pdfWidthIdx: number;
    pdfHeightIdx: number;
    pdfDownloadable: boolean;
    htmlTitle: string;
    audioTitle: string;
    posY: number;
    aspectHeight: number | null;
    zoom: number;
    sliderStyle: SliderStyleType;
  } | null>(null);
  const [pendingMenuAction, setPendingMenuAction] = useState<'video' | 'video-slider' | 'image-slider' | 'text-slab' | 'drive-image' | 'pdf' | 'html-code' | 'audio' | null>(null);
  const [showTabManagerModal, setShowTabManagerModal] = useState<boolean>(false);
  const [newTabTarget, setNewTabTarget] = useState<'top' | 'feature' | 'inner'>('top');
  const [newTabLabel, setNewTabLabel] = useState<string>('');
  const [newTabIconUrl, setNewTabIconUrl] = useState<string>('');
  const [showInnerTabModal, setShowInnerTabModal] = useState<boolean>(false);
  const [innerTabTargetPage, setInnerTabTargetPage] = useState<string>('rubiks-cube');
  const [innerTabLabelInput, setInnerTabLabelInput] = useState<string>('');
  const [innerTabIconInput, setInnerTabIconInput] = useState<string>('');
  const [magicBookModal, setMagicBookModal] = useState<{ imageUrl: string; linkUrl: string } | null>(null);
  const [showAboutStatsModal, setShowAboutStatsModal] = useState<boolean>(false);
  const [aboutStatsDraft, setAboutStatsDraft] = useState<{ id: string; value: string; label: string }[]>([]);
  const [showSocialLinksModal, setShowSocialLinksModal] = useState<boolean>(false);
  const [socialLinksDraft, setSocialLinksDraft] = useState<{ id: string; name: string; url: string }[]>([]);
  const [showFooterEditModal, setShowFooterEditModal] = useState<boolean>(false);
  const [footerDraft, setFooterDraft] = useState<{ line1: string; siteLabel: string; linkText: string; linkUrl: string }>({
    line1: '',
    siteLabel: '',
    linkText: '',
    linkUrl: ''
  });
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const [themeDraft, setThemeDraft] = useState<AppThemeConfig>({ ...DEFAULT_APP_THEME });
  const [showSubPageManagerModal, setShowSubPageManagerModal] = useState<boolean>(false);
  const [newSubPageForm, setNewSubPageForm] = useState<{
    title: string;
    category: string;
    desc: string;
    bannerUrl: string;
    showInHomeGrid: boolean;
    showInMenu: boolean;
    placement: 'none' | 'top' | 'feature';
    iconUrl: string;
  }>({
    title: '',
    category: '',
    desc: '',
    bannerUrl: '',
    showInHomeGrid: true,
    showInMenu: true,
    placement: 'none',
    iconUrl: ''
  });
  const [editingSubPageId, setEditingSubPageId] = useState<string | null>(null);
  const [editingSubPageDraft, setEditingSubPageDraft] = useState<{ title: string; category: string; desc: string }>({
    title: '',
    category: '',
    desc: ''
  });
  const [pageCardModal, setPageCardModal] = useState<{
    mode: 'add' | 'edit';
    pageId?: string;
    title: string;
    category: string;
    desc: string;
    bannerUrl: string;
  } | null>(null);
  const [activeFeatureTab, setActiveFeatureTab] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const [bookShowcaseTitle, setBookShowcaseTitle] = useState<string>('');
  const [bookShowcaseLink, setBookShowcaseLink] = useState<string>('');
  const [editingBookCoverId, setEditingBookCoverId] = useState<string | null>(null);

  // Apply app-wide color theme to document root whenever theme changes
  useEffect(() => {
    const activeTheme: AppThemeConfig =
      showThemeModal ? themeDraft : (siteContent.appTheme || DEFAULT_APP_THEME);
    if (!activeTheme || activeTheme.preset === 'default') {
      document.documentElement.removeAttribute('data-app-theme');
      document.documentElement.removeAttribute('data-app-light');
      document.body.style.backgroundColor = '';
      return;
    }
    const lightBg = isLightHex(activeTheme.bgColor);
    document.documentElement.setAttribute('data-app-theme', 'custom');
    document.documentElement.setAttribute('data-app-light', lightBg ? 'true' : 'false');
    document.body.style.backgroundColor = activeTheme.bgColor;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--theme-bg', activeTheme.bgColor);
    rootStyle.setProperty('--theme-footer-bg', mixHex(activeTheme.bgColor, '#000000', lightBg ? 0.05 : 0.22));
    rootStyle.setProperty('--theme-surface', activeTheme.surfaceColor);
    rootStyle.setProperty('--theme-surface-alt', mixHex(activeTheme.surfaceColor, activeTheme.bgColor, 0.35));
    rootStyle.setProperty('--theme-header-bg', rgbaStr(activeTheme.headerColor, 0.95));
    rootStyle.setProperty('--theme-accent', activeTheme.accentColor);
    rootStyle.setProperty('--theme-on-accent', isLightHex(activeTheme.accentColor) ? '#09090b' : '#ffffff');
    rootStyle.setProperty('--theme-secondary', activeTheme.secondaryColor);
    rootStyle.setProperty('--theme-secondary-soft', rgbaStr(activeTheme.secondaryColor, lightBg ? 0.14 : 0.26));
    rootStyle.setProperty('--theme-border', rgbaStr(activeTheme.secondaryColor, lightBg ? 0.35 : 0.42));
    rootStyle.setProperty('--theme-accent-border', rgbaStr(activeTheme.accentColor, 0.55));
    rootStyle.setProperty('--theme-text', activeTheme.textColor);
    rootStyle.setProperty('--theme-text-soft', mixHex(activeTheme.textColor, activeTheme.secondaryColor, 0.28));
    rootStyle.setProperty('--theme-glow-1', rgbaStr(activeTheme.secondaryColor, 0.18));
    rootStyle.setProperty('--theme-glow-2', rgbaStr(activeTheme.accentColor, 0.12));
  }, [siteContent.appTheme, showThemeModal, themeDraft]);

  const [sliderIndex, setSliderIndex] = useState<number>(0);
  
  // Interactive Cube Timer state
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Interactive Card Trick state
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [magicRevealed, setMagicRevealed] = useState<boolean>(false);

  // Career Hire Me WhatsApp message box state
  const DEFAULT_CAREER_MESSAGE =
    'Hi Rajib, I reviewed your portfolio and was impressed by your background in Project Management and Engineering. We have an opportunity at our organization and think you’d be a strong fit. Are you available for a brief chat this week?';
  const [careerMessageText, setCareerMessageText] = useState<string>(DEFAULT_CAREER_MESSAGE);

  // Magic Show Booking WhatsApp message box state
  const DEFAULT_MAGIC_MESSAGE =
    'Hi Rajib, we’re hosting an Event and would love to book your magic performance. Please let us know your availability!';
  const [magicMessageText, setMagicMessageText] = useState<string>(DEFAULT_MAGIC_MESSAGE);

  const sliderList = Array.isArray(siteContent.sliderImages) ? siteContent.sliderImages : [];
  const videosList = Array.isArray(siteContent.featuredVideos) ? siteContent.featuredVideos : [];
  const pageBannersMap = siteContent.pageBanners || {};
  const subpageInfoMap = siteContent.subpageInfo || {};

  useEffect(() => {
    if (sliderList.length === 0) return;
    const interval = setInterval(() => {
      setSliderIndex((prev) => (prev + 1) % sliderList.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [sliderList.length]);

  // Automatic image slider effect (3.5s interval, supports both built-in and Menu Bar image sliders)
  useEffect(() => {
    const entries: [string, string[]][] = Object.entries(siteContent.imageSliders || {}).map(
      ([k, arr]) => [k, Array.isArray(arr) ? arr : []]
    );
    Object.values(siteContent.customBlocks || {}).forEach((blocks: any) => {
      if (Array.isArray(blocks)) {
        blocks.forEach((blk: CustomBlock) => {
          if (blk.type === 'image-slider' && Array.isArray(blk.slides)) {
            entries.push([blk.id, blk.slides]);
          }
        });
      }
    });
    const multiSlideEntries = entries.filter(
      ([, arr]) => arr.filter((u: string) => u && u.trim() !== '').length > 1
    );
    if (multiSlideEntries.length === 0) return;

    const interval = setInterval(() => {
      setImageSliderIndices((prev) => {
        const next = { ...prev };
        multiSlideEntries.forEach(([key, arr]) => {
          const validLen = arr.filter((u: string) => u && u.trim() !== '').length;
          if (validLen > 1) {
            next[key] = ((prev[key] || 0) + 1) % validLen;
          }
        });
        return next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [siteContent.imageSliders, siteContent.customBlocks]);

  // Listen for YouTube embed state changes & non-YouTube iframe focus to pause/resume video slider
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'string') return;
      let parsed: any;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      let matchedKey: string | null =
        typeof parsed.id === 'string' && parsed.id in videoSliderIframeRefs.current
          ? parsed.id
          : null;
      if (!matchedKey && event.source) {
        for (const [k, el] of Object.entries(videoSliderIframeRefs.current)) {
          if (el && el.contentWindow === event.source) {
            matchedKey = k;
            break;
          }
        }
      }
      if (!matchedKey) return;

      const state =
        parsed.event === 'onStateChange'
          ? parsed.info
          : parsed.event === 'infoDelivery' && parsed.info && typeof parsed.info.playerState === 'number'
            ? parsed.info.playerState
            : null;

      if (state === 1 || state === 3) {
        setPlayingVideoSliders((prev) => (prev[matchedKey!] ? prev : { ...prev, [matchedKey!]: true }));
      } else if (state === 2 || state === 0 || state === -1) {
        setPlayingVideoSliders((prev) => (!prev[matchedKey!] ? prev : { ...prev, [matchedKey!]: false }));
      }
    };

    const onWindowBlur = () => {
      const activeEl = document.activeElement;
      if (!activeEl || activeEl.tagName !== 'IFRAME') return;
      const sliderKey = activeEl.getAttribute('data-video-slider');
      const embedSrc = activeEl.getAttribute('src') || '';
      if (sliderKey && !embedSrc.includes('youtube.com/embed/')) {
        setPlayingVideoSliders((prev) => ({ ...prev, [sliderKey]: true }));
      }
    };

    const onWindowFocus = () => {
      setPlayingVideoSliders((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [k, el] of Object.entries(videoSliderIframeRefs.current)) {
          const src = el?.getAttribute('src') || '';
          if (prev[k] && !src.includes('youtube.com/embed/')) {
            next[k] = false;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    window.addEventListener('message', onMessage);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, []);

  // Global pointer drag handler for banner & CV image reposition / height / width resize
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = bannerDragRef.current;
      if (!drag) return;
      const deltaY = e.clientY - drag.startY;
      const deltaX = e.clientX - (drag.startX ?? e.clientX);
      setSiteContent((prev: any) => {
        const curFrame: BannerFrame = (prev.bannerFrames && prev.bannerFrames[drag.imgKey]) || {};
        if (drag.mode === 'position') {
          const nextPosY = Math.round(
            Math.min(100, Math.max(0, drag.startVal - (deltaY / Math.max(drag.containerHeight, 120)) * 100))
          );
          return {
            ...prev,
            bannerFrames: {
              ...(prev.bannerFrames || {}),
              [drag.imgKey]: { ...curFrame, posY: nextPosY }
            }
          };
        } else if (drag.mode === 'width') {
          const nextWidth = Math.round(
            Math.min(100, Math.max(30, drag.startVal + (deltaX / Math.max(drag.containerWidth || 280, 140)) * 100))
          );
          return {
            ...prev,
            bannerFrames: {
              ...(prev.bannerFrames || {}),
              [drag.imgKey]: { ...curFrame, widthPct: nextWidth }
            }
          };
        } else {
          const isCvImg = drag.imgKey.startsWith('cv_img_');
          const minH = isCvImg ? 320 : 160;
          const maxH = isCvImg ? 2400 : 900;
          const nextHeight = Math.round(Math.min(maxH, Math.max(minH, drag.startVal + deltaY * (isCvImg ? 2.5 : 1.5))));
          return {
            ...prev,
            bannerFrames: {
              ...(prev.bannerFrames || {}),
              [drag.imgKey]: { ...curFrame, aspectHeight: nextHeight }
            }
          };
        }
      });
    };
    const onPointerUp = () => {
      bannerDragRef.current = null;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  // Automatic video slider effect (10s interval, pauses while a video is playing)
  useEffect(() => {
    const entries: [string, string[]][] = Object.entries(siteContent.videoSliders || {}).map(
      ([k, arr]) => [k, Array.isArray(arr) ? arr : []]
    );
    Object.values(siteContent.customBlocks || {}).forEach((blocks: any) => {
      if (Array.isArray(blocks)) {
        blocks.forEach((blk: CustomBlock) => {
          if (blk.type === 'video-slider' && Array.isArray(blk.slides)) {
            entries.push([blk.id, blk.slides]);
          }
        });
      }
    });
    const multiSlideEntries = entries.filter(([key, arr]) => {
      const validLen = arr.filter((u: string) => u && u.trim() !== '').length;
      return validLen > 1 && !playingVideoSliders[key];
    });
    if (multiSlideEntries.length === 0) return;

    const interval = setInterval(() => {
      setVideoSliderIndices((prev) => {
        const next = { ...prev };
        multiSlideEntries.forEach(([key, arr]) => {
          const validLen = arr.filter((u: string) => u && u.trim() !== '').length;
          if (validLen > 1) {
            next[key] = ((prev[key] || 0) + 1) % validLen;
          }
        });
        return next;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [siteContent.videoSliders, siteContent.customBlocks, playingVideoSliders]);

  // Close header menu dropdown when clicking/tapping anywhere outside
  useEffect(() => {
    if (!menuOpen) {
      setActiveMenuFlyout(null);
      return;
    }
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleWindowBlur = () => {
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [menuOpen]);

  // Cube timer effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const openCustomBlockBuilder = (type: 'video' | 'video-slider' | 'image-slider' | 'text-slab' | 'drive-image' | 'pdf' | 'html-code' | 'audio') => {
    const targetPage = currentPage || 'home';
    setSearchQuery('');
    setCustomBlockModal({
      mode: 'add',
      pageId: targetPage,
      type,
      link: '',
      countInput: '',
      slides: [],
      headline: '',
      body: '',
      align: 'left',
      linkUrl: '',
      driveInput: '',
      imageWidthIdx: 6,
      imageHeightIdx: 3,
      mergeTop: false,
      mergeBottom: false,
      pdfTitle: '',
      pdfWidthIdx: 6,
      pdfHeightIdx: 3,
      pdfDownloadable: false,
      htmlTitle: '',
      audioTitle: '',
      posY: 50,
      aspectHeight: null,
      zoom: 100,
      sliderStyle: 'classic'
    });
  };

  const handleGoogleAdminLogin = async () => {
    setLoginError('');
    setGoogleLoginLoading(true);
    try {
      const usePrimaryProvider = !isCloneMode || (isPrimaryAdmin && !isCoAdmin);
      const authProvider = usePrimaryProvider
        ? googleProvider
        : (() => {
            const p = new GoogleAuthProvider();
            p.setCustomParameters({ prompt: 'select_account' });
            return p;
          })();
      const cred = await signInWithPopup(auth, authProvider);
      const email = (cred.user.email || '').toLowerCase();
      if (!cred.user.emailVerified) {
        await signOut(auth);
        setLoginError('আপনার Google অ্যাকাউন্টের ইমেইলটি ভেরিফাইড নয়।');
        return;
      }
      if (isCloneMode) {
        // In Clone Mode: Primary Admin (rajibshahani9@gmail.com) or Co-Admin can sync clone edits
        if (ADMIN_EMAILS.includes(email)) {
          setFirebaseAdminUser(cred.user);
          setIsPrimaryAdmin(true);
        } else {
          if (!isCoAdmin && !isPrimaryAdmin) {
            await signOut(auth);
            setLoginError('প্রথমে অ্যাডমিনের দেওয়া কো-অ্যাডমিন ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন, তারপর Google ক্লাউড সিঙ্ক চালু করুন।');
            return;
          }
          setFirebaseCloneSyncUser(cred.user);
        }
      } else {
        if (!ADMIN_EMAILS.includes(email)) {
          await signOut(auth);
          setLoginError('মূল অ্যাডমিন ক্লাউড সিঙ্ক সবসময় rajibshahani9@gmail.com ইমেইল দিয়েই করতে হবে।');
          return;
        }
        setFirebaseAdminUser(cred.user);
        setIsPrimaryAdmin(true);
      }
      setShowAdminLoginModal(false);
      setAdminEmail('');
      setAdminPassword('');
      if (pendingMenuAction) {
        const actionType = pendingMenuAction;
        setPendingMenuAction(null);
        openCustomBlockBuilder(actionType);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setLoginError('Google লগইন সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    } finally {
      setGoogleLoginLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = adminEmail.trim().toLowerCase();
    const password = adminPassword;
    setLoginError('');

    if (normalizedEmail === 'rajibshahani9@gmail.com' && password === 'R@j01923#') {
      setIsPrimaryAdmin(true);
      setShowAdminLoginModal(false);
      setAdminEmail('');
      setAdminPassword('');
      if (pendingMenuAction) {
        const actionType = pendingMenuAction;
        setPendingMenuAction(null);
        openCustomBlockBuilder(actionType);
      }
      const curUser = auth.currentUser;
      const alreadyVerifiedPrimary = Boolean(
        curUser && curUser.emailVerified && ADMIN_EMAILS.includes((curUser.email || '').toLowerCase())
      );
      if (!alreadyVerifiedPrimary) {
        try {
          const cred = await signInWithPopup(auth, googleProvider);
          const gEmail = (cred.user.email || '').toLowerCase();
          if (cred.user.emailVerified && ADMIN_EMAILS.includes(gEmail)) {
            setFirebaseAdminUser(cred.user);
          } else {
            await signOut(auth);
          }
        } catch {
          // Local primary session stays active; edits sync automatically once Google connects
        }
      }
      return;
    }

    setLoginSubmitting(true);
    try {
      const tokenHash = await sha256Hex(`${normalizedEmail}::${password}`);
      const matchedLocal = coAdminsList.some((c) => c.tokenHash === tokenHash);
      let matchedCloud = false;
      if (!matchedLocal) {
        try {
          const snap = await getDoc(doc(db, 'co_admin_tokens', tokenHash));
          matchedCloud = Boolean(snap.exists() && (snap.data() as any)?.active !== false);
        } catch {
          matchedCloud = false;
        }
      }

      if (matchedLocal || matchedCloud) {
        if (!isCloneMode) {
          setLoginError('কো-অ্যাডমিন অ্যাকাউন্ট দিয়ে মূল ওয়েবসাইট এডিট করা যাবে না। অনুগ্রহ করে অ্যাডমিনের দেওয়া ক্লোন লিংক ব্যবহার করুন।');
          return;
        }
        if (assignedSubCloneEmail && normalizedEmail !== assignedSubCloneEmail) {
          setLoginError(`এই সাব-ক্লোন লিংকটি শুধুমাত্র নির্ধারিত কো-অ্যাডমিন (${assignedSubCloneEmail}) ব্যবহার করতে পারবেন।`);
          return;
        }
        const sessionObj = { email: normalizedEmail, tokenHash };
        setCoAdminSession(sessionObj);
        if (activeCloneId) {
          localStorage.setItem(`shahani_co_admin_session_${activeCloneId}`, JSON.stringify(sessionObj));
        }
        setShowAdminLoginModal(false);
        setAdminEmail('');
        setAdminPassword('');
        if (pendingMenuAction) {
          const actionType = pendingMenuAction;
          setPendingMenuAction(null);
          openCustomBlockBuilder(actionType);
        }
      } else {
        setLoginError('ভুল ইমেইল অথবা পাসওয়ার্ড!');
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleAdminLogout = () => {
    setIsPrimaryAdmin(false);
    setCoAdminSession(null);
    if (activeCloneId) {
      localStorage.removeItem(`shahani_co_admin_session_${activeCloneId}`);
    }
    setFirebaseAdminUser(null);
    setFirebaseCloneSyncUser(null);
    signOut(auth).catch(() => {});
  };

  const handleAddCoAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = coAdminEmailInput.trim().toLowerCase();
    const password = coAdminPasswordInput;
    const note = coAdminNoteInput.trim();
    if (!email || !password) return;
    setCoAdminSaving(true);
    setCoAdminStatusMsg('');
    try {
      const tokenHash = await sha256Hex(`${email}::${password}`);
      const newId = `ca_${Date.now().toString(36)}`;
      const entry = {
        id: newId,
        email,
        tokenHash,
        note,
        createdAtLabel: new Date().toLocaleDateString('bn-BD')
      };
      setCoAdminsList((prev) => {
        const filtered = prev.filter((item) => item.email !== email);
        return [entry, ...filtered];
      });
      if (firebaseAdminUser) {
        await setDoc(doc(db, 'co_admins', newId), {
          email,
          tokenHash,
          note,
          active: true,
          createdBy: firebaseAdminUser.uid,
          createdAt: serverTimestamp()
        });
        await setDoc(doc(db, 'co_admin_tokens', tokenHash), {
          coAdminId: newId,
          active: true,
          createdBy: firebaseAdminUser.uid,
          createdAt: serverTimestamp()
        });
        setCoAdminStatusMsg('কো-অ্যাডমিন সফলভাবে যুক্ত ও ক্লাউডে সিঙ্ক হয়েছে!');
      } else {
        setCoAdminStatusMsg('কো-অ্যাডমিন যুক্ত হয়েছে! সব ডিভাইসে চালু করতে Google দিয়ে ক্লাউড সিঙ্ক চালু করুন।');
      }
      setCoAdminEmailInput('');
      setCoAdminPasswordInput('');
      setCoAdminNoteInput('');
    } catch {
      setCoAdminStatusMsg('সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setCoAdminSaving(false);
    }
  };

  const handleDeleteCoAdmin = async (item: { id: string; email: string; tokenHash: string }) => {
    setCoAdminsList((prev) => prev.filter((c) => c.id !== item.id));
    if (firebaseAdminUser) {
      try {
        await deleteDoc(doc(db, 'co_admins', item.id));
        await deleteDoc(doc(db, 'co_admin_tokens', item.tokenHash));
      } catch {
        // ignore if already removed
      }
    }
  };

  const buildCloneUrl = (cloneId: string) => {
    if (typeof window === 'undefined') return `?clone=${cloneId}`;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('clone', cloneId);
    url.hash = '#home';
    return url.toString();
  };

  const handleCreateClone = async () => {
    if (!isPrimaryAdmin) return;
    setCloneCreating(true);
    try {
      const cloneId = `cl_${Date.now().toString(36)}`;
      const existingClones: { id: string; label: string; createdAt: string }[] = Array.isArray(siteContent.cloneLinks)
        ? siteContent.cloneLinks
        : [];
      const label = cloneLabelInput.trim() || `ক্লোন সাইট ${existingClones.length + 1}`;
      const newEntry = {
        id: cloneId,
        label,
        createdAt: new Date().toLocaleDateString('bn-BD')
      };
      setSiteContent((prev: any) => ({
        ...prev,
        cloneLinks: [newEntry, ...(Array.isArray(prev.cloneLinks) ? prev.cloneLinks : [])]
      }));

      if (firebaseAdminUser) {
        const snapshotSite = stripUndefinedDeep({
          ...siteContent,
          cloneLinks: [],
          subCloneLinks: [],
          subCloneConfig: null,
          blogPosts: mergedBlogPosts
        });
        const snapshotSub = stripUndefinedDeep(subpagesContent);
        await setDoc(doc(db, 'clone_states', cloneId), {
          siteContent: snapshotSite,
          subpagesContent: snapshotSub,
          ownerUid: '',
          updatedAt: serverTimestamp(),
          updatedBy: firebaseAdminUser.uid
        });
      }

      const cloneUrl = buildCloneUrl(cloneId);
      setLatestCloneUrl(cloneUrl);
      setCloneLabelInput('');
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(cloneUrl).then(() => {
          setCloneCopiedId(cloneId);
          setTimeout(() => setCloneCopiedId(null), 2500);
        }).catch(() => {});
      }
    } finally {
      setCloneCreating(false);
    }
  };

  const buildSubCloneUrl = (subCloneId: string, targetTabId: string) => {
    if (typeof window === 'undefined') return `?clone=${subCloneId}&page=${encodeURIComponent(targetTabId)}`;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('clone', subCloneId);
    url.searchParams.set('page', targetTabId);
    url.hash = `#${targetTabId}`;
    return url.toString();
  };

  const handleCreateSubClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrimaryAdmin) return;
    const targetTabId = subCloneTargetTabId.trim();
    if (!targetTabId) return;

    setSubCloneStatusMsg('');
    let assignedEmail = '';

    if (subCloneCoAdminMode === 'new') {
      const cleanEmail = subCloneCoAdminEmail.trim().toLowerCase();
      const cleanPassword = subCloneCoAdminPassword;
      if (!cleanEmail || !cleanPassword) {
        setSubCloneStatusMsg('নতুন কো-অ্যাডমিনের ইমেইল ও পাসওয়ার্ড লিখুন।');
        return;
      }
      assignedEmail = cleanEmail;
    } else if (subCloneCoAdminMode === 'existing') {
      assignedEmail = subCloneSelectedCoAdminEmail.trim().toLowerCase();
      if (!assignedEmail) {
        setSubCloneStatusMsg('তালিকা থেকে একজন কো-অ্যাডমিন নির্বাচন করুন।');
        return;
      }
    }

    setSubCloneCreating(true);
    try {
      if (subCloneCoAdminMode === 'new') {
        const cleanEmail = subCloneCoAdminEmail.trim().toLowerCase();
        const cleanPassword = subCloneCoAdminPassword;
        const cleanNote = subCloneCoAdminNote.trim();
        const tokenHash = await sha256Hex(`${cleanEmail}::${cleanPassword}`);
        const newCoAdminId = `ca_${Date.now().toString(36)}`;
        const entry = {
          id: newCoAdminId,
          email: cleanEmail,
          tokenHash,
          note: cleanNote,
          createdAtLabel: new Date().toLocaleDateString('bn-BD')
        };
        setCoAdminsList((prev) => {
          const filtered = prev.filter((item) => item.email !== cleanEmail);
          return [entry, ...filtered];
        });
        if (firebaseAdminUser) {
          await setDoc(doc(db, 'co_admins', newCoAdminId), {
            email: cleanEmail,
            tokenHash,
            note: cleanNote,
            active: true,
            createdBy: firebaseAdminUser.uid,
            createdAt: serverTimestamp()
          });
          await setDoc(doc(db, 'co_admin_tokens', tokenHash), {
            coAdminId: newCoAdminId,
            active: true,
            createdBy: firebaseAdminUser.uid,
            createdAt: serverTimestamp()
          });
        }
      }

      const subCloneId = `scl_${Date.now().toString(36)}`;
      const targetTabMeta = getTabMetaForPage(targetTabId);
      const targetTabLabel = targetTabMeta?.label || subpageInfoMap[targetTabId]?.title || targetTabId;
      const innerTabIds = Array.isArray(siteContent.pageInnerTabs?.[targetTabId])
        ? siteContent.pageInnerTabs[targetTabId].map((t: any) => t?.id).filter(Boolean)
        : [];
      const extraMagicIds =
        targetTabId === 'raj-magic-show'
          ? ['tas-vanish', 'tas-prediction', 'pin-card', 'taser-ghori', 'iskaponer-tekka']
          : [];
      const extraBookIds =
        targetTabId === 'books'
          ? (Array.isArray(siteContent.booksCovers) ? siteContent.booksCovers : [])
              .map((b: any) => (b?.id ? `book_${b.id}` : ''))
              .filter(Boolean)
          : [];
      const allowedPageIds = Array.from(new Set([targetTabId, ...innerTabIds, ...extraMagicIds, ...extraBookIds]));

      const subCloneConfigPayload = {
        targetTabId,
        targetTabLabel,
        allowedPageIds,
        assignedCoAdminEmail: assignedEmail
      };

      const existingSubClones: any[] = Array.isArray(siteContent.subCloneLinks) ? siteContent.subCloneLinks : [];
      const label = subCloneLabelInput.trim() || `সাব-ক্লোন: ${targetTabLabel}`;
      const newEntry = {
        id: subCloneId,
        label,
        targetTabId,
        targetTabLabel,
        assignedCoAdminEmail: assignedEmail,
        createdAt: new Date().toLocaleDateString('bn-BD')
      };

      setSiteContent((prev: any) => ({
        ...prev,
        subCloneLinks: [newEntry, ...(Array.isArray(prev.subCloneLinks) ? prev.subCloneLinks : [])]
      }));

      const snapshotSite = stripUndefinedDeep({
        ...siteContent,
        cloneLinks: [],
        subCloneLinks: [],
        blogPosts: targetTabId === 'blog' ? mergedBlogPosts : (siteContent.blogPosts || []),
        subCloneConfig: subCloneConfigPayload
      });
      const snapshotSub = stripUndefinedDeep(subpagesContent);

      localStorage.setItem(`shahani_clone_site_v5_${subCloneId}`, JSON.stringify(snapshotSite));
      localStorage.setItem(`shahani_clone_subpages_v5_${subCloneId}`, JSON.stringify(snapshotSub));

      if (firebaseAdminUser) {
        await setDoc(doc(db, 'clone_states', subCloneId), {
          siteContent: snapshotSite,
          subpagesContent: snapshotSub,
          ownerUid: '',
          updatedAt: serverTimestamp(),
          updatedBy: firebaseAdminUser.uid
        });
      }

      const subCloneUrl = buildSubCloneUrl(subCloneId, targetTabId);
      setLatestSubCloneUrl(subCloneUrl);
      setSubCloneLabelInput('');
      setSubCloneCoAdminEmail('');
      setSubCloneCoAdminPassword('');
      setSubCloneCoAdminNote('');
      setSubCloneStatusMsg(
        firebaseAdminUser
          ? `“${targetTabLabel}” ট্যাবের সাব-ক্লোন ও কো-অ্যাডমিন লিংক তৈরি ও সিঙ্ক হয়েছে!`
          : `“${targetTabLabel}” ট্যাবের সাব-ক্লোন লিংক তৈরি হয়েছে! সব ডিভাইসে চালু করতে Google সিঙ্ক ব্যবহার করুন।`
      );
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(subCloneUrl).then(() => {
          setSubCloneCopiedId(subCloneId);
          setTimeout(() => setSubCloneCopiedId(null), 2500);
        }).catch(() => {});
      }
    } catch {
      setSubCloneStatusMsg('সাব-ক্লোন তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setSubCloneCreating(false);
    }
  };

  const handleDeleteSubClone = async (itemId: string) => {
    setSiteContent((prev: any) => ({
      ...prev,
      subCloneLinks: (Array.isArray(prev.subCloneLinks) ? prev.subCloneLinks : []).filter(
        (x: any) => x.id !== itemId
      )
    }));
    localStorage.removeItem(`shahani_clone_site_v5_${itemId}`);
    localStorage.removeItem(`shahani_clone_subpages_v5_${itemId}`);
    if (firebaseAdminUser) {
      try {
        await deleteDoc(doc(db, 'clone_states', itemId));
      } catch {
        // ignore if already deleted
      }
    }
  };

  const handleSaveEdit = (key: string) => {
    if (key.startsWith('subpage_')) {
      const withoutPrefix = key.slice('subpage_'.length);
      const lastUnderscore = withoutPrefix.lastIndexOf('_');
      const pageId = lastUnderscore !== -1 ? withoutPrefix.slice(0, lastUnderscore) : withoutPrefix;
      const field = lastUnderscore !== -1 ? withoutPrefix.slice(lastUnderscore + 1) : 'title';
      setSiteContent((prev: any) => ({
        ...prev,
        subpageInfo: {
          ...prev.subpageInfo,
          [pageId]: {
            ...(prev.subpageInfo[pageId] || {}),
            [field]: tempEditValue
          }
        }
      }));
    } else {
      setSiteContent((prev: any) => ({ ...prev, [key]: tempEditValue }));
    }
    setEditingKey(null);
    setTempEditValue('');
  };

  const handleAddVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoLink.trim()) return;
    const link = newVideoLink.trim();
    if (newVideoTargetPage === 'home') {
      const newVid = {
        id: 'v_' + Date.now(),
        title: "ভিডিও প্রদর্শনী",
        yt: link
      };
      setSiteContent((prev: any) => ({
        ...prev,
        featuredVideos: [...(Array.isArray(prev.featuredVideos) ? prev.featuredVideos : []), newVid]
      }));
    } else {
      const newItem = {
        id: 'item_' + Date.now(),
        title: "ভিডিও কনটেন্ট",
        desc: "সংযুক্ত ভিডিও লিংক",
        yt: link
      };
      setSubpagesContent((prev: any) => ({
        ...prev,
        [newVideoTargetPage]: [...(prev[newVideoTargetPage] || []), newItem]
      }));
    }
    setNewVideoLink('');
    setShowAddVideoModal(false);
  };

  const handleAddBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim()) return;
    const newBook = {
      id: 'book_' + Date.now(),
      title: newBookTitle,
      desc: newBookDesc,
      price: newBookPrice || 'মূল্য নির্ধারিত নয়',
      pdfUrl: newBookPdf,
      coverUrl: normalizeImageUrl(newBookCover)
    };
    setSubpagesContent((prev: any) => ({
      ...prev,
      books: [...(prev.books || []), newBook]
    }));
    setNewBookTitle('');
    setNewBookDesc('');
    setNewBookPrice('');
    setNewBookPdf('');
    setNewBookCover('');
    setShowAddBookModal(false);
  };

  const buildPageShareUrl = (pageId: string) => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (activeCloneId) {
      url.searchParams.set('clone', activeCloneId);
    }
    if (pageId && pageId !== 'home') {
      url.searchParams.set('page', pageId);
      url.hash = `#${pageId}`;
    } else {
      url.hash = '#home';
    }
    return url.toString();
  };

  const handleShareCurrentPage = async () => {
    const shareUrl = buildPageShareUrl(currentPage);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${siteContent.headerBrandName || 'শাহানী রাজীব'} - Official App`,
          text: 'শাহানী রাজীব অফিশিয়াল অ্যাপের এই পেজটি দেখুন:',
          url: shareUrl
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
        return;
      }
    } catch {
      // Fallback modal below if clipboard is blocked inside iframe
    }
    setShareFallbackUrl(shareUrl);
  };

  const pagesData: PageData[] = [
    { 
      id: "raj-magic-show", 
      title: subpageInfoMap["raj-magic-show"]?.title || "রাজ ম্যাজিক শো", 
      category: subpageInfoMap["raj-magic-show"]?.category || "কন্টাক্ট ফর ম্যাজিক শো", 
      desc: subpageInfoMap["raj-magic-show"]?.desc || "হাতসাফাই, ক্লোজ-আপ ইল্যুশন, কার্ড ট্রিকস এবং ম্যাজিকের বিজ্ঞানসম্মত কৌশল।", 
      items: subpagesContent["raj-magic-show"] || []
    },
    { 
      id: "rubiks-cube", 
      title: subpageInfoMap["rubiks-cube"]?.title || "রুবিক্স কিউব", 
      category: subpageInfoMap["rubiks-cube"]?.category || "পাজল ও লজিক", 
      desc: subpageInfoMap["rubiks-cube"]?.desc || "হাজারেরও বেশি রুবিক্স কিউবের সংগ্রহশালা, অ্যালগরিদম সমাধান এবং গাণিতিক প্যাটার্ন।", 
      items: subpagesContent["rubiks-cube"] || []
    },
    { 
      id: "match-box", 
      title: subpageInfoMap["match-box"]?.title || "ম্যাচবক্স সংগ্রহ", 
      category: subpageInfoMap["match-box"]?.category || "সংগ্রহ ও শখ", 
      desc: subpageInfoMap["match-box"]?.desc || "পাঁচ শতাধিক ভিন্টেজ, অ্যান্টিক এবং আধুনিক দিয়াশলাই বাক্সের দুর্লভ সংগ্রহ।", 
      items: subpagesContent["match-box"] || []
    },
    { 
      id: "chess", 
      title: subpageInfoMap["chess"]?.title || "দাবা খেলা", 
      category: subpageInfoMap["chess"]?.category || "নিশিপাওয়া রাত", 
      desc: subpageInfoMap["chess"]?.desc || "সিসিলিয়ান ডিফেন্স, চেক-মেট ট্যাকটিক্স এবং নিশিপাওয়া রাতের দাবা ভাবনা।", 
      items: subpagesContent["chess"] || []
    },
    { 
      id: "books", 
      title: subpageInfoMap["books"]?.title || "বই ও প্রকাশনা", 
      category: subpageInfoMap["books"]?.category || "সাহিত্য", 
      desc: subpageInfoMap["books"]?.desc || "প্রকাশিত মৌলিক বই, প্রবন্ধ ও জাতীয় দৈনিক ও ম্যাগাজিনের লেখালেখি।", 
      items: subpagesContent["books"] || []
    },
    { 
      id: "ms-excel", 
      title: subpageInfoMap["ms-excel"]?.title || "এমএস এক্সেল", 
      category: subpageInfoMap["ms-excel"]?.category || "প্রফেশনাল স্কিলস", 
      desc: subpageInfoMap["ms-excel"]?.desc || "প্রজেক্ট ম্যানেজারদের জন্য এক্সেল শর্টকাট, অটোমেশন এবং ডেটা অ্যানালাইসিস।", 
      items: subpagesContent["ms-excel"] || []
    },
    { 
      id: "certificate", 
      title: subpageInfoMap["certificate"]?.title || "সিভি ও কর্মজীবন", 
      category: subpageInfoMap["certificate"]?.category || "ক্যারিয়ার প্রোফাইল", 
      desc: subpageInfoMap["certificate"]?.desc || "কর্মজীবন, শিক্ষাগত যোগ্যতা, পুরস্কার এবং প্রফেশনাল জীবনবৃত্তান্ত।", 
      items: subpagesContent["certificate"] || []
    }
  ];

  useEffect(() => {
    const syncFromUrl = () => {
      const rawNext = resolvePageFromLocation();
      const sc = activeSubCloneRef.current;
      const next = sc && !isPageAllowedInSubClone(rawNext, sc) ? sc.targetTabId : rawNext;
      setCurrentPage(next);
      setIsPinCardLocked(next === 'pin-card');
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  useEffect(() => {
    if (!activeSubClone?.targetTabId) return;
    if (!isPageAllowedInSubClone(currentPage, activeSubClone)) {
      const target = activeSubClone.targetTabId;
      setCurrentPage(target);
      setIsPinCardLocked(target === 'pin-card');
      if (typeof window !== 'undefined') {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('page', target);
        nextUrl.hash = `#${target}`;
        window.history.replaceState(null, '', nextUrl.toString());
      }
    }
  }, [activeSubClone, currentPage]);

  const handlePageChange = (requestedPageId: string) => {
    const sc = activeSubCloneRef.current;
    const pageId = sc && !isPageAllowedInSubClone(requestedPageId, sc) ? sc.targetTabId : requestedPageId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentPage(pageId);
    setIsPinCardLocked(pageId === 'pin-card');
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      if (pageId && pageId !== 'home') {
        nextUrl.searchParams.set('page', pageId);
        nextUrl.hash = `#${pageId}`;
      } else {
        nextUrl.searchParams.delete('page');
        nextUrl.hash = '';
      }
      window.history.replaceState(null, '', nextUrl.toString());
    }
    setMenuOpen(false);
    setGalleryBulkInput('');
    setPlayingVideoSliders({});
  };

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const baseTitle = 'শাহানী রাজীব | Shahani Rajib – Official Website & App';
    const pageMetaTitle =
      currentPage === 'home'
        ? baseTitle
        : currentPage === 'blog'
          ? 'ব্লগ | শাহানী রাজীব (Shahani Rajib)'
          : currentPage === 'books'
            ? 'বই ও সাহিত্য | শাহানী রাজীব (Shahani Rajib)'
            : currentPage === 'raj-magic-show'
              ? 'রাজ ম্যাজিক শো | শাহানী রাজীব (Shahani Rajib)'
              : currentPage === 'rubiks-cube'
                ? 'রুবিক্স কিউব | শাহানী রাজীব (Shahani Rajib)'
                : currentPage === 'ms-excel'
                  ? 'এক্সেল টিউটোরিয়াল | শাহানী রাজীব (Shahani Rajib)'
                  : currentPage === 'match-box'
                    ? 'সংগ্রহ | শাহানী রাজীব (Shahani Rajib)'
                    : currentPage === 'chess'
                      ? 'দাবা | শাহানী রাজীব (Shahani Rajib)'
                      : `${subpageInfoMap[currentPage]?.title || 'পোর্টফোলিও'} | শাহানী রাজীব`;
    document.title = pageMetaTitle;
    const canonicalHref = `${window.location.origin}${window.location.pathname}${
      currentPage && currentPage !== 'home' ? `?page=${encodeURIComponent(currentPage)}` : ''
    }`;
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalHref);
    let ogUrlEl = document.querySelector('meta[property="og:url"]');
    if (!ogUrlEl) {
      ogUrlEl = document.createElement('meta');
      ogUrlEl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrlEl);
    }
    ogUrlEl.setAttribute('content', canonicalHref);
  }, [currentPage, subpageInfoMap]);

  const extraSubPages: PageData[] = [
    ...(siteContent.homeFeatureTabs || []),
    ...(siteContent.topNavTabs || []).filter((t: any) => t.id !== 'home' && !pagesData.some((p) => p.id === t.id))
  ].map((tab: any) => ({
    id: tab.id,
    title: subpageInfoMap[tab.id]?.title || tab.label,
    category: subpageInfoMap[tab.id]?.category || tab.label,
    desc: subpageInfoMap[tab.id]?.desc || "",
    items: subpagesContent[tab.id] || []
  }));

  const customSubPageItems: PageData[] = (Array.isArray(siteContent.customSubPages) ? siteContent.customSubPages : []).map((sp: any) => ({
    id: sp.id,
    title: subpageInfoMap[sp.id]?.title || sp.title,
    category: subpageInfoMap[sp.id]?.category || sp.category || sp.title,
    desc: subpageInfoMap[sp.id]?.desc ?? sp.desc ?? "",
    items: subpagesContent[sp.id] || []
  }));

  const innerTabParentLookup: Record<string, string> = {};
  const allInnerTabItems: PageData[] = [];
  Object.entries(siteContent.pageInnerTabs || {}).forEach(([parentPageId, tabs]: [string, any]) => {
    if (Array.isArray(tabs)) {
      tabs.forEach((tab: any) => {
        if (tab && tab.id) {
          innerTabParentLookup[tab.id] = parentPageId;
          allInnerTabItems.push({
            id: tab.id,
            title: subpageInfoMap[tab.id]?.title || tab.label || 'ট্যাব',
            category: subpageInfoMap[tab.id]?.category || tab.label || 'ট্যাব',
            desc: subpageInfoMap[tab.id]?.desc || '',
            items: subpagesContent[tab.id] || []
          });
        }
      });
    }
  });

  innerTabParentLookupRef.current = innerTabParentLookup;

  const allSubPagesMap = new Map<string, PageData>();
  [...pagesData, ...extraSubPages, ...customSubPageItems, ...allInnerTabItems].forEach((p) => {
    if (!allSubPagesMap.has(p.id)) {
      allSubPagesMap.set(p.id, p);
    }
  });
  const allSubPages: PageData[] = Array.from(allSubPagesMap.values());
  const activePageData = allSubPages.find(p => p.id === currentPage);

  const getTabMetaForPage = (targetId: string): { label: string; iconUrl: string } => {
    const fromTop = (siteContent.topNavTabs || []).find((t: any) => t.id === targetId);
    if (fromTop) {
      return { label: fromTop.label || targetId, iconUrl: normalizeImageUrl(fromTop.iconUrl) };
    }
    const fromFeature = (siteContent.homeFeatureTabs || []).find((t: any) => t.id === targetId);
    if (fromFeature) {
      return { label: fromFeature.label || targetId, iconUrl: normalizeImageUrl(fromFeature.iconUrl) };
    }
    if (targetId === 'home') {
      return { label: 'হোম', iconUrl: '/assets/aistudio/Home_Logo_deea1969.png' };
    }
    if (targetId === 'raj-magic-show') {
      return { label: 'ম্যাজিক', iconUrl: '/assets/aistudio/Headline_Logo_41f367d1.png' };
    }
    if (targetId === 'books') {
      return { label: 'বই', iconUrl: '/assets/aistudio/Books_05f65e05.png' };
    }
    if (targetId === 'match-box') {
      return { label: 'সংগ্রহ', iconUrl: '/assets/aistudio/Collection_Logo_1603a52d.png' };
    }
    const fallbackTitle = subpageInfoMap[targetId]?.title || allSubPages.find((p) => p.id === targetId)?.title || 'পেজ';
    return { label: fallbackTitle, iconUrl: '' };
  };

  const renderSubpageTopBar = (pageId: string, extraNode?: React.ReactNode, compactMode: boolean = false) => {
    const parentId = innerTabParentLookup[pageId] || null;
    const tabsSourcePageId = parentId || pageId;
    const innerTabs: { id: string; label: string; iconUrl: string }[] = Array.isArray(
      siteContent.pageInnerTabs?.[tabsSourcePageId]
    )
      ? siteContent.pageInnerTabs[tabsSourcePageId]
      : [];
    const homeMeta = getTabMetaForPage('home');
    const parentMeta = parentId ? getTabMetaForPage(parentId) : null;

    return (
      <div className={`w-full flex items-center gap-1.5 sm:gap-2 ${extraNode ? 'flex-wrap overflow-visible py-0.5' : 'flex-nowrap overflow-hidden'}`}>
        {!isSubCloneMode && (
          <SubpageBackButton
            iconUrl={homeMeta.iconUrl}
            label={homeMeta.label}
            onClick={() => handlePageChange('home')}
            variant="home"
            compact={compactMode}
          />
        )}
        {parentId && parentMeta && (
          <SubpageBackButton
            iconUrl={parentMeta.iconUrl}
            label={parentMeta.label}
            onClick={() => handlePageChange(parentId)}
            variant="parent"
            compact={compactMode}
          />
        )}
        {extraNode}
        {innerTabs.length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {innerTabs.map((tab) => {
              const isTabActive = currentPage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handlePageChange(tab.id)}
                  title={tab.label || 'ট্যাব'}
                  className={`shrink-0 w-[72px] h-[72px] min-[380px]:w-[78px] min-[380px]:h-[78px] sm:w-[88px] sm:h-[88px] flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-xl border transition-all overflow-hidden ${
                    isTabActive
                      ? 'bg-gradient-to-b from-purple-900/70 to-amber-950/40 border-amber-400/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : 'bg-[#1b1b38]/95 border-purple-500/35 text-purple-100 hover:border-amber-400/60 hover:bg-purple-900/40'
                  }`}
                >
                  <img
                    src={normalizeImageUrl(tab.iconUrl)}
                    alt={tab.label || 'Tab'}
                    className="w-9 h-9 min-[380px]:w-10 min-[380px]:h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                  />
                  {tab.label && (
                    <span className="text-[9.5px] min-[390px]:text-[10px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold leading-tight whitespace-nowrap truncate max-w-full">
                      {tab.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const [booksSheetSearchText, setBooksSheetSearchText] = useState<string>('');
  const booksSearchLoadedRef = useRef(false);

  useEffect(() => {
    if (!searchQuery.trim() || booksSearchLoadedRef.current) return;
    booksSearchLoadedRef.current = true;
    import('./data/booksSheetData')
      .then((mod) => {
        const list = Array.isArray(mod.BOOKS_SHEET_DATA) ? mod.BOOKS_SHEET_DATA : [];
        const combined = list
          .map((col) => {
            const entries = Array.isArray(col.items)
              ? col.items.map((it) => `${it.title || ''} ${it.content || ''}`).join(' ')
              : '';
            return `${col.title || ''} ${entries}`;
          })
          .join(' ');
        setBooksSheetSearchText(combined);
      })
      .catch(() => {});
  }, [searchQuery]);

  const searchablePages: PageData[] = React.useMemo(() => {
    const map = new Map<string, PageData>();
    allSubPages.forEach((p) => map.set(p.id, p));

    const extraSearchTargets: PageData[] = [
      {
        id: 'about-shahani',
        title: subpageInfoMap['about-shahani']?.title || 'শাহানী রাজীব সম্পর্কে',
        category: subpageInfoMap['about-shahani']?.category || 'পরিচিতি',
        desc: subpageInfoMap['about-shahani']?.desc || siteContent.heroTitle || 'প্রজেক্ট ম্যানেজার, ইঞ্জিনিয়ার, ম্যাজিশিয়ান ও লেখক',
        items: subpagesContent['about-shahani'] || []
      },
      ...['tas-vanish', 'tas-prediction', 'pin-card', 'taser-ghori', 'iskaponer-tekka'].map((mid) => ({
        id: mid,
        title: subpageInfoMap[mid]?.title || mid,
        category: subpageInfoMap[mid]?.category || 'ম্যাজিক কার্ড ট্রিক',
        desc: subpageInfoMap[mid]?.desc || '',
        items: subpagesContent[mid] || []
      })),
      ...(Array.isArray(siteContent.booksCovers) ? siteContent.booksCovers : []).map((b: any) => ({
        id: `book_${b.id}`,
        title: b.title || 'বই',
        category: 'বই ও প্রকাশনা',
        desc: 'প্রকাশিত বই, কবিতা, গল্প ও সাহিত্য',
        items: []
      }))
    ];

    extraSearchTargets.forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, p);
    });

    const list = Array.from(map.values());
    return activeSubClone ? list.filter((p) => isPageAllowedInSubClone(p.id, activeSubClone)) : list;
  }, [allSubPages, subpageInfoMap, siteContent.heroTitle, siteContent.booksCovers, subpagesContent, activeSubClone]);

  const searchablePageIndex = React.useMemo(() => {
    return searchablePages.map((p) => {
      const itemTexts = (p.items || []).map((it) => `${it.title || ''} ${it.desc || ''}`).join(' ');
      const customBlkTexts = (Array.isArray(siteContent.customBlocks?.[p.id]) ? siteContent.customBlocks[p.id] : [])
        .map((blk: CustomBlock) => `${blk.headline || ''} ${blk.body || ''} ${blk.pdfTitle || ''} ${blk.htmlTitle || ''} ${blk.audioTitle || ''}`)
        .join(' ');
      const innerTabTexts = (Array.isArray(siteContent.pageInnerTabs?.[p.id]) ? siteContent.pageInnerTabs[p.id] : [])
        .map((t: any) => t.label || '')
        .join(' ');

      let extraPageCorpus = '';
      if (p.id === 'books') {
        const coversText = (Array.isArray(siteContent.booksCovers) ? siteContent.booksCovers : [])
          .map((b: any) => b.title || '')
          .join(' ');
        extraPageCorpus = `${coversText} কবিতা গল্প সাহিত্য বই ${booksSheetSearchText}`;
      } else if (p.id === 'blog') {
        extraPageCorpus = mergedBlogPosts
          .map((post) => {
            const blocksTxt = Array.isArray(post.blocks)
              ? post.blocks.map((b: any) => `${b.text || ''} ${b.caption || ''}`).join(' ')
              : '';
            return `${post.title || ''} ${blocksTxt}`;
          })
          .join(' ');
      } else if (p.id === 'about-shahani') {
        const statsTxt = (Array.isArray(siteContent.aboutStats) ? siteContent.aboutStats : [])
          .map((s: any) => `${s.value || ''} ${s.label || ''}`)
          .join(' ');
        extraPageCorpus = `${siteContent.heroTitle || ''} ${siteContent.aboutBio || ''} ${statsTxt}`;
      } else if (p.id === 'career-tab') {
        extraPageCorpus = `${siteContent.careerJobHeading || 'জব হিস্ট্রি'} ${siteContent.careerCvHeading || 'রেজ্যুমে/সিভি'}`;
      } else if (p.id === 'art-tab') {
        extraPageCorpus = siteContent.artHeading || 'আর্ট বাই রাজ';
      } else if (p.id === 'raj-magic-show') {
        extraPageCorpus = 'তাস ভ্যানিস তাস প্রেডিকশন পিন কার্ড তাসের ঘড়ি ইস্কাপনের টেক্কা';
      }

      const rawText = `${p.title || ''} ${p.category || ''} ${p.desc || ''} ${itemTexts} ${customBlkTexts} ${innerTabTexts} ${extraPageCorpus}`;
      const phoneticText = bengaliToLatinPhonetic(rawText);
      return { page: p, rawText, phoneticText };
    });
  }, [
    searchablePages,
    siteContent.customBlocks,
    siteContent.pageInnerTabs,
    siteContent.booksCovers,
    siteContent.heroTitle,
    siteContent.aboutBio,
    siteContent.aboutStats,
    siteContent.careerJobHeading,
    siteContent.careerCvHeading,
    siteContent.artHeading,
    booksSheetSearchText,
    mergedBlogPosts
  ]);

  const filteredPages = React.useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return allSubPages;
    return searchablePageIndex
      .filter((entry) => matchesBilingualSearch(entry.rawText, entry.phoneticText, q))
      .map((entry) => entry.page);
  }, [searchQuery, allSubPages, searchablePageIndex]);

  const openImageEditorModal = (imgKey: string, currentUrl: string, title: string, showSizeFields: boolean = true) => {
    const customSize = siteContent.imageSizes?.[imgKey] || {};
    setImageModal({
      imgKey,
      title,
      url: currentUrl || '',
      width: customSize.width || '100%',
      height: customSize.height || 'auto',
      showSizeFields
    });
  };

  const handleSaveImageModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageModal) return;
    const { imgKey, url, width, height, showSizeFields } = imageModal;
    const finalUrl = normalizeImageUrl(url);

    setSiteContent((prev: any) => {
      const next = { ...prev };
      if (showSizeFields) {
        next.imageSizes = {
          ...(prev.imageSizes || {}),
          [imgKey]: { width: width.trim() || '100%', height: height.trim() || 'auto' }
        };
      }
      if (imgKey === 'profile') {
        next.profileImage = finalUrl;
      } else if (imgKey === 'headerBrandLogo') {
        next.headerBrandLogo = finalUrl;
      } else if (imgKey === 'aboutButtonImage') {
        next.aboutButtonImage = finalUrl;
      } else if (imgKey.startsWith('slider_')) {
        const idx = parseInt(imgKey.split('_')[1]);
        const updated = [...(prev.sliderImages || [])];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], url: finalUrl };
          next.sliderImages = updated;
        }
      } else if (imgKey.startsWith('banner_')) {
        const pageId = imgKey.replace('banner_', '');
        next.pageBanners = { ...(prev.pageBanners || {}), [pageId]: finalUrl };
      } else if (imgKey.startsWith('tab_')) {
        const tabId = imgKey.replace('tab_', '');
        next.homeFeatureTabs = (prev.homeFeatureTabs || []).map((t: any) =>
          t.id === tabId ? { ...t, iconUrl: finalUrl } : t
        );
      } else if (imgKey.startsWith('topnav_')) {
        const tabId = imgKey.replace('topnav_', '');
        next.topNavTabs = (prev.topNavTabs || []).map((t: any) =>
          t.id === tabId ? { ...t, iconUrl: finalUrl } : t
        );
      }
      return next;
    });
    setImageModal(null);
  };

  // Helper render wrapper for admin resizable image container (Google-Form-style drag/resize fit for banners)
  const renderResizableImage = (imgSrc: string, imgKey: string, altText: string, defaultClass: string = "w-full h-full object-contain") => {
    const resolvedSrc = normalizeImageUrl(imgSrc);
    if (!resolvedSrc || resolvedSrc.trim() === '') {
      return isAdmin ? (
        <div className="bg-[#13132b] border-2 border-dashed border-purple-500/50 rounded-2xl p-6 text-center text-xs text-purple-300 space-y-2">
          <p>এই পেজে কোনো ব্যানার বা হেডার ইমেজ নেই (1600 × 400)।</p>
          <button 
            onClick={() => openImageEditorModal(imgKey, '', 'ব্যানার ইমেজ যোগ করুন', true)}
            className="bg-amber-500 text-black px-3.5 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 hover:brightness-110 transition-all"
          >
            <ImageIcon size={14} /> ড্রাইভ / ইমেজ লিংক যোগ করুন
          </button>
        </div>
      ) : null;
    }

    const customSize = siteContent.imageSizes[imgKey] || {};
    const isBanner = imgKey.startsWith('banner_');

    if (isBanner) {
      const frame: BannerFrame = (siteContent.bannerFrames && siteContent.bannerFrames[imgKey]) || {};
      const posY = typeof frame.posY === 'number' ? frame.posY : 50;
      const aspectHeight = typeof frame.aspectHeight === 'number' ? frame.aspectHeight : 400;
      const zoom = typeof frame.zoom === 'number' ? frame.zoom : 100;
      const isAdjusting = isAdmin && bannerAdjustKey === imgKey;
      const hasCustomHeight = customSize.height && customSize.height !== 'auto';

      return (
        <div className="space-y-2 w-full mx-auto" style={{ width: customSize.width || '100%' }}>
          <div
            onPointerDown={(e) => {
              if (!isAdjusting) return;
              if ((e.target as HTMLElement).closest('button, input')) return;
              e.preventDefault();
              bannerDragRef.current = {
                imgKey,
                mode: 'position',
                startY: e.clientY,
                startVal: posY,
                containerHeight: e.currentTarget.getBoundingClientRect().height || 200
              };
            }}
            className={`relative group w-full overflow-hidden rounded-2xl bg-[#101026] ${
              isAdjusting
                ? 'border-2 border-amber-400 cursor-ns-resize touch-none shadow-[0_0_25px_rgba(245,158,11,0.35)]'
                : isAdmin
                  ? 'border-2 border-dashed border-purple-500/60 bg-purple-950/20'
                  : ''
            }`}
            style={{
              aspectRatio: hasCustomHeight ? undefined : `1600 / ${aspectHeight}`,
              height: hasCustomHeight ? customSize.height : undefined
            }}
          >
            <img
              src={resolvedSrc}
              alt={altText}
              draggable={false}
              className="w-full h-full object-cover select-none block"
              style={{
                objectPosition: `50% ${posY}%`,
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                transformOrigin: zoom < 100 ? '50% 50%' : `50% ${posY}%`
              }}
            />

            {isAdjusting && (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center z-10">
                  <span className="bg-black/75 border border-amber-400/60 text-amber-200 text-[11px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                    <MoveVertical size={13} /> ছবিটি উপর-নিচে টেনে পজিশন ঠিক করুন
                  </span>
                </div>
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    bannerDragRef.current = {
                      imgKey,
                      mode: 'height',
                      startY: e.clientY,
                      startVal: aspectHeight,
                      containerHeight: 200
                    };
                  }}
                  title="উপর-নিচে টেনে ব্যানারের উচ্চতা ছোট/বড় করুন"
                  className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-amber-500/90 to-amber-500/30 hover:from-amber-400 cursor-row-resize touch-none flex items-center justify-center z-20"
                >
                  <span className="w-12 h-1 rounded-full bg-black/80" />
                </div>
              </>
            )}

            {isAdmin && (
              <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-md p-1.5 rounded-lg flex flex-wrap items-center gap-1.5 z-30 shadow-2xl border border-purple-500/50">
                <button
                  type="button"
                  onClick={() => setBannerAdjustKey(prev => (prev === imgKey ? null : imgKey))}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-all ${
                    isAdjusting
                      ? 'bg-emerald-500 text-black'
                      : 'bg-cyan-500 text-black hover:bg-cyan-400'
                  }`}
                >
                  <MoveVertical size={11} /> {isAdjusting ? 'ফিট সেভ করুন' : 'টেনে ফিট করুন'}
                </button>
                <button 
                  type="button"
                  onClick={() => openImageEditorModal(imgKey, imgSrc, 'ইমেজ সাইজ ও লিংক পরিবর্তন', true)}
                  className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-purple-500"
                >
                  সাইজ
                </button>
                <button 
                  type="button"
                  onClick={() => openImageEditorModal(imgKey, imgSrc, 'নতুন ইমেজ বা ড্রাইভ লিংক দিন', true)}
                  className="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-bold"
                >
                  লিংক
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setConfirmModal({
                      message: "এই ব্যানার ইমেজটি মুছে ফেলতে চান?",
                      onConfirm: () => {
                        const pageId = imgKey.replace('banner_', '');
                        setSiteContent((prev: any) => ({
                          ...prev,
                          pageBanners: { ...(prev.pageBanners || {}), [pageId]: "" }
                        }));
                        if (bannerAdjustKey === imgKey) setBannerAdjustKey(null);
                      }
                    });
                  }}
                  className="bg-red-500 text-white px-2 py-0.5 rounded text-[10px]"
                >
                  ডিলিট
                </button>
              </div>
            )}
          </div>

          {isAdjusting && (
            <div className="bg-[#13132b] border border-amber-400/50 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left shadow-lg">
              <div>
                <div className="flex justify-between text-[11px] text-amber-300 font-bold mb-1">
                  <span>উপর-নিচ পজিশন</span>
                  <span>{posY}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={posY}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSiteContent((prev: any) => ({
                      ...prev,
                      bannerFrames: {
                        ...(prev.bannerFrames || {}),
                        [imgKey]: { ...(prev.bannerFrames?.[imgKey] || {}), posY: val }
                      }
                    }));
                  }}
                  className="w-full accent-amber-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-amber-300 font-bold mb-1">
                  <span>ব্যানার উচ্চতা (বড়/ছোট)</span>
                  <span>1600×{aspectHeight}</span>
                </div>
                <input
                  type="range"
                  min={160}
                  max={900}
                  step={10}
                  value={aspectHeight}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSiteContent((prev: any) => ({
                      ...prev,
                      bannerFrames: {
                        ...(prev.bannerFrames || {}),
                        [imgKey]: { ...(prev.bannerFrames?.[imgKey] || {}), aspectHeight: val }
                      },
                      imageSizes: {
                        ...(prev.imageSizes || {}),
                        [imgKey]: { ...(prev.imageSizes?.[imgKey] || {}), height: 'auto' }
                      }
                    }));
                  }}
                  className="w-full accent-amber-400"
                />
              </div>
              <div>
                <div className="flex justify-between items-center text-[11px] text-amber-300 font-bold mb-1 gap-1">
                  <span>জুম ইন / আউট ({zoom}%)</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const nextZoom = Math.max(50, zoom - 10);
                        setSiteContent((prev: any) => ({
                          ...prev,
                          bannerFrames: {
                            ...(prev.bannerFrames || {}),
                            [imgKey]: { ...(prev.bannerFrames?.[imgKey] || {}), zoom: nextZoom }
                          }
                        }));
                      }}
                      className="bg-purple-800/70 hover:bg-purple-700 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 text-[10px]"
                      title="জুম আউট"
                    >
                      <ZoomOut size={10} /> আউট
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextZoom = Math.min(250, zoom + 10);
                        setSiteContent((prev: any) => ({
                          ...prev,
                          bannerFrames: {
                            ...(prev.bannerFrames || {}),
                            [imgKey]: { ...(prev.bannerFrames?.[imgKey] || {}), zoom: nextZoom }
                          }
                        }));
                      }}
                      className="bg-purple-800/70 hover:bg-purple-700 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 text-[10px]"
                      title="জুম ইন"
                    >
                      <ZoomIn size={10} /> ইন
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSiteContent((prev: any) => ({
                          ...prev,
                          bannerFrames: {
                            ...(prev.bannerFrames || {}),
                            [imgKey]: { posY: 50, aspectHeight: 400, zoom: 100 }
                          }
                        }));
                      }}
                      className="text-[10px] text-cyan-300 hover:underline inline-flex items-center gap-0.5 ml-0.5"
                    >
                      <RotateCcw size={10} /> রিসেট
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={50}
                  max={250}
                  value={zoom}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSiteContent((prev: any) => ({
                      ...prev,
                      bannerFrames: {
                        ...(prev.bannerFrames || {}),
                        [imgKey]: { ...(prev.bannerFrames?.[imgKey] || {}), zoom: val }
                      }
                    }));
                  }}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div 
        className={`relative group mx-auto ${isAdmin && imgKey !== 'profile' ? 'border-2 border-dashed border-purple-500/60 p-1 rounded-xl resize both overflow-auto bg-purple-950/20' : ''}`}
        style={{ 
          width: customSize.width || '100%', 
          height: customSize.height || 'auto',
          minWidth: isAdmin && imgKey !== 'profile' ? '120px' : undefined,
          minHeight: isAdmin && imgKey !== 'profile' ? '100px' : undefined
        }}
      >
        <img
          src={resolvedSrc}
          alt={altText}
          className={`${defaultClass} mx-auto block`}
        />
        {isAdmin && (
          <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-md p-1.5 rounded-lg flex items-center gap-1.5 z-20 shadow-2xl border border-purple-500/50">
            <span className="text-[10px] text-purple-300 font-bold">🌙 রিসাইজ/লিংক:</span>
            <button 
              onClick={() => openImageEditorModal(imgKey, imgSrc, 'ইমেজ সাইজ ও লিংক পরিবর্তন', true)}
              className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-purple-500"
            >
              সাইজ
            </button>
            <button 
              onClick={() => openImageEditorModal(imgKey, imgSrc, 'নতুন ইমেজ বা ড্রাইভ লিংক দিন', true)}
              className="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-bold"
            >
              লিংক
            </button>
          </div>
        )}
      </div>
    );
  };

  const openSliderBuilder = (type: 'video' | 'image', targetKey: string, title: string) => {
    const existing: string[] = type === 'video'
      ? (siteContent.videoSliders?.[targetKey] || [])
      : (siteContent.imageSliders?.[targetKey] || []);
    setSliderBuilderModal({
      type,
      targetKey,
      title,
      countInput: existing.length > 0 ? String(existing.length) : '',
      links: [...existing]
    });
  };

  const handleVideoSliderIframeLoad = (targetKey: string, iframeEl: HTMLIFrameElement | null) => {
    if (!iframeEl || !iframeEl.contentWindow) return;
    try {
      iframeEl.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: targetKey, channel: 'widget' }),
        '*'
      );
      iframeEl.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
        '*'
      );
    } catch {
      // Ignore cross-origin restrictions for non-YouTube embeds
    }
  };

  const renderVideoSliderTrack = (
    targetKey: string,
    slides: string[],
    label: string,
    styleType: SliderStyleType = 'classic'
  ) => {
    if (slides.length === 0) return null;
    const rawIdx = videoSliderIndices[targetKey] || 0;
    const safeIdx = rawIdx % slides.length;
    if (styleType !== 'classic') {
      return (
        <CarouselShowcase
          mode="video"
          styleType={styleType}
          slides={slides}
          activeIndex={safeIdx}
          onChangeIndex={(nextIdx) =>
            setVideoSliderIndices((prev) => ({ ...prev, [targetKey]: nextIdx }))
          }
          onVideoNavigate={() =>
            setPlayingVideoSliders((prev) => ({ ...prev, [targetKey]: false }))
          }
          onVideoIframeRef={(el) => {
            videoSliderIframeRefs.current[targetKey] = el;
          }}
          onVideoIframeLoad={(el) => handleVideoSliderIframeLoad(targetKey, el)}
          normalizeImageUrl={normalizeImageUrl}
          getVideoEmbedUrl={getSliderEmbedUrl}
          label={label}
          targetKey={targetKey}
        />
      );
    }
    return (
      <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-2.5 sm:p-3.5 shadow-[0_0_25px_rgba(120,50,255,0.2)] space-y-2.5 overflow-hidden">
        <div className="relative">
          <div
            key={`${targetKey}_${safeIdx}_${slides[safeIdx]}`}
            className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-purple-500/30 shadow-inner animate-video-slide"
          >
            <iframe
              ref={(el) => { videoSliderIframeRefs.current[targetKey] = el; }}
              data-video-slider={targetKey}
              onLoad={(e) => handleVideoSliderIframeLoad(targetKey, e.currentTarget)}
              src={getSliderEmbedUrl(slides[safeIdx])}
              title={`${label} ${safeIdx + 1}`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>

          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPlayingVideoSliders(prev => ({ ...prev, [targetKey]: false }));
                  setVideoSliderIndices(prev => ({
                    ...prev,
                    [targetKey]: (safeIdx - 1 + slides.length) % slides.length
                  }));
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/65 hover:bg-black/90 text-amber-300 border border-purple-500/40 p-2 rounded-full transition-all shadow-lg z-10"
                aria-label="Previous video"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayingVideoSliders(prev => ({ ...prev, [targetKey]: false }));
                  setVideoSliderIndices(prev => ({
                    ...prev,
                    [targetKey]: (safeIdx + 1) % slides.length
                  }));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/65 hover:bg-black/90 text-amber-300 border border-purple-500/40 p-2 rounded-full transition-all shadow-lg z-10"
                aria-label="Next video"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {slides.length > 1 && (
          <div className="flex flex-wrap justify-center gap-1.5 pt-0.5">
            {slides.map((_: string, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setPlayingVideoSliders(prev => ({ ...prev, [targetKey]: false }));
                  setVideoSliderIndices(prev => ({ ...prev, [targetKey]: i }));
                }}
                aria-label={`Slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  safeIdx === i
                    ? 'bg-amber-400 w-6 shadow-[0_0_10px_rgba(245,158,11,0.8)]'
                    : 'bg-white/30 hover:bg-white/50 w-2.5'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderVideoSlider = (targetKey: string, label: string) => {
    const slides: string[] = Array.isArray(siteContent.videoSliders?.[targetKey])
      ? siteContent.videoSliders[targetKey].filter((u: string) => u && u.trim() !== '')
      : [];
    if (slides.length === 0 && !isAdmin) return null;

    return (
      <div className="space-y-2.5">
        {isAdmin && (
          <div className="flex flex-wrap justify-between items-center gap-2 bg-purple-950/50 border border-purple-500/40 rounded-xl px-3 py-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Video size={14} /> {label} ({slides.length}টি ভিডিও)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openSliderBuilder('video', targetKey, label)}
                className="bg-gradient-to-r from-purple-600 to-amber-500 text-black text-xs font-bold px-3 py-1 rounded-lg inline-flex items-center gap-1 hover:brightness-110"
              >
                <PlusCircle size={13} /> {slides.length > 0 ? 'ভিডিও স্লাইডার এডিট করুন' : 'ভিডিও স্লাইডার অ্যাড করুন'}
              </button>
              {slides.length > 0 && (
                <button
                  onClick={() => {
                    setConfirmModal({
                      message: 'এই ভিডিও স্লাইডারটি ডিলিট করতে চান?',
                      onConfirm: () => {
                        setSiteContent((prev: any) => ({
                          ...prev,
                          videoSliders: { ...(prev.videoSliders || {}), [targetKey]: [] }
                        }));
                      }
                    });
                  }}
                  className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-red-600"
                >
                  ডিলিট
                </button>
              )}
            </div>
          </div>
        )}

        {renderVideoSliderTrack(targetKey, slides, label)}
      </div>
    );
  };

  const renderImageSliderTrack = (
    targetKey: string,
    slides: string[],
    label: string,
    frameOpts?: { posY?: number; aspectHeight?: number | null; zoom?: number; sliderStyle?: SliderStyleType }
  ) => {
    if (slides.length === 0) return null;
    const rawIdx = imageSliderIndices[targetKey] || 0;
    const safeIdx = rawIdx % slides.length;
    const styleType = frameOpts?.sliderStyle || 'classic';
    if (styleType !== 'classic') {
      return (
        <CarouselShowcase
          mode="image"
          styleType={styleType}
          slides={slides}
          activeIndex={safeIdx}
          onChangeIndex={(nextIdx) =>
            setImageSliderIndices((prev) => ({ ...prev, [targetKey]: nextIdx }))
          }
          onOpenLightbox={(url) => setLightboxImageUrl(url)}
          normalizeImageUrl={normalizeImageUrl}
          getVideoEmbedUrl={getSliderEmbedUrl}
          frameOpts={frameOpts}
          label={label}
          targetKey={targetKey}
        />
      );
    }
    const posY = typeof frameOpts?.posY === 'number' ? frameOpts.posY : 50;
    const aspectHeight = typeof frameOpts?.aspectHeight === 'number' && frameOpts.aspectHeight > 0 ? frameOpts.aspectHeight : null;
    const zoom = typeof frameOpts?.zoom === 'number' ? frameOpts.zoom : 100;
    const hasCustomFrame = Boolean(aspectHeight || posY !== 50);

    return (
      <div className="w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border border-purple-500/40 shadow-[0_0_30px_rgba(120,50,255,0.25)] bg-[#101026] p-2 sm:p-3 flex items-center justify-center relative">
        {hasCustomFrame ? (
          <div
            className="w-full overflow-hidden rounded-2xl bg-[#101026]"
            style={{ aspectRatio: `1600 / ${aspectHeight || 420}` }}
          >
            <img
              src={normalizeImageUrl(slides[safeIdx])}
              alt={`${label} ${safeIdx + 1}`}
              onClick={() => setLightboxImageUrl(normalizeImageUrl(slides[safeIdx]))}
              className="w-full h-full object-cover cursor-pointer rounded-2xl block"
              style={{
                objectPosition: `50% ${posY}%`,
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                transformOrigin: zoom < 100 ? '50% 50%' : `50% ${posY}%`
              }}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl max-w-full flex items-center justify-center">
            <img
              src={normalizeImageUrl(slides[safeIdx])}
              alt={`${label} ${safeIdx + 1}`}
              onClick={() => setLightboxImageUrl(normalizeImageUrl(slides[safeIdx]))}
              className="w-auto max-w-full h-auto max-h-[260px] sm:max-h-[380px] object-contain mx-auto cursor-pointer rounded-2xl shadow-md block transition-transform"
              style={{
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                transformOrigin: '50% 50%'
              }}
            />
          </div>
        )}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setImageSliderIndices(prev => ({
                ...prev,
                [targetKey]: (safeIdx - 1 + slides.length) % slides.length
              }))}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-amber-300 border border-purple-500/40 p-2 rounded-full transition-all shadow-lg"
              title="আগের ছবি"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setImageSliderIndices(prev => ({
                ...prev,
                [targetKey]: (safeIdx + 1) % slides.length
              }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-amber-300 border border-purple-500/40 p-2 rounded-full transition-all shadow-lg"
              title="পরের ছবি"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 right-3 flex gap-1.5 z-10 bg-black/50 px-2 py-1 rounded-full">
              {slides.map((_: string, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageSliderIndices(prev => ({ ...prev, [targetKey]: i }))}
                  className={`h-2.5 rounded-full transition-all ${
                    safeIdx === i ? 'bg-amber-400 w-6 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-white/40 w-2.5'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderImageSlider = (targetKey: string, label: string) => {
    const slides: string[] = Array.isArray(siteContent.imageSliders?.[targetKey])
      ? siteContent.imageSliders[targetKey].filter((u: string) => u && u.trim() !== '')
      : [];
    if (slides.length === 0 && !isAdmin) return null;

    return (
      <div className="space-y-2.5">
        {isAdmin && (
          <div className="flex flex-wrap justify-between items-center gap-2 bg-purple-950/50 border border-purple-500/40 rounded-xl px-3 py-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <ImageIcon size={14} /> {label} ({slides.length}টি ইমেজ)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openSliderBuilder('image', targetKey, label)}
                className="bg-gradient-to-r from-purple-600 to-amber-500 text-black text-xs font-bold px-3 py-1 rounded-lg inline-flex items-center gap-1 hover:brightness-110"
              >
                <PlusCircle size={13} /> {slides.length > 0 ? 'ইমেজ স্লাইডার এডিট করুন' : 'ইমেজ স্লাইডার অ্যাড করুন'}
              </button>
              {slides.length > 0 && (
                <button
                  onClick={() => {
                    setConfirmModal({
                      message: 'এই ইমেজ স্লাইডারটি ডিলিট করতে চান?',
                      onConfirm: () => {
                        setSiteContent((prev: any) => ({
                          ...prev,
                          imageSliders: { ...(prev.imageSliders || {}), [targetKey]: [] }
                        }));
                      }
                    });
                  }}
                  className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-red-600"
                >
                  ডিলিট
                </button>
              )}
            </div>
          </div>
        )}

        {renderImageSliderTrack(targetKey, slides, label)}
      </div>
    );
  };

  // Canva-style page section ordering & Menu-bar repeatable custom blocks
  const getPageCustomBlocks = (pageId: string): CustomBlock[] => {
    const raw = siteContent.customBlocks?.[pageId];
    return Array.isArray(raw) ? raw : [];
  };

  const getDeletableSystemKey = (pageId: string, sectionKey: string): string | null => {
    if (pageId === 'books' && (sectionKey === 'booksReader' || sectionKey === 'booksShowcase')) {
      return `sys_books_${sectionKey}`;
    }
    if (pageId === 'raj-magic-show' && (sectionKey === 'subpageHeader' || sectionKey === 'videosSection')) {
      return `sys_raj-magic-show_${sectionKey}`;
    }
    if (pageId === 'ms-excel' && (sectionKey === 'videoSlider' || sectionKey === 'subpageHeader')) {
      return `sys_ms-excel_${sectionKey}`;
    }
    if (pageId === 'career-tab' && sectionKey === 'certTab') {
      return 'sys_career-tab_certTab';
    }
    if (pageId === 'about-shahani' && sectionKey === 'stats') {
      return 'sys_about-shahani_stats';
    }
    return null;
  };

  const deleteBuiltInSection = (pageId: string, sectionKey: string, label: string) => {
    const sysKey = getDeletableSystemKey(pageId, sectionKey);
    if (!sysKey) return;
    setConfirmModal({
      message: `"${label}" অংশটি ডিলিট করতে চান?`,
      onConfirm: () => {
        setSiteContent((prev: any) => {
          const curDeleted: string[] = Array.isArray(prev.deletedSystemBlockIds) ? prev.deletedSystemBlockIds : [];
          if (curDeleted.includes(sysKey)) return prev;
          return {
            ...prev,
            deletedSystemBlockIds: [...curDeleted, sysKey]
          };
        });
      }
    });
  };

  const renderDeletedBuiltInRestoreBar = (
    pageId: string,
    sectionKeys: string[],
    labelsMap: Record<string, string>
  ) => {
    if (!isAdmin) return null;
    const deletedIds: string[] = Array.isArray(siteContent.deletedSystemBlockIds)
      ? siteContent.deletedSystemBlockIds
      : [];
    const deletedHere = sectionKeys
      .map((secKey) => ({ secKey, sysKey: getDeletableSystemKey(pageId, secKey) }))
      .filter((x): x is { secKey: string; sysKey: string } => Boolean(x.sysKey && deletedIds.includes(x.sysKey)));
    if (deletedHere.length === 0) return null;
    return (
      <div className="bg-[#161632]/80 border border-dashed border-purple-500/40 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-purple-300/80">ডিলিট করা অংশসমূহ (অ্যাডমিন):</span>
        <div className="flex flex-wrap gap-1.5">
          {deletedHere.map(({ secKey, sysKey }) => (
            <button
              key={sysKey}
              type="button"
              onClick={() => {
                setSiteContent((prev: any) => ({
                  ...prev,
                  deletedSystemBlockIds: (Array.isArray(prev.deletedSystemBlockIds) ? prev.deletedSystemBlockIds : []).filter(
                    (id: string) => id !== sysKey
                  )
                }));
              }}
              className="bg-purple-800/60 hover:bg-purple-700 text-amber-300 px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1"
            >
              <RotateCcw size={10} /> {labelsMap[secKey] || secKey} ফিরিয়ে আনুন
            </button>
          ))}
        </div>
      </div>
    );
  };

  const getOrderedSectionKeys = (pageId: string, builtInKeys: string[]): string[] => {
    const deletedSystemIds: string[] = Array.isArray(siteContent.deletedSystemBlockIds)
      ? siteContent.deletedSystemBlockIds
      : [];
    const activeBuiltInKeys = builtInKeys.filter((k) => {
      const sysKey = getDeletableSystemKey(pageId, k);
      return !sysKey || !deletedSystemIds.includes(sysKey);
    });
    const customIds = getPageCustomBlocks(pageId).map((b) => b.id);
    const validKeys = [...activeBuiltInKeys, ...customIds];
    const validSet = new Set(validKeys);
    const saved: string[] = Array.isArray(siteContent.pageSectionOrders?.[pageId])
      ? siteContent.pageSectionOrders[pageId]
      : [];
    const ordered = saved.filter((k) => validSet.has(k));
    const orderedSet = new Set(ordered);
    validKeys.forEach((k) => {
      if (!orderedSet.has(k)) {
        if ((pageId === 'career-tab' && k === 'hireBox') || (pageId === 'raj-magic-show' && k === 'magicBookBox')) {
          ordered.unshift(k);
        } else if (pageId === 'career-tab' && k === 'certTab') {
          ordered.push(k);
        } else {
          ordered.push(k);
        }
        orderedSet.add(k);
      }
    });
    return ordered;
  };

  const movePageSection = (pageId: string, builtInKeys: string[], key: string, direction: 'up' | 'down') => {
    const currentOrder = getOrderedSectionKeys(pageId, builtInKeys);
    const idx = currentOrder.indexOf(key);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentOrder.length) return;
    const updated = [...currentOrder];
    const temp = updated[idx];
    updated[idx] = updated[swapIdx];
    updated[swapIdx] = temp;
    setSiteContent((prev: any) => ({
      ...prev,
      pageSectionOrders: {
        ...(prev.pageSectionOrders || {}),
        [pageId]: updated
      }
    }));
  };

  const deleteCustomBlock = (pageId: string, blockId: string) => {
    setConfirmModal({
      message: 'এই কনটেন্ট ব্লকটি ডিলিট করতে চান?',
      onConfirm: () => {
        setSiteContent((prev: any) => {
          const curBlocks: CustomBlock[] = Array.isArray(prev.customBlocks?.[pageId]) ? prev.customBlocks[pageId] : [];
          const curOrder: string[] = Array.isArray(prev.pageSectionOrders?.[pageId]) ? prev.pageSectionOrders[pageId] : [];
          const curDeleted: string[] = Array.isArray(prev.deletedSystemBlockIds) ? prev.deletedSystemBlockIds : [];
          const nextDeleted = blockId === 'cb_word_in_my_pocket_html' && !curDeleted.includes(blockId)
            ? [...curDeleted, blockId]
            : curDeleted;
          return {
            ...prev,
            deletedSystemBlockIds: nextDeleted,
            customBlocks: {
              ...(prev.customBlocks || {}),
              [pageId]: curBlocks.filter((b) => b.id !== blockId)
            },
            pageSectionOrders: {
              ...(prev.pageSectionOrders || {}),
              [pageId]: curOrder.filter((k) => k !== blockId)
            }
          };
        });
      }
    });
  };

  const updateCustomBlock = (pageId: string, blockId: string, updater: (block: CustomBlock) => CustomBlock) => {
    setSiteContent((prev: any) => {
      const pageBlocks: CustomBlock[] = Array.isArray(prev.customBlocks?.[pageId]) ? prev.customBlocks[pageId] : [];
      return {
        ...prev,
        customBlocks: {
          ...(prev.customBlocks || {}),
          [pageId]: pageBlocks.map((b) => (b.id === blockId ? updater(b) : b))
        }
      };
    });
  };

  const openEditCustomBlock = (pageId: string, block: CustomBlock) => {
    setCustomBlockModal({
      mode: 'edit',
      pageId,
      blockId: block.id,
      type: block.type,
      link: block.link || '',
      countInput: Array.isArray(block.slides) && block.slides.length > 0 ? String(block.slides.length) : '',
      slides: Array.isArray(block.slides) ? [...block.slides] : [],
      headline: block.headline || '',
      body: block.body || '',
      align: block.align || 'left',
      linkUrl: block.linkUrl || '',
      driveInput: Array.isArray(block.images) ? block.images.join('\n') : '',
      imageWidthIdx: typeof block.imageWidthIdx === 'number' ? block.imageWidthIdx : 6,
      imageHeightIdx: typeof block.imageHeightIdx === 'number' ? block.imageHeightIdx : 3,
      mergeTop: Boolean(block.mergeTop),
      mergeBottom: Boolean(block.mergeBottom),
      pdfTitle: block.pdfTitle || '',
      pdfWidthIdx: typeof block.pdfWidthIdx === 'number' ? block.pdfWidthIdx : 6,
      pdfHeightIdx: typeof block.pdfHeightIdx === 'number' ? block.pdfHeightIdx : 3,
      pdfDownloadable: Boolean(block.pdfDownloadable),
      htmlTitle: block.htmlTitle || '',
      audioTitle: block.audioTitle || '',
      posY: typeof block.posY === 'number' ? block.posY : 50,
      aspectHeight: typeof block.aspectHeight === 'number' && block.aspectHeight > 0 ? block.aspectHeight : null,
      zoom: typeof block.zoom === 'number' ? block.zoom : 100,
      sliderStyle: block.sliderStyle || 'classic'
    });
  };

  const renderCustomBlock = (pageId: string, block: CustomBlock, isMerged: boolean = false) => {
    if (block.type === 'audio') {
      return (
        <AudioPlayerSlab
          blockId={block.id}
          link={block.link || ''}
          title={block.audioTitle}
        />
      );
    }
    if (block.type === 'html-code') {
      return (
        <HtmlCodeSlab
          blockId={block.id}
          link={block.link || ''}
          title={block.htmlTitle}
        />
      );
    }
    if (block.type === 'video') {
      return (
        <div className="bg-[#13132b] border border-purple-500/30 rounded-2xl p-4 shadow-[0_0_20px_rgba(120,50,255,0.15)]">
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-purple-500/30 shadow-inner">
            <iframe
              src={getEmbedUrl(block.link || '')}
              title="Video"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      );
    }
    if (block.type === 'video-slider') {
      const validSlides = (block.slides || []).filter((s) => s && s.trim() !== '');
      return renderVideoSliderTrack(block.id, validSlides, 'ভিডিও স্লাইডার', block.sliderStyle || 'classic');
    }
    if (block.type === 'image-slider') {
      const validSlides = (block.slides || []).filter((s) => s && s.trim() !== '');
      return renderImageSliderTrack(block.id, validSlides, 'ইমেজ স্লাইডার', {
        posY: block.posY,
        aspectHeight: block.aspectHeight,
        zoom: block.zoom,
        sliderStyle: block.sliderStyle || 'classic'
      });
    }
    if (block.type === 'pdf') {
      const pwIdx = Math.min(DRIVE_IMG_WIDTHS.length - 1, Math.max(0, typeof block.pdfWidthIdx === 'number' ? block.pdfWidthIdx : 6));
      const phIdx = Math.min(PDF_VIEWER_HEIGHTS.length - 1, Math.max(0, typeof block.pdfHeightIdx === 'number' ? block.pdfHeightIdx : 3));
      const widthCls = DRIVE_IMG_WIDTHS[pwIdx].cls;
      const heightCls = PDF_VIEWER_HEIGHTS[phIdx].cls;
      const rawUrl = (block.link || '').trim();
      if (!rawUrl) return null;
      const cleanAsciiTitle = (block.pdfTitle || '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const downloadFilename = `${cleanAsciiTitle || 'Shahani_Rajib_Document'}.pdf`;

      return (
        <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-4 sm:p-5 shadow-[0_0_25px_rgba(120,50,255,0.15)] space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-amber-300 font-['Aikya','Poppins',sans-serif] flex items-center gap-2">
              <FileText size={16} className="shrink-0" />
              <span>{block.pdfTitle || 'পিডিএফ ডকুমেন্ট'}</span>
            </h3>
            <a
              href={normalizeExternalUrl(rawUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-purple-600 to-amber-500 text-black px-3 py-1 rounded-xl text-[11px] font-extrabold inline-flex items-center gap-1 hover:brightness-110"
            >
              <ExternalLink size={12} /> নতুন ট্যাবে পড়ুন
            </a>
          </div>
          <div className={`${widthCls} mx-auto ${heightCls} rounded-xl overflow-hidden border border-purple-500/40 bg-black/60 shadow-inner transition-all`}>
            <iframe
              src={normalizePdfEmbedUrl(rawUrl)}
              title={block.pdfTitle || 'PDF Preview'}
              className="w-full h-full border-0"
              allow="autoplay"
            ></iframe>
          </div>
          {block.pdfDownloadable && (
            <div className="flex justify-center pt-1">
              <a
                href={`/api/drive-download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(downloadFilename)}`}
                download={downloadFilename}
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all"
              >
                <Download size={15} /> পিডিএফ ডাউনলোড করুন
              </a>
            </div>
          )}
        </div>
      );
    }
    if (block.type === 'text-slab') {
      const alignCls =
        block.align === 'center'
          ? 'text-center'
          : block.align === 'right'
            ? 'text-right'
            : block.align === 'justify'
              ? 'text-justify'
              : 'text-left';
      const rawLink = (block.linkUrl || '').trim();
      const isInternalPageLink = rawLink.startsWith('#page:');
      const clickUrl = isInternalPageLink ? rawLink : normalizeExternalUrl(rawLink);
      const innerText = (
        <div className={`space-y-2 ${alignCls}`}>
          {block.headline && (
            <h3 className={`text-lg sm:text-xl font-extrabold text-amber-300 font-['Aikya','Poppins',sans-serif] leading-snug ${alignCls}`}>
              {block.headline}
            </h3>
          )}
          {block.body && (
            <p className={`text-xs sm:text-sm text-purple-200/85 leading-relaxed whitespace-pre-line font-['Aikya','Poppins',sans-serif] ${alignCls}`}>
              {block.body}
            </p>
          )}
        </div>
      );
      const wrappedText = clickUrl ? (
        isInternalPageLink ? (
          <button
            type="button"
            onClick={() => handlePageChange(rawLink.slice('#page:'.length))}
            className="block w-full text-left hover:opacity-90 transition-opacity cursor-pointer"
          >
            {innerText}
          </button>
        ) : (
          <a
            href={clickUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:opacity-90 transition-opacity cursor-pointer"
          >
            {innerText}
          </a>
        )
      ) : (
        innerText
      );
      if (isMerged) {
        return wrappedText;
      }
      return (
        <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_25px_rgba(120,50,255,0.15)]">
          {wrappedText}
        </div>
      );
    }
    if (block.type === 'drive-image') {
      const imgs = (block.images || []).filter((u) => u && u.trim() !== '');
      if (imgs.length === 0) return null;
      const wIdx = Math.min(DRIVE_IMG_WIDTHS.length - 1, Math.max(0, typeof block.imageWidthIdx === 'number' ? block.imageWidthIdx : 6));
      const hIdx = Math.min(DRIVE_IMG_HEIGHTS.length - 1, Math.max(0, typeof block.imageHeightIdx === 'number' ? block.imageHeightIdx : 3));
      const widthCls = DRIVE_IMG_WIDTHS[wIdx].cls;
      const heightCfg = DRIVE_IMG_HEIGHTS[hIdx];
      const rawLink = (block.linkUrl || '').trim();
      const isInternalPageLink = rawLink.startsWith('#page:');
      const clickUrl = isInternalPageLink ? rawLink : normalizeExternalUrl(rawLink);
      const posY = typeof block.posY === 'number' ? block.posY : 50;
      const aspectHeight = typeof block.aspectHeight === 'number' && block.aspectHeight > 0 ? block.aspectHeight : null;
      const zoom = typeof block.zoom === 'number' ? block.zoom : 100;
      const hasCustomFrame = Boolean(aspectHeight || posY !== 50);

      const renderStyledImg = (srcUrl: string, altTxt: string, isGridItem: boolean) => {
        if (hasCustomFrame) {
          return (
            <div
              className="w-full overflow-hidden rounded-2xl bg-[#101026]"
              style={{ aspectRatio: `1600 / ${aspectHeight || 420}` }}
            >
              <img
                src={normalizeImageUrl(srcUrl)}
                alt={altTxt}
                onClick={!clickUrl || isGridItem ? () => setLightboxImageUrl(normalizeImageUrl(srcUrl)) : undefined}
                className="w-full h-full object-cover rounded-2xl cursor-pointer block"
                style={{
                  objectPosition: `50% ${posY}%`,
                  transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                  transformOrigin: zoom < 100 ? '50% 50%' : `50% ${posY}%`
                }}
              />
            </div>
          );
        }
        return (
          <div className="overflow-hidden rounded-2xl max-w-full flex items-center justify-center">
            <img
              src={normalizeImageUrl(srcUrl)}
              alt={altTxt}
              onClick={!clickUrl || isGridItem ? () => setLightboxImageUrl(normalizeImageUrl(srcUrl)) : undefined}
              className={`w-auto max-w-full ${isGridItem ? heightCfg.gridCls : heightCfg.maxCls} object-contain rounded-2xl shadow-md cursor-pointer mx-auto block hover:scale-[1.01] transition-transform`}
              style={{
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                transformOrigin: '50% 50%'
              }}
            />
          </div>
        );
      };

      const imgContent =
        imgs.length === 1 ? (
          <div className={`${widthCls} mx-auto transition-all flex justify-center`}>
            {clickUrl ? (
              isInternalPageLink ? (
                <button
                  type="button"
                  onClick={() => handlePageChange(rawLink.slice('#page:'.length))}
                  className="inline-flex justify-center w-full max-w-full cursor-pointer"
                >
                  {renderStyledImg(imgs[0], 'Drive Image', false)}
                </button>
              ) : (
                <a
                  href={clickUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex justify-center w-full max-w-full"
                >
                  {renderStyledImg(imgs[0], 'Drive Image', false)}
                </a>
              )
            ) : (
              <div className={hasCustomFrame ? 'w-full' : 'inline-flex justify-center max-w-full'}>
                {renderStyledImg(imgs[0], 'Drive Image', false)}
              </div>
            )}
          </div>
        ) : (
          <div className={`${widthCls} mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 transition-all`}>
            {imgs.map((imgUrl, idx) => (
              <div
                key={idx}
                className={isMerged ? 'flex items-center justify-center' : 'bg-[#13132b] border border-purple-500/30 rounded-2xl p-2.5 shadow-[0_0_20px_rgba(120,50,255,0.15)] flex items-center justify-center'}
              >
                {renderStyledImg(imgUrl, `Image ${idx + 1}`, true)}
              </div>
            ))}
          </div>
        );

      if (isMerged) {
        return imgContent;
      }
      if (imgs.length === 1) {
        return (
          <div className="bg-[#13132b] border border-purple-500/30 rounded-2xl p-3 shadow-[0_0_20px_rgba(120,50,255,0.15)]">
            {imgContent}
          </div>
        );
      }
      return imgContent;
    }
    return null;
  };

  const renderBlockAdminBar = (
    pageId: string,
    builtInKeys: string[],
    sectionKey: string,
    idx: number,
    total: number,
    label: string,
    customBlock?: CustomBlock
  ) => {
    const wIdx = customBlock
      ? Math.min(DRIVE_IMG_WIDTHS.length - 1, Math.max(0, typeof customBlock.imageWidthIdx === 'number' ? customBlock.imageWidthIdx : 6))
      : 6;
    const hIdx = customBlock
      ? Math.min(DRIVE_IMG_HEIGHTS.length - 1, Math.max(0, typeof customBlock.imageHeightIdx === 'number' ? customBlock.imageHeightIdx : 3))
      : 3;
    const pwIdx = customBlock
      ? Math.min(DRIVE_IMG_WIDTHS.length - 1, Math.max(0, typeof customBlock.pdfWidthIdx === 'number' ? customBlock.pdfWidthIdx : 6))
      : 6;
    const phIdx = customBlock
      ? Math.min(PDF_VIEWER_HEIGHTS.length - 1, Math.max(0, typeof customBlock.pdfHeightIdx === 'number' ? customBlock.pdfHeightIdx : 3))
      : 3;

    return (
      <div className="space-y-1.5 bg-[#161632] border border-purple-500/30 rounded-xl px-2.5 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-purple-200 truncate max-w-[190px] sm:max-w-xs">
            {label}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {customBlock && (
              <>
                <button
                  type="button"
                  onClick={() => openEditCustomBlock(pageId, customBlock)}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5"
                >
                  <Edit2 size={10} /> এডিট
                </button>
                <button
                  type="button"
                  onClick={() => deleteCustomBlock(pageId, customBlock.id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5"
                >
                  <Trash2 size={10} /> ডিলিট
                </button>
              </>
            )}
            {!customBlock && pageId === 'about-shahani' && sectionKey === 'stats' && (
              <button
                type="button"
                onClick={() => {
                  const currentStats =
                    Array.isArray(siteContent.aboutStats) && siteContent.aboutStats.length > 0
                      ? siteContent.aboutStats
                      : DEFAULT_SITE_CONTENT.aboutStats;
                  setAboutStatsDraft(currentStats.map((s: any) => ({ ...s })));
                  setShowAboutStatsModal(true);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5"
              >
                <Edit2 size={10} /> এডিট
              </button>
            )}
            {!customBlock && pageId === 'ms-excel' && sectionKey === 'videoSlider' && (
              <button
                type="button"
                onClick={() => openSliderBuilder('video', 'ms-excel', 'এক্সেল ভিডিও স্লাইডার')}
                className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5"
              >
                <Edit2 size={10} /> এডিট
              </button>
            )}
            {!customBlock && pageId === 'ms-excel' && sectionKey === 'subpageHeader' && (
              <button
                type="button"
                onClick={() => {
                  setEditingKey('subpage_ms-excel_title');
                  setTempEditValue(activePageData?.title || '');
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5"
              >
                <Edit2 size={10} /> এডিট
              </button>
            )}
            {!customBlock && getDeletableSystemKey(pageId, sectionKey) && (
              <button
                type="button"
                onClick={() => deleteBuiltInSection(pageId, sectionKey, label)}
                className="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5"
              >
                <Trash2 size={10} /> ডিলিট
              </button>
            )}
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => movePageSection(pageId, builtInKeys, sectionKey, 'up')}
              className="bg-purple-800/70 hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5"
              title="উপরে নিন"
            >
              <ArrowUp size={11} /> উপরে
            </button>
            <button
              type="button"
              disabled={idx === total - 1}
              onClick={() => movePageSection(pageId, builtInKeys, sectionKey, 'down')}
              className="bg-purple-800/70 hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5"
              title="নিচে নিন"
            >
              <ArrowDown size={11} /> নিচে
            </button>
          </div>
        </div>

        {/* Inline Alignment controls for text-slab */}
        {customBlock?.type === 'text-slab' && (
          <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-purple-500/20 text-[10px]">
            <span className="text-purple-300/80 font-semibold mr-1">আলাইনমেন্ট:</span>
            {(
              [
                { id: 'left', label: 'বাম', Icon: AlignLeft },
                { id: 'center', label: 'মাঝে', Icon: AlignCenter },
                { id: 'right', label: 'ডান', Icon: AlignRight },
                { id: 'justify', label: 'সমান', Icon: AlignJustify }
              ] as const
            ).map(({ id, label: aLabel, Icon }) => {
              const active = (customBlock.align || 'left') === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, align: id }))}
                  className={`px-2 py-0.5 rounded-md inline-flex items-center gap-1 font-semibold transition-all ${
                    active
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/5 hover:bg-white/15 text-purple-200'
                  }`}
                >
                  <Icon size={10} /> {aLabel}
                </button>
              );
            })}
          </div>
        )}

        {/* Inline Resize controls for pdf */}
        {customBlock?.type === 'pdf' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-purple-500/20 text-[10px]">
            <div className="inline-flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-lg border border-purple-500/25">
              <span className="text-purple-300/80 font-semibold">পিডিএফ প্রস্থ:</span>
              <button
                type="button"
                disabled={pwIdx <= 0}
                onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, pdfWidthIdx: Math.max(0, pwIdx - 1) }))}
                className="px-1.5 py-0.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
              >
                −
              </button>
              <span className="text-amber-300 font-bold min-w-[30px] text-center">{DRIVE_IMG_WIDTHS[pwIdx].label}</span>
              <button
                type="button"
                disabled={pwIdx >= DRIVE_IMG_WIDTHS.length - 1}
                onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, pdfWidthIdx: Math.min(DRIVE_IMG_WIDTHS.length - 1, pwIdx + 1) }))}
                className="px-1.5 py-0.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
              >
                +
              </button>
            </div>

            <div className="inline-flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-lg border border-purple-500/25">
              <span className="text-purple-300/80 font-semibold">পিডিএফ উচ্চতা:</span>
              <button
                type="button"
                disabled={phIdx <= 0}
                onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, pdfHeightIdx: Math.max(0, phIdx - 1) }))}
                className="px-1.5 py-0.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
              >
                −
              </button>
              <span className="text-amber-300 font-bold min-w-[44px] text-center">{PDF_VIEWER_HEIGHTS[phIdx].label}</span>
              <button
                type="button"
                disabled={phIdx >= PDF_VIEWER_HEIGHTS.length - 1}
                onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, pdfHeightIdx: Math.min(PDF_VIEWER_HEIGHTS.length - 1, phIdx + 1) }))}
                className="px-1.5 py-0.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Inline Resize & Merge controls for drive-image */}
        {customBlock?.type === 'drive-image' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-purple-500/20 text-[10px]">
            <div className="inline-flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-lg border border-purple-500/25">
              <span className="text-purple-300/80 font-semibold">প্রস্থ:</span>
              <button
                type="button"
                disabled={wIdx <= 0}
                onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, imageWidthIdx: Math.max(0, wIdx - 1) }))}
                className="px-1.5 py-0.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
              >
                −
              </button>
              <span className="text-amber-300 font-bold min-w-[30px] text-center">{DRIVE_IMG_WIDTHS[wIdx].label}</span>
              <button
                type="button"
                disabled={wIdx >= DRIVE_IMG_WIDTHS.length - 1}
                onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, imageWidthIdx: Math.min(DRIVE_IMG_WIDTHS.length - 1, wIdx + 1) }))}
                className="px-1.5 py-0.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
              >
                +
              </button>
            </div>

            <div className="inline-flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-lg border border-purple-500/25">
              <span className="text-purple-300/80 font-semibold">উচ্চতা:</span>
              <button
                type="button"
                disabled={hIdx <= 0}
                onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, imageHeightIdx: Math.max(0, hIdx - 1) }))}
                className="px-1.5 py-0.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
              >
                −
              </button>
              <span className="text-amber-300 font-bold min-w-[44px] text-center">{DRIVE_IMG_HEIGHTS[hIdx].label}</span>
              <button
                type="button"
                disabled={hIdx >= DRIVE_IMG_HEIGHTS.length - 1}
                onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, imageHeightIdx: Math.min(DRIVE_IMG_HEIGHTS.length - 1, hIdx + 1) }))}
                className="px-1.5 py-0.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, mergeTop: !b.mergeTop }))}
              className={`px-2 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 border transition-all ${
                customBlock.mergeTop
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-purple-900/40 text-purple-200 border-purple-500/30 hover:bg-purple-800/60'
              }`}
              title="উপরে থাকা টেক্সট স্ল্যাবের সাথে মার্জ করুন"
            >
              <Layers size={10} /> {customBlock.mergeTop ? 'উপরের টেক্সটের সাথে মার্জড ✓' : 'উপরের টেক্সটের সাথে মার্জ'}
            </button>

            <button
              type="button"
              onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, mergeBottom: !b.mergeBottom }))}
              className={`px-2 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 border transition-all ${
                customBlock.mergeBottom
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-purple-900/40 text-purple-200 border-purple-500/30 hover:bg-purple-800/60'
              }`}
              title="নিচে থাকা টেক্সট স্ল্যাবের সাথে মার্জ করুন"
            >
              <Layers size={10} /> {customBlock.mergeBottom ? 'নিচের টেক্সটের সাথে মার্জড ✓' : 'নিচের টেক্সটের সাথে মার্জ'}
            </button>
          </div>
        )}

        {/* Inline Banner-Style Position / Height / Zoom In & Zoom Out controls for image-slider & drive-image */}
        {(customBlock?.type === 'image-slider' || customBlock?.type === 'drive-image') && (() => {
          const bPosY = typeof customBlock.posY === 'number' ? customBlock.posY : 50;
          const bAspect = typeof customBlock.aspectHeight === 'number' && customBlock.aspectHeight > 0 ? customBlock.aspectHeight : null;
          const bZoom = typeof customBlock.zoom === 'number' ? customBlock.zoom : 100;
          const isOpen = bannerAdjustKey === customBlock.id;
          return (
            <div className="pt-1 border-t border-purple-500/20 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => setBannerAdjustKey((prev) => (prev === customBlock.id ? null : customBlock.id))}
                  className={`px-2.5 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 transition-all ${
                    isOpen ? 'bg-emerald-500 text-black' : 'bg-cyan-500 text-black hover:bg-cyan-400'
                  }`}
                >
                  <MoveVertical size={11} />
                  {isOpen ? 'ফিট সেভ করুন' : 'উপর-নিচ, উচ্চতা ও জুম সেট করুন'}
                </button>
                {(bAspect || bPosY !== 50 || bZoom !== 100) && (
                  <span className="text-[10px] text-amber-300/80">
                    পজিশন {bPosY}% • উচ্চতা {bAspect ? `1600×${bAspect}` : 'অটো'} • জুম {bZoom}%
                  </span>
                )}
              </div>

              {isOpen && (
                <div className="bg-[#13132b] border border-amber-400/40 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                  <div>
                    <div className="flex justify-between text-[11px] text-amber-300 font-bold mb-1">
                      <span>উপর-নিচ পজিশন</span>
                      <span>{bPosY}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={bPosY}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateCustomBlock(pageId, customBlock.id, (b) => ({
                          ...b,
                          posY: val,
                          aspectHeight: b.aspectHeight || 420
                        }));
                      }}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-amber-300 font-bold mb-1">
                      <span>ইমেজ উচ্চতা (বড়/ছোট)</span>
                      <span>{bAspect ? `1600×${bAspect}` : 'অটো'}</span>
                    </div>
                    <input
                      type="range"
                      min={160}
                      max={900}
                      step={10}
                      value={bAspect || 420}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, aspectHeight: val }));
                      }}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-[11px] text-amber-300 font-bold mb-1 gap-1">
                      <span>জুম ({bZoom}%)</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, zoom: Math.max(50, (typeof b.zoom === 'number' ? b.zoom : 100) - 10) }))}
                          className="bg-purple-800/70 hover:bg-purple-700 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 text-[10px]"
                        >
                          <ZoomOut size={10} /> আউট
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, zoom: Math.min(250, (typeof b.zoom === 'number' ? b.zoom : 100) + 10) }))}
                          className="bg-purple-800/70 hover:bg-purple-700 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 text-[10px]"
                        >
                          <ZoomIn size={10} /> ইন
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, posY: 50, aspectHeight: null, zoom: 100 }))}
                          className="text-[10px] text-cyan-300 hover:underline inline-flex items-center gap-0.5 ml-0.5"
                        >
                          <RotateCcw size={10} /> রিসেট
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={250}
                      value={bZoom}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateCustomBlock(pageId, customBlock.id, (b) => ({ ...b, zoom: val }));
                      }}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderReorderableSection = (
    pageId: string,
    builtInKeys: string[],
    sectionKey: string,
    idx: number,
    total: number,
    label: string,
    content: React.ReactNode,
    customBlock?: CustomBlock
  ) => {
    if (!content && !isAdmin) return null;
    if (!content && isAdmin && !customBlock) return null;
    if (!isAdmin) {
      return <React.Fragment key={sectionKey}>{content}</React.Fragment>;
    }
    return (
      <div
        key={sectionKey}
        className="relative rounded-2xl border border-purple-500/25 bg-[#0b0b1a]/40 p-2 sm:p-2.5 space-y-2"
      >
        {renderBlockAdminBar(pageId, builtInKeys, sectionKey, idx, total, label, customBlock)}
        {content}
      </div>
    );
  };

  const renderPageSectionsList = (
    pageId: string,
    builtInKeys: string[],
    order: string[],
    customBlocks: CustomBlock[],
    labelsMap: Record<string, string>,
    renderBuiltIn: (key: string) => React.ReactNode
  ) => {
    const getLabel = (secKey: string, blk?: CustomBlock) =>
      blk
        ? (
            blk.type === 'video'
              ? 'ভিডিও ব্লক'
              : blk.type === 'video-slider'
                ? 'ভিডিও স্লাইডার'
                : blk.type === 'image-slider'
                  ? 'ইমেজ স্লাইডার'
                  : blk.type === 'pdf'
                    ? (blk.pdfTitle || 'পিডিএফ ডকুমেন্ট')
                    : blk.type === 'html-code'
                      ? (blk.htmlTitle || 'html কোড')
                      : blk.type === 'audio'
                        ? (blk.audioTitle || 'অডিও প্লেয়ার')
                        : blk.type === 'text-slab'
                          ? (blk.headline || 'টেক্সট স্ল্যাব')
                          : 'ড্রাইভ ইমেজ'
          )
        : (labelsMap[secKey] || secKey);

    const canMergePair = (keyA: string, keyB: string): boolean => {
      const blkA = customBlocks.find((b) => b.id === keyA);
      const blkB = customBlocks.find((b) => b.id === keyB);
      if (!blkA || !blkB) return false;
      if (blkA.type === 'text-slab' && blkB.type === 'drive-image' && blkB.mergeTop) return true;
      if (blkA.type === 'drive-image' && blkA.mergeBottom && blkB.type === 'text-slab') return true;
      return false;
    };

    const groups: { key: string; idx: number; blk?: CustomBlock }[][] = [];
    for (let i = 0; i < order.length; i++) {
      const secKey = order[i];
      const blk = customBlocks.find((b) => b.id === secKey);
      if (groups.length > 0) {
        const prevGroup = groups[groups.length - 1];
        const prevItem = prevGroup[prevGroup.length - 1];
        if (canMergePair(prevItem.key, secKey)) {
          prevGroup.push({ key: secKey, idx: i, blk });
          continue;
        }
      }
      groups.push([{ key: secKey, idx: i, blk }]);
    }

    return groups.map((group) => {
      if (group.length === 1) {
        const item = group[0];
        const lbl = getLabel(item.key, item.blk);
        const content = item.blk ? renderCustomBlock(pageId, item.blk) : renderBuiltIn(item.key);
        return renderReorderableSection(pageId, builtInKeys, item.key, item.idx, order.length, lbl, content, item.blk);
      }

      const groupKey = `merged_${group.map((g) => g.key).join('_')}`;
      const mergedCard = (
        <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_25px_rgba(120,50,255,0.15)] space-y-4">
          {group.map((item) => (
            <React.Fragment key={item.key}>
              {item.blk ? renderCustomBlock(pageId, item.blk, true) : renderBuiltIn(item.key)}
            </React.Fragment>
          ))}
        </div>
      );

      if (!isAdmin) {
        return <React.Fragment key={groupKey}>{mergedCard}</React.Fragment>;
      }

      return (
        <div key={groupKey} className="relative rounded-2xl border border-amber-500/45 bg-[#0b0b1a]/60 p-2 sm:p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 px-1">
            <Layers size={12} /> মার্জ করা স্ল্যাব ({group.length}টি অংশ একসাথে)
          </div>
          <div className="space-y-1.5">
            {group.map((item) => (
              <React.Fragment key={item.key}>
                {renderBlockAdminBar(pageId, builtInKeys, item.key, item.idx, order.length, getLabel(item.key, item.blk), item.blk)}
              </React.Fragment>
            ))}
          </div>
          {mergedCard}
        </div>
      );
    });
  };

  return (
    <div className="app-root-shell min-h-screen bg-[#070711] text-[#f0f0f5] flex flex-col selection:bg-purple-600 selection:text-white relative overflow-x-hidden">
      {/* MAGICAL AMBIENT GLOW EFFECTS */}
      <div className="theme-glow-1 absolute top-0 left-1/4 w-96 h-96 bg-purple-900/15 rounded-full blur-3xl pointer-events-none" />
      <div className="theme-glow-2 absolute top-1/3 right-10 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="theme-glow-3 absolute bottom-1/4 left-10 w-96 h-96 bg-indigo-900/15 rounded-full blur-3xl pointer-events-none" />

      {/* SHARE TOAST NOTIFICATION */}
      {shareToast && (
        <div className="fixed top-20 right-4 z-50 bg-amber-500 text-black px-4 py-2 rounded-xl text-xs font-bold shadow-2xl animate-bounce">
          লিংক কপি করা হয়েছে! 📋
        </div>
      )}

      {/* HEADER */}
      {currentPage !== 'pin-card' && (
      <header className="theme-header sticky top-0 z-50 bg-[#0d0d1f]/95 backdrop-blur-md border-b border-purple-500/30 px-2 sm:px-4 py-2.5 shadow-[0_4px_30px_rgba(120,50,255,0.15)]">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => handlePageChange('home')}
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-purple-600/30 to-amber-500/20 border border-purple-400/40 flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                <img
                  src={normalizeImageUrl(siteContent.headerBrandLogo || "https://lh3.googleusercontent.com/d/1jqU1ivOslQkqB2YZDhuxRkW8kQOyWPd5")}
                  alt={siteContent.headerBrandName || "Shahani Rajib"}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-white font-['Aikya','Poppins',sans-serif] tracking-wide">
                  {siteContent.headerBrandName || "Shahani Rajib"}
                </h1>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    openImageEditorModal(
                      'headerBrandLogo',
                      siteContent.headerBrandLogo || "https://lh3.googleusercontent.com/d/1jqU1ivOslQkqB2YZDhuxRkW8kQOyWPd5",
                      'লোগো ইমেজ পরিবর্তন করুন (ড্রাইভ লিংক)',
                      false
                    )
                  }
                  className="bg-amber-500 hover:bg-amber-400 text-black p-1 rounded-lg text-[10px] font-bold shadow"
                  title="উপরের লোগো ছবি পরিবর্তন (ড্রাইভ লিংক)"
                >
                  <ImageIcon size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey('headerBrandName');
                    setTempEditValue(siteContent.headerBrandName || 'Shahani Rajib');
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white p-1 rounded-lg text-[10px] font-bold shadow"
                  title="উপরের শিরোনাম এডিট করুন"
                >
                  <Edit2 size={11} />
                </button>
              </div>
            )}
          </div>

          {/* TOP RIGHT PHONE CALL, HIRE ME & 3-BAR MENU BAR */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <a
              href="tel:+8801923866283"
              title="কল করুন (+8801923866283)"
              aria-label="কল করুন"
              className="h-9 w-9 bg-emerald-900/45 hover:bg-emerald-800/65 border border-emerald-400/50 text-emerald-300 rounded-xl flex items-center justify-center transition-all shadow-[0_0_12px_rgba(16,185,129,0.22)] shrink-0"
            >
              <Phone size={15} />
            </a>
            <button
              type="button"
              onClick={() => handlePageChange('career-tab')}
              title="Hire Me – ক্যারিয়ার ও যোগাযোগ"
              aria-label="Hire Me"
              className="h-9 flex items-center justify-center shrink-0 rounded-full hover:scale-105 active:scale-95 transition-transform cursor-pointer drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)]"
            >
              <img
                src="/assets/aistudio/Hire_Me_Logo_6a4dd96d.png"
                alt="Hire Me"
                className="h-9 w-auto object-contain"
              />
            </button>

            <div className="relative" ref={menuContainerRef}>
              <button 
                onClick={() => { setMenuOpen((prev) => !prev); setActiveMenuFlyout(null); }}
                className="h-9 w-9 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 text-amber-300 rounded-xl flex items-center justify-center transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                aria-label="Menu"
              >
                <Menu size={18} />
              </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 sm:w-60 bg-[#121225] border border-purple-500/50 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.85)] py-2 z-50 space-y-1">
                {/* 1. Login & Cloud Sync Options */}
                {isAdmin ? (
                  <>
                    {!activeCloudUser ? (
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); setActiveMenuFlyout(null); handleGoogleAdminLogin(); }}
                        disabled={googleLoginLoading}
                        className="w-full text-left px-3.5 sm:px-4 py-2 text-xs text-emerald-300 hover:bg-emerald-950/40 flex items-center gap-2 font-bold"
                      >
                        <RefreshCw size={14} className={googleLoginLoading ? 'animate-spin shrink-0' : 'shrink-0'} />
                        <span>
                          {isCloneMode
                            ? 'Google দিয়ে ক্লাউড সিঙ্ক চালু'
                            : 'সিঙ্ক (rajibshahani9@gmail.com)'}
                        </span>
                      </button>
                    ) : (
                      <div className="px-3.5 sm:px-4 py-1.5 text-[10.5px] text-emerald-300 flex items-center gap-1.5 font-bold">
                        <ShieldCheck size={13} className="shrink-0" />
                        <span className="truncate">
                          অটো সিঙ্ক চালু ({activeCloudUser.email})
                        </span>
                      </div>
                    )}
                    <button 
                      onClick={() => { handleAdminLogout(); setMenuOpen(false); setActiveMenuFlyout(null); }}
                      className="w-full text-left px-3.5 sm:px-4 py-2 text-xs text-red-300 hover:bg-red-950/40 flex items-center gap-2"
                    >
                      <LogOut size={14} className="shrink-0" /> <span>{isCoAdmin && !isPrimaryAdmin ? 'কো-অ্যাডমিন লগআউট' : 'অ্যাডমিন লগআউট'}</span>
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => { setPendingMenuAction(null); setShowAdminLoginModal(true); setMenuOpen(false); setActiveMenuFlyout(null); }}
                    className="w-full text-left px-3.5 sm:px-4 py-2 text-xs text-amber-300 hover:bg-purple-900/40 flex items-center gap-2 font-bold"
                  >
                    <Lock size={14} className="shrink-0" /> <span>{isCloneMode ? 'কো-অ্যাডমিন / অ্যাডমিন লগইন' : 'অ্যাডমিন লগইন'}</span>
                  </button>
                )}

                {/* Repeatable Page Content Builders & Tab/Social Editors (Left Flyout on Hover or Click) */}
                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-purple-500/25" />

                    {/* Flyout 1: এই পেজে + */}
                    <div
                      className="relative"
                      onMouseEnter={() => setActiveMenuFlyout('add')}
                      onMouseLeave={() => setActiveMenuFlyout((prev) => (prev === 'add' ? null : prev))}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveMenuFlyout((prev) => (prev === 'add' ? null : 'add'))}
                        className={`w-full text-left px-3 sm:px-4 py-2 text-xs font-bold flex items-center justify-between gap-1.5 transition-colors ${
                          activeMenuFlyout === 'add'
                            ? 'bg-purple-900/60 text-amber-300'
                            : 'text-amber-300 hover:bg-purple-900/40'
                        }`}
                      >
                        <ChevronLeft size={14} className="shrink-0 text-amber-400" />
                        <span className="flex-1 truncate">এই পেজে</span>
                        <span className="w-4 h-4 rounded-full bg-purple-800/80 border border-amber-400/55 text-amber-300 inline-flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={2.75} />
                        </span>
                      </button>

                      {activeMenuFlyout === 'add' && (
                        <div className="absolute right-full top-0 pr-1.5 z-50">
                          <div className="w-44 sm:w-56 max-h-[75vh] overflow-y-auto bg-[#121225] border border-purple-500/50 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.9)] py-2 space-y-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                openCustomBlockBuilder('video');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                            >
                              <Youtube size={14} className="text-red-400 shrink-0" />
                              <span className="flex-1 truncate">YouTube / Facebook ভিডিও</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-amber-400/50 text-amber-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                openCustomBlockBuilder('video-slider');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                            >
                              <Video size={14} className="text-cyan-400 shrink-0" />
                              <span className="flex-1 truncate">ভিডিও স্লাইড</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-amber-400/50 text-amber-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                openCustomBlockBuilder('image-slider');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                            >
                              <ImageIcon size={14} className="text-pink-400 shrink-0" />
                              <span className="flex-1 truncate">ইমেজ স্লাইডার</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-amber-400/50 text-amber-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                openCustomBlockBuilder('drive-image');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                            >
                              <ImageIcon size={14} className="text-emerald-400 shrink-0" />
                              <span className="flex-1 truncate">গুগল ড্রাইভ ইমেজ লিংক</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-amber-400/50 text-amber-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                openCustomBlockBuilder('text-slab');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                            >
                              <Type size={14} className="text-amber-400 shrink-0" />
                              <span className="flex-1 truncate">টেক্সট স্ল্যাব</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-amber-400/50 text-amber-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                openCustomBlockBuilder('pdf');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                            >
                              <FileText size={14} className="text-orange-400 shrink-0" />
                              <span className="flex-1 truncate">পিডিএফ</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-amber-400/50 text-amber-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                openCustomBlockBuilder('html-code');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                            >
                              <Code size={14} className="text-sky-400 shrink-0" />
                              <span className="flex-1 truncate">html কোড</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-amber-400/50 text-amber-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                openCustomBlockBuilder('audio');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                            >
                              <Music size={14} className="text-violet-400 shrink-0" />
                              <span className="flex-1 truncate">অডিও</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-amber-400/50 text-amber-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Flyout 2: সেটিংস ও এডিট */}
                    <div
                      className="relative"
                      onMouseEnter={() => setActiveMenuFlyout('settings')}
                      onMouseLeave={() => setActiveMenuFlyout((prev) => (prev === 'settings' ? null : prev))}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveMenuFlyout((prev) => (prev === 'settings' ? null : 'settings'))}
                        className={`w-full text-left px-3 sm:px-4 py-2 text-xs font-bold flex items-center justify-between gap-1.5 transition-colors ${
                          activeMenuFlyout === 'settings'
                            ? 'bg-purple-900/60 text-cyan-300'
                            : 'text-purple-200 hover:bg-purple-900/40'
                        }`}
                      >
                        <ChevronLeft size={14} className="shrink-0 text-cyan-400" />
                        <span className="flex-1 truncate">সেটিংস ও এডিট</span>
                      </button>

                      {activeMenuFlyout === 'settings' && (
                        <div className="absolute right-full top-0 pr-1.5 z-50">
                          <div className="w-44 sm:w-56 max-h-[75vh] overflow-y-auto bg-[#121225] border border-purple-500/50 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.9)] py-2 space-y-0.5">
                            {(!isSubCloneMode || isPrimaryAdmin) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpen(false);
                                  setActiveMenuFlyout(null);
                                  const activeParent = innerTabParentLookup[currentPage];
                                  if (activeParent) setInnerTabTargetPage(activeParent);
                                  else if (currentPage && currentPage !== 'home') setInnerTabTargetPage(currentPage);
                                  setShowTabManagerModal(true);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs text-amber-300 hover:bg-purple-900/40 flex items-center gap-2 font-bold"
                              >
                                <Edit2 size={14} className="text-amber-400 shrink-0" /> <span>ট্যাব এডিট</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                if (isSubCloneMode && activeSubClone) {
                                  setInnerTabTargetPage(activeSubClone.targetTabId);
                                } else {
                                  const activeParent = innerTabParentLookup[currentPage];
                                  const defaultTarget = activeParent
                                    ? activeParent
                                    : currentPage !== 'home'
                                      ? currentPage
                                      : 'rubiks-cube';
                                  setInnerTabTargetPage(defaultTarget);
                                }
                                setInnerTabLabelInput('');
                                setInnerTabIconInput('');
                                setShowInnerTabModal(true);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-cyan-300 hover:bg-purple-900/40 flex items-center gap-2 font-bold"
                            >
                              <Layers size={14} className="text-cyan-400 shrink-0" />
                              <span className="flex-1 truncate">পেজের ভিতরে ট্যাব</span>
                              <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-cyan-400/50 text-cyan-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                            </button>

                            {(!isSubCloneMode || isPrimaryAdmin) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpen(false);
                                    setActiveMenuFlyout(null);
                                    setEditingSubPageId(null);
                                    setShowSubPageManagerModal(true);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2 font-bold"
                                >
                                  <LayoutGrid size={14} className="text-emerald-400 shrink-0" />
                                  <span className="flex-1 truncate">সাব-পেজ এডিট</span>
                                  <span className="w-4 h-4 rounded-full bg-purple-800/70 border border-emerald-400/50 text-emerald-300 inline-flex items-center justify-center shrink-0"><Plus size={10} strokeWidth={2.75} /></span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpen(false);
                                    setActiveMenuFlyout(null);
                                    setThemeDraft(siteContent.appTheme ? { ...DEFAULT_APP_THEME, ...siteContent.appTheme } : { ...DEFAULT_APP_THEME });
                                    setShowThemeModal(true);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2 font-bold"
                                >
                                  <Palette size={14} className="text-pink-400 shrink-0" /> <span>থিম চেঞ্জ</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpen(false);
                                    setActiveMenuFlyout(null);
                                    setSocialLinksDraft((siteContent.socialLinks || []).map((s: any) => ({ id: s.id, name: s.name, url: s.url })));
                                    setShowSocialLinksModal(true);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                                >
                                  <ExternalLink size={14} className="text-sky-400 shrink-0" /> <span>সোশ্যাল লিংক এডিট</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpen(false);
                                    setActiveMenuFlyout(null);
                                    setFooterDraft({
                                      line1: siteContent.footerLine1 ?? "© শাহানী রাজীব (Shahani Rajib) • সর্বস্বত্ব সংরক্ষিত",
                                      siteLabel: siteContent.footerSiteLabel ?? "আসল গুগল সাইট:",
                                      linkText: siteContent.footerSiteLinkText ?? "sites.google.com/view/shahani9",
                                      linkUrl: siteContent.footerSiteUrl ?? "https://sites.google.com/view/shahani9/home"
                                    });
                                    setShowFooterEditModal(true);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-amber-200 hover:bg-purple-900/40 flex items-center gap-2"
                                >
                                  <Edit2 size={14} className="text-orange-400 shrink-0" /> <span>ফুটার এডিট</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {(siteContent.customSubPages || []).some((sp: any) => sp.showInMenu && isPageAllowedInSubClone(sp.id)) && (
                  <>
                    <div className="my-1 border-t border-purple-500/25 pt-1.5 px-3.5 sm:px-4 pb-0.5">
                      <span className="text-[10px] font-bold text-purple-300/80 uppercase tracking-wide">
                        অতিরিক্ত সাব-পেজ
                      </span>
                    </div>
                    {(siteContent.customSubPages || [])
                      .filter((sp: any) => sp.showInMenu && isPageAllowedInSubClone(sp.id))
                      .map((sp: any) => (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => handlePageChange(sp.id)}
                          className={`w-full text-left px-3.5 sm:px-4 py-2 text-xs hover:bg-purple-900/40 flex items-center gap-2 ${
                            currentPage === sp.id ? 'text-amber-300 font-bold' : 'text-purple-200'
                          }`}
                        >
                          <LayoutGrid size={13} className="shrink-0 text-amber-400" />
                          <span className="truncate">{subpageInfoMap[sp.id]?.title || sp.title}</span>
                        </button>
                      ))}
                  </>
                )}

                {isPrimaryAdmin && (
                  <>
                    <div className="my-1 border-t border-purple-500/25 pt-1.5 px-3.5 sm:px-4 pb-0.5">
                      <span className="text-[10px] font-bold text-purple-300/80 uppercase tracking-wide">
                        ব্যবস্থাপনা
                      </span>
                    </div>

                    {/* Flyout 3: কো-অ্যাডমিন ও ক্লোন */}
                    <div
                      className="relative"
                      onMouseEnter={() => setActiveMenuFlyout('adminClone')}
                      onMouseLeave={() => setActiveMenuFlyout((prev) => (prev === 'adminClone' ? null : prev))}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveMenuFlyout((prev) => (prev === 'adminClone' ? null : 'adminClone'))}
                        className={`w-full text-left px-3 sm:px-4 py-2 text-xs font-bold flex items-center justify-between gap-1.5 transition-colors ${
                          activeMenuFlyout === 'adminClone'
                            ? 'bg-purple-900/60 text-cyan-300'
                            : 'text-cyan-300 hover:bg-purple-900/40'
                        }`}
                      >
                        <ChevronLeft size={14} className="shrink-0 text-cyan-400" />
                        <span className="flex-1 truncate">কো-অ্যাডমিন ও ক্লোন</span>
                      </button>

                      {activeMenuFlyout === 'adminClone' && (
                        <div className="absolute right-full top-0 pr-1.5 z-50">
                          <div className="w-44 sm:w-56 bg-[#121225] border border-purple-500/50 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.9)] py-2 space-y-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                setCoAdminStatusMsg('');
                                setShowCoAdminModal(true);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-amber-300 hover:bg-purple-900/40 flex items-center gap-2 font-bold"
                            >
                              <UserPlus size={14} className="text-amber-400 shrink-0" /> <span>কো-অ্যাডমিন অ্যাড</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                setLatestCloneUrl('');
                                setShowCloneModal(true);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-cyan-300 hover:bg-purple-900/40 flex items-center gap-2 font-bold"
                            >
                              <CopyPlus size={14} className="text-cyan-400 shrink-0" /> <span>ওয়েবসাইট ক্লোন</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setActiveMenuFlyout(null);
                                setSubCloneStatusMsg('');
                                setLatestSubCloneUrl('');
                                setShowSubCloneModal(true);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-emerald-300 hover:bg-purple-900/40 flex items-center gap-2 font-bold"
                            >
                              <Layers size={14} className="text-emerald-400 shrink-0" /> <span>সাব ক্লোনিং</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}



                {/* 4. Context-Aware Share Page Option */}
                <button 
                  type="button"
                  onClick={() => { handleShareCurrentPage(); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-purple-200 hover:bg-purple-900/40 flex items-center gap-2"
                >
                  <Share2 size={14} className="shrink-0" />
                  <span className="truncate">
                    শেয়ার করুন ({currentPage === 'home'
                      ? 'হোম'
                      : currentPage === 'tas-vanish'
                        ? 'তাস ভ্যানিস'
                        : currentPage === 'tas-prediction'
                          ? 'তাস প্রেডিকশন'
                          : currentPage === 'pin-card'
                            ? 'পিন কার্ড'
                            : currentPage === 'taser-ghori'
                              ? 'তাসের ঘড়ি'
                              : currentPage === 'iskaponer-tekka'
                                ? 'ইস্কাপনের টেক্কা'
                                  : currentPage === 'blog'
                                    ? 'ব্লগ'
                                    : currentPage.startsWith('book_')
                            ? ((Array.isArray(siteContent.booksCovers) ? siteContent.booksCovers : []).find((b: any) => b.id === currentPage.slice(5))?.title || 'বই')
                            : (activePageData?.title || subpageInfoMap[currentPage]?.title || 'এই পেজ')})
                  </span>
                </button>

                {/* 5. Install Website / App Option (Available to All Visitors) */}
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (isPwaInstalled) return;
                    if (isPwaInstallable) {
                      const ok = await installPwa();
                      if (!ok) setShowInstallModal(true);
                    } else {
                      setShowInstallModal(true);
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-emerald-300 hover:bg-emerald-950/40 flex items-center gap-2 font-bold"
                >
                  <Smartphone size={14} className="shrink-0" />
                  <span>{isPwaInstalled ? 'অ্যাপ ইনস্টল করা আছে ✓' : 'অ্যাপ ইনস্টল করুন'}</span>
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* TOP NAVIGATION STYLED LIKE FOOTER ICONS */}
        {isSubCloneMode && activeSubClone ? (
          (() => {
            const subTabMeta = getTabMetaForPage(activeSubClone.targetTabId);
            const isTabActive = currentPage === activeSubClone.targetTabId;
            return (
              <div className="max-w-4xl mx-auto mt-2.5 pt-2.5 border-t border-purple-500/20 w-full flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePageChange(activeSubClone.targetTabId)}
                  className={`animate-tab-fade flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
                    isTabActive
                      ? 'text-amber-300 font-bold bg-gradient-to-b from-purple-900/40 to-amber-950/30 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                      : 'text-purple-200 hover:text-amber-300 hover:bg-white/5 border border-purple-500/25'
                  }`}
                >
                  {subTabMeta.iconUrl ? (
                    <img
                      src={normalizeImageUrl(subTabMeta.iconUrl)}
                      alt={subTabMeta.label || activeSubClone.targetTabLabel}
                      className="w-9 h-9 sm:w-12 sm:h-12 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                    />
                  ) : (
                    <Layers size={24} className="text-amber-300" />
                  )}
                  <span className="text-[10.5px] sm:text-xs font-['Aikya','Poppins',sans-serif] leading-tight whitespace-nowrap">
                    {subTabMeta.label || activeSubClone.targetTabLabel}
                  </span>
                </button>
              </div>
            );
          })()
        ) : (
          <div className="max-w-4xl mx-auto mt-2.5 pt-2.5 border-t border-purple-500/20 w-full grid grid-flow-col auto-cols-fr items-center gap-0 sm:gap-1">
            {(siteContent.topNavTabs || []).map((item: any) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handlePageChange(item.id)}
                  className={`animate-tab-fade min-w-0 flex flex-col items-center justify-center gap-0.5 px-0 sm:px-1 py-1 rounded-xl transition-all ${
                    isActive 
                      ? 'text-amber-300 font-bold scale-[1.03] bg-gradient-to-b from-purple-900/40 to-amber-950/30 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]' 
                      : 'text-gray-400 hover:text-purple-300 hover:bg-white/5'
                  }`}
                >
                  <img
                    src={normalizeImageUrl(item.iconUrl)}
                    alt={item.label}
                    className="w-8 h-8 min-[360px]:w-9 min-[360px]:h-9 min-[410px]:w-11 min-[410px]:h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                  />
                  <span className="text-[8.5px] min-[370px]:text-[9.5px] min-[410px]:text-[10.5px] sm:text-xs font-['Aikya','Poppins',sans-serif] leading-tight whitespace-nowrap truncate max-w-full px-0.5">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* SEARCH & MARQUEE (Hidden only on Career page) */}
        {currentPage !== 'career-tab' && (
        <div className="max-w-4xl mx-auto mt-2.5 relative bg-[#13132b] border border-purple-500/30 rounded-xl overflow-hidden px-3.5 py-2 flex items-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]">
          <Search size={14} className="text-amber-400 absolute left-3 z-10" />
          <input 
            type="text"
            placeholder="অনুসন্ধান করুন যেকোনো কনটেন্ট বা বিষয়..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent pl-7 pr-3 text-xs text-white placeholder-purple-300/50 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white text-xs px-1">
              <X size={14} />
            </button>
          )}
        </div>
        )}
      </header>
      )}

      {/* ADMIN LOGIN MODAL */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Lock size={16} /> {isCloneMode ? 'কো-অ্যাডমিন / অ্যাডমিন লগইন' : 'অ্যাডমিন লগইন প্যানেল'}
              </h3>
              <button onClick={() => setShowAdminLoginModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            {loginError && (
              <div className="bg-red-950/60 border border-red-500/50 text-red-300 text-xs p-2.5 rounded-xl">
                {loginError}
              </div>
            )}
            <button
              type="button"
              onClick={handleGoogleAdminLogin}
              disabled={googleLoginLoading}
              className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow"
            >
              <RefreshCw size={14} className={googleLoginLoading ? 'animate-spin text-purple-600' : 'text-purple-600'} />
              <span>
                {googleLoginLoading
                  ? 'Google লগইন হচ্ছে...'
                  : isCloneMode
                    ? 'Google দিয়ে ক্লাউড সিঙ্ক চালু (ক্লোন ডাটা)'
                    : 'Google দিয়ে লগইন করুন (ক্লাউড সিঙ্ক)'}
              </span>
            </button>
            <p className="text-[10px] text-purple-300/75 text-center leading-relaxed">
              {isCloneMode
                ? 'প্রথমে অ্যাডমিনের দেওয়া ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন, তারপর আপনার পরিবর্তনগুলো সংরক্ষণ করতে Google দিয়ে ক্লাউড সিঙ্ক চালু করুন।'
                : 'শেয়ার লিংক ও মোবাইলে সব আপডেট (বই ও কনটেন্ট) দেখাতে Google দিয়ে লগইন করুন।'}
            </p>
            <div className="border-t border-purple-500/25 pt-3">
              <form onSubmit={handleAdminLogin} className="space-y-3">
                <div>
                  <label className="text-[11px] text-purple-300 block mb-1">ইমেইল</label>
                  <input 
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder={isCloneMode ? 'কো-অ্যাডমিন ইমেইল লিখুন' : 'rajibshahani9@gmail.com'}
                    className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-purple-300 block mb-1">পাসওয়ার্ড</label>
                  <input 
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loginSubmitting}
                  className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-black font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-60"
                >
                  {loginSubmitting ? 'যাচাই হচ্ছে...' : 'প্রবেশ করুন'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CO-ADMIN MANAGER MODAL (Primary Admin Only) */}
      {isPrimaryAdmin && showCoAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Users size={16} /> কো-অ্যাডমিন অ্যাড ও তালিকা
              </h3>
              <button type="button" onClick={() => setShowCoAdminModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-[11px] text-purple-200/80 leading-relaxed">
              একাধিক কো-অ্যাডমিন যোগ করতে পারবেন। এই ইমেইল ও পাসওয়ার্ড দিয়ে কেউ শুধুমাত্র আপনার শেয়ার করা ক্লোন লিংকে এডিট, অ্যাড ও ডিলিট করতে পারবে। মূল সাইটে কোনো পরিবর্তন হবে না।
            </p>
            {coAdminStatusMsg && (
              <div className="bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs p-2.5 rounded-xl">
                {coAdminStatusMsg}
              </div>
            )}
            <form onSubmit={handleAddCoAdminSubmit} className="bg-[#181833] border border-purple-500/35 rounded-xl p-4 space-y-3">
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">কো-অ্যাডমিন ই-মেইল *</label>
                <input
                  type="email"
                  value={coAdminEmailInput}
                  onChange={(e) => setCoAdminEmailInput(e.target.value)}
                  placeholder="coadmin@gmail.com"
                  className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">কো-অ্যাডমিন পাসওয়ার্ড *</label>
                <input
                  type="text"
                  value={coAdminPasswordInput}
                  onChange={(e) => setCoAdminPasswordInput(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখুন..."
                  className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">নাম / নোট (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={coAdminNoteInput}
                  onChange={(e) => setCoAdminNoteInput(e.target.value)}
                  placeholder="যেমন: সহকর্মী / এডিটর"
                  className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                type="submit"
                disabled={coAdminSaving}
                className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:brightness-110 text-black font-extrabold text-xs py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <PlusCircle size={14} /> {coAdminSaving ? 'যোগ হচ্ছে...' : 'অ্যাড করুন'}
              </button>
            </form>

            {coAdminsList.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-purple-200 border-b border-purple-500/25 pb-1">
                  অনুমোদিত কো-অ্যাডমিন তালিকা ({coAdminsList.length})
                </h4>
                <div className="space-y-2">
                  {coAdminsList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-amber-200 truncate">{item.email}</div>
                        <div className="text-[10px] text-purple-300/70 truncate">
                          {item.note ? `${item.note} • ` : ''}{item.createdAtLabel}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoAdmin(item)}
                        className="bg-red-500/85 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shrink-0"
                      >
                        <Trash2 size={11} /> ডিলিট
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLONE APP / WEBSITE MODAL (Primary Admin Only) */}
      {isPrimaryAdmin && showCloneModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <CopyPlus size={16} /> ওয়েবসাইট ক্লোন করুন
              </h3>
              <button type="button" onClick={() => setShowCloneModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-[11px] text-purple-200/80 leading-relaxed">
              এখান থেকে আপনার পুরো ওয়েবসাইট/অ্যাপের একটি আলাদা ক্লোন লিংক তৈরি করে শেয়ার করতে পারবেন। কো-অ্যাডমিন শুধুমাত্র এই ক্লোন লিংকে আপনার দেওয়া ইমেইল-পাসওয়ার্ড ও নিজের Google ক্লাউড সিঙ্ক ব্যবহার করে এডিট করতে পারবে—মূল সাইটে কোনো পরিবর্তন হবে না।
            </p>
            <div className="bg-[#181833] border border-purple-500/35 rounded-xl p-4 space-y-3">
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">ক্লোনের নাম (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={cloneLabelInput}
                  onChange={(e) => setCloneLabelInput(e.target.value)}
                  placeholder="যেমন: কো-অ্যাডমিন কপি ১"
                  className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateClone}
                disabled={cloneCreating}
                className="w-full bg-gradient-to-r from-cyan-500 to-amber-500 hover:brightness-110 text-black font-extrabold text-xs py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <CopyPlus size={14} /> {cloneCreating ? 'ক্লোন তৈরি হচ্ছে...' : 'নতুন ক্লোন তৈরি ও লিংক কপি করুন'}
              </button>
            </div>

            {latestCloneUrl && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-bold text-emerald-300">নতুন ক্লোন লিংক প্রস্তুত:</div>
                <input
                  type="text"
                  readOnly
                  value={latestCloneUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full bg-[#0c0c1c] border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-emerald-200 select-all"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(latestCloneUrl).catch(() => {});
                      setCloneCopiedId('latest');
                      setTimeout(() => setCloneCopiedId(null), 2000);
                    }}
                    className="bg-amber-500 text-black font-bold text-[11px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                  >
                    {cloneCopiedId === 'latest' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{cloneCopiedId === 'latest' ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.share({
                          title: `${siteContent.headerBrandName || 'Shahani Rajib'} (ক্লোন)`,
                          url: latestCloneUrl
                        }).catch(() => {});
                      }}
                      className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                    >
                      <Share2 size={12} /> শেয়ার করুন
                    </button>
                  )}
                </div>
              </div>
            )}

            {Array.isArray(siteContent.cloneLinks) && siteContent.cloneLinks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-purple-200 border-b border-purple-500/25 pb-1">
                  তৈরি করা ক্লোন লিংকসমূহ ({siteContent.cloneLinks.length})
                </h4>
                <div className="space-y-2">
                  {siteContent.cloneLinks.map((cl: { id: string; label: string; createdAt: string }) => {
                    const url = buildCloneUrl(cl.id);
                    return (
                      <div
                        key={cl.id}
                        className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-amber-200 truncate">{cl.label}</div>
                            <div className="text-[10px] text-purple-300/70">{cl.createdAt}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(url).catch(() => {});
                                setCloneCopiedId(cl.id);
                                setTimeout(() => setCloneCopiedId(null), 2000);
                              }}
                              className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              {cloneCopiedId === cl.id ? <Check size={10} /> : <Copy size={10} />}
                              <span>{cloneCopiedId === cl.id ? 'কপিড' : 'কপি'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (navigator.share) {
                                  navigator.share({ title: cl.label, url }).catch(() => {});
                                } else {
                                  navigator.clipboard?.writeText(url).catch(() => {});
                                  setCloneCopiedId(cl.id);
                                  setTimeout(() => setCloneCopiedId(null), 2000);
                                }
                              }}
                              className="bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              <Share2 size={10} /> শেয়ার
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSiteContent((prev: any) => ({
                                  ...prev,
                                  cloneLinks: (Array.isArray(prev.cloneLinks) ? prev.cloneLinks : []).filter(
                                    (x: any) => x.id !== cl.id
                                  )
                                }));
                              }}
                              className="bg-red-500/85 hover:bg-red-600 text-white p-1 rounded-lg"
                              title="তালিকা থেকে মুছুন"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-CLONING MODAL (Primary Admin Only — Clone any single tab & add/assign Co-Admin) */}
      {isPrimaryAdmin && showSubCloneModal && (() => {
        const rawTabsForSubClone: { id: string; label: string; group: string; iconUrl?: string }[] = [
          ...(siteContent.topNavTabs || [])
            .filter((t: any) => t && t.id && t.id !== 'home')
            .map((t: any) => ({
              id: t.id,
              label: subpageInfoMap[t.id]?.title || t.label || t.id,
              group: 'টপ ট্যাব',
              iconUrl: t.iconUrl
            })),
          ...(siteContent.homeFeatureTabs || [])
            .filter((t: any) => t && t.id)
            .map((t: any) => ({
              id: t.id,
              label: subpageInfoMap[t.id]?.title || t.label || t.id,
              group: 'ফিচার ট্যাব',
              iconUrl: t.iconUrl
            })),
          ...pagesData
            .filter((p) => p.id !== 'certificate')
            .map((p) => ({
              id: p.id,
              label: subpageInfoMap[p.id]?.title || p.title || p.id,
              group: 'মূল পেজ',
              iconUrl: getTabMetaForPage(p.id).iconUrl
            })),
          {
            id: 'about-shahani',
            label: subpageInfoMap['about-shahani']?.title || 'শাহানী রাজীব সম্পর্কে',
            group: 'পরিচিতি',
            iconUrl: ''
          },
          ...(siteContent.customSubPages || []).map((sp: any) => ({
            id: sp.id,
            label: subpageInfoMap[sp.id]?.title || sp.title || sp.id,
            group: 'অতিরিক্ত পেজ',
            iconUrl: ''
          }))
        ];
        const selectableSubCloneTabs = Array.from(
          new Map(rawTabsForSubClone.map((item) => [item.id, item])).values()
        );
        const subCloneLinksList: {
          id: string;
          label: string;
          targetTabId: string;
          targetTabLabel: string;
          assignedCoAdminEmail?: string;
          createdAt: string;
        }[] = Array.isArray(siteContent.subCloneLinks) ? siteContent.subCloneLinks : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#121225] border border-emerald-500/45 rounded-2xl p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto shadow-[0_0_40px_rgba(16,185,129,0.25)] space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <Layers size={16} /> সাব ক্লোনিং (একক ট্যাব ক্লোন ও কো-অ্যাডমিন)
                </h3>
                <button type="button" onClick={() => setShowSubCloneModal(false)} className="text-gray-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <p className="text-[11px] text-purple-200/80 leading-relaxed">
                যেকোনো একটি আলাদা ট্যাব (যেমন: শুধুমাত্র বই, কিংবা ম্যাজিক, ব্লগ, কিউব বা সংগ্রহ) ক্লোন করে কো-অ্যাডমিন যোগ করতে পারবেন। কো-অ্যাডমিন শুধুমাত্র ওই ট্যাবটিই দেখতে ও এডিট করতে পারবে—অন্য কোনো ট্যাব বা মূল সাইটে কোনো পরিবর্তন হবে না।
              </p>

              {subCloneStatusMsg && (
                <div className="bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs p-2.5 rounded-xl">
                  {subCloneStatusMsg}
                </div>
              )}

              <form onSubmit={handleCreateSubClone} className="bg-[#181833] border border-purple-500/35 rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-[11px] text-purple-300 block mb-1 font-bold">
                    ১. কোন ট্যাবটি সাব-ক্লোন করতে চান? *
                  </label>
                  <select
                    value={subCloneTargetTabId}
                    onChange={(e) => setSubCloneTargetTabId(e.target.value)}
                    className="w-full bg-[#101026] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    required
                  >
                    {selectableSubCloneTabs.map((tab) => (
                      <option key={tab.id} value={tab.id}>
                        {tab.label} ({tab.group})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-purple-300 block mb-1">
                    ২. সাব-ক্লোনের নাম (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={subCloneLabelInput}
                    onChange={(e) => setSubCloneLabelInput(e.target.value)}
                    placeholder="যেমন: বই কো-অ্যাডমিন / ম্যাজিক এডিটর"
                    className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="border-t border-purple-500/25 pt-3 space-y-2.5">
                  <label className="text-[11px] text-amber-300 block font-bold">
                    ৩. এই ট্যাবের জন্য কো-অ্যাডমিন সেট করুন
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSubCloneCoAdminMode('new')}
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold border transition-all ${
                        subCloneCoAdminMode === 'new'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-[#101026] border-purple-500/30 text-purple-300 hover:border-purple-400'
                      }`}
                    >
                      নতুন কো-অ্যাডমিন
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubCloneCoAdminMode('existing');
                        if (!subCloneSelectedCoAdminEmail && coAdminsList.length > 0) {
                          setSubCloneSelectedCoAdminEmail(coAdminsList[0].email);
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold border transition-all ${
                        subCloneCoAdminMode === 'existing'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-[#101026] border-purple-500/30 text-purple-300 hover:border-purple-400'
                      }`}
                    >
                      বিদ্যমান তালিকা
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubCloneCoAdminMode('any')}
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold border transition-all ${
                        subCloneCoAdminMode === 'any'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-[#101026] border-purple-500/30 text-purple-300 hover:border-purple-400'
                      }`}
                    >
                      সবার জন্য
                    </button>
                  </div>

                  {subCloneCoAdminMode === 'new' && (
                    <div className="space-y-2 bg-[#12122a] border border-purple-500/25 rounded-xl p-3">
                      <div>
                        <label className="text-[10.5px] text-purple-300 block mb-1">কো-অ্যাডমিন ই-মেইল *</label>
                        <input
                          type="email"
                          value={subCloneCoAdminEmail}
                          onChange={(e) => setSubCloneCoAdminEmail(e.target.value)}
                          placeholder="coadmin@gmail.com"
                          className="w-full bg-[#0d0d20] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10.5px] text-purple-300 block mb-1">পাসওয়ার্ড *</label>
                        <input
                          type="text"
                          value={subCloneCoAdminPassword}
                          onChange={(e) => setSubCloneCoAdminPassword(e.target.value)}
                          placeholder="পাসওয়ার্ড লিখুন..."
                          className="w-full bg-[#0d0d20] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10.5px] text-purple-300 block mb-1">নাম / নোট (ঐচ্ছিক)</label>
                        <input
                          type="text"
                          value={subCloneCoAdminNote}
                          onChange={(e) => setSubCloneCoAdminNote(e.target.value)}
                          placeholder="যেমন: বই এডিটর"
                          className="w-full bg-[#0d0d20] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  )}

                  {subCloneCoAdminMode === 'existing' && (
                    <div>
                      {coAdminsList.length === 0 ? (
                        <p className="text-[11px] text-amber-300/80 bg-[#12122a] border border-amber-500/25 rounded-lg p-2.5">
                          এখনো কোনো কো-অ্যাডমিন যোগ করা হয়নি। “নতুন কো-অ্যাডমিন” নির্বাচন করে এখান থেকেই যোগ করুন।
                        </p>
                      ) : (
                        <select
                          value={subCloneSelectedCoAdminEmail}
                          onChange={(e) => setSubCloneSelectedCoAdminEmail(e.target.value)}
                          className="w-full bg-[#101026] border border-purple-500/35 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                          required
                        >
                          <option value="">কো-অ্যাডমিন নির্বাচন করুন...</option>
                          {coAdminsList.map((ca) => (
                            <option key={ca.id} value={ca.email}>
                              {ca.email}{ca.note ? ` (${ca.note})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {subCloneCoAdminMode === 'any' && (
                    <p className="text-[10.5px] text-purple-300/75 bg-[#12122a] border border-purple-500/20 rounded-lg p-2">
                      আপনার তালিকায় থাকা যেকোনো অনুমোদিত কো-অ্যাডমিন এই সাব-ক্লোন লিংকটিতে প্রবেশ করে শুধুমাত্র নির্বাচিত ট্যাবটি এডিট করতে পারবেন।
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={subCloneCreating}
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-400 hover:brightness-110 text-black font-extrabold text-xs py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Layers size={14} />
                  <span>{subCloneCreating ? 'সাব-ক্লোন তৈরি হচ্ছে...' : 'সাব-ক্লোন তৈরি ও লিংক কপি করুন'}</span>
                </button>
              </form>

              {latestSubCloneUrl && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 space-y-2">
                  <div className="text-[11px] font-bold text-emerald-300">নতুন সাব-ক্লোন লিংক প্রস্তুত:</div>
                  <input
                    type="text"
                    readOnly
                    value={latestSubCloneUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full bg-[#0c0c1c] border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-emerald-200 select-all"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(latestSubCloneUrl).catch(() => {});
                        setSubCloneCopiedId('latest');
                        setTimeout(() => setSubCloneCopiedId(null), 2000);
                      }}
                      className="bg-amber-500 text-black font-bold text-[11px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                    >
                      {subCloneCopiedId === 'latest' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{subCloneCopiedId === 'latest' ? 'কপি হয়েছে' : 'কপি'}</span>
                    </button>
                    {typeof navigator !== 'undefined' && navigator.share && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.share({
                            title: `${siteContent.headerBrandName || 'Shahani Rajib'} (সাব-ক্লোন)`,
                            url: latestSubCloneUrl
                          }).catch(() => {});
                        }}
                        className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                      >
                        <Share2 size={12} /> শেয়ার করুন
                      </button>
                    )}
                  </div>
                </div>
              )}

              {subCloneLinksList.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-purple-200 border-b border-purple-500/25 pb-1">
                    তৈরি করা সাব-ক্লোন লিংকসমূহ ({subCloneLinksList.length})
                  </h4>
                  <div className="space-y-2">
                    {subCloneLinksList.map((cl) => {
                      const url = buildSubCloneUrl(cl.id, cl.targetTabId);
                      return (
                        <div
                          key={cl.id}
                          className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-emerald-200 truncate">{cl.label}</div>
                              <div className="text-[10px] text-purple-300/80 truncate">
                                ট্যাব: <span className="text-amber-300 font-bold">{cl.targetTabLabel}</span>
                                {cl.assignedCoAdminEmail ? ` • ${cl.assignedCoAdminEmail}` : ' • যেকোনো কো-অ্যাডমিন'}
                                {cl.createdAt ? ` • ${cl.createdAt}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(url).catch(() => {});
                                  setSubCloneCopiedId(cl.id);
                                  setTimeout(() => setSubCloneCopiedId(null), 2000);
                                }}
                                className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                {subCloneCopiedId === cl.id ? <Check size={10} /> : <Copy size={10} />}
                                <span>{subCloneCopiedId === cl.id ? 'কপিড' : 'কপি'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (navigator.share) {
                                    navigator.share({ title: cl.label, url }).catch(() => {});
                                  } else {
                                    navigator.clipboard?.writeText(url).catch(() => {});
                                    setSubCloneCopiedId(cl.id);
                                    setTimeout(() => setSubCloneCopiedId(null), 2000);
                                  }
                                }}
                                className="bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <Share2 size={10} /> শেয়ার
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubClone(cl.id)}
                                className="bg-red-500/85 hover:bg-red-600 text-white p-1 rounded-lg"
                                title="তালিকা থেকে মুছুন"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* SHARE LINK FALLBACK MODAL (Guarantees copy always works even inside iframes) */}
      {shareFallbackUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-5 max-w-md w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Share2 size={15} /> পেজ শেয়ার লিংক
              </h3>
              <button type="button" onClick={() => setShareFallbackUrl(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={shareFallbackUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 select-all"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShareFallbackUrl(null)}
                className="bg-white/10 text-gray-200 text-xs px-3.5 py-2 rounded-xl"
              >
                বন্ধ
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareFallbackUrl).catch(() => {});
                  setShareToast(true);
                  setTimeout(() => setShareToast(false), 2000);
                  setShareFallbackUrl(null);
                }}
                className="bg-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1"
              >
                <Copy size={13} /> লিংক কপি করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBSITE / PWA APP INSTALL MODAL (Available to All Visitors) */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-emerald-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(16,185,129,0.25)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <Smartphone size={16} /> ওয়েবসাইট / অ্যাপ ইনস্টল করুন
              </h3>
              <button type="button" onClick={() => setShowInstallModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-purple-100/90 leading-relaxed">
              {isIOSDevice ? (
                <div className="bg-[#181833] border border-purple-500/30 rounded-xl p-3 space-y-1">
                  <div className="font-bold text-amber-300">iPhone / iPad (Safari):</div>
                  <p>১. নিচে Safari-এর <strong>Share</strong> বাটনে ট্যাপ করুন।</p>
                  <p>২. নিচে স্ক্রল করে <strong>Add to Home Screen</strong> সিলেক্ট করুন।</p>
                </div>
              ) : (
                <div className="bg-[#181833] border border-purple-500/30 rounded-xl p-3 space-y-1">
                  <div className="font-bold text-amber-300">Android / PC ব্রাউজার থেকে ইনস্টল:</div>
                  <p>১. নিচের ওয়েবসাইট লিংকটি Chrome বা Edge ব্রাউজারে খুলুন।</p>
                  <p>২. ব্রাউজারের মেনু (⋮) থেকে <strong>Install App</strong> অথবা <strong>Add to Home screen</strong> চাপুন।</p>
                </div>
              )}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-purple-300 flex items-center gap-1">
                  <Globe size={12} /> ওয়েবসাইট লিংক:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}${activeCloneId ? `?clone=${activeCloneId}` : ''}` : '/'}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 bg-[#1b1b38] border border-purple-500/30 rounded-xl px-2.5 py-1.5 text-[11px] text-amber-200 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const webUrl = `${window.location.origin}${window.location.pathname}${activeCloneId ? `?clone=${activeCloneId}` : ''}`;
                      navigator.clipboard?.writeText(webUrl).catch(() => {});
                      setWebsiteLinkCopied(true);
                      setTimeout(() => setWebsiteLinkCopied(false), 2000);
                    }}
                    className="bg-amber-500 text-black font-bold text-[11px] px-3 py-1.5 rounded-xl shrink-0 inline-flex items-center gap-1"
                  >
                    {websiteLinkCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{websiteLinkCopied ? 'কপিড' : 'কপি'}</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2 rounded-xl"
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Connectivity Indicator */}
      {!isOnline && (
        <div className="fixed bottom-16 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-black shadow-lg">
          <span className="h-2 w-2 rounded-full bg-black animate-pulse" />
          অফলাইন মোড — সংরক্ষিত ডাটা দেখানো হচ্ছে
        </div>
      )}

      {/* ADD NEW VIDEO MODAL */}
      {showAddVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <PlusCircle size={16} /> নতুন ভিডিও যোগ করুন
              </h3>
              <button onClick={() => setShowAddVideoModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddVideoSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">কোথায় যোগ করতে চান?</label>
                <select 
                  value={newVideoTargetPage}
                  onChange={(e) => setNewVideoTargetPage(e.target.value)}
                  className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="home">হোম পেজ (নির্বাচিত ভিডিও প্রদর্শনী)</option>
                  {allSubPages.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">ইউটিউব অথবা ফেসবুক ভিডিও লিংক</label>
                <input 
                  type="text"
                  value={newVideoLink}
                  onChange={(e) => setNewVideoLink(e.target.value)}
                  placeholder="https://www.youtube.com/... বা ফেসবুক ভিডিও লিংক"
                  className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:brightness-110 text-black font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              >
                ভিডিও যুক্ত করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW BOOK MODAL (For books page tab) */}
      {showAddBookModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <BookMarked size={16} /> নতুন বই যুক্ত করুন
              </h3>
              <button onClick={() => setShowAddBookModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddBookSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">বইয়ের নাম</label>
                <input 
                  type="text"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  placeholder="বইয়ের নাম দিন"
                  className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">বইয়ের বিবরণ</label>
                <textarea 
                  rows={2}
                  value={newBookDesc}
                  onChange={(e) => setNewBookDesc(e.target.value)}
                  placeholder="বই সম্পর্কে কিছু লিখুন"
                  className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">মূল্য</label>
                <input 
                  type="text"
                  value={newBookPrice}
                  onChange={(e) => setNewBookPrice(e.target.value)}
                  placeholder="যেমন: ৩৫০ টাকা"
                  className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">পিডিএফ বা ড্রাইভ লিংক (ঐচ্ছিক)</label>
                <input 
                  type="text"
                  value={newBookPdf}
                  onChange={(e) => setNewBookPdf(e.target.value)}
                  placeholder="PDF / Google Drive Link"
                  className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">বইয়ের কভার ইমেজ বা ড্রাইভ লিংক (ঐচ্ছিক)</label>
                <input 
                  type="text"
                  value={newBookCover}
                  onChange={(e) => setNewBookCover(e.target.value)}
                  placeholder="Image URL / Google Drive Link"
                  className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:brightness-110 text-black font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              >
                বই সংরক্ষণ করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN EDIT INLINE MODAL */}
      {editingKey && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-lg w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Edit2 size={16} /> টেক্সট পরিবর্তন করুন ({editingKey})
              </h3>
              <button onClick={() => setEditingKey(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <textarea 
              rows={4}
              value={tempEditValue}
              onChange={(e) => setTempEditValue(e.target.value)}
              className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setEditingKey(null)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
              >
                বাতিল
              </button>
              <button 
                onClick={() => handleSaveEdit(editingKey)}
                className="bg-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <Save size={13} /> সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE & BANNER LINK / SIZE MODAL (Replaces prompt for reliable Drive links) */}
      {imageModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <ImageIcon size={16} /> {imageModal.title}
              </h3>
              <button onClick={() => setImageModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveImageModal} className="space-y-3">
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">
                  গুগল ড্রাইভ বা ছবির ডাইরেক্ট লিংক
                </label>
                <input
                  type="text"
                  value={imageModal.url}
                  onChange={(e) => setImageModal({ ...imageModal, url: e.target.value })}
                  placeholder="https://drive.google.com/file/d/... বা Image URL"
                  className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-purple-300/70 mt-1">
                  গুগল ড্রাইভ শেয়ার লিংক দিলে অটোমেটিক ডাইরেক্ট ভিউতে রূপান্তর হবে।
                </p>
              </div>
              {imageModal.url.trim() && (
                <div className="bg-[#0a0a18] border border-purple-500/30 rounded-xl p-2 text-center">
                  <img
                    src={normalizeImageUrl(imageModal.url)}
                    alt="Preview"
                    className="max-h-28 mx-auto object-contain rounded"
                  />
                </div>
              )}
              {imageModal.showSizeFields && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-purple-300 block mb-1">উইথ (Width)</label>
                    <input
                      type="text"
                      value={imageModal.width}
                      onChange={(e) => setImageModal({ ...imageModal, width: e.target.value })}
                      placeholder="100% বা 400px"
                      className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-purple-300 block mb-1">হাইট (Height)</label>
                    <input
                      type="text"
                      value={imageModal.height}
                      onChange={(e) => setImageModal({ ...imageModal, height: e.target.value })}
                      placeholder="auto বা 200px"
                      className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}
              {imageModal.imgKey.startsWith('banner_') && (() => {
                const frameKey = imageModal.imgKey;
                const frame: BannerFrame = (siteContent.bannerFrames && siteContent.bannerFrames[frameKey]) || {};
                const bPosY = typeof frame.posY === 'number' ? frame.posY : 50;
                const bAspect = typeof frame.aspectHeight === 'number' ? frame.aspectHeight : 400;
                const bZoom = typeof frame.zoom === 'number' ? frame.zoom : 100;
                return (
                  <div className="bg-[#181833] border border-amber-400/40 rounded-xl p-3 space-y-2.5">
                    {imageModal.url.trim() && (
                      <div
                        className="w-full overflow-hidden rounded-xl bg-[#0a0a18] border border-purple-500/30"
                        style={{ aspectRatio: `1600 / ${bAspect}` }}
                      >
                        <img
                          src={normalizeImageUrl(imageModal.url)}
                          alt="Banner Frame Preview"
                          className="w-full h-full object-cover block"
                          style={{
                            objectPosition: `50% ${bPosY}%`,
                            transform: bZoom !== 100 ? `scale(${bZoom / 100})` : undefined,
                            transformOrigin: bZoom < 100 ? '50% 50%' : `50% ${bPosY}%`
                          }}
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                      <div>
                        <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                          <span>উপর-নিচ পজিশন</span>
                          <span>{bPosY}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={bPosY}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSiteContent((prev: any) => ({
                              ...prev,
                              bannerFrames: {
                                ...(prev.bannerFrames || {}),
                                [frameKey]: { ...(prev.bannerFrames?.[frameKey] || {}), posY: val }
                              }
                            }));
                          }}
                          className="w-full accent-amber-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                          <span>ব্যানার উচ্চতা (বড়/ছোট)</span>
                          <span>1600×{bAspect}</span>
                        </div>
                        <input
                          type="range"
                          min={160}
                          max={900}
                          step={10}
                          value={bAspect}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSiteContent((prev: any) => ({
                              ...prev,
                              bannerFrames: {
                                ...(prev.bannerFrames || {}),
                                [frameKey]: { ...(prev.bannerFrames?.[frameKey] || {}), aspectHeight: val }
                              }
                            }));
                          }}
                          className="w-full accent-amber-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-[10px] text-amber-300 font-bold mb-1 gap-1">
                          <span>জুম ({bZoom}%)</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const nextZ = Math.max(50, bZoom - 10);
                                setSiteContent((prev: any) => ({
                                  ...prev,
                                  bannerFrames: {
                                    ...(prev.bannerFrames || {}),
                                    [frameKey]: { ...(prev.bannerFrames?.[frameKey] || {}), zoom: nextZ }
                                  }
                                }));
                              }}
                              className="bg-purple-800/70 hover:bg-purple-700 text-white px-1 py-0.5 rounded inline-flex items-center"
                              title="জুম আউট"
                            >
                              <ZoomOut size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextZ = Math.min(250, bZoom + 10);
                                setSiteContent((prev: any) => ({
                                  ...prev,
                                  bannerFrames: {
                                    ...(prev.bannerFrames || {}),
                                    [frameKey]: { ...(prev.bannerFrames?.[frameKey] || {}), zoom: nextZ }
                                  }
                                }));
                              }}
                              className="bg-purple-800/70 hover:bg-purple-700 text-white px-1 py-0.5 rounded inline-flex items-center"
                              title="জুম ইন"
                            >
                              <ZoomIn size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSiteContent((prev: any) => ({
                                  ...prev,
                                  bannerFrames: {
                                    ...(prev.bannerFrames || {}),
                                    [frameKey]: { posY: 50, aspectHeight: 400, zoom: 100 }
                                  }
                                }));
                              }}
                              className="text-cyan-300 hover:underline inline-flex items-center"
                              title="রিসেট"
                            >
                              <RotateCcw size={10} />
                            </button>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={250}
                          value={bZoom}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSiteContent((prev: any) => ({
                              ...prev,
                              bannerFrames: {
                                ...(prev.bannerFrames || {}),
                                [frameKey]: { ...(prev.bannerFrames?.[frameKey] || {}), zoom: val }
                              }
                            }));
                          }}
                          className="w-full accent-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setImageModal(null)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Save size={13} /> সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIDEO LINK EDIT MODAL */}
      {videoEditModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Video size={16} /> ভিডিও লিংক পরিবর্তন করুন
              </h3>
              <button onClick={() => setVideoEditModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = videoEditModal.link.trim();
                if (!trimmed) return;
                if (videoEditModal.target === 'home') {
                  const updated = videosList.map((v: any) =>
                    v.id === videoEditModal.id ? { ...v, yt: trimmed } : v
                  );
                  setSiteContent((prev: any) => ({ ...prev, featuredVideos: updated }));
                } else {
                  const pageId = videoEditModal.target;
                  const updatedItems = (subpagesContent[pageId] || []).map((it: any) =>
                    it.id === videoEditModal.id ? { ...it, yt: trimmed } : it
                  );
                  setSubpagesContent((prev: any) => ({ ...prev, [pageId]: updatedItems }));
                }
                setVideoEditModal(null);
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={videoEditModal.link}
                onChange={(e) => setVideoEditModal({ ...videoEditModal, link: e.target.value })}
                placeholder="ইউটিউব অথবা ফেসবুক ভিডিও লিংক"
                className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVideoEditModal(null)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Save size={13} /> আপডেট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HOME PAGE SLIDER MULTI-IMAGE MANAGER MODAL */}
      {isAdmin && showHomeSliderModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <ImageIcon size={16} /> হোম ইমেজ স্লাইডার (একাধিক ইমেজ অ্যাড ও এডিট)
              </h3>
              <button type="button" onClick={() => setShowHomeSliderModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Bulk multi-link paste */}
            <div className="bg-[#181833] border border-purple-500/35 rounded-xl p-3 space-y-2">
              <label className="text-xs font-bold text-purple-200 block">
                একসাথে একাধিক ইমেজ / গুগল ড্রাইভ লিংক যোগ করুন (প্রতি লাইনে একটি করে লিংক দিন):
              </label>
              <textarea
                rows={3}
                value={homeSliderBulkInput}
                onChange={(e) => setHomeSliderBulkInput(e.target.value)}
                placeholder="https://drive.google.com/file/d/...&#10;https://drive.google.com/file/d/..."
                className="w-full bg-[#101026] border border-purple-500/35 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const links = homeSliderBulkInput
                      .split(/\s+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (links.length === 0) return;
                    setHomeSliderDraft((prev) => [
                      ...prev,
                      ...links.map((l) => ({ url: normalizeImageUrl(l), caption: '' }))
                    ]);
                    setHomeSliderBulkInput('');
                  }}
                  className="bg-gradient-to-r from-cyan-500 to-amber-500 text-black font-bold text-xs px-3 py-1.5 rounded-xl inline-flex items-center gap-1 hover:brightness-110"
                >
                  <PlusCircle size={13} /> সবগুলো তালিকায় যোগ করুন
                </button>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={homeSliderCountInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setHomeSliderCountInput(raw);
                      const count = parseInt(raw, 10);
                      if (!Number.isNaN(count) && count >= 1 && count <= 50) {
                        setHomeSliderDraft((prev) =>
                          Array.from({ length: count }, (_, i) => prev[i] || { url: '', caption: '' })
                        );
                      }
                    }}
                    placeholder="সংখ্যা"
                    className="w-20 bg-[#101026] border border-purple-500/35 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setHomeSliderDraft((prev) => [...prev, { url: '', caption: '' }])}
                    className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1"
                  >
                    <Plus size={12} /> + ১টি
                  </button>
                </div>
              </div>
            </div>

            {/* Individual slide list */}
            <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
              {homeSliderDraft.map((item, idx) => (
                <div key={idx} className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 flex items-center gap-2">
                  {item.url.trim() ? (
                    <img
                      src={normalizeImageUrl(item.url)}
                      alt={`Slide ${idx + 1}`}
                      className="w-12 h-12 object-cover rounded-lg bg-black/40 shrink-0 border border-purple-500/30"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-black/40 shrink-0 border border-dashed border-purple-500/30 flex items-center justify-center text-[10px] text-purple-300/60">
                      #{idx + 1}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-[10px] font-bold text-amber-300">স্লাইড ছবি {idx + 1}</div>
                    <input
                      type="text"
                      value={item.url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHomeSliderDraft((prev) => prev.map((it, i) => (i === idx ? { ...it, url: val } : it)));
                      }}
                      placeholder="https://drive.google.com/file/d/... লিংক দিন"
                      className="w-full bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          setHomeSliderDraft((prev) => {
                            const next = [...prev];
                            const tmp = next[idx - 1];
                            next[idx - 1] = next[idx];
                            next[idx] = tmp;
                            return next;
                          });
                        }}
                        className="bg-purple-800/70 hover:bg-purple-700 disabled:opacity-30 text-amber-300 p-1 rounded"
                        title="উপরে"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === homeSliderDraft.length - 1}
                        onClick={() => {
                          setHomeSliderDraft((prev) => {
                            const next = [...prev];
                            const tmp = next[idx + 1];
                            next[idx + 1] = next[idx];
                            next[idx] = tmp;
                            return next;
                          });
                        }}
                        className="bg-purple-800/70 hover:bg-purple-700 disabled:opacity-30 text-amber-300 p-1 rounded"
                        title="নিচে"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHomeSliderDraft((prev) => prev.filter((_, i) => i !== idx))}
                      className="bg-red-500/85 hover:bg-red-600 text-white p-1 rounded inline-flex items-center justify-center"
                      title="মুছুন"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowHomeSliderModal(false)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = homeSliderDraft
                    .map((it) => ({
                      url: normalizeImageUrl(it.url.trim()),
                      caption: (it.caption || '').trim() || '🌙 মিডনাইট ম্যাজিক ও অফিশিয়াল মোমেন্ট'
                    }))
                    .filter((it) => it.url !== '');
                  if (cleaned.length === 0) return;
                  setSiteContent((prev: any) => ({
                    ...prev,
                    sliderImages: cleaned
                  }));
                  setSliderIndex(0);
                  setShowHomeSliderModal(false);
                }}
                className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 hover:brightness-110"
              >
                <Save size={13} /> সংরক্ষণ করুন ({homeSliderDraft.filter((x) => x.url.trim()).length}টি ছবি)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-red-500/50 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(239,68,68,0.25)] space-y-4 text-center">
            <p className="text-sm font-bold text-white">{confirmModal.message}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="bg-white/10 hover:bg-white/20 text-gray-200 text-xs px-4 py-2 rounded-xl"
              >
                না, থাকুক
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-xl"
              >
                হ্যাঁ, ডিলিট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX IMAGE MODAL */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <button
            onClick={() => setLightboxImageUrl(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full"
            title="বন্ধ করুন"
          >
            <X size={22} />
          </button>
          <img
            src={lightboxImageUrl}
            alt="Full Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* SLIDER BUILDER MODAL (Video Slider & Image Slider by count) */}
      {sliderBuilderModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                {sliderBuilderModal.type === 'video' ? <Video size={16} /> : <ImageIcon size={16} />}
                <span>{sliderBuilderModal.title}</span>
              </h3>
              <button onClick={() => setSliderBuilderModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-purple-200 block">
                {sliderBuilderModal.type === 'video'
                  ? 'কয়টি ভিডিও দিয়ে স্লাইডার বানাতে চান? (সংখ্যা লিখুন)'
                  : 'কয়টি ইমেজ দিয়ে স্লাইডার বানাতে চান? (সংখ্যা লিখুন)'}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={sliderBuilderModal.countInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsedCount = parseInt(raw, 10);
                  const count = Number.isNaN(parsedCount) ? 0 : Math.min(Math.max(parsedCount, 0), 50);
                  setSliderBuilderModal(prev => {
                    if (!prev) return null;
                    const nextLinks = Array.from({ length: count }, (_, idx) => prev.links[idx] || '');
                    return { ...prev, countInput: raw, links: nextLinks };
                  });
                }}
                placeholder="যেমন: 3 বা 5 লিখুন..."
                className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {sliderBuilderModal.links.length > 0 && (
              <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
                {sliderBuilderModal.links.map((linkVal, idx) => (
                  <div key={idx} className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5">
                    <label className="text-[11px] font-semibold text-amber-300 block">
                      {sliderBuilderModal.type === 'video'
                        ? `ভিডিও লিংক ${idx + 1} (YouTube / Facebook)`
                        : `গুগল ড্রাইভ ইমেজ লিংক ${idx + 1}`}
                    </label>
                    <input
                      type="text"
                      value={linkVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSliderBuilderModal(prev => {
                          if (!prev) return null;
                          const updated = [...prev.links];
                          updated[idx] = val;
                          return { ...prev, links: updated };
                        });
                      }}
                      placeholder={
                        sliderBuilderModal.type === 'video'
                          ? 'https://www.youtube.com/... বা ফেসবুক ভিডিও লিংক পেস্ট করুন'
                          : 'https://drive.google.com/file/d/... লিংক পেস্ট করুন'
                      }
                      className="w-full bg-[#101026] border border-purple-500/30 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                    />
                    {sliderBuilderModal.type === 'image' && linkVal.trim() && (
                      <img
                        src={normalizeImageUrl(linkVal)}
                        alt={`Slide preview ${idx + 1}`}
                        className="h-20 object-contain rounded bg-black/40 mx-auto"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSliderBuilderModal(null)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = sliderBuilderModal.links.map(s => s.trim()).filter(Boolean);
                  const { type, targetKey } = sliderBuilderModal;
                  if (type === 'video') {
                    setSiteContent((prev: any) => ({
                      ...prev,
                      videoSliders: { ...(prev.videoSliders || {}), [targetKey]: cleaned }
                    }));
                    setVideoSliderIndices(prev => ({ ...prev, [targetKey]: 0 }));
                  } else {
                    setSiteContent((prev: any) => ({
                      ...prev,
                      imageSliders: { ...(prev.imageSliders || {}), [targetKey]: cleaned }
                    }));
                    setImageSliderIndices(prev => ({ ...prev, [targetKey]: 0 }));
                  }
                  setSliderBuilderModal(null);
                }}
                className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 hover:brightness-110"
              >
                <Save size={13} /> স্লাইডার সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENU BAR REPEATABLE CONTENT BUILDER MODAL */}
      {customBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                {customBlockModal.type === 'video' && <><Youtube size={16} /> YouTube / Facebook ভিডিও যোগ করুন</>}
                {customBlockModal.type === 'video-slider' && <><Video size={16} /> ভিডিও স্লাইডার যোগ করুন</>}
                {customBlockModal.type === 'image-slider' && <><ImageIcon size={16} /> ইমেজ স্লাইডার যোগ করুন</>}
                {customBlockModal.type === 'text-slab' && <><Type size={16} /> টেক্সট স্ল্যাব যোগ করুন</>}
                {customBlockModal.type === 'drive-image' && <><ImageIcon size={16} /> গুগল ড্রাইভ ইমেজ লিংক যোগ করুন</>}
                {customBlockModal.type === 'pdf' && <><FileText size={16} /> পিডিএফ যোগ করুন</>}
                {customBlockModal.type === 'html-code' && <><Code size={16} className="text-sky-400" /> html কোড যোগ করুন</>}
                {customBlockModal.type === 'audio' && <><Music size={16} className="text-violet-400" /> অডিও যোগ করুন</>}
              </h3>
              <button onClick={() => setCustomBlockModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {customBlockModal.type === 'audio' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    হেডার টেক্সট (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    value={customBlockModal.audioTitle}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, audioTitle: e.target.value } : null)}
                    placeholder="যেমন: কবিতা আবৃত্তি / অডিও বার্তা (খালি রাখলে শুধু অডিও চলবে)"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    গুগল ড্রাইভ অডিও লিংক (অথবা সরাসরি MP3 / অডিও URL) দিন:
                  </label>
                  <input
                    type="text"
                    value={customBlockModal.link}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, link: e.target.value } : null)}
                    placeholder="https://drive.google.com/file/d/... লিংক পেস্ট করুন"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                  <div className="text-[11px] text-purple-300/75 mt-1.5 space-y-1">
                    <p>• গুগল ড্রাইভে থাকা অডিও ফাইলে <strong>Share → "Anyone with the link"</strong> (Viewer) পারমিশন দিয়ে লিংক দিন।</p>
                    <p>• হেডার টেক্সট দিলে প্লেয়ারের উপরে দেখাবে, না দিলে শুধু অডিও প্লেয়ার দেখাবে। যেকোনো ডিভাইসে প্লে, স্টপ ও ভলিউম বাড়ানো-কমানো যাবে।</p>
                  </div>
                </div>
              </div>
            )}

            {customBlockModal.type === 'video' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-purple-200 block">
                  YouTube অথবা Facebook ভিডিও লিংক দিন:
                </label>
                <input
                  type="text"
                  value={customBlockModal.link}
                  onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, link: e.target.value } : null)}
                  placeholder="https://www.youtube.com/... বা Facebook ভিডিও লিংক"
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            {customBlockModal.type === 'html-code' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    শিরোনাম (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={customBlockModal.htmlTitle}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, htmlTitle: e.target.value } : null)}
                    placeholder="যেমন: Word in my pocket (খালি রাখলে সরাসরি স্ল্যাব দেখাবে)"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    গুগল ড্রাইভ (.html / .docx / Docs) লিংক, যেকোনো ওয়েব লিংক, অথবা সরাসরি HTML কোড দিন:
                  </label>
                  <textarea
                    rows={6}
                    value={customBlockModal.link}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, link: e.target.value } : null)}
                    placeholder="https://drive.google.com/file/d/... (.html বা .docx), ওয়েব লিংক (https://...), অথবা সরাসরি HTML কোড পেস্ট করুন"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl p-3 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                  <div className="text-[11px] text-purple-300/75 mt-1.5 space-y-1">
                    <p>• গুগল ড্রাইভে আপলোড করা <strong>.html</strong> বা <strong>.docx</strong> ফাইল (অথবা Google Doc) লিংক দিলে ("Anyone with the link" পারমিশনসহ), ভেতরের HTML কোডটি আসল ওয়েবপেজের মতো দেখাবে।</p>
                    <p>• যেকোনো ওয়েবসাইটের লিংক বা সরাসরি HTML কোড দিলেও অ্যাপের স্ল্যাবে সব ডিভাইস অনুযায়ী সুন্দরভাবে দেখাবে।</p>
                  </div>
                </div>
              </div>
            )}

            {customBlockModal.type === 'pdf' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    পিডিএফ এর নাম লিখুন (উপরে শিরোনাম হিসেবে দেখাবে):
                  </label>
                  <input
                    type="text"
                    value={customBlockModal.pdfTitle}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, pdfTitle: e.target.value } : null)}
                    placeholder="যেমন: ট্রেনিং মডিউল / সিভি / বইয়ের পিডিএফ"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    পিডিএফ লিংক দিন (Google Drive / PDF URL):
                  </label>
                  <input
                    type="text"
                    value={customBlockModal.link}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, link: e.target.value } : null)}
                    placeholder="https://drive.google.com/file/d/... বা PDF লিংক পেস্ট করুন"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCustomBlockModal((prev) =>
                      prev ? { ...prev, pdfDownloadable: !prev.pdfDownloadable } : null
                    )
                  }
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    customBlockModal.pdfDownloadable
                      ? 'bg-emerald-950/50 border-emerald-400/70 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.2)]'
                      : 'bg-[#181833] border-purple-500/35 text-purple-200 hover:border-amber-400/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Download size={15} className={customBlockModal.pdfDownloadable ? 'text-emerald-400' : 'text-amber-300'} />
                    <span>ডাউনলোড অপশন চালু রাখুন</span>
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-extrabold ${
                      customBlockModal.pdfDownloadable
                        ? 'bg-emerald-400 text-black'
                        : 'bg-white/10 text-purple-300'
                    }`}
                  >
                    {customBlockModal.pdfDownloadable ? 'চালু ✓' : 'বন্ধ'}
                  </span>
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-bold text-purple-200">
                      <span>পিডিএফ প্রস্থ (Width)</span>
                      <span className="text-amber-300">{DRIVE_IMG_WIDTHS[customBlockModal.pdfWidthIdx]?.label}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={DRIVE_IMG_WIDTHS.length - 1}
                      value={customBlockModal.pdfWidthIdx}
                      onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, pdfWidthIdx: Number(e.target.value) } : null)}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-bold text-purple-200">
                      <span>পিডিএফ উচ্চতা (Height)</span>
                      <span className="text-amber-300">{PDF_VIEWER_HEIGHTS[customBlockModal.pdfHeightIdx]?.label}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={PDF_VIEWER_HEIGHTS.length - 1}
                      value={customBlockModal.pdfHeightIdx}
                      onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, pdfHeightIdx: Number(e.target.value) } : null)}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {(customBlockModal.type === 'video-slider' || customBlockModal.type === 'image-slider') && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-300 block">
                    স্লাইড টাইপ নির্বাচন করুন:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {SLIDER_STYLE_OPTIONS.map((opt) => {
                      const active = customBlockModal.sliderStyle === opt.id;
                      const displayLabel =
                        customBlockModal.type === 'video-slider' && opt.id === 'curved'
                          ? '3D Curved Video Slider'
                          : opt.label;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setCustomBlockModal((prev) =>
                              prev ? { ...prev, sliderStyle: opt.id } : null
                            )
                          }
                          className={`text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                            active
                              ? 'bg-gradient-to-r from-purple-900/80 to-amber-900/40 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.28)]'
                              : 'bg-[#181833] border-purple-500/30 text-purple-200 hover:border-purple-400/60'
                          }`}
                        >
                          <div className="text-[11px] font-extrabold leading-tight">
                            {displayLabel}
                          </div>
                          <div className="text-[10px] text-purple-300/75 mt-0.5 leading-snug">
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-purple-200 block">
                    {customBlockModal.type === 'image-slider'
                      ? 'কয়টি ছবি দিয়ে স্লাইডার বানাতে চান? (সংখ্যা লিখুন)'
                      : 'কয়টি ভিডিও দিয়ে স্লাইডার বানাতে চান? (সংখ্যা লিখুন)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customBlockModal.countInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const parsedCount = parseInt(raw, 10);
                      const count = Number.isNaN(parsedCount) ? 0 : Math.min(Math.max(parsedCount, 0), 50);
                      setCustomBlockModal(prev => {
                        if (!prev) return null;
                        const nextSlides = Array.from({ length: count }, (_, idx) => prev.slides[idx] || '');
                        return { ...prev, countInput: raw, slides: nextSlides };
                      });
                    }}
                    placeholder="যেমন: 3 বা 5 লিখুন..."
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                {customBlockModal.slides.length > 0 && (
                  <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                    {customBlockModal.slides.map((val, idx) => (
                      <div key={idx} className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5">
                        <label className="text-[11px] font-semibold text-amber-300 block">
                          {customBlockModal.type === 'image-slider'
                            ? `ছবির লিংক ${idx + 1} (গুগল ড্রাইভ / ইমেজ লিংক)`
                            : `ভিডিও লিংক ${idx + 1} (YouTube / Facebook)`}
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            setCustomBlockModal(prev => {
                              if (!prev) return null;
                              const updated = [...prev.slides];
                              updated[idx] = nextVal;
                              return { ...prev, slides: updated };
                            });
                          }}
                          placeholder={
                            customBlockModal.type === 'image-slider'
                              ? 'https://drive.google.com/file/d/... লিংক পেস্ট করুন'
                              : 'https://www.youtube.com/... বা Facebook লিংক'
                          }
                          className="w-full bg-[#101026] border border-purple-500/30 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {customBlockModal.type === 'image-slider' && (() => {
                  const previewImg = customBlockModal.slides.find((s) => s && s.trim() !== '');
                  const mPosY = customBlockModal.posY;
                  const mAspect = customBlockModal.aspectHeight;
                  const mZoom = customBlockModal.zoom;
                  const hasFrame = Boolean(mAspect || mPosY !== 50);
                  return (
                    <div className="bg-[#181833] border border-amber-400/40 rounded-xl p-3 space-y-2.5">
                      <div className="text-[11px] font-bold text-amber-300">ব্যানার স্টাইল ইমেজ অ্যাডজাস্টমেন্ট:</div>
                      {previewImg && (
                        hasFrame ? (
                          <div
                            className="w-full overflow-hidden rounded-2xl bg-[#101026] border border-purple-500/30"
                            style={{ aspectRatio: `1600 / ${mAspect || 420}` }}
                          >
                            <img
                              src={normalizeImageUrl(previewImg)}
                              alt="Slider Preview"
                              className="w-full h-full object-cover rounded-2xl block"
                              style={{
                                objectPosition: `50% ${mPosY}%`,
                                transform: mZoom !== 100 ? `scale(${mZoom / 100})` : undefined,
                                transformOrigin: mZoom < 100 ? '50% 50%' : `50% ${mPosY}%`
                              }}
                            />
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-2xl bg-[#101026] p-2 flex items-center justify-center border border-purple-500/30">
                            <img
                              src={normalizeImageUrl(previewImg)}
                              alt="Slider Preview"
                              className="w-auto max-w-full max-h-40 object-contain rounded-2xl block"
                              style={{
                                transform: mZoom !== 100 ? `scale(${mZoom / 100})` : undefined,
                                transformOrigin: '50% 50%'
                              }}
                            />
                          </div>
                        )
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                        <div>
                          <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                            <span>উপর-নিচ পজিশন</span>
                            <span>{mPosY}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={mPosY}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCustomBlockModal((prev) => prev ? { ...prev, posY: val, aspectHeight: prev.aspectHeight || 420 } : null);
                            }}
                            className="w-full accent-amber-400"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                            <span>ইমেজ উচ্চতা (বড়/ছোট)</span>
                            <span>{mAspect ? `1600×${mAspect}` : 'অটো'}</span>
                          </div>
                          <input
                            type="range"
                            min={160}
                            max={900}
                            step={10}
                            value={mAspect || 420}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCustomBlockModal((prev) => prev ? { ...prev, aspectHeight: val } : null);
                            }}
                            className="w-full accent-amber-400"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center text-[10px] text-amber-300 font-bold mb-1 gap-1">
                            <span>জুম ({mZoom}%)</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setCustomBlockModal((prev) => prev ? { ...prev, zoom: Math.max(50, prev.zoom - 10) } : null)}
                                className="bg-purple-800/70 hover:bg-purple-700 text-white px-1 py-0.5 rounded inline-flex items-center"
                                title="জুম আউট"
                              >
                                <ZoomOut size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustomBlockModal((prev) => prev ? { ...prev, zoom: Math.min(250, prev.zoom + 10) } : null)}
                                className="bg-purple-800/70 hover:bg-purple-700 text-white px-1 py-0.5 rounded inline-flex items-center"
                                title="জুম ইন"
                              >
                                <ZoomIn size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustomBlockModal((prev) => prev ? { ...prev, posY: 50, aspectHeight: null, zoom: 100 } : null)}
                                className="text-cyan-300 hover:underline inline-flex items-center"
                                title="রিসেট"
                              >
                                <RotateCcw size={10} />
                              </button>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={50}
                            max={250}
                            value={mZoom}
                            onChange={(e) => setCustomBlockModal((prev) => prev ? { ...prev, zoom: Number(e.target.value) } : null)}
                            className="w-full accent-amber-400"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {customBlockModal.type === 'text-slab' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    হেডলাইন (বড় ও বোল্ড দেখাবে)
                  </label>
                  <input
                    type="text"
                    value={customBlockModal.headline}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, headline: e.target.value } : null)}
                    placeholder="শিরোনাম লিখুন..."
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-sm font-bold text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    নিচের বিস্তারিত টেক্সট (ছোট দেখাবে)
                  </label>
                  <textarea
                    rows={4}
                    value={customBlockModal.body}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, body: e.target.value } : null)}
                    placeholder="বিস্তারিত লেখা লিখুন..."
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1.5">
                    টেক্সট আলাইনমেন্ট নির্বাচন করুন
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'left', label: 'বাম', Icon: AlignLeft },
                        { id: 'center', label: 'মাঝখান', Icon: AlignCenter },
                        { id: 'right', label: 'ডান', Icon: AlignRight },
                        { id: 'justify', label: 'জাস্টিফাই', Icon: AlignJustify }
                      ] as const
                    ).map(({ id, label: aLabel, Icon }) => {
                      const active = customBlockModal.align === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCustomBlockModal(prev => prev ? { ...prev, align: id } : null)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1 border transition-all ${
                            active
                              ? 'bg-amber-500 text-black border-amber-400 shadow'
                              : 'bg-[#1b1b38] text-purple-200 border-purple-500/30 hover:bg-purple-900/40'
                          }`}
                        >
                          <Icon size={13} /> {aLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    লেখায় ক্লিক করলে যে লিংকে যাবে (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={customBlockModal.linkUrl}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, linkUrl: e.target.value } : null)}
                    placeholder="https://... (খালি রাখলে সাধারণ টেক্সট থাকবে)"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {customBlockModal.type === 'drive-image' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    গুগল ড্রাইভ ইমেজ লিংক দিন (প্রতি লাইনে একটি করে একাধিক লিংকও দিতে পারবেন):
                  </label>
                  <textarea
                    rows={3}
                    value={customBlockModal.driveInput}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, driveInput: e.target.value } : null)}
                    placeholder="https://drive.google.com/file/d/... লিংক পেস্ট করুন"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">
                    একটি ছবিতে ক্লিক করলে যে লিংকে যাবে (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={customBlockModal.linkUrl}
                    onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, linkUrl: e.target.value } : null)}
                    placeholder="https://... (খালি রাখলে ছবি বড় করে দেখাবে)"
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {(() => {
                  const previewImg = customBlockModal.driveInput.split(/\s+/).map((s) => s.trim()).find(Boolean);
                  const mPosY = customBlockModal.posY;
                  const mAspect = customBlockModal.aspectHeight;
                  const mZoom = customBlockModal.zoom;
                  const hasFrame = Boolean(mAspect || mPosY !== 50);
                  return (
                    <div className="bg-[#181833] border border-amber-400/40 rounded-xl p-3 space-y-2.5">
                      <div className="text-[11px] font-bold text-amber-300">ব্যানার স্টাইল ইমেজ অ্যাডজাস্টমেন্ট:</div>
                      {previewImg && (
                        hasFrame ? (
                          <div
                            className="w-full overflow-hidden rounded-2xl bg-[#101026] border border-purple-500/30"
                            style={{ aspectRatio: `1600 / ${mAspect || 420}` }}
                          >
                            <img
                              src={normalizeImageUrl(previewImg)}
                              alt="Drive Image Preview"
                              className="w-full h-full object-cover rounded-2xl block"
                              style={{
                                objectPosition: `50% ${mPosY}%`,
                                transform: mZoom !== 100 ? `scale(${mZoom / 100})` : undefined,
                                transformOrigin: mZoom < 100 ? '50% 50%' : `50% ${mPosY}%`
                              }}
                            />
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-2xl bg-[#101026] p-2 flex items-center justify-center border border-purple-500/30">
                            <img
                              src={normalizeImageUrl(previewImg)}
                              alt="Drive Image Preview"
                              className="w-auto max-w-full max-h-40 object-contain rounded-2xl block"
                              style={{
                                transform: mZoom !== 100 ? `scale(${mZoom / 100})` : undefined,
                                transformOrigin: '50% 50%'
                              }}
                            />
                          </div>
                        )
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                        <div>
                          <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                            <span>উপর-নিচ পজিশন</span>
                            <span>{mPosY}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={mPosY}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCustomBlockModal((prev) => prev ? { ...prev, posY: val, aspectHeight: prev.aspectHeight || 420 } : null);
                            }}
                            className="w-full accent-amber-400"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                            <span>ইমেজ উচ্চতা (বড়/ছোট)</span>
                            <span>{mAspect ? `1600×${mAspect}` : 'অটো'}</span>
                          </div>
                          <input
                            type="range"
                            min={160}
                            max={900}
                            step={10}
                            value={mAspect || 420}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCustomBlockModal((prev) => prev ? { ...prev, aspectHeight: val } : null);
                            }}
                            className="w-full accent-amber-400"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center text-[10px] text-amber-300 font-bold mb-1 gap-1">
                            <span>জুম ({mZoom}%)</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setCustomBlockModal((prev) => prev ? { ...prev, zoom: Math.max(50, prev.zoom - 10) } : null)}
                                className="bg-purple-800/70 hover:bg-purple-700 text-white px-1 py-0.5 rounded inline-flex items-center"
                                title="জুম আউট"
                              >
                                <ZoomOut size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustomBlockModal((prev) => prev ? { ...prev, zoom: Math.min(250, prev.zoom + 10) } : null)}
                                className="bg-purple-800/70 hover:bg-purple-700 text-white px-1 py-0.5 rounded inline-flex items-center"
                                title="জুম ইন"
                              >
                                <ZoomIn size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustomBlockModal((prev) => prev ? { ...prev, posY: 50, aspectHeight: null, zoom: 100 } : null)}
                                className="text-cyan-300 hover:underline inline-flex items-center"
                                title="রিসেট"
                              >
                                <RotateCcw size={10} />
                              </button>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={50}
                            max={250}
                            value={mZoom}
                            onChange={(e) => setCustomBlockModal((prev) => prev ? { ...prev, zoom: Number(e.target.value) } : null)}
                            className="w-full accent-amber-400"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-bold text-purple-200">
                      <span>ছবির প্রস্থ (Width)</span>
                      <span className="text-amber-300">{DRIVE_IMG_WIDTHS[customBlockModal.imageWidthIdx]?.label}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={DRIVE_IMG_WIDTHS.length - 1}
                      value={customBlockModal.imageWidthIdx}
                      onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, imageWidthIdx: Number(e.target.value) } : null)}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-bold text-purple-200">
                      <span>ছবির উচ্চতা (Height)</span>
                      <span className="text-amber-300">{DRIVE_IMG_HEIGHTS[customBlockModal.imageHeightIdx]?.label}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={DRIVE_IMG_HEIGHTS.length - 1}
                      value={customBlockModal.imageHeightIdx}
                      onChange={(e) => setCustomBlockModal(prev => prev ? { ...prev, imageHeightIdx: Number(e.target.value) } : null)}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>

                <div className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 space-y-2">
                  <span className="text-[11px] font-bold text-purple-200 block">টেক্সট স্ল্যাবের সাথে মার্জ অপশন:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomBlockModal(prev => prev ? { ...prev, mergeTop: !prev.mergeTop } : null)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 border transition-all ${
                        customBlockModal.mergeTop
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-[#101026] text-purple-200 border-purple-500/30 hover:bg-purple-900/40'
                      }`}
                    >
                      <Layers size={12} /> {customBlockModal.mergeTop ? 'উপরের টেক্সটের সাথে মার্জড ✓' : 'উপরের টেক্সটের সাথে মার্জ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomBlockModal(prev => prev ? { ...prev, mergeBottom: !prev.mergeBottom } : null)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 border transition-all ${
                        customBlockModal.mergeBottom
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-[#101026] text-purple-200 border-purple-500/30 hover:bg-purple-900/40'
                      }`}
                    >
                      <Layers size={12} /> {customBlockModal.mergeBottom ? 'নিচের টেক্সটের সাথে মার্জড ✓' : 'নিচের টেক্সটের সাথে মার্জ'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomBlockModal(null)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  const modal = customBlockModal;
                  let newBlock: CustomBlock | null = null;
                  const blockId = modal.mode === 'edit' && modal.blockId
                    ? modal.blockId
                    : `cb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

                  if (modal.type === 'video') {
                    const trimmed = modal.link.trim();
                    if (!trimmed) return;
                    newBlock = { id: blockId, type: 'video', link: trimmed };
                  } else if (modal.type === 'pdf') {
                    const trimmed = modal.link.trim();
                    if (!trimmed) return;
                    newBlock = {
                      id: blockId,
                      type: 'pdf',
                      pdfTitle: modal.pdfTitle.trim() || 'পিডিএফ ডকুমেন্ট',
                      link: trimmed,
                      pdfWidthIdx: modal.pdfWidthIdx,
                      pdfHeightIdx: modal.pdfHeightIdx,
                      pdfDownloadable: Boolean(modal.pdfDownloadable)
                    };
                  } else if (modal.type === 'html-code') {
                    const trimmed = modal.link.trim();
                    if (!trimmed) return;
                    newBlock = {
                      id: blockId,
                      type: 'html-code',
                      htmlTitle: modal.htmlTitle.trim(),
                      link: trimmed
                    };
                  } else if (modal.type === 'audio') {
                    const trimmed = modal.link.trim();
                    if (!trimmed) return;
                    newBlock = {
                      id: blockId,
                      type: 'audio',
                      audioTitle: modal.audioTitle.trim(),
                      link: trimmed
                    };
                  } else if (modal.type === 'video-slider') {
                    const cleaned = modal.slides.map(s => s.trim()).filter(Boolean);
                    if (cleaned.length === 0) return;
                    newBlock = {
                      id: blockId,
                      type: 'video-slider',
                      slides: cleaned,
                      sliderStyle: modal.sliderStyle || 'classic'
                    };
                  } else if (modal.type === 'image-slider') {
                    const cleaned = modal.slides.map(s => s.trim()).filter(Boolean);
                    if (cleaned.length === 0) return;
                    newBlock = {
                      id: blockId,
                      type: 'image-slider',
                      slides: cleaned,
                      posY: modal.posY,
                      aspectHeight: modal.aspectHeight,
                      zoom: modal.zoom,
                      sliderStyle: modal.sliderStyle || 'classic'
                    };
                  } else if (modal.type === 'text-slab') {
                    const h = modal.headline.trim();
                    const b = modal.body.trim();
                    if (!h && !b) return;
                    newBlock = {
                      id: blockId,
                      type: 'text-slab',
                      headline: h,
                      body: b,
                      align: modal.align || 'left',
                      linkUrl: modal.linkUrl.trim() || undefined
                    };
                  } else if (modal.type === 'drive-image') {
                    const imgs = modal.driveInput.split(/\s+/).map(s => s.trim()).filter(Boolean);
                    if (imgs.length === 0) return;
                    newBlock = {
                      id: blockId,
                      type: 'drive-image',
                      images: imgs,
                      linkUrl: modal.linkUrl.trim() || undefined,
                      imageWidthIdx: modal.imageWidthIdx,
                      imageHeightIdx: modal.imageHeightIdx,
                      mergeTop: modal.mergeTop,
                      mergeBottom: modal.mergeBottom,
                      posY: modal.posY,
                      aspectHeight: modal.aspectHeight,
                      zoom: modal.zoom
                    };
                  }

                  if (!newBlock) return;
                  const finalBlock = newBlock;
                  setSiteContent((prev: any) => {
                    const pageBlocks: CustomBlock[] = Array.isArray(prev.customBlocks?.[modal.pageId])
                      ? prev.customBlocks[modal.pageId]
                      : [];
                    const updatedBlocks = modal.mode === 'edit'
                      ? pageBlocks.map((b) => (b.id === finalBlock.id ? finalBlock : b))
                      : [...pageBlocks, finalBlock];
                    return {
                      ...prev,
                      customBlocks: {
                        ...(prev.customBlocks || {}),
                        [modal.pageId]: updatedBlocks
                      }
                    };
                  });
                  setCustomBlockModal(null);
                }}
                className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 hover:brightness-110"
              >
                <Save size={13} /> সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOK FOR MAGIC SHOW BUTTON EDIT MODAL (Admin Only) */}
      {isAdmin && magicBookModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Edit2 size={15} /> Book For Magic Show বাটন এডিট করুন
              </h3>
              <button type="button" onClick={() => setMagicBookModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-purple-200 block mb-1">
                  বাটনের ইমেজ লিংক (Google Drive / Image URL):
                </label>
                <input
                  type="text"
                  value={magicBookModal.imageUrl}
                  onChange={(e) => setMagicBookModal(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                  placeholder="https://drive.google.com/file/d/... বা ইমেজ লিংক"
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-purple-200 block mb-1">
                  বাটনে ক্লিক করলে যে লিংকে যাবে (Destination URL):
                </label>
                <input
                  type="text"
                  value={magicBookModal.linkUrl}
                  onChange={(e) => setMagicBookModal(prev => prev ? { ...prev, linkUrl: e.target.value } : null)}
                  placeholder="https://magicschoolofbangladesh.com/raj"
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMagicBookModal(null)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextImg = magicBookModal.imageUrl.trim() || DEFAULT_SITE_CONTENT.magicBookConfig.imageUrl;
                  const nextLink = magicBookModal.linkUrl.trim() || DEFAULT_SITE_CONTENT.magicBookConfig.linkUrl;
                  setSiteContent((prev: any) => ({
                    ...prev,
                    magicBookConfig: {
                      visible: true,
                      imageUrl: nextImg,
                      linkUrl: nextLink
                    }
                  }));
                  setMagicBookModal(null);
                }}
                className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 hover:brightness-110"
              >
                <Save size={13} /> সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB EDITOR & ADD NEW TAB MODAL (Admin Only - All 3 Tab Types) */}
      {isAdmin && showTabManagerModal && (() => {
        const selectableInnerPages: { id: string; title: string }[] = Array.from(
          new Map(
            [
              ...pagesData.map((p) => ({ id: p.id, title: p.title })),
              ...(siteContent.homeFeatureTabs || []).map((t: any) => ({
                id: t.id,
                title: subpageInfoMap[t.id]?.title || t.label
              })),
              ...(siteContent.topNavTabs || [])
                .filter((t: any) => t.id !== 'home' && !pagesData.some((p) => p.id === t.id))
                .map((t: any) => ({
                  id: t.id,
                  title: subpageInfoMap[t.id]?.title || t.label
                })),
              ...(siteContent.customSubPages || []).map((sp: any) => ({
                id: sp.id,
                title: subpageInfoMap[sp.id]?.title || sp.title
              }))
            ].map((p) => [p.id, p])
          ).values()
        );
        const existingInnerTabs: { id: string; label: string; iconUrl: string }[] = Array.isArray(
          siteContent.pageInnerTabs?.[innerTabTargetPage]
        )
          ? siteContent.pageInnerTabs[innerTabTargetPage]
          : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <Edit2 size={16} /> ট্যাব এডিট ও নতুন ট্যাব ম্যানেজার
                </h3>
                <button onClick={() => setShowTabManagerModal(false)} className="text-gray-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Section A: Top Tabs */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-purple-200 border-b border-purple-500/25 pb-1">
                  উপরের ট্যাব সমূহ (এডিট ও ডিলিট করুন)
                </h4>
                <div className="space-y-2">
                  {(siteContent.topNavTabs || []).map((tab: any, idx: number) => (
                    <div key={tab.id} className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row items-center gap-2">
                      <img
                        src={normalizeImageUrl(tab.iconUrl)}
                        alt={tab.label}
                        className="w-9 h-9 object-contain rounded-lg bg-black/40 p-1 shrink-0"
                      />
                      <input
                        type="text"
                        value={tab.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSiteContent((prev: any) => ({
                            ...prev,
                            topNavTabs: (prev.topNavTabs || []).map((t: any, i: number) =>
                              i === idx ? { ...t, label: val } : t
                            )
                          }));
                        }}
                        placeholder="ট্যাবের নাম"
                        className="w-full sm:w-32 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                      <input
                        type="text"
                        value={tab.iconUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSiteContent((prev: any) => ({
                            ...prev,
                            topNavTabs: (prev.topNavTabs || []).map((t: any, i: number) =>
                              i === idx ? { ...t, iconUrl: val } : t
                            )
                          }));
                        }}
                        placeholder="আইকন ড্রাইভ বা ইমেজ লিংক"
                        className="w-full flex-1 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                      {tab.id !== 'home' && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModal({
                              message: `"${tab.label || tab.id}" ট্যাবটি ডিলিট করতে চান?`,
                              onConfirm: () => {
                                const sysTabKey = `sys_tab_${tab.id}`;
                                setSiteContent((prev: any) => {
                                  const curDel: string[] = Array.isArray(prev.deletedSystemBlockIds) ? prev.deletedSystemBlockIds : [];
                                  return {
                                    ...prev,
                                    topNavTabs: (prev.topNavTabs || []).filter((_: any, i: number) => i !== idx),
                                    deletedSystemBlockIds: curDel.includes(sysTabKey) ? curDel : [...curDel, sysTabKey]
                                  };
                                });
                              }
                            });
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shrink-0"
                          title="ডিলিট করুন"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section B: Certificate / Feature Tabs */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-purple-200 border-b border-purple-500/25 pb-1">
                  সার্টিফিকেট ট্যাবের পাশের ট্যাব সমূহ (এডিট ও ডিলিট করুন)
                </h4>
                <div className="space-y-2">
                  {(siteContent.homeFeatureTabs || []).map((tab: any, idx: number) => (
                    <div key={tab.id} className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row items-center gap-2">
                      <img
                        src={normalizeImageUrl(tab.iconUrl)}
                        alt={tab.label}
                        className="w-9 h-9 object-contain rounded-lg bg-black/40 p-1 shrink-0"
                      />
                      <input
                        type="text"
                        value={tab.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSiteContent((prev: any) => ({
                            ...prev,
                            homeFeatureTabs: (prev.homeFeatureTabs || []).map((t: any, i: number) =>
                              i === idx ? { ...t, label: val } : t
                            )
                          }));
                        }}
                        placeholder="ট্যাবের নাম"
                        className="w-full sm:w-32 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                      <input
                        type="text"
                        value={tab.iconUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSiteContent((prev: any) => ({
                            ...prev,
                            homeFeatureTabs: (prev.homeFeatureTabs || []).map((t: any, i: number) =>
                              i === idx ? { ...t, iconUrl: val } : t
                            )
                          }));
                        }}
                        placeholder="আইকন ড্রাইভ বা ইমেজ লিংক"
                        className="w-full flex-1 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModal({
                            message: `"${tab.label || tab.id}" ট্যাবটি ডিলিট করতে চান?`,
                            onConfirm: () => {
                              const sysTabKey = `sys_tab_${tab.id}`;
                              setSiteContent((prev: any) => {
                                const curDel: string[] = Array.isArray(prev.deletedSystemBlockIds) ? prev.deletedSystemBlockIds : [];
                                return {
                                  ...prev,
                                  homeFeatureTabs: (prev.homeFeatureTabs || []).filter((_: any, i: number) => i !== idx),
                                  deletedSystemBlockIds: curDel.includes(sysTabKey) ? curDel : [...curDel, sysTabKey]
                                };
                              });
                            }
                          });
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shrink-0"
                        title="ডিলিট করুন"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section C: Inner Page Tabs */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/25 pb-1.5">
                  <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Layers size={13} /> পেজের ভিতরের ট্যাব সমূহ (এডিট ও ডিলিট করুন)
                  </h4>
                  <select
                    value={innerTabTargetPage}
                    onChange={(e) => setInnerTabTargetPage(e.target.value)}
                    className="bg-[#181833] border border-purple-500/40 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-400"
                  >
                    {selectableInnerPages.map((pg) => (
                      <option key={pg.id} value={pg.id}>
                        {pg.title}
                      </option>
                    ))}
                  </select>
                </div>

                {existingInnerTabs.length === 0 ? (
                  <p className="text-xs text-purple-300/60 bg-[#181833]/60 border border-purple-500/20 rounded-xl p-3 text-center">
                    নির্বাচিত পেজে এখনো কোনো ভিতরের ট্যাব নেই। নিচ থেকে যোগ করতে পারেন।
                  </p>
                ) : (
                  <div className="space-y-2">
                    {existingInnerTabs.map((tab, idx) => (
                      <div key={tab.id} className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row items-center gap-2">
                        <img
                          src={normalizeImageUrl(tab.iconUrl)}
                          alt={tab.label || 'Tab'}
                          className="w-9 h-9 object-contain rounded-lg bg-black/40 p-1 shrink-0"
                        />
                        <input
                          type="text"
                          value={tab.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSiteContent((prev: any) => ({
                              ...prev,
                              pageInnerTabs: {
                                ...(prev.pageInnerTabs || {}),
                                [innerTabTargetPage]: (prev.pageInnerTabs?.[innerTabTargetPage] || []).map(
                                  (t: any, i: number) => (i === idx ? { ...t, label: val } : t)
                                )
                              }
                            }));
                          }}
                          placeholder="ট্যাবের নাম"
                          className="w-full sm:w-28 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <input
                          type="text"
                          value={tab.iconUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSiteContent((prev: any) => ({
                              ...prev,
                              pageInnerTabs: {
                                ...(prev.pageInnerTabs || {}),
                                [innerTabTargetPage]: (prev.pageInnerTabs?.[innerTabTargetPage] || []).map(
                                  (t: any, i: number) => (i === idx ? { ...t, iconUrl: val } : t)
                                )
                              }
                            }));
                          }}
                          placeholder="আইকন ড্রাইভ বা ইমেজ লিংক"
                          className="w-full flex-1 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setShowTabManagerModal(false);
                              handlePageChange(tab.id);
                            }}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                            title="ট্যাব পেজ খুলুন"
                          >
                            খুলুন
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmModal({
                                message: `"${tab.label || 'এই'}" ভিতরের ট্যাবটি ডিলিট করতে চান?`,
                                onConfirm: () => {
                                  const sysInnerKey = `sys_inner_${tab.id}`;
                                  setSiteContent((prev: any) => {
                                    const curDel: string[] = Array.isArray(prev.deletedSystemBlockIds) ? prev.deletedSystemBlockIds : [];
                                    return {
                                      ...prev,
                                      pageInnerTabs: {
                                        ...(prev.pageInnerTabs || {}),
                                        [innerTabTargetPage]: (prev.pageInnerTabs?.[innerTabTargetPage] || []).filter(
                                          (_: any, i: number) => i !== idx
                                        )
                                      },
                                      deletedSystemBlockIds: curDel.includes(sysInnerKey) ? curDel : [...curDel, sysInnerKey]
                                    };
                                  });
                                }
                              });
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                            title="ডিলিট করুন"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section D: Add New Tab (All 3 Targets) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const lbl = newTabLabel.trim();
                  if (!lbl && !newTabIconUrl.trim()) return;
                  if (newTabTarget === 'inner') {
                    const icon = newTabIconUrl.trim() || '/assets/aistudio/2x2_Logo_22e89a61.png';
                    const newId = `inner_tab_${Date.now()}`;
                    const newTabObj = { id: newId, label: lbl, iconUrl: icon };
                    setSiteContent((prev: any) => ({
                      ...prev,
                      pageInnerTabs: {
                        ...(prev.pageInnerTabs || {}),
                        [innerTabTargetPage]: [...(prev.pageInnerTabs?.[innerTabTargetPage] || []), newTabObj]
                      },
                      pageBanners: { ...(prev.pageBanners || {}), [newId]: '' },
                      subpageInfo: {
                        ...(prev.subpageInfo || {}),
                        [newId]: { title: lbl || 'নতুন ট্যাব', category: lbl || 'ট্যাব', desc: '' }
                      }
                    }));
                  } else {
                    if (!lbl) return;
                    const icon = newTabIconUrl.trim() || '/assets/certificate-logo.svg';
                    const newId = `custom_tab_${Date.now()}`;
                    const newTabObj = { id: newId, label: lbl, iconUrl: icon, isCustom: true };
                    setSiteContent((prev: any) => ({
                      ...prev,
                      topNavTabs: newTabTarget === 'top' ? [...(prev.topNavTabs || []), newTabObj] : prev.topNavTabs,
                      homeFeatureTabs: newTabTarget === 'feature' ? [...(prev.homeFeatureTabs || []), newTabObj] : prev.homeFeatureTabs,
                      pageBanners: { ...(prev.pageBanners || {}), [newId]: '' },
                      subpageInfo: {
                        ...(prev.subpageInfo || {}),
                        [newId]: { title: lbl, category: lbl, desc: '' }
                      }
                    }));
                  }
                  setNewTabLabel('');
                  setNewTabIconUrl('');
                }}
                className="bg-[#181833] border border-amber-500/40 rounded-xl p-4 space-y-3"
              >
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <PlusCircle size={14} /> নতুন ট্যাব যোগ করুন
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTabTarget('top')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      newTabTarget === 'top'
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-[#101026] text-purple-200 border-purple-500/30'
                    }`}
                  >
                    উপরে (টপ বারে)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTabTarget('feature')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      newTabTarget === 'feature'
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-[#101026] text-purple-200 border-purple-500/30'
                    }`}
                  >
                    সার্টিফিকেট ট্যাবের পাশে
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTabTarget('inner')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      newTabTarget === 'inner'
                        ? 'bg-cyan-400 text-black border-cyan-300'
                        : 'bg-[#101026] text-purple-200 border-purple-500/30'
                    }`}
                  >
                    পেজের ভিতরে (Inner Tab)
                  </button>
                </div>
                {newTabTarget === 'inner' && (
                  <div>
                    <label className="text-[11px] text-purple-300 block mb-1">কোন পেজের ভিতরে যোগ হবে?</label>
                    <select
                      value={innerTabTargetPage}
                      onChange={(e) => setInnerTabTargetPage(e.target.value)}
                      className="w-full bg-[#101026] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      {selectableInnerPages.map((pg) => (
                        <option key={pg.id} value={pg.id}>
                          {pg.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={newTabLabel}
                    onChange={(e) => setNewTabLabel(e.target.value)}
                    placeholder="নতুন ট্যাবের নাম লিখুন..."
                    className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    required={newTabTarget !== 'inner'}
                  />
                  <input
                    type="text"
                    value={newTabIconUrl}
                    onChange={(e) => setNewTabIconUrl(e.target.value)}
                    placeholder="আইকন ড্রাইভ বা ইমেজ লিংক..."
                    className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 hover:brightness-110"
                >
                  <PlusCircle size={14} /> ট্যাব যোগ করুন
                </button>
              </form>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowTabManagerModal(false)}
                  className="bg-amber-500 text-black font-bold text-xs px-5 py-2 rounded-xl"
                >
                  সম্পন্ন
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* INNER PAGE TAB MANAGER MODAL (Admin Only) */}
      {isAdmin && showInnerTabModal && (() => {
        const selectablePages: { id: string; title: string }[] = [
          ...pagesData.map((p) => ({ id: p.id, title: p.title })),
          ...(siteContent.homeFeatureTabs || []).map((t: any) => ({
            id: t.id,
            title: subpageInfoMap[t.id]?.title || t.label
          })),
          ...(siteContent.topNavTabs || [])
            .filter((t: any) => t.id !== 'home' && !pagesData.some((p) => p.id === t.id))
            .map((t: any) => ({
              id: t.id,
              title: subpageInfoMap[t.id]?.title || t.label
            })),
          ...(siteContent.customSubPages || []).map((sp: any) => ({
            id: sp.id,
            title: subpageInfoMap[sp.id]?.title || sp.title
          }))
        ];
        const uniqueSelectablePages = Array.from(
          new Map(selectablePages.map((p) => [p.id, p])).values()
        ).filter((p) => !isSubCloneMode || !activeSubClone || p.id === activeSubClone.targetTabId);
        const existingInnerTabs: { id: string; label: string; iconUrl: string }[] = Array.isArray(
          siteContent.pageInnerTabs?.[innerTabTargetPage]
        )
          ? siteContent.pageInnerTabs[innerTabTargetPage]
          : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <Layers size={16} className="text-cyan-400" /> পেজের ভিতরে ট্যাব যোগ ও এডিট
                </h3>
                <button onClick={() => setShowInnerTabModal(false)} className="text-gray-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Select Target Page */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-purple-200 block">
                  কোন পেজের ভিতরে ট্যাব যোগ/এডিট করবেন?
                </label>
                <select
                  value={innerTabTargetPage}
                  onChange={(e) => setInnerTabTargetPage(e.target.value)}
                  className="w-full bg-[#181833] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {uniqueSelectablePages.map((pg) => (
                    <option key={pg.id} value={pg.id}>
                      {pg.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Existing Inner Tabs on Selected Page */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-purple-200 border-b border-purple-500/25 pb-1">
                  এই পেজের বর্তমান ট্যাব সমূহ ({existingInnerTabs.length}টি)
                </h4>
                {existingInnerTabs.length === 0 ? (
                  <p className="text-xs text-purple-300/60 bg-[#181833]/60 border border-purple-500/20 rounded-xl p-3 text-center">
                    এই পেজে এখনো কোনো ভিতরের ট্যাব যোগ করা হয়নি।
                  </p>
                ) : (
                  <div className="space-y-2">
                    {existingInnerTabs.map((tab, idx) => (
                      <div key={tab.id} className="bg-[#181833] border border-purple-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row items-center gap-2">
                        <img
                          src={normalizeImageUrl(tab.iconUrl)}
                          alt={tab.label || 'Tab'}
                          className="w-9 h-9 object-contain rounded-lg bg-black/40 p-1 shrink-0"
                        />
                        <input
                          type="text"
                          value={tab.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSiteContent((prev: any) => ({
                              ...prev,
                              pageInnerTabs: {
                                ...(prev.pageInnerTabs || {}),
                                [innerTabTargetPage]: (prev.pageInnerTabs?.[innerTabTargetPage] || []).map(
                                  (t: any, i: number) => (i === idx ? { ...t, label: val } : t)
                                )
                              }
                            }));
                          }}
                          placeholder="ট্যাবের নাম (ঐচ্ছিক)"
                          className="w-full sm:w-28 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <input
                          type="text"
                          value={tab.iconUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSiteContent((prev: any) => ({
                              ...prev,
                              pageInnerTabs: {
                                ...(prev.pageInnerTabs || {}),
                                [innerTabTargetPage]: (prev.pageInnerTabs?.[innerTabTargetPage] || []).map(
                                  (t: any, i: number) => (i === idx ? { ...t, iconUrl: val } : t)
                                )
                              }
                            }));
                          }}
                          placeholder="আইকন ড্রাইভ বা ইমেজ লিংক"
                          className="w-full flex-1 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setShowInnerTabModal(false);
                              handlePageChange(tab.id);
                            }}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                            title="ট্যাব পেজ খুলুন (ব্যানার ও কনটেন্ট যোগ করতে)"
                          >
                            খুলুন
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const sysInnerKey = `sys_inner_${tab.id}`;
                              setSiteContent((prev: any) => {
                                const curDel: string[] = Array.isArray(prev.deletedSystemBlockIds) ? prev.deletedSystemBlockIds : [];
                                return {
                                  ...prev,
                                  pageInnerTabs: {
                                    ...(prev.pageInnerTabs || {}),
                                    [innerTabTargetPage]: (prev.pageInnerTabs?.[innerTabTargetPage] || []).filter(
                                      (_: any, i: number) => i !== idx
                                    )
                                  },
                                  deletedSystemBlockIds: curDel.includes(sysInnerKey) ? curDel : [...curDel, sysInnerKey]
                                };
                              });
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                            title="ডিলিট করুন"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Inner Tab Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const lbl = innerTabLabelInput.trim();
                  const icon = innerTabIconInput.trim() || '/assets/aistudio/2x2_Logo_22e89a61.png';
                  if (!lbl && !innerTabIconInput.trim()) return;
                  const newId = `inner_tab_${Date.now()}`;
                  const newTabObj = { id: newId, label: lbl, iconUrl: icon };
                  setSiteContent((prev: any) => ({
                    ...prev,
                    pageInnerTabs: {
                      ...(prev.pageInnerTabs || {}),
                      [innerTabTargetPage]: [...(prev.pageInnerTabs?.[innerTabTargetPage] || []), newTabObj]
                    },
                    pageBanners: { ...(prev.pageBanners || {}), [newId]: '' },
                    subpageInfo: {
                      ...(prev.subpageInfo || {}),
                      [newId]: { title: lbl || 'নতুন ট্যাব', category: lbl || 'ট্যাব', desc: '' }
                    }
                  }));
                  setInnerTabLabelInput('');
                  setInnerTabIconInput('');
                }}
                className="bg-[#181833] border border-amber-500/40 rounded-xl p-4 space-y-3"
              >
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <PlusCircle size={14} /> এই পেজে নতুন ট্যাব যোগ করুন
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={innerTabLabelInput}
                    onChange={(e) => setInnerTabLabelInput(e.target.value)}
                    placeholder="ট্যাবের নাম (ঐচ্ছিক, যেমন: 3x3, পার্ট ২)"
                    className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={innerTabIconInput}
                    onChange={(e) => setInnerTabIconInput(e.target.value)}
                    placeholder="আইকন ড্রাইভ বা ইমেজ লিংক..."
                    className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <p className="text-[11px] text-purple-300/75 leading-relaxed">
                  নতুন ট্যাবটি হোম ব্যাক বাটনের পাশে এক লাইনে দেখাবে এবং ট্যাবে ক্লিক করলে উপরে ব্যানার ইমেজ দেওয়ার অপশন থাকবে।
                </p>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 hover:brightness-110"
                >
                  <PlusCircle size={14} /> ট্যাব যোগ করুন
                </button>
              </form>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowInnerTabModal(false)}
                  className="bg-amber-500 text-black font-bold text-xs px-5 py-2 rounded-xl"
                >
                  সম্পন্ন
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SOCIAL MEDIA LINKS EDITOR MODAL (Admin Only) */}
      {isAdmin && showSocialLinksModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <ExternalLink size={16} /> সোশ্যাল মিডিয়া লিংক এডিট করুন
              </h3>
              <button onClick={() => setShowSocialLinksModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {socialLinksDraft.map((soc, idx) => (
                <div key={soc.id} className="space-y-1">
                  <label className="text-xs font-bold text-purple-200 block">{soc.name} লিংক</label>
                  <input
                    type="text"
                    value={soc.url}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSocialLinksDraft((prev) => prev.map((item, i) => (i === idx ? { ...item, url: val } : item)));
                    }}
                    placeholder="https://..."
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSocialLinksModal(false)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  setSiteContent((prev: any) => ({
                    ...prev,
                    socialLinks: (prev.socialLinks || []).map((s: any) => {
                      const found = socialLinksDraft.find((d) => d.id === s.id);
                      return found ? { ...s, url: found.url.trim() || s.url } : s;
                    })
                  }));
                  setShowSocialLinksModal(false);
                }}
                className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <Save size={13} /> সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER EDITOR MODAL (Admin Only) */}
      {isAdmin && showFooterEditModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Edit2 size={16} /> ফুটারের লেখা ও লিংক এডিট করুন
              </h3>
              <button onClick={() => setShowFooterEditModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSiteContent((prev: any) => ({
                  ...prev,
                  footerLine1: footerDraft.line1,
                  footerSiteLabel: footerDraft.siteLabel,
                  footerSiteLinkText: footerDraft.linkText,
                  footerSiteUrl: footerDraft.linkUrl
                }));
                setShowFooterEditModal(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">প্রথম লাইন (কপিরাইট লেখা)</label>
                <input
                  type="text"
                  value={footerDraft.line1}
                  onChange={(e) => setFooterDraft((prev) => ({ ...prev, line1: e.target.value }))}
                  placeholder="© শাহানী রাজীব (Shahani Rajib) • সর্বস্বত্ব সংরক্ষিত"
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">দ্বিতীয় লাইনের শুরুর লেখা</label>
                <input
                  type="text"
                  value={footerDraft.siteLabel}
                  onChange={(e) => setFooterDraft((prev) => ({ ...prev, siteLabel: e.target.value }))}
                  placeholder="আসল গুগল সাইট:"
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">লিংকের প্রদর্শিত নাম</label>
                <input
                  type="text"
                  value={footerDraft.linkText}
                  onChange={(e) => setFooterDraft((prev) => ({ ...prev, linkText: e.target.value }))}
                  placeholder="sites.google.com/view/shahani9"
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">লিংক URL (ক্লিক করলে যেখানে যাবে)</label>
                <input
                  type="text"
                  value={footerDraft.linkUrl}
                  onChange={(e) => setFooterDraft((prev) => ({ ...prev, linkUrl: e.target.value }))}
                  placeholder="https://sites.google.com/view/shahani9/home"
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFooterEditModal(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Save size={13} /> সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APP COLOR THEME MODAL (Admin Only) */}
      {isAdmin && showThemeModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-xl w-full max-h-[88vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Palette size={16} /> থিম চেঞ্জ করুন
              </h3>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Ready Presets */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-purple-200 border-b border-purple-500/25 pb-1">
                রেডিমেড থিম (এক ক্লিকে পরিবর্তন করুন)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {APP_THEME_PRESETS.map((p) => {
                  const selected = themeDraft.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setThemeDraft({ ...p.theme })}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
                        selected
                          ? 'border-amber-400 bg-purple-900/40 ring-1 ring-amber-400'
                          : 'border-purple-500/30 bg-[#181833] hover:border-amber-400/50'
                      }`}
                    >
                      <span className="text-xs font-bold text-white truncate">{p.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {p.swatchCls.map((cls, sIdx) => (
                          <span key={sIdx} className={`w-4 h-4 rounded-full border border-white/30 ${cls}`} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="space-y-2.5 bg-[#181833] border border-purple-500/30 rounded-xl p-4">
              <h4 className="text-xs font-bold text-amber-300">
                কাস্টম কালার বেছে নিন (লাইভ প্রিভিউ)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: 'bgColor', label: 'মূল ব্যাকগ্রাউন্ড' },
                  { key: 'surfaceColor', label: 'কার্ড ও বক্স' },
                  { key: 'headerColor', label: 'হেডার ও মেনু' },
                  { key: 'accentColor', label: 'মূল অ্যাকসেন্ট / বাটন' },
                  { key: 'secondaryColor', label: 'বর্ডার ও থিম হাইলাইট' },
                  { key: 'textColor', label: 'লেখার কালার' }
                ].map((field) => (
                  <label key={field.key} className="bg-[#101026] border border-purple-500/30 rounded-xl p-2.5 flex items-center justify-between gap-2 cursor-pointer">
                    <div>
                      <span className="text-[11px] font-bold text-purple-200 block">{field.label}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{(themeDraft as any)[field.key]}</span>
                    </div>
                    <input
                      type="color"
                      value={(themeDraft as any)[field.key]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setThemeDraft((prev) => ({
                          ...prev,
                          preset: 'custom',
                          [field.key]: val
                        }));
                      }}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setThemeDraft({ ...DEFAULT_APP_THEME })}
                className="bg-white/10 hover:bg-white/20 text-purple-200 text-xs px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5"
              >
                <RotateCcw size={13} /> ডিফল্ট কালার রিসেট
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowThemeModal(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSiteContent((prev: any) => ({ ...prev, appTheme: { ...themeDraft } }));
                    setShowThemeModal(false);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Save size={13} /> কালার সংরক্ষণ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE ADD & EDIT MANAGER MODAL (Admin Only) */}
      {isAdmin && showSubPageManagerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <LayoutGrid size={16} /> সাব-পেজ যোগ ও এডিট করুন
              </h3>
              <button onClick={() => setShowSubPageManagerModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Section 1: Add New Sub-page */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const title = newSubPageForm.title.trim();
                if (!title) return;
                const category = newSubPageForm.category.trim() || title;
                const desc = newSubPageForm.desc.trim();
                const bannerUrl = newSubPageForm.bannerUrl.trim();
                const newId = `custom_page_${Date.now()}`;
                const icon = newSubPageForm.iconUrl.trim() || '/assets/certificate-logo.svg';

                setSiteContent((prev: any) => {
                  const nextCustomPages = [
                    ...(Array.isArray(prev.customSubPages) ? prev.customSubPages : []),
                    {
                      id: newId,
                      title,
                      category,
                      desc,
                      showInHomeGrid: newSubPageForm.showInHomeGrid,
                      showInMenu: newSubPageForm.showInMenu
                    }
                  ];
                  let nextTopTabs = prev.topNavTabs || [];
                  let nextFeatureTabs = prev.homeFeatureTabs || [];
                  if (newSubPageForm.placement === 'top') {
                    nextTopTabs = [...nextTopTabs, { id: newId, label: title, iconUrl: icon, isCustom: true }];
                  } else if (newSubPageForm.placement === 'feature') {
                    nextFeatureTabs = [...nextFeatureTabs, { id: newId, label: title, iconUrl: icon, isCustom: true }];
                  }
                  return {
                    ...prev,
                    customSubPages: nextCustomPages,
                    topNavTabs: nextTopTabs,
                    homeFeatureTabs: nextFeatureTabs,
                    pageBanners: { ...(prev.pageBanners || {}), [newId]: bannerUrl },
                    subpageInfo: {
                      ...(prev.subpageInfo || {}),
                      [newId]: { title, category, desc }
                    }
                  };
                });

                setNewSubPageForm({
                  title: '',
                  category: '',
                  desc: '',
                  bannerUrl: '',
                  showInHomeGrid: true,
                  showInMenu: true,
                  placement: 'none',
                  iconUrl: ''
                });
                setShowSubPageManagerModal(false);
                handlePageChange(newId);
              }}
              className="bg-[#181833] border border-amber-500/40 rounded-xl p-4 space-y-3"
            >
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <PlusCircle size={14} /> নতুন সাব-পেজ তৈরি করুন
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={newSubPageForm.title}
                  onChange={(e) => setNewSubPageForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="সাব-পেজের নাম / শিরোনাম *"
                  className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
                <input
                  type="text"
                  value={newSubPageForm.category}
                  onChange={(e) => setNewSubPageForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="ক্যাটাগরি / ব্যাজ (ঐচ্ছিক)"
                  className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <textarea
                rows={2}
                value={newSubPageForm.desc}
                onChange={(e) => setNewSubPageForm((prev) => ({ ...prev, desc: e.target.value }))}
                placeholder="সাব-পেজের সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)..."
                className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
              />
              <input
                type="text"
                value={newSubPageForm.bannerUrl}
                onChange={(e) => setNewSubPageForm((prev) => ({ ...prev, bannerUrl: e.target.value }))}
                placeholder="ব্যানার ইমেজ / ড্রাইভ লিংক (ঐচ্ছিক)"
                className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <div className="flex flex-wrap gap-3 text-xs text-purple-200 pt-1">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSubPageForm.showInHomeGrid}
                    onChange={(e) => setNewSubPageForm((prev) => ({ ...prev, showInHomeGrid: e.target.checked }))}
                    className="accent-amber-500"
                  />
                  <span>হোম পেজে কার্ড দেখান</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSubPageForm.showInMenu}
                    onChange={(e) => setNewSubPageForm((prev) => ({ ...prev, showInMenu: e.target.checked }))}
                    className="accent-amber-500"
                  />
                  <span>মেনু বারে দেখান</span>
                </label>
              </div>
              <div className="space-y-2 pt-1">
                <span className="text-[11px] text-purple-300 block">ঐচ্ছিক: কোনো ট্যাবের সাথে যুক্ত করতে চাইলে বেছে নিন</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'none', label: 'শুধু সাব-পেজ' },
                    { id: 'top', label: 'উপরে (টপ বারে)' },
                    { id: 'feature', label: 'সার্টিফিকেট ট্যাবের পাশে' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewSubPageForm((prev) => ({ ...prev, placement: opt.id as any }))}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold border ${
                        newSubPageForm.placement === opt.id
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-[#101026] text-purple-200 border-purple-500/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {newSubPageForm.placement !== 'none' && (
                  <input
                    type="text"
                    value={newSubPageForm.iconUrl}
                    onChange={(e) => setNewSubPageForm((prev) => ({ ...prev, iconUrl: e.target.value }))}
                    placeholder="ট্যাব আইকন ড্রাইভ বা ইমেজ লিংক..."
                    className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                )}
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 hover:brightness-110"
              >
                <PlusCircle size={14} /> সাব-পেজ তৈরি করুন ও খুলুন
              </button>
            </form>

            {/* Section 2: Existing & Custom Sub-pages Editor */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-purple-200 border-b border-purple-500/25 pb-1">
                সকল সাব-পেজ তালিকা (শিরোনাম, ক্যাটাগরি ও বিবরণ এডিট করুন)
              </h4>
              <div className="space-y-2">
                {allSubPages.map((pg) => {
                  const isCustomSub = pg.id.startsWith('custom_page_');
                  const customRecord = isCustomSub
                    ? (siteContent.customSubPages || []).find((sp: any) => sp.id === pg.id)
                    : null;
                  const isEditingThis = editingSubPageId === pg.id;

                  return (
                    <div key={pg.id} className="bg-[#181833] border border-purple-500/30 rounded-xl p-3 space-y-2">
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editingSubPageDraft.title}
                              onChange={(e) => setEditingSubPageDraft((prev) => ({ ...prev, title: e.target.value }))}
                              placeholder="সাব-পেজের শিরোনাম"
                              className="w-full bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                            />
                            <input
                              type="text"
                              value={editingSubPageDraft.category}
                              onChange={(e) => setEditingSubPageDraft((prev) => ({ ...prev, category: e.target.value }))}
                              placeholder="ক্যাটাগরি"
                              className="w-full bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={editingSubPageDraft.desc}
                            onChange={(e) => setEditingSubPageDraft((prev) => ({ ...prev, desc: e.target.value }))}
                            placeholder="বিবরণ"
                            className="w-full bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingSubPageId(null)}
                              className="bg-white/10 text-gray-200 text-[11px] px-3 py-1 rounded-lg"
                            >
                              বাতিল
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSiteContent((prev: any) => ({
                                  ...prev,
                                  subpageInfo: {
                                    ...(prev.subpageInfo || {}),
                                    [pg.id]: {
                                      title: editingSubPageDraft.title.trim() || pg.title,
                                      category: editingSubPageDraft.category.trim() || pg.category,
                                      desc: editingSubPageDraft.desc
                                    }
                                  },
                                  customSubPages: isCustomSub
                                    ? (prev.customSubPages || []).map((sp: any) =>
                                        sp.id === pg.id
                                          ? {
                                              ...sp,
                                              title: editingSubPageDraft.title.trim() || sp.title,
                                              category: editingSubPageDraft.category.trim() || sp.category,
                                              desc: editingSubPageDraft.desc
                                            }
                                          : sp
                                      )
                                    : prev.customSubPages
                                }));
                                setEditingSubPageId(null);
                              }}
                              className="bg-amber-500 text-black font-bold text-[11px] px-3 py-1 rounded-lg inline-flex items-center gap-1"
                            >
                              <Save size={11} /> সেভ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white">{pg.title}</span>
                              <span className="text-[10px] bg-purple-900/50 text-amber-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                                {pg.category}
                              </span>
                            </div>
                            {pg.desc && (
                              <p className="text-[11px] text-purple-200/70 line-clamp-1 mt-0.5">{pg.desc}</p>
                            )}
                            {isCustomSub && customRecord && (
                              <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-purple-200">
                                <label className="inline-flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customRecord.showInHomeGrid !== false}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSiteContent((prev: any) => ({
                                        ...prev,
                                        customSubPages: (prev.customSubPages || []).map((sp: any) =>
                                          sp.id === pg.id ? { ...sp, showInHomeGrid: checked } : sp
                                        )
                                      }));
                                    }}
                                    className="accent-amber-500"
                                  />
                                  <span>হোম কার্ড</span>
                                </label>
                                <label className="inline-flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!customRecord.showInMenu}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSiteContent((prev: any) => ({
                                        ...prev,
                                        customSubPages: (prev.customSubPages || []).map((sp: any) =>
                                          sp.id === pg.id ? { ...sp, showInMenu: checked } : sp
                                        )
                                      }));
                                    }}
                                    className="accent-amber-500"
                                  />
                                  <span>মেনুতে দেখান</span>
                                </label>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setShowSubPageManagerModal(false);
                                handlePageChange(pg.id);
                              }}
                              className="bg-purple-700 hover:bg-purple-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold"
                            >
                              পেজে যান
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubPageId(pg.id);
                                setEditingSubPageDraft({
                                  title: pg.title,
                                  category: pg.category,
                                  desc: pg.desc
                                });
                              }}
                              className="bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              <Edit2 size={10} /> এডিট
                            </button>
                            {isCustomSub && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmModal({
                                    message: `"${pg.title}" সাব-পেজটি ডিলিট করতে চান?`,
                                    onConfirm: () => {
                                      setSiteContent((prev: any) => ({
                                        ...prev,
                                        customSubPages: (prev.customSubPages || []).filter((sp: any) => sp.id !== pg.id),
                                        topNavTabs: (prev.topNavTabs || []).filter((t: any) => t.id !== pg.id),
                                        homeFeatureTabs: (prev.homeFeatureTabs || []).filter((t: any) => t.id !== pg.id)
                                      }));
                                      if (currentPage === pg.id) {
                                        handlePageChange('home');
                                      }
                                    }
                                  });
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold"
                                title="ডিলিট"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowSubPageManagerModal(false)}
                className="bg-amber-500 text-black font-bold text-xs px-5 py-2 rounded-xl"
              >
                সম্পন্ন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAGE CARD ADD / EDIT MODAL (Admin Only) */}
      {isAdmin && pageCardModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <LayoutGrid size={16} />
                {pageCardModal.mode === 'add' ? 'নতুন পেজ কার্ড যোগ করুন' : 'পেজ কার্ড এডিট করুন'}
              </h3>
              <button type="button" onClick={() => setPageCardModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const title = pageCardModal.title.trim();
                if (!title) return;
                const category = pageCardModal.category.trim() || title;
                const desc = pageCardModal.desc.trim();
                const bannerUrl = pageCardModal.bannerUrl.trim();

                if (pageCardModal.mode === 'add') {
                  const newId = `custom_page_${Date.now()}`;
                  setSiteContent((prev: any) => ({
                    ...prev,
                    customSubPages: [
                      ...(Array.isArray(prev.customSubPages) ? prev.customSubPages : []),
                      {
                        id: newId,
                        title,
                        category,
                        desc,
                        showInHomeGrid: true,
                        showInMenu: false
                      }
                    ],
                    pageBanners: { ...(prev.pageBanners || {}), [newId]: bannerUrl },
                    subpageInfo: {
                      ...(prev.subpageInfo || {}),
                      [newId]: { title, category, desc }
                    }
                  }));
                } else if (pageCardModal.pageId) {
                  const targetId = pageCardModal.pageId;
                  setSiteContent((prev: any) => ({
                    ...prev,
                    subpageInfo: {
                      ...(prev.subpageInfo || {}),
                      [targetId]: { title, category, desc }
                    },
                    customSubPages: (Array.isArray(prev.customSubPages) ? prev.customSubPages : []).map((sp: any) =>
                      sp.id === targetId ? { ...sp, title, category, desc } : sp
                    )
                  }));
                }
                setPageCardModal(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">কার্ড / পেজের শিরোনাম *</label>
                <input
                  type="text"
                  value={pageCardModal.title}
                  onChange={(e) => setPageCardModal((prev) => (prev ? { ...prev, title: e.target.value } : null))}
                  placeholder="যেমন: নতুন প্রজেক্ট / গ্যালারি..."
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">ক্যাটাগরি / ব্যাজ</label>
                <input
                  type="text"
                  value={pageCardModal.category}
                  onChange={(e) => setPageCardModal((prev) => (prev ? { ...prev, category: e.target.value } : null))}
                  placeholder="যেমন: সাহিত্য / সংগ্রহ / স্কিলস"
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">সংক্ষিপ্ত বিবরণ</label>
                <textarea
                  rows={3}
                  value={pageCardModal.desc}
                  onChange={(e) => setPageCardModal((prev) => (prev ? { ...prev, desc: e.target.value } : null))}
                  placeholder="কার্ডের নিচে যে সংক্ষিপ্ত বিবরণ দেখাবে..."
                  className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
              {pageCardModal.mode === 'add' && (
                <div>
                  <label className="text-[11px] text-purple-300 block mb-1">ব্যানার ইমেজ / ড্রাইভ লিংক (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={pageCardModal.bannerUrl}
                    onChange={(e) => setPageCardModal((prev) => (prev ? { ...prev, bannerUrl: e.target.value } : null))}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full bg-[#1b1b38] border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPageCardModal(null)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Save size={13} /> {pageCardModal.mode === 'add' ? 'কার্ড যোগ করুন' : 'আপডেট করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ABOUT STATS EDIT MODAL (Admin Only) */}
      {isAdmin && showAboutStatsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121225] border border-purple-500/50 rounded-2xl p-6 max-w-lg w-full shadow-[0_0_40px_rgba(120,50,255,0.3)] space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Edit2 size={15} /> সংগ্রহ পরিসংখ্যান এডিট করুন
              </h3>
              <button
                type="button"
                onClick={() => setShowAboutStatsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cleaned = aboutStatsDraft
                  .map((item, idx) => ({
                    id: item.id || `st_${Date.now()}_${idx}`,
                    value: item.value.trim(),
                    label: item.label.trim()
                  }))
                  .filter((item) => item.value || item.label);
                setSiteContent((prev: any) => ({
                  ...prev,
                  aboutStats: cleaned
                }));
                setShowAboutStatsModal(false);
              }}
              className="space-y-3"
            >
              <div className="space-y-2.5">
                {aboutStatsDraft.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="bg-[#1b1b38] border border-purple-500/30 rounded-xl p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
                  >
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAboutStatsDraft((prev) => prev.map((it, i) => (i === idx ? { ...it, value: val } : it)));
                      }}
                      placeholder="মান / সংখ্যা (যেমন: ১, ৫০০+)"
                      className="sm:w-36 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => {
                        const lbl = e.target.value;
                        setAboutStatsDraft((prev) => prev.map((it, i) => (i === idx ? { ...it, label: lbl } : it)));
                      }}
                      placeholder="শিরোনাম (যেমন: রুবিক্স কিউব)"
                      className="flex-1 bg-[#101026] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setAboutStatsDraft((prev) => prev.filter((_, i) => i !== idx))}
                      className="bg-red-500/80 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 shrink-0"
                      title="কার্ডটি মুছুন"
                    >
                      <Trash2 size={12} /> মুছুন
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setAboutStatsDraft((prev) => [
                    ...prev,
                    { id: `st_${Date.now()}`, value: '', label: '' }
                  ])
                }
                className="bg-purple-800/60 hover:bg-purple-700 text-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5"
              >
                <PlusCircle size={14} /> নতুন পরিসংখ্যান কার্ড যোগ করুন
              </button>
              <div className="flex justify-end gap-2 pt-2 border-t border-purple-500/20">
                <button
                  type="button"
                  onClick={() => setShowAboutStatsModal(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-4 py-2 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5"
                >
                  <Save size={13} /> সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className={hideChromeForPinLock ? 'w-full flex-1 z-10' : 'max-w-4xl w-full mx-auto p-4 flex-1 z-10'}>
        <React.Suspense fallback={<div className="py-12 text-center text-xs text-purple-200/75">লোড হচ্ছে...</div>}>
        {/* SEARCH RESULTS OVERLAY IF SEARCH ACTIVE */}
        {searchQuery.trim() !== '' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-bold text-amber-300">"{searchQuery}" এর অনুসন্ধান ফলাফল:</h2>
              <button onClick={() => setSearchQuery('')} className="text-xs text-purple-300 underline">সব দেখুন</button>
            </div>
            {filteredPages.length === 0 ? (
              <div className="bg-[#13132b] border border-purple-500/30 p-8 rounded-2xl text-center text-purple-300">
                কোনো মিল পাওয়া যায়নি। অন্য কিছু লিখে খুঁজুন।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPages.map(page => (
                  <div 
                    key={page.id} 
                    onClick={() => { handlePageChange(page.id); setSearchQuery(''); }}
                    className="bg-[#13132b] border border-purple-500/30 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all hover:translate-y-[-2px] shadow-[0_0_20px_rgba(120,50,255,0.1)]"
                  >
                    <span className="text-[10px] bg-purple-900/40 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30">{page.category}</span>
                    <h3 className="text-sm font-bold text-white mt-2">{page.title}</h3>
                    <p className="text-xs text-purple-200/70 mt-1 line-clamp-2">{page.desc}</p>
                    <div className="mt-3 pt-2 border-t border-purple-500/20 flex justify-between items-center text-xs text-amber-300">
                      <span>{page.items.length} টি কনটেন্ট</span>
                      <span>পরিদর্শন করুন ➔</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : currentPage === 'home' ? (
          /* HOME VIEW */
          (() => {
            const homeBuiltIn = ['heroMeta', 'magicBookButton', 'featureTabs', 'pagesGrid'];
            const homeOrder = getOrderedSectionKeys('home', homeBuiltIn);
            const homeCustom = getPageCustomBlocks('home');
            const homeSectionLabels: Record<string, string> = {
              heroMeta: 'নাম ও About Shahani',
              magicBookButton: 'Book For Magic Show বাটন',
              featureTabs: 'সার্টিফিকেট / ক্যারিয়ার / আর্ট',
              pagesGrid: 'সব পেজ কার্ড'
            };

            const renderHomeSection = (key: string) => {
              if (key === 'heroMeta') {
                return (
                  <div className="text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-2">
                      <h3 className="text-xl sm:text-3xl font-bold text-amber-100 font-['Aikya','Poppins',sans-serif] tracking-wide min-h-[36px] drop-shadow-[0_2px_12px_rgba(245,158,11,0.35)]">
                        {typedText}<span className="animate-pulse text-amber-400 font-sans">|</span>
                      </h3>
                      {isAdmin && (
                        <button 
                          onClick={() => { setEditingKey('heroTitle'); setTempEditValue(siteContent.heroTitle); }}
                          className="bg-amber-500 text-black p-1 rounded text-[10px]"
                        >
                          <Edit2 size={11} />
                        </button>
                      )}
                    </div>

                    {(() => {
                      const abtWIdx = Math.min(ABOUT_BTN_WIDTHS.length - 1, Math.max(0, typeof siteContent.aboutButtonWidthIdx === 'number' ? siteContent.aboutButtonWidthIdx : 3));
                      const abtWidthCfg = ABOUT_BTN_WIDTHS[abtWIdx];
                      const abtImgSrc = normalizeImageUrl(siteContent.aboutButtonImage || '/assets/aistudio/About_Shahani_6595dec1.png');
                      return (
                        <div className="pt-3 flex flex-col items-center gap-2">
                          {isAdmin && (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 bg-[#161632] border border-purple-500/35 rounded-xl px-2.5 py-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() =>
                                  openImageEditorModal(
                                    'aboutButtonImage',
                                    siteContent.aboutButtonImage || '/assets/aistudio/About_Shahani_6595dec1.png',
                                    'About ইমেজ পরিবর্তন (ড্রাইভ লিংক)',
                                    false
                                  )
                                }
                                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-2 py-0.5 rounded-lg inline-flex items-center gap-1"
                              >
                                <Edit2 size={10} /> About ইমেজ বদলান
                              </button>
                              <div className="inline-flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-lg">
                                <span className="text-purple-200 font-semibold">সাইজ:</span>
                                <button
                                  type="button"
                                  disabled={abtWIdx <= 0}
                                  onClick={() => setSiteContent((prev: any) => ({ ...prev, aboutButtonWidthIdx: Math.max(0, abtWIdx - 1) }))}
                                  className="px-1.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
                                >
                                  −
                                </button>
                                <span className="text-amber-300 font-bold">{abtWidthCfg.label}</span>
                                <button
                                  type="button"
                                  disabled={abtWIdx >= ABOUT_BTN_WIDTHS.length - 1}
                                  onClick={() => setSiteContent((prev: any) => ({ ...prev, aboutButtonWidthIdx: Math.min(ABOUT_BTN_WIDTHS.length - 1, abtWIdx + 1) }))}
                                  className="px-1.5 rounded bg-purple-800/60 hover:bg-purple-700 disabled:opacity-30 text-white font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => handlePageChange('about-shahani')}
                            className={`block w-full ${abtWidthCfg.cls} bg-white hover:brightness-95 border-2 border-amber-400/70 rounded-2xl p-2 shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:scale-[1.02] transition-all cursor-pointer overflow-hidden`}
                            title="About Shahani"
                          >
                            <img
                              src={abtImgSrc}
                              alt="About Shahani"
                              className="w-full h-auto object-contain"
                            />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }
              if (key === 'magicBookButton') {
                const mbCfg = siteContent.magicBookConfig || DEFAULT_SITE_CONTENT.magicBookConfig;
                const isVisible = mbCfg.visible !== false;
                if (!isVisible) {
                  if (!isAdmin) return null;
                  return (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          setSiteContent((prev: any) => ({
                            ...prev,
                            magicBookConfig: {
                              ...(prev.magicBookConfig || DEFAULT_SITE_CONTENT.magicBookConfig),
                              visible: true
                            }
                          }))
                        }
                        className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5"
                      >
                        <PlusCircle size={14} /> Book For Magic Show বাটন ফিরিয়ে আনুন
                      </button>
                    </div>
                  );
                }
                const mbImgSrc = normalizeImageUrl(mbCfg.imageUrl || DEFAULT_SITE_CONTENT.magicBookConfig.imageUrl);
                const mbHref = normalizeExternalUrl(mbCfg.linkUrl || DEFAULT_SITE_CONTENT.magicBookConfig.linkUrl);
                return (
                  <div className="flex flex-col items-center gap-2">
                    {isAdmin && (
                      <div className="flex flex-wrap items-center justify-center gap-1.5 bg-[#161632] border border-purple-500/35 rounded-xl px-2.5 py-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() =>
                            setMagicBookModal({
                              imageUrl: mbCfg.imageUrl || DEFAULT_SITE_CONTENT.magicBookConfig.imageUrl,
                              linkUrl: mbCfg.linkUrl || DEFAULT_SITE_CONTENT.magicBookConfig.linkUrl
                            })
                          }
                          className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1"
                        >
                          <Edit2 size={10} /> এডিট করুন
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModal({
                              message: 'Book For Magic Show বাটনটি ডিলিট করতে চান?',
                              onConfirm: () => {
                                setSiteContent((prev: any) => ({
                                  ...prev,
                                  magicBookConfig: {
                                    ...(prev.magicBookConfig || DEFAULT_SITE_CONTENT.magicBookConfig),
                                    visible: false
                                  }
                                }));
                              }
                            });
                          }}
                          className="bg-red-600 hover:bg-red-500 text-white font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1"
                        >
                          <Trash2 size={10} /> ডিলিট
                        </button>
                      </div>
                    )}
                    <a
                      href={mbHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full max-w-xl bg-[#0e0e22] border border-amber-500/40 hover:border-amber-400 rounded-2xl p-2 shadow-[0_0_25px_rgba(168,85,247,0.25)] hover:scale-[1.01] transition-all overflow-hidden"
                      title="Book For Magic Show - Magic School of Bangladesh"
                    >
                      <img
                        src={mbImgSrc}
                        alt="Book For Magic Show"
                        className="w-full h-auto object-contain rounded-xl"
                      />
                    </a>
                  </div>
                );
              }
              if (key === 'featureTabs') {
                return (
                  <div className="py-2 w-full grid grid-flow-col auto-cols-fr items-center gap-0 sm:gap-1">
                    {(siteContent.homeFeatureTabs || []).map((tab: any) => {
                      const isTabActive = currentPage === tab.id || activeFeatureTab === tab.id;
                      return (
                        <div key={tab.id} className="relative group min-w-0 flex justify-center">
                          <button
                            onClick={() => {
                              setActiveFeatureTab(tab.id);
                              handlePageChange(tab.id);
                            }}
                            className={`w-full flex flex-col items-center justify-center gap-0.5 px-0 sm:px-1.5 py-1 rounded-xl transition-all cursor-pointer active:text-amber-300 active:font-bold active:scale-[1.03] active:bg-gradient-to-b active:from-purple-900/40 active:to-amber-950/30 active:border active:border-amber-500/40 active:shadow-[0_0_15px_rgba(245,158,11,0.25)] ${
                              isTabActive
                                ? 'text-amber-300 font-bold scale-[1.03] bg-gradient-to-b from-purple-900/40 to-amber-950/30 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                                : 'text-gray-200/85 hover:text-purple-300 hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <img
                              src={normalizeImageUrl(tab.iconUrl)}
                              alt={tab.label}
                              className="w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[410px]:w-11 min-[410px]:h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                            />
                            <span className="text-[9px] min-[390px]:text-[10px] sm:text-xs font-['Aikya','Poppins',sans-serif] leading-tight whitespace-nowrap truncate max-w-full px-0.5">
                              {tab.label}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              if (key === 'pagesGrid') {
                const hiddenCards: string[] = Array.isArray(siteContent.hiddenHomeGridPages) ? siteContent.hiddenHomeGridPages : [];
                const homeGridPages = [
                  ...pagesData.filter((p) => !hiddenCards.includes(p.id)),
                  ...customSubPageItems.filter((cp) => {
                    const meta = (siteContent.customSubPages || []).find((sp: any) => sp.id === cp.id);
                    return (!meta || meta.showInHomeGrid !== false) && !hiddenCards.includes(cp.id);
                  })
                ];
                return (
                  <div className="space-y-3">
                    {isAdmin && (
                      <div className="flex flex-wrap justify-between items-center gap-2 bg-[#161632] border border-purple-500/35 rounded-xl px-3 py-2">
                        <span className="text-[11px] font-bold text-purple-200">সব পেজ কার্ড ম্যানেজ করুন</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {hiddenCards.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSiteContent((prev: any) => ({ ...prev, hiddenHomeGridPages: [] }))}
                              className="bg-purple-700 hover:bg-purple-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1"
                            >
                              <RotateCcw size={12} /> মুছে ফেলা কার্ড ফিরিয়ে আনুন ({hiddenCards.length})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setPageCardModal({
                                mode: 'add',
                                title: '',
                                category: '',
                                desc: '',
                                bannerUrl: ''
                              })
                            }
                            className="bg-gradient-to-r from-purple-600 to-amber-500 text-black text-xs font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1 hover:brightness-110 shadow"
                          >
                            <PlusCircle size={13} /> নতুন পেজ কার্ড যোগ করুন
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {homeGridPages.map((page) => (
                        <div 
                          key={page.id}
                          onClick={() => handlePageChange(page.id)}
                          className="bg-[#13132b] border border-purple-500/30 hover:border-amber-400/60 rounded-2xl p-4 cursor-pointer transition-all hover:translate-y-[-2px] hover:bg-[#181838] flex flex-col justify-between shadow-[0_0_20px_rgba(120,50,255,0.1)] relative"
                        >
                          <div>
                            <div className="flex justify-between items-center mb-2 gap-2">
                              <span className="text-[10px] bg-purple-900/40 text-amber-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full truncate">{page.category}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPageCardModal({
                                          mode: 'edit',
                                          pageId: page.id,
                                          title: page.title,
                                          category: page.category,
                                          desc: page.desc,
                                          bannerUrl: ''
                                        });
                                      }}
                                      className="bg-amber-500 hover:bg-amber-400 text-black p-1 rounded-lg shadow"
                                      title="কার্ড এডিট করুন"
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmModal({
                                          message: `"${page.title}" পেজ কার্ডটি ডিলিট করতে চান?`,
                                          onConfirm: () => {
                                            setSiteContent((prev: any) => {
                                              if (page.id.startsWith('custom_page_')) {
                                                return {
                                                  ...prev,
                                                  customSubPages: (prev.customSubPages || []).filter((sp: any) => sp.id !== page.id),
                                                  topNavTabs: (prev.topNavTabs || []).filter((t: any) => t.id !== page.id),
                                                  homeFeatureTabs: (prev.homeFeatureTabs || []).filter((t: any) => t.id !== page.id)
                                                };
                                              }
                                              const existingHidden = Array.isArray(prev.hiddenHomeGridPages) ? prev.hiddenHomeGridPages : [];
                                              return {
                                                ...prev,
                                                hiddenHomeGridPages: existingHidden.includes(page.id)
                                                  ? existingHidden
                                                  : [...existingHidden, page.id]
                                              };
                                            });
                                          }
                                        });
                                      }}
                                      className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-lg shadow"
                                      title="কার্ড ডিলিট করুন"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </>
                                )}
                                <ChevronRight size={14} className="text-amber-400" />
                              </div>
                            </div>
                            <h4 className="text-sm font-bold text-white mb-1">{page.title}</h4>
                            <p className="text-xs text-purple-200/70 leading-relaxed">{page.desc}</p>
                          </div>
                          <div className="mt-4 pt-2.5 border-t border-purple-500/20 flex justify-between items-center text-[11px] text-amber-300 font-semibold">
                            <span>{page.items.length} টি কনটেন্ট</span>
                            <span>বিস্তারিত ➔</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              const blk = homeCustom.find((b) => b.id === key);
              return blk ? renderCustomBlock('home', blk) : null;
            };

            return (
              <div className="space-y-5">
                {/* IMAGE SLIDER BANNER WITH CENTER ALIGNMENT */}
                {(() => {
                  const safeSliderIdx = sliderList.length > 0 ? sliderIndex % sliderList.length : 0;
                  return (
                    <div className="slider-container w-full max-w-4xl mx-auto rounded-2xl overflow-hidden border border-purple-500/40 shadow-[0_0_30px_rgba(120,50,255,0.25)] bg-[#101026] relative text-center">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setHomeSliderDraft(
                              sliderList.map((item: any) => ({
                                url: item?.url || '',
                                caption: item?.caption || ''
                              }))
                            );
                            setHomeSliderBulkInput('');
                            setHomeSliderCountInput(sliderList.length > 0 ? String(sliderList.length) : '');
                            setShowHomeSliderModal(true);
                          }}
                          className="absolute top-2 left-2 z-20 bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-lg shadow-lg inline-flex items-center gap-1 hover:brightness-110 transition-all"
                        >
                          <PlusCircle size={12} /> একাধিক ইমেজ অ্যাড ({sliderList.length})
                        </button>
                      )}
                      {renderResizableImage(
                        sliderList[safeSliderIdx]?.url || sliderList[0]?.url || "",
                        `slider_${safeSliderIdx}`,
                        `Slide ${safeSliderIdx}`,
                        "w-full h-auto max-h-[240px] sm:max-h-[380px] object-contain mx-auto"
                      )}
                      <div className="absolute bottom-3 right-3 flex gap-1.5 z-10">
                        {sliderList.map((_: any, i: number) => (
                          <button 
                            key={i} 
                            onClick={() => setSliderIndex(i)}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${safeSliderIdx === i ? 'bg-amber-400 w-6 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-white/40'}`} 
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {renderPageSectionsList('home', homeBuiltIn, homeOrder, homeCustom, homeSectionLabels, renderHomeSection)}
              </div>
            );
          })()
        ) : currentPage === 'about-shahani' ? (
          /* ABOUT SHAHANI SUBPAGE (Stats, Wiki Image & Video, Quote, Career, Publication, Awards) */
          (() => {
            const aboutBuiltIn = ['stats', 'profileImage', 'wikiVideo', 'quote', 'careerSlab', 'publicationSlab', 'awardsSlab'];
            const aboutOrder = getOrderedSectionKeys('about-shahani', aboutBuiltIn);
            const aboutCustom = getPageCustomBlocks('about-shahani');
            const aboutLabels: Record<string, string> = {
              stats: 'সংগ্রহ পরিসংখ্যান',
              profileImage: 'প্রোফাইল ছবি',
              wikiVideo: 'উইকি প্রোফাইল ভিডিও',
              quote: 'পরিচিতি উক্তি',
              careerSlab: 'কর্মজীবন',
              publicationSlab: 'প্রকাশনা',
              awardsSlab: 'পুরস্কার ও সম্মাননা'
            };

            const renderAboutSection = (key: string) => {
              if (key === 'stats') {
                const statsList: { id: string; value: string; label: string }[] = Array.isArray(siteContent.aboutStats)
                  ? siteContent.aboutStats
                  : DEFAULT_SITE_CONTENT.aboutStats;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2">
                    {statsList.map((st) => (
                      <div
                        key={st.id}
                        className="bg-[#1b1b38] border border-purple-500/30 p-3 rounded-xl text-center shadow-[0_0_15px_rgba(120,50,255,0.1)]"
                      >
                        <div className="text-lg font-bold text-amber-400">{st.value}</div>
                        <div className="text-[11px] text-purple-200/80 mt-0.5">{st.label}</div>
                      </div>
                    ))}
                  </div>
                );
              }
              if (key === 'profileImage') {
                return (
                  <div className="space-y-1 my-2 text-center">
                    {renderResizableImage(
                      siteContent.profileImage,
                      'profile',
                      'Shahani Rajib Profile',
                      'w-full h-auto max-h-[380px] object-contain mx-auto rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                    )}
                  </div>
                );
              }
              if (key === 'wikiVideo') {
                if (!siteContent.wikiProfileVideo && !isAdmin) return null;
                return (
                  <div className="space-y-2.5 my-2">
                    {isAdmin && (
                      <div className="bg-[#1b1b38] border border-purple-500/30 rounded-xl p-3 space-y-2">
                        <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Video size={14} /> উইকি প্রোফাইল ইমেজের নিচে ভিডিও যোগ করুন (YouTube / Facebook / Google Drive):
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={wikiVideoInput || siteContent.wikiProfileVideo || ""}
                            onChange={(e) => setWikiVideoInput(e.target.value)}
                            placeholder="ইউটিউব, ফেসবুক বা গুগল ড্রাইভ ভিডিও লিংক দিন..."
                            className="flex-1 min-w-[200px] bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                          />
                          <button
                            onClick={() => {
                              const val = (wikiVideoInput || siteContent.wikiProfileVideo || "").trim();
                              setSiteContent((prev: any) => ({ ...prev, wikiProfileVideo: val }));
                            }}
                            className="bg-amber-500 text-black font-bold text-xs px-3.5 py-2 rounded-xl hover:brightness-110"
                          >
                            সেভ করুন
                          </button>
                          {siteContent.wikiProfileVideo && (
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  message: "উইকি প্রোফাইল ভিডিওটি ডিলিট করতে চান?",
                                  onConfirm: () => {
                                    setSiteContent((prev: any) => ({ ...prev, wikiProfileVideo: "" }));
                                    setWikiVideoInput("");
                                  }
                                });
                              }}
                              className="bg-red-500 text-white font-bold text-xs px-3 py-2 rounded-xl hover:bg-red-600"
                            >
                              ডিলিট
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {siteContent.wikiProfileVideo && (
                      <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-purple-500/30 shadow-inner">
                        <iframe
                          src={getEmbedUrl(siteContent.wikiProfileVideo)}
                          title="Wiki Profile Video"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        ></iframe>
                      </div>
                    )}
                  </div>
                );
              }
              if (key === 'quote') {
                return (
                  <div className="relative bg-[#0a0a18]/90 border-l-4 border-amber-400 p-4 rounded-r-xl text-xs sm:text-sm leading-relaxed text-purple-100 italic my-2 whitespace-pre-line shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button 
                          onClick={() => { setEditingKey('poeticQuote'); setTempEditValue(siteContent.poeticQuote); }}
                          className="bg-amber-500 text-black p-1.5 rounded-lg text-xs font-bold"
                          title="এডিট করুন"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                    {siteContent.poeticQuote}
                  </div>
                );
              }
              if (key === 'careerSlab') {
                return (
                  <div className="relative bg-[#14142e] p-4 rounded-xl text-xs sm:text-sm leading-relaxed border border-purple-500/30 text-purple-200">
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button 
                          onClick={() => { setEditingKey('careerText'); setTempEditValue(siteContent.careerText); }}
                          className="bg-amber-500 text-black p-1.5 rounded-lg text-xs font-bold"
                          title="এডিট করুন"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                    <strong className="text-amber-300 block mb-1.5 flex items-center gap-1.5">
                      <Briefcase size={15} /> কর্মজীবন:
                    </strong>
                    {siteContent.careerText}
                  </div>
                );
              }
              if (key === 'publicationSlab') {
                return (
                  <div className="relative bg-[#14142e] p-4 rounded-xl text-xs sm:text-sm leading-relaxed border border-purple-500/30 text-purple-200">
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button 
                          onClick={() => { setEditingKey('publicationText'); setTempEditValue(siteContent.publicationText); }}
                          className="bg-amber-500 text-black p-1.5 rounded-lg text-xs font-bold"
                          title="এডিট করুন"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                    <strong className="text-amber-300 block mb-1.5 flex items-center gap-1.5">
                      <BookOpen size={15} /> প্রকাশনা:
                    </strong>
                    {siteContent.publicationText}
                  </div>
                );
              }
              if (key === 'awardsSlab') {
                return (
                  <div className="relative bg-[#14142e] p-4 rounded-xl text-xs sm:text-sm leading-relaxed border border-purple-500/30 text-purple-200">
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button 
                          onClick={() => { setEditingKey('awardsText'); setTempEditValue(siteContent.awardsText); }}
                          className="bg-amber-500 text-black p-1.5 rounded-lg text-xs font-bold"
                          title="এডিট করুন"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                    <strong className="text-amber-300 block mb-1.5 flex items-center gap-1.5">
                      <Award size={15} /> পুরস্কার ও সম্মাননা:
                    </strong>
                    {siteContent.awardsText}
                  </div>
                );
              }
              const blk = aboutCustom.find((b) => b.id === key);
              return blk ? renderCustomBlock('about-shahani', blk) : null;
            };

            return (
              <div className="space-y-4">
                {!isSubCloneMode && (
                  <SubpageBackButton
                    iconUrl={getTabMetaForPage('home').iconUrl}
                    label={getTabMetaForPage('home').label}
                    onClick={() => handlePageChange('home')}
                    variant="home"
                  />
                )}

                <div className="bg-gradient-to-br from-[#13132b] via-[#101022] to-[#16122d] border border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_35px_rgba(120,50,255,0.15)] relative space-y-4">
                  {renderPageSectionsList('about-shahani', aboutBuiltIn, aboutOrder, aboutCustom, aboutLabels, renderAboutSection)}
                  {renderDeletedBuiltInRestoreBar('about-shahani', aboutBuiltIn, aboutLabels)}
                </div>
              </div>
            );
          })()
        ) : currentPage === 'certificates-tab' ? (
          /* CERTIFICATES IMAGE GALLERY SUBPAGE (Banner on top + Multiple Google Drive Images) */
          (() => {
            const certBuiltIn = ['imageSlider', 'certGallery'];
            const certOrder = getOrderedSectionKeys('certificates-tab', certBuiltIn);
            const certCustom = getPageCustomBlocks('certificates-tab');
            const certLabels: Record<string, string> = {
              imageSlider: 'সার্টিফিকেট ইমেজ স্লাইডার',
              certGallery: 'সার্টিফিকেট গ্যালারি'
            };

            const renderCertSection = (key: string) => {
              if (key === 'imageSlider') {
                return renderImageSlider('certificates-tab', 'সার্টিফিকেট ইমেজ স্লাইডার');
              }
              if (key === 'certGallery') {
                const hasImgs = (siteContent.certGalleryImages || []).length > 0;
                if (!hasImgs && !isAdmin) return null;
                return (
                  <div className="space-y-4">
                    {isAdmin && (
                      <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-4 space-y-3">
                        <label className="text-xs font-bold text-amber-300 block">
                          একাধিক গুগল ড্রাইভ ইমেজ লিংক যুক্ত করুন (প্রতি লাইনে একটি করে লিংক দিন):
                        </label>
                        <textarea
                          rows={3}
                          value={galleryBulkInput}
                          onChange={(e) => setGalleryBulkInput(e.target.value)}
                          placeholder="https://drive.google.com/file/d/... (একটি বা একাধিক লিংক দিন)"
                          className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={() => {
                            const links = galleryBulkInput.split(/\s+/).map(s => s.trim()).filter(Boolean);
                            if (links.length === 0) return;
                            setSiteContent((prev: any) => ({
                              ...prev,
                              certGalleryImages: [...(prev.certGalleryImages || []), ...links]
                            }));
                            setGalleryBulkInput('');
                          }}
                          className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 hover:brightness-110"
                        >
                          <PlusCircle size={14} /> গ্যালারিতে ইমেজ যোগ করুন
                        </button>
                      </div>
                    )}

                    {hasImgs && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {(siteContent.certGalleryImages || []).map((imgUrl: string, idx: number) => (
                          <div key={idx} className="bg-[#13132b] border border-purple-500/30 rounded-2xl p-2.5 shadow-[0_0_20px_rgba(120,50,255,0.15)] relative group">
                            <img
                              src={normalizeImageUrl(imgUrl)}
                              alt={`Certificate ${idx + 1}`}
                              onClick={() => setLightboxImageUrl(normalizeImageUrl(imgUrl))}
                              className="w-full h-56 object-contain rounded-xl bg-black/40 cursor-pointer hover:scale-[1.02] transition-transform"
                            />
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    message: "এই সার্টিফিকেট ইমেজটি ডিলিট করতে চান?",
                                    onConfirm: () => {
                                      setSiteContent((prev: any) => ({
                                        ...prev,
                                        certGalleryImages: (prev.certGalleryImages || []).filter((_: any, i: number) => i !== idx)
                                      }));
                                    }
                                  });
                                }}
                                className="absolute top-3 right-3 bg-red-500/90 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold shadow"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              const blk = certCustom.find((b) => b.id === key);
              return blk ? renderCustomBlock('certificates-tab', blk) : null;
            };

            return (
              <div className="space-y-4">
                {renderSubpageTopBar('certificates-tab')}

                {/* ONLY BANNER ON TOP */}
                <div className="space-y-2 text-center">
                  {isAdmin && (
                    <div className="flex justify-center mb-1">
                      <button 
                        onClick={() => openImageEditorModal(`banner_certificates-tab`, pageBannersMap['certificates-tab'] || '', 'সার্টিফিকেট ব্যানার ইমেজ (ড্রাইভ লিংক)', true)}
                        className="bg-amber-500 text-black px-3 py-1.5 rounded-xl text-xs font-bold shadow hover:brightness-110 transition-all inline-flex items-center gap-1.5"
                      >
                        <ImageIcon size={14} /> ব্যানার ইমেজ পরিবর্তন করুন
                      </button>
                    </div>
                  )}
                  {renderResizableImage(
                    pageBannersMap['certificates-tab'] || "",
                    `banner_certificates-tab`,
                    'Certificates Banner',
                    'w-full mx-auto rounded-2xl shadow-[0_0_30px_rgba(120,50,255,0.2)]'
                  )}
                </div>

                {renderPageSectionsList('certificates-tab', certBuiltIn, certOrder, certCustom, certLabels, renderCertSection)}
              </div>
            );
          })()
        ) : currentPage === 'career-tab' ? (
          /* CAREER SUBPAGE (Compact Top Tabs + WhatsApp Hire Box + Reorderable Job History / Resume-CV + CV Images + PDF) */
          (() => {
            const careerBuiltIn = ['hireBox', 'jobHeading', 'cvHeading', 'cvImages', 'cvPdf', 'certTab'];
            const careerOrder = getOrderedSectionKeys('career-tab', careerBuiltIn);
            const careerCustom = getPageCustomBlocks('career-tab');
            const careerLabels: Record<string, string> = {
              hireBox: 'মেসেজ বক্স (WhatsApp)',
              certTab: 'সার্টিফিকেট ট্যাব',
              jobHeading: 'জব হিস্ট্রি',
              cvHeading: 'রেজ্যুমে/সিভি',
              cvImages: 'সিভি ইমেজ',
              cvPdf: 'সিভি পিডিএফ ভিউয়ার'
            };

            const renderCareerSection = (key: string) => {
              if (key === 'hireBox') {
                const whatsappHref = `https://wa.me/8801923866283?text=${encodeURIComponent(
                  careerMessageText.trim() || DEFAULT_CAREER_MESSAGE
                )}`;
                return (
                  <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-3.5 sm:p-4 shadow-[0_0_25px_rgba(120,50,255,0.16)] space-y-2.5">
                    <div className="relative bg-[#0c0c20] border border-purple-500/35 focus-within:border-amber-400/75 rounded-xl overflow-hidden">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none select-none absolute inset-0 flex items-center justify-center px-4 text-center text-base sm:text-xl font-bold tracking-wide text-purple-200/15"
                      >
                        Customize Your Text...
                      </div>
                      <textarea
                        rows={4}
                        value={careerMessageText}
                        onChange={(e) => setCareerMessageText(e.target.value)}
                        aria-label="Message for Shahani Rajib"
                        className="relative z-10 w-full bg-transparent px-3.5 py-3 text-xs sm:text-sm text-purple-50 leading-relaxed focus:outline-none resize-y min-h-[116px]"
                      />
                    </div>
                    <div className="flex justify-end">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gradient-to-r from-emerald-500 to-green-500 hover:brightness-110 text-black font-extrabold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(16,185,129,0.3)] transition-all"
                      >
                        <Send size={13} /> Send
                      </a>
                    </div>
                  </div>
                );
              }
              if (key === 'certTab') {
                const certFeature = (siteContent.homeFeatureTabs || []).find((t: any) => t.id === 'certificates-tab') || {
                  id: 'certificates-tab',
                  label: 'সার্টিফিকেট',
                  iconUrl: '/assets/certificate-logo.svg'
                };
                return (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => handlePageChange('certificates-tab')}
                      className="w-full bg-gradient-to-r from-[#171535] via-[#1b1740] to-[#171535] border border-purple-500/45 hover:border-amber-400/75 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(120,50,255,0.2)] hover:scale-[1.01] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={normalizeImageUrl(certFeature.iconUrl)}
                          alt={certFeature.label}
                          className="w-10 h-10 min-[360px]:w-11 min-[360px]:h-11 sm:w-12 sm:h-12 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                        />
                        <div className="text-left min-w-0">
                          <div className="text-sm sm:text-base font-extrabold text-amber-300 font-['Aikya','Poppins',sans-serif] truncate">
                            {certFeature.label || 'সার্টিফিকেট'}
                          </div>
                          <div className="text-[11px] text-purple-200/75 truncate">
                            সম্মাননা ও সনদপত্র দেখতে ক্লিক করুন
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 bg-purple-900/60 group-hover:bg-amber-500 text-amber-300 group-hover:text-black px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition-colors">
                        দেখুন <ChevronRight size={13} />
                      </span>
                    </button>
                  </div>
                );
              }
              if (key === 'jobHeading') {
                return (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-extrabold bg-purple-900/40 text-amber-300 border border-purple-500/40 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <Briefcase size={14} /> {siteContent.careerJobHeading || "জব হিস্ট্রি"}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => { setEditingKey('careerJobHeading'); setTempEditValue(siteContent.careerJobHeading || 'জব হিস্ট্রি'); }}
                        className="bg-amber-500 hover:bg-amber-400 text-black p-1.5 rounded-lg text-xs font-bold shrink-0"
                        title="এডিট করুন"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                );
              }
              if (key === 'cvHeading') {
                return (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-extrabold bg-purple-900/40 text-amber-300 border border-purple-500/40 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <Award size={14} /> {siteContent.careerCvHeading || "রেজ্যুমে/সিভি"}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => { setEditingKey('careerCvHeading'); setTempEditValue(siteContent.careerCvHeading || 'রেজ্যুমে/সিভি'); }}
                        className="bg-amber-500 hover:bg-amber-400 text-black p-1.5 rounded-lg text-xs font-bold shrink-0"
                        title="এডিট করুন"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                );
              }
              if (key === 'cvImages') {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    {[0, 1].map((slotIdx) => {
                      const cvImg = (siteContent.careerCvImages || ["", ""])[slotIdx] || "";
                      const cvFrameKey = `cv_img_${slotIdx}`;
                      const frame: BannerFrame = (siteContent.bannerFrames && siteContent.bannerFrames[cvFrameKey]) || {};
                      const posY = typeof frame.posY === 'number' ? frame.posY : 50;
                      const aspectHeight = typeof frame.aspectHeight === 'number' && frame.aspectHeight > 0 ? frame.aspectHeight : null;
                      const widthPct = typeof frame.widthPct === 'number' ? Math.min(100, Math.max(30, frame.widthPct)) : 100;
                      const zoom = typeof frame.zoom === 'number' ? frame.zoom : 100;
                      const isAdjusting = isAdmin && bannerAdjustKey === cvFrameKey;
                      const hasCustomCrop = Boolean(aspectHeight || posY !== 50);

                      return (
                        <div key={slotIdx} className="bg-[#13132b] border border-purple-500/30 rounded-2xl p-2.5 sm:p-3 space-y-2.5 shadow-[0_0_20px_rgba(120,50,255,0.15)]">
                          {isAdmin && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <input
                                type="text"
                                value={cvImg}
                                onChange={(e) => {
                                  const updated = [...(siteContent.careerCvImages || ["", ""])];
                                  updated[slotIdx] = e.target.value;
                                  setSiteContent((prev: any) => ({ ...prev, careerCvImages: updated }));
                                }}
                                placeholder={`সিভি ইমেজ ${slotIdx + 1} (Google Drive লিংক)`}
                                className="flex-1 min-w-[140px] bg-[#1b1b38] border border-purple-500/30 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                              />
                              {cvImg && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setBannerAdjustKey((prev) => (prev === cvFrameKey ? null : cvFrameKey))}
                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-all ${
                                      isAdjusting ? 'bg-emerald-500 text-black' : 'bg-cyan-500 text-black hover:bg-cyan-400'
                                    }`}
                                  >
                                    <MoveVertical size={11} /> {isAdjusting ? 'সেভ' : 'টেনে ও পাশে ছোট/বড়'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...(siteContent.careerCvImages || ["", ""])];
                                      updated[slotIdx] = "";
                                      setSiteContent((prev: any) => ({ ...prev, careerCvImages: updated }));
                                      if (bannerAdjustKey === cvFrameKey) setBannerAdjustKey(null);
                                    }}
                                    className="bg-red-500 text-white p-1.5 rounded-lg text-xs"
                                    title="মুছুন"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          {cvImg ? (
                            <div className="space-y-2">
                              <div
                                className="mx-auto relative overflow-hidden rounded-xl bg-black/25"
                                style={{ width: `${widthPct}%` }}
                              >
                                <div
                                  onPointerDown={(e) => {
                                    if (!isAdjusting) return;
                                    if ((e.target as HTMLElement).closest('button, input')) return;
                                    e.preventDefault();
                                    bannerDragRef.current = {
                                      imgKey: cvFrameKey,
                                      mode: 'position',
                                      startY: e.clientY,
                                      startVal: posY,
                                      containerHeight: e.currentTarget.getBoundingClientRect().height || 260
                                    };
                                  }}
                                  className={`relative w-full overflow-hidden rounded-xl ${
                                    isAdjusting
                                      ? 'border-2 border-amber-400 cursor-ns-resize touch-none shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                      : ''
                                  }`}
                                  style={hasCustomCrop ? { aspectRatio: `1000 / ${aspectHeight || 1414}` } : undefined}
                                >
                                  <img
                                    src={normalizeImageUrl(cvImg)}
                                    alt={`CV Page ${slotIdx + 1}`}
                                    draggable={false}
                                    onClick={!isAdjusting ? () => setLightboxImageUrl(normalizeImageUrl(cvImg)) : undefined}
                                    className={
                                      hasCustomCrop
                                        ? 'w-full h-full object-cover select-none block rounded-xl'
                                        : 'w-full h-auto object-contain rounded-xl cursor-pointer hover:scale-[1.01] transition-transform block'
                                    }
                                    style={{
                                      objectPosition: hasCustomCrop ? `50% ${posY}%` : undefined,
                                      transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                                      transformOrigin: hasCustomCrop && zoom >= 100 ? `50% ${posY}%` : '50% 50%'
                                    }}
                                  />

                                  {isAdjusting && (
                                    <>
                                      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center z-10">
                                        <span className="bg-black/80 border border-amber-400/60 text-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                                          <MoveVertical size={11} /> উপর-নিচ বা কোনায় টেনে ঠিক করুন
                                        </span>
                                      </div>
                                      {/* Bottom drag handle for vertical height */}
                                      <div
                                        onPointerDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          bannerDragRef.current = {
                                            imgKey: cvFrameKey,
                                            mode: 'height',
                                            startY: e.clientY,
                                            startVal: aspectHeight || 1414,
                                            containerHeight: 300
                                          };
                                        }}
                                        title="উপর-নিচে টেনে উচ্চতা ছোট/বড় করুন"
                                        className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-amber-500/90 to-amber-500/30 hover:from-amber-400 cursor-row-resize touch-none flex items-center justify-center z-20"
                                      >
                                        <span className="w-10 h-1 rounded-full bg-black/80" />
                                      </div>
                                      {/* Right drag handle for horizontal width */}
                                      <div
                                        onPointerDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          const parentRect = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                                          bannerDragRef.current = {
                                            imgKey: cvFrameKey,
                                            mode: 'width',
                                            startY: e.clientY,
                                            startX: e.clientX,
                                            startVal: widthPct,
                                            containerHeight: 300,
                                            containerWidth: parentRect?.width || 300
                                          };
                                        }}
                                        title="ডান-বাম টেনে পাশে ছোট/বড় করুন"
                                        className="absolute inset-y-0 right-0 w-3.5 bg-gradient-to-l from-cyan-400/90 to-cyan-400/20 hover:from-cyan-300 cursor-col-resize touch-none flex items-center justify-center z-20"
                                      >
                                        <span className="h-10 w-1 rounded-full bg-black/80" />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {isAdjusting && (
                                <div className="bg-[#181833] border border-amber-400/50 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                                  <div>
                                    <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                                      <span>পাশে ছোট / বড় (প্রস্থ)</span>
                                      <span>{widthPct}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={30}
                                      max={100}
                                      value={widthPct}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setSiteContent((prev: any) => ({
                                          ...prev,
                                          bannerFrames: {
                                            ...(prev.bannerFrames || {}),
                                            [cvFrameKey]: { ...(prev.bannerFrames?.[cvFrameKey] || {}), widthPct: val }
                                          }
                                        }));
                                      }}
                                      className="w-full accent-cyan-400"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                                      <span>উচ্চতা (বড়/ছোট)</span>
                                      <span>{aspectHeight ? `${aspectHeight}` : 'অটো'}</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={320}
                                      max={2400}
                                      step={20}
                                      value={aspectHeight || 1414}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setSiteContent((prev: any) => ({
                                          ...prev,
                                          bannerFrames: {
                                            ...(prev.bannerFrames || {}),
                                            [cvFrameKey]: { ...(prev.bannerFrames?.[cvFrameKey] || {}), aspectHeight: val }
                                          }
                                        }));
                                      }}
                                      className="w-full accent-amber-400"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] text-amber-300 font-bold mb-1">
                                      <span>উপর-নিচ পজিশন</span>
                                      <span>{posY}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={100}
                                      value={posY}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setSiteContent((prev: any) => ({
                                          ...prev,
                                          bannerFrames: {
                                            ...(prev.bannerFrames || {}),
                                            [cvFrameKey]: {
                                              ...(prev.bannerFrames?.[cvFrameKey] || {}),
                                              posY: val,
                                              aspectHeight: prev.bannerFrames?.[cvFrameKey]?.aspectHeight || 1414
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-full accent-amber-400"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex justify-between items-center text-[10px] text-amber-300 font-bold mb-1 gap-1">
                                      <span>জুম ({zoom}%)</span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextZ = Math.max(50, zoom - 10);
                                            setSiteContent((prev: any) => ({
                                              ...prev,
                                              bannerFrames: {
                                                ...(prev.bannerFrames || {}),
                                                [cvFrameKey]: { ...(prev.bannerFrames?.[cvFrameKey] || {}), zoom: nextZ }
                                              }
                                            }));
                                          }}
                                          className="bg-purple-800/70 hover:bg-purple-700 text-white px-1 py-0.5 rounded inline-flex items-center"
                                        >
                                          <ZoomOut size={10} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextZ = Math.min(250, zoom + 10);
                                            setSiteContent((prev: any) => ({
                                              ...prev,
                                              bannerFrames: {
                                                ...(prev.bannerFrames || {}),
                                                [cvFrameKey]: { ...(prev.bannerFrames?.[cvFrameKey] || {}), zoom: nextZ }
                                              }
                                            }));
                                          }}
                                          className="bg-purple-800/70 hover:bg-purple-700 text-white px-1 py-0.5 rounded inline-flex items-center"
                                        >
                                          <ZoomIn size={10} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSiteContent((prev: any) => ({
                                              ...prev,
                                              bannerFrames: {
                                                ...(prev.bannerFrames || {}),
                                                [cvFrameKey]: { posY: 50, aspectHeight: null, widthPct: 100, zoom: 100 }
                                              }
                                            }));
                                          }}
                                          className="text-cyan-300 hover:underline inline-flex items-center gap-0.5"
                                        >
                                          <RotateCcw size={10} /> রিসেট
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      type="range"
                                      min={50}
                                      max={250}
                                      value={zoom}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setSiteContent((prev: any) => ({
                                          ...prev,
                                          bannerFrames: {
                                            ...(prev.bannerFrames || {}),
                                            [cvFrameKey]: { ...(prev.bannerFrames?.[cvFrameKey] || {}), zoom: val }
                                          }
                                        }));
                                      }}
                                      className="w-full accent-amber-400"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-36 flex items-center justify-center text-xs text-purple-300/50 border border-dashed border-purple-500/20 rounded-xl">
                              সিভি ইমেজ {slotIdx + 1}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }
              if (key === 'cvPdf') {
                return (
                  <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl px-2 py-3 sm:p-5 shadow-[0_0_25px_rgba(120,50,255,0.15)] space-y-3.5 min-w-0 overflow-hidden">
                    {isAdmin && (
                      <div className="bg-[#1b1b38] border border-purple-500/30 rounded-xl p-3 space-y-2">
                        <label className="text-xs font-bold text-amber-300 block">সিভি পিডিএফ লিংক (Google Drive / PDF URL):</label>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={cvPdfInput || siteContent.careerCvPdf || ""}
                            onChange={(e) => setCvPdfInput(e.target.value)}
                            placeholder="https://drive.google.com/file/d/... বা PDF লিংক দিন"
                            className="flex-1 min-w-[160px] bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                          />
                          <button
                            onClick={() => {
                              const val = (cvPdfInput || siteContent.careerCvPdf || "").trim();
                              setSiteContent((prev: any) => ({ ...prev, careerCvPdf: val }));
                              setCvPdfOpen(true);
                            }}
                            className="bg-amber-500 text-black font-bold text-xs px-3.5 py-2 rounded-xl"
                          >
                            সেভ করুন
                          </button>
                          {siteContent.careerCvPdf && (
                            <button
                              onClick={() => {
                                setSiteContent((prev: any) => ({ ...prev, careerCvPdf: "" }));
                                setCvPdfInput('');
                              }}
                              className="bg-red-500 text-white font-bold text-xs px-3 py-2 rounded-xl"
                            >
                              ডিলিট
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {siteContent.careerCvPdf ? (
                      <div className="space-y-3 min-w-0">
                        <div className="flex flex-wrap justify-between items-center gap-2 px-1 sm:px-0">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-300">
                            <FileText size={16} /> সিভি পিডিএফ ফাইল (CV Document)
                          </div>
                        </div>
                        <div className="w-full max-w-full min-w-0 aspect-[3/4] min-h-[380px] max-h-[650px] sm:aspect-auto sm:h-[580px] rounded-xl overflow-hidden border border-purple-500/40 bg-black/60 shadow-inner">
                          <iframe
                            src={normalizePdfEmbedUrl(siteContent.careerCvPdf)}
                            title="CV PDF Preview"
                            className="w-full h-full border-0"
                            allow="autoplay"
                          ></iframe>
                        </div>
                        <div className="flex justify-center pt-1">
                          <a
                            href={`/api/drive-download?url=${encodeURIComponent(siteContent.careerCvPdf)}&filename=Shahani_Rajib_CV.pdf`}
                            download="Shahani_Rajib_CV.pdf"
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all"
                          >
                            <Download size={15} /> সিভি পিডিএফ ডাউনলোড করুন
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-xs text-purple-300/60 py-3">
                        এখনও কোনো পিডিএফ লিংক যুক্ত করা হয়নি।
                      </div>
                    )}
                  </div>
                );
              }
              const blk = careerCustom.find((b) => b.id === key);
              return blk ? renderCustomBlock('career-tab', blk) : null;
            };

            const certFeatureMeta = (siteContent.homeFeatureTabs || []).find((t: any) => t.id === 'certificates-tab') || {
              id: 'certificates-tab',
              label: 'সার্টিফিকেট',
              iconUrl: '/assets/certificate-logo.svg'
            };
            const eduFeatureMeta = (siteContent.homeFeatureTabs || []).find((t: any) => t.id === 'education-tab') || {
              id: 'education-tab',
              label: 'এডুকেশন',
              iconUrl: '/assets/aistudio/Education_Card_5c874c48.png'
            };

            const showCareerShortcuts =
              !isSubCloneMode || isPageAllowedInSubClone('certificates-tab') || isPageAllowedInSubClone('education-tab');

            return (
              <div className="space-y-4">
                {renderSubpageTopBar(
                  'career-tab',
                  showCareerShortcuts ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap">
                      {(!isSubCloneMode || isPageAllowedInSubClone('certificates-tab')) && (
                        <button
                          type="button"
                          onClick={() => handlePageChange('certificates-tab')}
                          title={certFeatureMeta.label || 'সার্টিফিকেট'}
                          className="shrink-0 w-[72px] h-[72px] min-[380px]:w-[78px] min-[380px]:h-[78px] sm:w-[88px] sm:h-[88px] flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-xl border border-purple-500/35 bg-[#1b1b38]/95 hover:border-amber-400/60 hover:bg-purple-900/40 text-purple-100 transition-all overflow-hidden shadow-sm cursor-pointer"
                        >
                          <img
                            src={normalizeImageUrl(certFeatureMeta.iconUrl)}
                            alt={certFeatureMeta.label || 'সার্টিফিকেট'}
                            className="w-9 h-9 min-[380px]:w-10 min-[380px]:h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                          />
                          <span className="text-[9.5px] min-[390px]:text-[10px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold leading-tight whitespace-nowrap truncate max-w-full">
                            {certFeatureMeta.label || 'সার্টিফিকেট'}
                          </span>
                        </button>
                      )}
                      {(!isSubCloneMode || isPageAllowedInSubClone('education-tab')) && (
                        <button
                          type="button"
                          onClick={() => handlePageChange('education-tab')}
                          title={eduFeatureMeta.label || 'এডুকেশন'}
                          className="shrink-0 w-[72px] h-[72px] min-[380px]:w-[78px] min-[380px]:h-[78px] sm:w-[88px] sm:h-[88px] flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-xl border border-purple-500/35 bg-[#1b1b38]/95 hover:border-amber-400/60 hover:bg-purple-900/40 text-purple-100 transition-all overflow-hidden shadow-sm cursor-pointer"
                        >
                          <img
                            src={normalizeImageUrl(eduFeatureMeta.iconUrl)}
                            alt={eduFeatureMeta.label || 'এডুকেশন'}
                            className="w-9 h-9 min-[380px]:w-10 min-[380px]:h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                          />
                          <span className="text-[9.5px] min-[390px]:text-[10px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold leading-tight whitespace-nowrap truncate max-w-full">
                            {eduFeatureMeta.label || 'এডুকেশন'}
                          </span>
                        </button>
                      )}
                    </div>
                  ) : undefined
                )}

                {renderPageSectionsList('career-tab', careerBuiltIn, careerOrder, careerCustom, careerLabels, renderCareerSection)}
                {renderDeletedBuiltInRestoreBar('career-tab', careerBuiltIn, careerLabels)}
              </div>
            );
          })()
        ) : currentPage === 'art-tab' ? (
          /* ART SUBPAGE */
          (() => {
            const artBuiltIn = ['imageSlider', 'artGallery'];
            const artOrder = getOrderedSectionKeys('art-tab', artBuiltIn);
            const artCustom = getPageCustomBlocks('art-tab');
            const artLabels: Record<string, string> = {
              imageSlider: 'আর্ট ইমেজ স্লাইডার',
              artGallery: 'আর্ট গ্যালারি'
            };

            const renderArtSection = (key: string) => {
              if (key === 'imageSlider') {
                return renderImageSlider('art-tab', 'আর্ট ইমেজ স্লাইডার');
              }
              if (key === 'artGallery') {
                const hasArtImgs = (siteContent.artImages || []).length > 0;
                if (!hasArtImgs && !isAdmin) return null;
                return (
                  <div className="space-y-4">
                    {isAdmin && (
                      <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-4 space-y-3">
                        <label className="text-xs font-bold text-amber-300 block">
                          একাধিক গুগল ড্রাইভ ইমেজ লিংক যুক্ত করুন (প্রতি লাইনে একটি করে লিংক দিন):
                        </label>
                        <textarea
                          rows={3}
                          value={galleryBulkInput}
                          onChange={(e) => setGalleryBulkInput(e.target.value)}
                          placeholder="https://drive.google.com/file/d/... (একটি বা একাধিক লিংক দিন)"
                          className="w-full bg-[#1b1b38] border border-purple-500/30 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={() => {
                            const links = galleryBulkInput.split(/\s+/).map(s => s.trim()).filter(Boolean);
                            if (links.length === 0) return;
                            setSiteContent((prev: any) => ({
                              ...prev,
                              artImages: [...(prev.artImages || []), ...links]
                            }));
                            setGalleryBulkInput('');
                          }}
                          className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 hover:brightness-110"
                        >
                          <PlusCircle size={14} /> আর্ট ইমেজ যোগ করুন
                        </button>
                      </div>
                    )}

                    {hasArtImgs && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {(siteContent.artImages || []).map((imgUrl: string, idx: number) => (
                          <div key={idx} className="bg-[#13132b] border border-purple-500/30 rounded-2xl p-2.5 shadow-[0_0_20px_rgba(120,50,255,0.15)] relative">
                            <img
                              src={normalizeImageUrl(imgUrl)}
                              alt={`Art by Raj ${idx + 1}`}
                              onClick={() => setLightboxImageUrl(normalizeImageUrl(imgUrl))}
                              className="w-full h-56 object-contain rounded-xl bg-black/40 cursor-pointer hover:scale-[1.02] transition-transform"
                            />
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    message: "এই আর্ট ইমেজটি ডিলিট করতে চান?",
                                    onConfirm: () => {
                                      setSiteContent((prev: any) => ({
                                        ...prev,
                                        artImages: (prev.artImages || []).filter((_: any, i: number) => i !== idx)
                                      }));
                                    }
                                  });
                                }}
                                className="absolute top-3 right-3 bg-red-500/90 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold shadow"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              const blk = artCustom.find((b) => b.id === key);
              return blk ? renderCustomBlock('art-tab', blk) : null;
            };

            return (
              <div className="space-y-4">
                {renderSubpageTopBar('art-tab')}

                {renderPageSectionsList('art-tab', artBuiltIn, artOrder, artCustom, artLabels, renderArtSection)}
              </div>
            );
          })()
        ) : currentPage.startsWith('book_') ? (
          /* DEDICATED BOOK PAGE */
          (() => {
            const bookId = currentPage.slice(5);
            const selectedBook = (Array.isArray(siteContent.booksCovers) ? siteContent.booksCovers : []).find(
              (b: any) => b.id === bookId
            );
            const bookBuiltIn: string[] = [];
            const rawBookCustom = getPageCustomBlocks(currentPage);
            const deletedSystemIds: string[] = Array.isArray(siteContent.deletedSystemBlockIds)
              ? siteContent.deletedSystemBlockIds
              : [];
            const isWordInMyPocket = Boolean(
              selectedBook && /words?\s+in\s+my\s+pocket/i.test((selectedBook.title || '').trim())
            );
            const shouldInjectWordHtml =
              isWordInMyPocket &&
              !deletedSystemIds.includes('cb_word_in_my_pocket_html') &&
              !rawBookCustom.some((b) => b.id === 'cb_word_in_my_pocket_html');
            const bookCustom: CustomBlock[] = shouldInjectWordHtml
              ? [
                  ...rawBookCustom,
                  {
                    id: 'cb_word_in_my_pocket_html',
                    type: 'html-code',
                    htmlTitle: '',
                    link: '/assets/aistudio/index_bcb1494a.html'
                  }
                ]
              : rawBookCustom;
            const rawBookOrder = getOrderedSectionKeys(currentPage, bookBuiltIn);
            const bookOrder =
              shouldInjectWordHtml && !rawBookOrder.includes('cb_word_in_my_pocket_html')
                ? [...rawBookOrder, 'cb_word_in_my_pocket_html']
                : rawBookOrder;

            return (
              <div className="space-y-4">
                {renderSubpageTopBar(
                  currentPage,
                  <SubpageBackButton
                    iconUrl={getTabMetaForPage('books').iconUrl}
                    label={getTabMetaForPage('books').label}
                    onClick={() => handlePageChange('books')}
                    variant="parent"
                  />
                )}

                <h1 className="text-2xl sm:text-4xl font-extrabold text-amber-300 font-['Aikya','Poppins',sans-serif] text-center tracking-wide py-3">
                  {selectedBook?.title || 'বই'}
                </h1>

                {bookOrder.length > 0 && (
                  <div className="space-y-4">
                    {renderPageSectionsList(currentPage, bookBuiltIn, bookOrder, bookCustom, {}, () => null)}
                  </div>
                )}
              </div>
            );
          })()
        ) : currentPage === 'blog' ? (
          /* BLOG VIEW */
          (() => {
            const homeMeta = getTabMetaForPage('home');
            const blogMeta = getTabMetaForPage('blog');
            return (
              <BlogView
                blogs={mergedBlogPosts}
                isAdmin={isAdmin}
                homeIconUrl={homeMeta.iconUrl}
                homeLabel={homeMeta.label}
                blogIconUrl={blogMeta.iconUrl || '/assets/aistudio/blog_logo_632001ae.png'}
                blogLabel={blogMeta.label || 'ব্লগ'}
                onBackHome={() => handlePageChange('home')}
                hideHomeButton={isSubCloneMode}
                onSaveBlog={handleSaveBlogPost}
                onDeleteBlog={handleDeleteBlogPost}
                onOpenLightbox={(url) => setLightboxImageUrl(url)}
              />
            );
          })()
        ) : currentPage === 'tas-vanish' ? (
          /* TAS VANISH MAGIC VIEW */
          <TasVanishView
            title={subpageInfoMap['tas-vanish']?.title ?? 'তাস ভ্যানিস'}
            desc={
              subpageInfoMap['tas-vanish']?.desc ??
              '৮টি ছবির মধ্য থেকে যেকোনো ৫টি ছবির উপরে ক্লিক করে নির্বাচন করুন। ৫টি নির্বাচন সম্পূর্ণ হলে নিচের বাক্সে ছবিগুলো একে অপরের ওপর দেখা যাবে।'
            }
            isAdmin={isAdmin}
            homeIconUrl={getTabMetaForPage('home').iconUrl}
            homeLabel={getTabMetaForPage('home').label}
            magicIconUrl={getTabMetaForPage('raj-magic-show').iconUrl}
            magicLabel={getTabMetaForPage('raj-magic-show').label}
            onEditTitle={() => {
              setEditingKey('subpage_tas-vanish_title');
              setTempEditValue(subpageInfoMap['tas-vanish']?.title ?? 'তাস ভ্যানিস');
            }}
            onEditDesc={() => {
              setEditingKey('subpage_tas-vanish_desc');
              setTempEditValue(
                subpageInfoMap['tas-vanish']?.desc ??
                  '৮টি ছবির মধ্য থেকে যেকোনো ৫টি ছবির উপরে ক্লিক করে নির্বাচন করুন। ৫টি নির্বাচন সম্পূর্ণ হলে নিচের বাক্সে ছবিগুলো একে অপরের ওপর দেখা যাবে।'
              );
            }}
            onBackHome={() => handlePageChange('home')}
            onBackMagic={() => handlePageChange('raj-magic-show')}
            hideHomeButton={isSubCloneMode}
          />
        ) : currentPage === 'tas-prediction' ? (
          /* TAS PREDICTION MAGIC VIEW */
          <TasPredictionView
            title={subpageInfoMap['tas-prediction']?.title ?? 'তাস প্রেডিকশন'}
            desc={
              subpageInfoMap['tas-prediction']?.desc ??
              'যেকোনো কার্ড মনে মনে বেছে নিন এবং যে যে ছবিতে সেই কার্ডটি আছে সেগুলোর উপরে ক্লিক করুন। নিচের কার্ড বক্সে আপনার নির্বাচিত তাসটি দেখা যাবে।'
            }
            isAdmin={isAdmin}
            homeIconUrl={getTabMetaForPage('home').iconUrl}
            homeLabel={getTabMetaForPage('home').label}
            magicIconUrl={getTabMetaForPage('raj-magic-show').iconUrl}
            magicLabel={getTabMetaForPage('raj-magic-show').label}
            onEditTitle={() => {
              setEditingKey('subpage_tas-prediction_title');
              setTempEditValue(subpageInfoMap['tas-prediction']?.title ?? 'তাস প্রেডিকশন');
            }}
            onEditDesc={() => {
              setEditingKey('subpage_tas-prediction_desc');
              setTempEditValue(
                subpageInfoMap['tas-prediction']?.desc ??
                  'যেকোনো কার্ড মনে মনে বেছে নিন এবং যে যে ছবিতে সেই কার্ডটি আছে সেগুলোর উপরে ক্লিক করুন। নিচের কার্ড বক্সে আপনার নির্বাচিত তাসটি দেখা যাবে।'
              );
            }}
            onBackHome={() => handlePageChange('home')}
            onBackMagic={() => handlePageChange('raj-magic-show')}
            hideHomeButton={isSubCloneMode}
          />
        ) : currentPage === 'pin-card' ? (
          /* PIN CARD MAGIC VIEW */
          <PinCardView
            title={subpageInfoMap['pin-card']?.title ?? 'পিন কার্ড'}
            desc={
              subpageInfoMap['pin-card']?.desc ??
              'অ্যাপ আনলক করে ৪ ডিজিটের পিন নম্বর অনুযায়ী নির্ধারিত বাইসাইকেল প্লেয়িং কার্ড ফুলস্ক্রিনে দেখুন।'
            }
            isAdmin={isAdmin}
            homeIconUrl={getTabMetaForPage('home').iconUrl}
            homeLabel={getTabMetaForPage('home').label}
            magicIconUrl={getTabMetaForPage('raj-magic-show').iconUrl}
            magicLabel={getTabMetaForPage('raj-magic-show').label}
            onLockChange={setIsPinCardLocked}
            onEditTitle={() => {
              setEditingKey('subpage_pin-card_title');
              setTempEditValue(subpageInfoMap['pin-card']?.title ?? 'পিন কার্ড');
            }}
            onEditDesc={() => {
              setEditingKey('subpage_pin-card_desc');
              setTempEditValue(
                subpageInfoMap['pin-card']?.desc ??
                  'অ্যাপ আনলক করে ৪ ডিজিটের পিন নম্বর অনুযায়ী নির্ধারিত বাইসাইকেল প্লেয়িং কার্ড ফুলস্ক্রিনে দেখুন।'
              );
            }}
            onBackHome={() => handlePageChange('home')}
            onBackMagic={() => handlePageChange('raj-magic-show')}
            hideHomeButton={isSubCloneMode}
          />
        ) : currentPage === 'taser-ghori' ? (
          /* TASER GHORI (CARD CLOCK) MAGIC VIEW */
          <TaserGhoriView
            title={subpageInfoMap['taser-ghori']?.title ?? 'তাসের ঘড়ি'}
            desc={
              subpageInfoMap['taser-ghori']?.desc ??
              'ঘড়ির মতো সাজানো ১২টি তাসের ওপর একবার ক্লিক করলে হালকা নড়বে এবং ডাবল ক্লিক করলে ফ্ল্যাশ ও ফ্লিপ হয়ে সামনের তাস দেখা যাবে।'
            }
            isAdmin={isAdmin}
            homeIconUrl={getTabMetaForPage('home').iconUrl}
            homeLabel={getTabMetaForPage('home').label}
            magicIconUrl={getTabMetaForPage('raj-magic-show').iconUrl}
            magicLabel={getTabMetaForPage('raj-magic-show').label}
            onEditTitle={() => {
              setEditingKey('subpage_taser-ghori_title');
              setTempEditValue(subpageInfoMap['taser-ghori']?.title ?? 'তাসের ঘড়ি');
            }}
            onEditDesc={() => {
              setEditingKey('subpage_taser-ghori_desc');
              setTempEditValue(
                subpageInfoMap['taser-ghori']?.desc ??
                  'ঘড়ির মতো সাজানো ১২টি তাসের ওপর একবার ক্লিক করলে হালকা নড়বে এবং ডাবল ক্লিক করলে ফ্ল্যাশ ও ফ্লিপ হয়ে সামনের তাস দেখা যাবে।'
              );
            }}
            onBackHome={() => handlePageChange('home')}
            onBackMagic={() => handlePageChange('raj-magic-show')}
            hideHomeButton={isSubCloneMode}
          />
        ) : currentPage === 'iskaponer-tekka' ? (
          /* ISKAPONER TEKKA (THREE-CARD MONTE) MAGIC VIEW */
          <IskaponerTekkaView
            title={subpageInfoMap['iskaponer-tekka']?.title ?? 'ইস্কাপনের টেক্কা'}
            desc={
              subpageInfoMap['iskaponer-tekka']?.desc ??
              'তাসগুলো টেনে যেকোনো বর্ডারে বসান এবং যেকোনো তাসে ডাবল ক্লিক করলে ফ্ল্যাশ ও ফ্লিপ হয়ে সামনের বা পেছনের দিক দেখা যাবে।'
            }
            isAdmin={isAdmin}
            homeIconUrl={getTabMetaForPage('home').iconUrl}
            homeLabel={getTabMetaForPage('home').label}
            magicIconUrl={getTabMetaForPage('raj-magic-show').iconUrl}
            magicLabel={getTabMetaForPage('raj-magic-show').label}
            onEditTitle={() => {
              setEditingKey('subpage_iskaponer-tekka_title');
              setTempEditValue(subpageInfoMap['iskaponer-tekka']?.title ?? 'ইস্কাপনের টেক্কা');
            }}
            onEditDesc={() => {
              setEditingKey('subpage_iskaponer-tekka_desc');
              setTempEditValue(
                subpageInfoMap['iskaponer-tekka']?.desc ??
                  'তাসগুলো টেনে যেকোনো বর্ডারে বসান এবং যেকোনো তাসে ডাবল ক্লিক করলে ফ্ল্যাশ ও ফ্লিপ হয়ে সামনের বা পেছনের দিক দেখা যাবে।'
              );
            }}
            onBackHome={() => handlePageChange('home')}
            onBackMagic={() => handlePageChange('raj-magic-show')}
            hideHomeButton={isSubCloneMode}
          />
        ) : (
          /* SUBPAGE VIEW */
          (() => {
            const isInnerTab = Boolean(innerTabParentLookup[currentPage]);
            const isCustomOrTrainer = currentPage === 'trainer-tab' || currentPage.startsWith('custom_tab_') || isInnerTab;
            const isCustomSubPage = currentPage.startsWith('custom_page_');
            const subBuiltIn =
              isCustomOrTrainer
                ? []
                : isCustomSubPage || currentPage === 'education-tab' || currentPage === 'award-tab'
                  ? ['subpageHeader']
                  : currentPage === 'books'
                    ? ['booksReader', 'booksShowcase']
                    : currentPage === 'ms-excel'
                      ? ['videoSlider', 'subpageHeader']
                      : currentPage === 'rubiks-cube'
                        ? ['imageSlider']
                        : currentPage === 'match-box'
                          ? []
                          : currentPage === 'chess'
                            ? []
                            : currentPage === 'raj-magic-show'
                              ? ['magicBookBox', 'subpageHeader']
                              : ['subpageHeader', 'videosSection'];

            const subOrder = getOrderedSectionKeys(currentPage, subBuiltIn);
            const subCustom = getPageCustomBlocks(currentPage);
            const subLabels: Record<string, string> = {
              booksReader: 'কবিতা ও বই পাঠক',
              booksShowcase: 'শাহানী রাজীবের বই',
              videoSlider: 'এক্সেল ভিডিও স্লাইডার',
              imageSlider: currentPage === 'rubiks-cube' ? 'কিউব ইমেজ স্লাইডার' : 'সংগ্রহ ইমেজ স্লাইডার',
              magicBookBox: 'ম্যাজিক বুকিং মেসেজ বক্স (WhatsApp)',
              subpageHeader: 'পেজ পরিচিতি',
              videosSection: 'ভিডিও কনটেন্ট'
            };

            const renderSubSection = (key: string) => {
              if (key === 'magicBookBox') {
                const magicWhatsappHref = `https://wa.me/8801923866283?text=${encodeURIComponent(
                  magicMessageText.trim() || DEFAULT_MAGIC_MESSAGE
                )}`;
                return (
                  <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-3.5 sm:p-4 shadow-[0_0_25px_rgba(120,50,255,0.16)] space-y-2.5">
                    <div className="relative bg-[#0c0c20] border border-purple-500/35 focus-within:border-amber-400/75 rounded-xl overflow-hidden">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none select-none absolute inset-0 flex items-center justify-center px-4 text-center text-base sm:text-xl font-bold tracking-wide text-purple-200/15"
                      >
                        Customize Your Text...
                      </div>
                      <textarea
                        rows={4}
                        value={magicMessageText}
                        onChange={(e) => setMagicMessageText(e.target.value)}
                        aria-label="Magic Event Booking Message for Shahani Rajib"
                        className="relative z-10 w-full bg-transparent px-3.5 py-3 text-xs sm:text-sm text-purple-50 leading-relaxed focus:outline-none resize-y min-h-[116px]"
                      />
                    </div>
                    <div className="flex justify-end">
                      <a
                        href={magicWhatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gradient-to-r from-emerald-500 to-green-500 hover:brightness-110 text-black font-extrabold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(16,185,129,0.3)] transition-all"
                      >
                        <Send size={13} /> Send
                      </a>
                    </div>
                  </div>
                );
              }
              if (key === 'booksReader') {
                return <BooksSheetReader />;
              }
              if (key === 'booksShowcase') {
                const booksCovers: { id: string; title: string; imageUrl: string }[] = Array.isArray(siteContent.booksCovers)
                  ? siteContent.booksCovers
                  : [];
                return (
                  <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(120,50,255,0.15)] space-y-5">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-['Aikya','Poppins',sans-serif] text-center tracking-wide">
                      শাহানী রাজীবের বই
                    </h2>

                    {isAdmin && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmedTitle = bookShowcaseTitle.trim();
                          const trimmedLink = bookShowcaseLink.trim();
                          if (!trimmedTitle || !trimmedLink) return;
                          if (editingBookCoverId) {
                            setSiteContent((prev: any) => ({
                              ...prev,
                              booksCovers: (prev.booksCovers || []).map((b: any) =>
                                b.id === editingBookCoverId
                                  ? { ...b, title: trimmedTitle, imageUrl: trimmedLink }
                                  : b
                              )
                            }));
                            setEditingBookCoverId(null);
                          } else {
                            setSiteContent((prev: any) => ({
                              ...prev,
                              booksCovers: [
                                ...(prev.booksCovers || []),
                                { id: `bk_${Date.now()}`, title: trimmedTitle, imageUrl: trimmedLink }
                              ]
                            }));
                          }
                          setBookShowcaseTitle('');
                          setBookShowcaseLink('');
                        }}
                        className="bg-[#1b1b38] border border-purple-500/35 rounded-xl p-4 space-y-3"
                      >
                        <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <BookMarked size={14} /> {editingBookCoverId ? 'বইয়ের তথ্য আপডেট করুন' : 'বইয়ের কভার ও নাম যোগ করুন'}
                        </p>
                        {!activeCloudUser && !isCloneMode && (
                          <p className="text-[11px] text-emerald-300/90 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
                            সব ডিভাইস ও শেয়ার লিংকে বইগুলো সংরক্ষণ করতে মেনু থেকে Google দিয়ে সিঙ্ক (rajibshahani9@gmail.com) চালু রাখুন।
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={bookShowcaseTitle}
                            onChange={(e) => setBookShowcaseTitle(e.target.value)}
                            placeholder="বইয়ের নাম লিখুন..."
                            className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-['Aikya','Poppins',sans-serif]"
                            required
                          />
                          <input
                            type="text"
                            value={bookShowcaseLink}
                            onChange={(e) => setBookShowcaseLink(e.target.value)}
                            placeholder="গুগল ড্রাইভ ইমেজ লিংক দিন..."
                            className="w-full bg-[#101026] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="submit"
                            className="bg-gradient-to-r from-purple-600 to-amber-500 text-black font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 hover:brightness-110"
                          >
                            <PlusCircle size={14} /> {editingBookCoverId ? 'আপডেট করুন' : 'বই যোগ করুন'}
                          </button>
                          {editingBookCoverId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBookCoverId(null);
                                setBookShowcaseTitle('');
                                setBookShowcaseLink('');
                              }}
                              className="bg-white/10 hover:bg-white/20 text-gray-200 text-xs px-3 py-2 rounded-xl"
                            >
                              বাতিল
                            </button>
                          )}
                        </div>
                      </form>
                    )}

                    {booksCovers.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
                        {booksCovers.map((book) => (
                          <div
                            key={book.id}
                            className="group bg-[#0e0e22] border border-purple-500/35 hover:border-amber-400/70 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all relative"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const normalizedTitle = book.title
                                  .trim()
                                  .toLowerCase()
                                  .replace(/['’`]/g, '')
                                  .replace(/\s+/g, ' ');
                                if (normalizedTitle === 'how to solve a rubiks cube') {
                                  handlePageChange('rubiks-cube');
                                } else {
                                  handlePageChange(`book_${book.id}`);
                                }
                              }}
                              className="w-full flex flex-col gap-1.5 sm:gap-2 cursor-pointer text-left focus:outline-none"
                            >
                              <div className="w-full aspect-[2/3] rounded-lg sm:rounded-xl overflow-hidden bg-black/50 border border-purple-500/20">
                                <img
                                  src={normalizeImageUrl(book.imageUrl)}
                                  alt={book.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <h3 className="w-full text-[10px] sm:text-xs md:text-sm font-bold text-amber-200 text-center font-['Aikya','Poppins',sans-serif] leading-tight sm:leading-snug line-clamp-2 px-0.5 sm:px-1">
                                {book.title}
                              </h3>
                            </button>
                            {isAdmin && (
                              <div className="absolute top-2 right-2 sm:top-3.5 sm:right-3.5 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBookCoverId(book.id);
                                    setBookShowcaseTitle(book.title);
                                    setBookShowcaseLink(book.imageUrl);
                                  }}
                                  className="bg-amber-500/95 hover:bg-amber-400 text-black p-1 sm:p-1.5 rounded-md sm:rounded-lg shadow"
                                  title="এডিট করুন"
                                >
                                  <Edit2 size={10} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModal({
                                      message: `"${book.title}" বইটি ডিলিট করতে চান?`,
                                      onConfirm: () => {
                                        setSiteContent((prev: any) => {
                                          const curDelBooks: string[] = Array.isArray(prev.deletedBookIds) ? prev.deletedBookIds : [];
                                          return {
                                            ...prev,
                                            booksCovers: (prev.booksCovers || []).filter((b: any) => b.id !== book.id),
                                            deletedBookIds: curDelBooks.includes(book.id) ? curDelBooks : [...curDelBooks, book.id]
                                          };
                                        });
                                      }
                                    });
                                  }}
                                  className="bg-red-500/95 hover:bg-red-600 text-white p-1 sm:p-1.5 rounded-md sm:rounded-lg shadow"
                                  title="ডিলিট করুন"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (key === 'videoSlider') {
                return renderVideoSlider('ms-excel', 'এক্সেল ভিডিও স্লাইডার');
              }
              if (key === 'imageSlider') {
                return renderImageSlider(
                  currentPage,
                  currentPage === 'rubiks-cube' ? 'কিউব ইমেজ স্লাইডার' : 'সংগ্রহ ইমেজ স্লাইডার'
                );
              }
              if (key === 'subpageHeader') {
                return (
                  <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(120,50,255,0.15)] relative">
                    {isAdmin && (
                      <div className="absolute top-3 right-3 flex gap-1.5">
                        <button 
                          onClick={() => { setEditingKey(`subpage_${currentPage}_title`); setTempEditValue(activePageData?.title || ''); }}
                          className="bg-amber-500 text-black px-2 py-1 rounded text-xs font-bold"
                          title="শিরোনাম এডিট"
                        >
                          <Edit2 size={12} /> শিরোনাম এডিট
                        </button>
                        <button 
                          onClick={() => { setEditingKey(`subpage_${currentPage}_desc`); setTempEditValue(activePageData?.desc || ''); }}
                          className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-bold"
                          title="বিবরণ এডিট"
                        >
                          <Edit2 size={12} /> বিবরণ এডিট
                        </button>
                      </div>
                    )}
                    {currentPage === 'raj-magic-show' ? (
                      <a
                        href="https://wa.me/8801923866283"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-gradient-to-r from-purple-900/70 to-emerald-950/70 hover:brightness-110 text-amber-300 border border-emerald-500/50 px-3.5 py-1.5 rounded-full inline-flex items-center gap-2 mb-2 font-semibold transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] cursor-pointer"
                      >
                        <span>{activePageData?.category || 'কন্টাক্ট ফর ম্যাজিক শো'}</span>
                        <i className="fa-brands fa-whatsapp text-[#25D366] text-sm"></i>
                      </a>
                    ) : (
                      <span className="text-[11px] bg-purple-900/40 text-amber-300 border border-purple-500/40 px-3 py-1 rounded-full inline-block mb-2 font-medium">
                        {activePageData?.category}
                      </span>
                    )}
                    <h2 className="text-xl font-bold text-white mb-2">{activePageData?.title}</h2>
                    <p className="text-xs text-purple-200/80 leading-relaxed">{activePageData?.desc}</p>
                  </div>
                );
              }
              if (key === 'videosSection') {
                const hideVideoHeaderForUsers = ['raj-magic-show', 'match-box', 'chess', 'rubiks-cube'].includes(currentPage);
                return (
                  <div className="space-y-4">
                    {(isAdmin || !hideVideoHeaderForUsers) && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-purple-300">ভিডিও কনটেন্ট তালিকা</span>
                        {isAdmin && (
                          <button 
                            onClick={() => { setNewVideoTargetPage(currentPage); setShowAddVideoModal(true); }}
                            className="bg-gradient-to-r from-purple-600 to-amber-500 text-black text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:brightness-110 transition-all"
                          >
                            <PlusCircle size={14} /> নতুন ভিডিও যোগ করুন
                          </button>
                        )}
                      </div>
                    )}

                    {(!activePageData?.items || activePageData.items.length === 0) ? (
                      <>
                        {isAdmin && (
                          <div className="bg-[#13132b] border border-purple-500/30 p-6 rounded-2xl text-center text-purple-300 text-xs">
                            কোনো ভিডিও যোগ করা হয়নি। উপরে "নতুন ভিডিও যোগ করুন" বাটনে ক্লিক করে যুক্ত করুন।
                          </div>
                        )}
                        {(currentPage === 'raj-magic-show' || currentPage === 'chess') &&
                          renderVideoSlider(
                            currentPage,
                            currentPage === 'raj-magic-show' ? 'ম্যাজিক ভিডিও স্লাইডার' : 'দাবা ভিডিও স্লাইডার'
                          )
                        }
                      </>
                    ) : (
                      activePageData.items.map((item, idx) => (
                        <React.Fragment key={item.id || idx}>
                          <div className="bg-[#13132b] border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-[0_0_20px_rgba(120,50,255,0.15)] space-y-3">
                            {isAdmin && (
                              <div className="bg-purple-950/60 border border-purple-500/40 p-2 rounded-xl flex items-center justify-between text-xs text-purple-200">
                                <span>অ্যাডমিন: ভিডিও লিংক পরিবর্তন বা ডিলিট</span>
                                <div className="flex gap-1.5">
                                  <button 
                                    onClick={() => setVideoEditModal({ target: currentPage, id: item.id, link: item.yt || '' })}
                                    className="bg-amber-500 text-black px-2.5 py-1 rounded font-bold text-[10px]"
                                  >
                                    লিংক বদলান
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setConfirmModal({
                                        message: "এই আইটেমটি ডিলিট করতে চান?",
                                        onConfirm: () => {
                                          const updatedItems = (subpagesContent[currentPage] || []).filter((it: any) => it.id !== item.id);
                                          setSubpagesContent((prev: any) => ({ ...prev, [currentPage]: updatedItems }));
                                        }
                                      });
                                    }}
                                    className="bg-red-500 text-white px-2.5 py-1 rounded font-bold text-[10px]"
                                  >
                                    ডিলিট
                                  </button>
                                </div>
                              </div>
                            )}
                            {item.yt && (
                              <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-purple-500/30 mt-2 shadow-inner">
                                <iframe 
                                  src={getEmbedUrl(item.yt)} 
                                  title={item.title} 
                                  className="w-full h-full border-0" 
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                  allowFullScreen
                                ></iframe>
                              </div>
                            )}
                          </div>
                          {idx === 0 && (currentPage === 'raj-magic-show' || currentPage === 'chess') &&
                            renderVideoSlider(
                              currentPage,
                              currentPage === 'raj-magic-show' ? 'ম্যাজিক ভিডিও স্লাইডার' : 'দাবা ভিডিও স্লাইডার'
                            )
                          }
                        </React.Fragment>
                      ))
                    )}
                  </div>
                );
              }
              const blk = subCustom.find((b) => b.id === key);
              return blk ? renderCustomBlock(currentPage, blk) : null;
            };

            return (
              <div className="space-y-4">
                {currentPage === 'raj-magic-show' ? (
                  <div className="w-full grid grid-flow-col auto-cols-fr items-stretch gap-1 sm:gap-1.5">
                    {!isSubCloneMode && (
                      <SubpageBackButton
                        iconUrl={getTabMetaForPage('home').iconUrl}
                        label={getTabMetaForPage('home').label}
                        onClick={() => handlePageChange('home')}
                        variant="home"
                        fluid
                      />
                    )}
                    <a
                      href="https://midnight-magician.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Magic App"
                      className="w-full aspect-square min-w-0 bg-[#12122a] hover:bg-[#1b1b3d] border border-cyan-400/50 hover:border-cyan-300 px-0.5 sm:px-1.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors shadow-[0_0_15px_rgba(34,211,238,0.25)] overflow-hidden"
                    >
                      <img
                        src="/assets/midnight-magician-logo.png"
                        alt="Magic App"
                        className="w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 min-[430px]:w-8 min-[430px]:h-8 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                      />
                      <span className="text-[7.5px] min-[370px]:text-[8.5px] min-[430px]:text-[9.5px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold text-cyan-200 leading-tight whitespace-nowrap max-w-full truncate px-0.5">
                        Magic App
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handlePageChange('tas-vanish')}
                      title="তাস ভ্যানিস"
                      className="w-full aspect-square min-w-0 bg-[#12122a] hover:bg-[#1b1b3d] border border-amber-400/50 hover:border-amber-300 px-0.5 sm:px-1.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.25)] overflow-hidden cursor-pointer"
                    >
                      <img
                        src="/assets/aistudio/card__Logo_91ce8353.png"
                        alt="তাস ভ্যানিস"
                        className="w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 min-[430px]:w-8 min-[430px]:h-8 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                      />
                      <span className="text-[7.5px] min-[370px]:text-[8.5px] min-[430px]:text-[9.5px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold text-amber-200 leading-tight whitespace-nowrap max-w-full truncate px-0.5">
                        তাস ভ্যানিস
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange('tas-prediction')}
                      title="তাস প্রেডিকশন"
                      className="w-full aspect-square min-w-0 bg-[#12122a] hover:bg-[#1b1b3d] border border-sky-400/50 hover:border-sky-300 px-0.5 sm:px-1.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.25)] overflow-hidden cursor-pointer"
                    >
                      <img
                        src="/assets/aistudio/Card_PPP_64d477c3.png"
                        alt="তাস প্রেডিকশন"
                        className="w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 min-[430px]:w-8 min-[430px]:h-8 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                      />
                      <span className="text-[7.5px] min-[370px]:text-[8.5px] min-[430px]:text-[9.5px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold text-sky-200 leading-tight whitespace-nowrap max-w-full truncate px-0.5">
                        তাস প্রেডিকশন
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          if (document.documentElement?.requestFullscreen && !document.fullscreenElement) {
                            void document.documentElement.requestFullscreen().catch(() => {});
                          }
                        } catch {
                          // Fallback fullscreen lock screen still applies
                        }
                        handlePageChange('pin-card');
                      }}
                      title="পিন কার্ড"
                      className="w-full aspect-square min-w-0 bg-[#12122a] hover:bg-[#1b1b3d] border border-emerald-400/50 hover:border-emerald-300 px-0.5 sm:px-1.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.25)] overflow-hidden cursor-pointer"
                    >
                      <img
                        src="/assets/aistudio/Pin_Card_3fbe59ac.png"
                        alt="পিন কার্ড"
                        className="w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 min-[430px]:w-8 min-[430px]:h-8 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                      />
                      <span className="text-[7.5px] min-[370px]:text-[8.5px] min-[430px]:text-[9.5px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold text-emerald-200 leading-tight whitespace-nowrap max-w-full truncate px-0.5">
                        পিন কার্ড
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange('taser-ghori')}
                      title="তাসের ঘড়ি"
                      className="w-full aspect-square min-w-0 bg-[#12122a] hover:bg-[#1b1b3d] border border-rose-400/50 hover:border-rose-300 px-0.5 sm:px-1.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors shadow-[0_0_15px_rgba(244,63,94,0.25)] overflow-hidden cursor-pointer"
                    >
                      <img
                        src="/assets/aistudio/Card_Clock_e1f093bf.png"
                        alt="তাসের ঘড়ি"
                        className="w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 min-[430px]:w-8 min-[430px]:h-8 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                      />
                      <span className="text-[7.5px] min-[370px]:text-[8.5px] min-[430px]:text-[9.5px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold text-rose-200 leading-tight whitespace-nowrap max-w-full truncate px-0.5">
                        তাসের ঘড়ি
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange('iskaponer-tekka')}
                      title="ইস্কাপনের টেক্কা"
                      className="w-full aspect-square min-w-0 bg-[#12122a] hover:bg-[#1b1b3d] border border-fuchsia-400/50 hover:border-fuchsia-300 px-0.5 sm:px-1.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors shadow-[0_0_15px_rgba(217,70,239,0.25)] overflow-hidden cursor-pointer"
                    >
                      <img
                        src="/assets/aistudio/df_e0688293.png"
                        alt="ইস্কাপনের টেক্কা"
                        className="w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 min-[430px]:w-8 min-[430px]:h-8 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                      />
                      <span className="text-[7.5px] min-[370px]:text-[8.5px] min-[430px]:text-[9.5px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold text-fuchsia-200 leading-tight whitespace-nowrap max-w-full truncate px-0.5">
                        ইস্কাপনের টেক্কা
                      </span>
                    </button>
                    {(Array.isArray(siteContent.pageInnerTabs?.['raj-magic-show']) ? siteContent.pageInnerTabs['raj-magic-show'] : []).map((tab: any) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handlePageChange(tab.id)}
                        title={tab.label || 'ট্যাব'}
                        className="w-full aspect-square min-w-0 bg-[#1b1b38]/95 border border-purple-500/35 text-purple-100 hover:border-amber-400/60 hover:bg-purple-900/40 px-0.5 sm:px-1.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all overflow-hidden cursor-pointer"
                      >
                        <img
                          src={normalizeImageUrl(tab.iconUrl)}
                          alt={tab.label || 'Tab'}
                          className="w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 min-[430px]:w-8 min-[430px]:h-8 sm:w-11 sm:h-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] shrink-0"
                        />
                        {tab.label && (
                          <span className="text-[7.5px] min-[370px]:text-[8.5px] min-[430px]:text-[9.5px] sm:text-[11px] font-['Aikya','Poppins',sans-serif] font-bold leading-tight whitespace-nowrap max-w-full truncate px-0.5">
                            {tab.label}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  renderSubpageTopBar(currentPage)
                )}

                {/* HEADER BANNER FOR EACH SUBPAGE */}
                <div className="space-y-2 text-center">
                  {isAdmin && (
                    <div className="flex justify-center mb-1">
                      <button 
                        onClick={() => openImageEditorModal(`banner_${currentPage}`, pageBannersMap[currentPage] || '', 'সাব-পেজ ব্যানার ইমেজ (ড্রাইভ লিংক)', true)}
                        className="bg-amber-500 text-black px-3 py-1.5 rounded-xl text-xs font-bold shadow hover:brightness-110 transition-all inline-flex items-center gap-1.5"
                      >
                        <ImageIcon size={14} /> ব্যানার ইমেজ পরিবর্তন করুন
                      </button>
                    </div>
                  )}
                  {renderResizableImage(
                    pageBannersMap[currentPage] || "",
                    `banner_${currentPage}`,
                    'Subpage Banner',
                    'w-full mx-auto rounded-2xl shadow-[0_0_30px_rgba(120,50,255,0.2)]'
                  )}
                </div>

                {renderPageSectionsList(currentPage, subBuiltIn, subOrder, subCustom, subLabels, renderSubSection)}
                {renderDeletedBuiltInRestoreBar(currentPage, subBuiltIn, subLabels)}
              </div>
            );
          })()
        )}
        </React.Suspense>
      </main>

      {/* REQUIREMENT 5: COLORFUL SOCIAL MEDIA BRAND ICONS BAR AT THE BOTTOM (Midnight Magician style) */}
      {currentPage !== 'pin-card' && (
      <>
      <nav className="theme-bottom-nav sticky bottom-0 z-50 bg-[#0d0d1f]/95 backdrop-blur-md border-t border-purple-500/30 py-2.5 px-4 flex justify-center items-center gap-3 sm:gap-6 shadow-[0_-4px_25px_rgba(120,50,255,0.15)]">
        {(siteContent.socialLinks || []).map((soc: any, idx: number) => (
          <a
            key={soc.id || idx}
            href={normalizeExternalUrl(soc.url)}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br ${soc.bg} border ${soc.border} flex items-center justify-center transition-all hover:scale-110 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] text-base sm:text-lg`}
            title={soc.name}
          >
            {soc.isX ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="w-4 h-4 sm:w-[18px] sm:h-[18px] fill-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            ) : (
              <i className={soc.icon} style={{ color: soc.color, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}></i>
            )}
          </a>
        ))}
      </nav>

      {/* FOOTER */}
      <footer className="theme-footer text-center py-4 text-xs text-purple-300/60 border-t border-purple-500/20 bg-[#06060e] space-y-1 z-10 px-4">
        {siteContent.footerLine1 && <p>{siteContent.footerLine1}</p>}
        {(siteContent.footerSiteLabel || siteContent.footerSiteLinkText) && (
          <p>
            {siteContent.footerSiteLabel ? `${siteContent.footerSiteLabel} ` : ''}
            {siteContent.footerSiteLinkText && (
              siteContent.footerSiteUrl ? (
                <a
                  href={normalizeExternalUrl(siteContent.footerSiteUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-300 hover:underline"
                >
                  {siteContent.footerSiteLinkText}
                </a>
              ) : (
                <span className="text-amber-300">{siteContent.footerSiteLinkText}</span>
              )
            )}
          </p>
        )}
      </footer>
      </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
