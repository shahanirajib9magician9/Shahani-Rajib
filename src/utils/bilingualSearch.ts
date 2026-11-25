// Smart Bilingual (English / Banglish <-> Bengali) Search Utility
// Translates English & Banglish queries (including partial prefixes like "matchbo", "kobit")
// to Bengali equivalents AND transliterates any Bengali site content into phonetic Latin
// so English, Banglish, and Bengali queries all find matching site content seamlessly.

const ENGLISH_BANG_DICTIONARY: Record<string, string[]> = {
  // Core navigation & hobbies on site
  magic: ['ম্যাজিক', 'জাদু', 'ইল্যুশন', 'হাতসাফাই', 'ক্লোজ-আপ', 'কার্ড ট্রিকস'],
  magician: ['ম্যাজিশিয়ান', 'জাদুকর', 'ম্যাজিক'],
  illusion: ['ইল্যুশন', 'ম্যাজিক'],
  trick: ['ট্রিক', 'ট্রিকস', 'কৌশল', 'ম্যাজিক'],
  jadu: ['জাদু', 'ম্যাজিক'],
  zadukor: ['জাদুকর', 'ম্যাজিক'],
  card: ['কার্ড', 'তাস', 'তাসের'],
  cards: ['কার্ড', 'তাস', 'তাসের'],
  tas: ['তাস', 'তাসের', 'কার্ড'],
  taser: ['তাসের', 'তাস'],
  clock: ['ঘড়ি', 'তাসের ঘড়ি'],
  watch: ['ঘড়ি'],
  ghori: ['ঘড়ি', 'তাসের ঘড়ি'],
  vanish: ['ভ্যানিস', 'তাস ভ্যানিস'],
  disappear: ['ভ্যানিস'],
  prediction: ['প্রেডিকশন', 'তাস প্রেডিকশন'],
  predict: ['প্রেডিকশন'],
  pin: ['পিন', 'পিন কার্ড'],
  ace: ['টেক্কা', 'ইস্কাপনের টেক্কা'],
  spade: ['ইস্কাপন', 'ইস্কাপনের টেক্কা'],
  spades: ['ইস্কাপন', 'ইস্কাপনের টেক্কা'],
  iskapon: ['ইস্কাপন', 'ইস্কাপনের টেক্কা'],
  tekka: ['টেক্কা', 'ইস্কাপনের টেক্কা'],
  midnight: ['মিডনাইট', 'নিশিপাওয়া'],

  // Cube & Puzzles
  cube: ['কিউব', 'রুবিক্স কিউব', 'রুবিক্স'],
  rubik: ['রুবিক্স', 'কিউব'],
  rubiks: ['রুবিক্স', 'কিউব'],
  kiub: ['কিউব', 'রুবিক্স'],
  puzzle: ['পাজল', 'লজিক', 'কিউব'],
  logic: ['লজিক', 'পাজল'],
  algorithm: ['অ্যালগরিদম'],
  math: ['গাণিতিক', 'অঙ্ক'],
  pattern: ['প্যাটার্ন'],

  // Matchbox & Collection
  matchbox: ['ম্যাচবক্স', 'দিয়াশলাই', 'সংগ্রহ'],
  match: ['ম্যাচবক্স', 'দিয়াশলাই'],
  diaslai: ['দিয়াশলাই', 'ম্যাচবক্স'],
  diashlai: ['দিয়াশলাই', 'ম্যাচবক্স'],
  collection: ['সংগ্রহ', 'সংগ্রহশালা'],
  collect: ['সংগ্রহ'],
  songroho: ['সংগ্রহ', 'ম্যাচবক্স'],
  shongroho: ['সংগ্রহ', 'ম্যাচবক্স'],
  vintage: ['ভিন্টেজ'],
  antique: ['অ্যান্টিক'],
  hobby: ['শখ'],

  // Chess
  chess: ['দাবা', 'দাবা খেলা', 'চেক-মেট', 'সিসিলিয়ান'],
  daba: ['দাবা', 'দাবা খেলা'],
  checkmate: ['চেক-মেট', 'দাবা'],
  sicilian: ['সিসিলিয়ান', 'দাবা'],
  game: ['খেলা'],
  khela: ['খেলা', 'দাবা খেলা'],

  // Books, Poetry & Literature
  book: ['বই', 'বই ও প্রকাশনা', 'পুস্তক', 'সাহিত্য'],
  books: ['বই', 'বই ও প্রকাশনা', 'পুস্তক', 'সাহিত্য'],
  boi: ['বই', 'বই ও প্রকাশনা'],
  pustok: ['পুস্তক', 'বই'],
  poem: ['কবিতা', 'পদ্য', 'ছড়া', 'কাব্য', 'কবি', 'সাহিত্য'],
  poems: ['কবিতা', 'পদ্য', 'ছড়া', 'কাব্য', 'সাহিত্য'],
  poetry: ['কবিতা', 'কাব্য', 'পদ্য', 'সাহিত্য'],
  verse: ['পদ্য', 'কবিতা'],
  kobita: ['কবিতা', 'কবিতার', 'কবি', 'পদ্য'],
  kabita: ['কবিতা', 'পদ্য'],
  poet: ['কবি', 'কবিতা'],
  kobi: ['কবি', 'কবিতা'],
  story: ['গল্প', 'রূপকথা', 'সাহিত্য', 'ব্লগ'],
  stories: ['গল্প', 'রূপকথা', 'সাহিত্য'],
  golpo: ['গল্প'],
  galpo: ['গল্প'],
  literature: ['সাহিত্য', 'বই ও প্রকাশনা', 'কবিতা'],
  sahitya: ['সাহিত্য'],
  sahitto: ['সাহিত্য'],
  magazine: ['ম্যাগাজিন', 'প্রবন্ধ'],
  article: ['প্রবন্ধ', 'ব্লগ'],
  essay: ['প্রবন্ধ', 'রচনা'],
  probondho: ['প্রবন্ধ'],
  publication: ['প্রকাশনা', 'বই ও প্রকাশনা'],
  write: ['লেখা', 'লেখালেখি'],
  writing: ['লেখালেখি', 'ব্লগ'],
  lekha: ['লেখা', 'লেখালেখি'],
  read: ['পড়া'],
  meghmaloti: ['মেঘমালতী'],

  // Excel & Professional Skills
  excel: ['এক্সেল', 'এমএস এক্সেল'],
  ekshel: ['এক্সেল', 'এমএস এক্সেল'],
  spreadsheet: ['এক্সেল', 'এমএস এক্সেল'],
  shortcut: ['শর্টকাট'],
  automation: ['অটোমেশন'],
  data: ['ডেটা', 'ডাটা'],
  analysis: ['অ্যানালাইসিস'],
  skill: ['স্কিল', 'স্কিলস', 'দক্ষতা'],
  skills: ['স্কিলস', 'প্রফেশনাল স্কিলস'],
  professional: ['প্রফেশনাল'],

  // Career, Job, CV, Resume, Hire
  career: ['ক্যারিয়ার', 'কর্মজীবন', 'পেশাগত'],
  job: ['জব', 'জব হিস্ট্রি', 'কর্মজীবন', 'চাকরি'],
  history: ['হিস্ট্রি', 'জব হিস্ট্রি', 'ইতিহাস'],
  resume: ['রেজ্যুমে', 'রেজ্যুমে/সিভি', 'সিভি', 'জীবনবৃত্তান্ত'],
  cv: ['সিভি', 'রেজ্যুমে/সিভি', 'জীবনবৃত্তান্ত'],
  biodata: ['জীবনবৃত্তান্ত', 'সিভি'],
  hire: ['ক্যারিয়ার', 'জব', 'রেজ্যুমে/সিভি'],
  work: ['কর্মজীবন', 'কাজ', 'অভিজ্ঞতা'],
  experience: ['অভিজ্ঞতা'],
  project: ['প্রজেক্ট'],
  management: ['ম্যানেজমেন্ট'],
  manager: ['ম্যানেজার'],

  // Education, Certificates, Trainer, Award, Art, Blog, About
  education: ['এডুকেশন', 'শিক্ষা', 'শিক্ষাগত', 'একাডেমিক', 'ডিগ্রি'],
  study: ['পড়াশোনা', 'শিক্ষা'],
  degree: ['ডিগ্রি', 'এডুকেশন'],
  academic: ['একাডেমিক', 'এডুকেশন'],
  shikkha: ['শিক্ষা', 'শিক্ষাগত', 'এডুকেশন'],
  certificate: ['সার্টিফিকেট', 'সনদ', 'সনদপত্র', 'সম্মাননা'],
  certificates: ['সার্টিফিকেট', 'সনদপত্র'],
  sonod: ['সনদ', 'সনদপত্র', 'সার্টিফিকেট'],
  record: ['রেকর্ড', 'রেকর্ডস'],
  award: ['অ্যাওয়ার্ড', 'পুরস্কার', 'সম্মাননা', 'অর্জন'],
  awards: ['অ্যাওয়ার্ড', 'পুরস্কার', 'সম্মাননা'],
  prize: ['পুরস্কার', 'অ্যাওয়ার্ড'],
  honor: ['সম্মাননা', 'অ্যাওয়ার্ড'],
  puroskar: ['পুরস্কার', 'অ্যাওয়ার্ড'],
  achievement: ['অর্জন', 'অ্যাওয়ার্ড'],
  trainer: ['ট্রেইনার', 'প্রশিক্ষণ', 'কর্মশালা', 'ট্রেনিং'],
  training: ['প্রশিক্ষণ', 'ট্রেনিং', 'ট্রেইনার', 'কর্মশালা'],
  workshop: ['কর্মশালা', 'ওয়ার্কশপ', 'ট্রেইনার'],
  session: ['সেশন', 'ট্রেইনার'],
  art: ['আর্ট', 'চিত্র', 'ছবি', 'আঁকা', 'গ্যালারি'],
  arts: ['আর্ট', 'চিত্র', 'গ্যালারি'],
  drawing: ['আঁকা', 'আর্ট', 'ছবি'],
  painting: ['আর্ট', 'চিত্র', 'ছবি'],
  sketch: ['আর্ট', 'ছবি'],
  gallery: ['গ্যালারি', 'ছবি'],
  chobi: ['ছবি', 'আর্ট'],
  chhobi: ['ছবি', 'আর্ট'],
  blog: ['ব্লগ', 'প্রবন্ধ', 'ভাবনা', 'গল্প'],
  thought: ['ভাবনা', 'ব্লগ'],
  about: ['সম্পর্কে', 'পরিচিতি', 'শাহানী', 'রাজীব'],
  profile: ['প্রোফাইল', 'শাহানী রাজীব'],
  bio: ['পরিচিতি', 'জীবনবৃত্তান্ত', 'শাহানী'],
  shahani: ['শাহানী', 'শাহানী রাজীব'],
  rajib: ['রাজীব', 'শাহানী রাজীব'],
  raj: ['রাজ', 'রাজ ম্যাজিক'],
  home: ['হোম'],

  // Media & Common Bengali words
  video: ['ভিডিও'],
  audio: ['অডিও'],
  music: ['গান', 'সংগীত', 'অডিও'],
  song: ['গান'],
  gan: ['গান'],
  photo: ['ছবি', 'ইমেজ', 'ফটো'],
  image: ['ইমেজ', 'ছবি'],
  picture: ['ছবি', 'ইমেজ'],
  love: ['ভালোবাসা', 'প্রেম'],
  valobasha: ['ভালোবাসা'],
  bhalobasha: ['ভালোবাসা'],
  dream: ['স্বপ্ন'],
  shopno: ['স্বপ্ন'],
  swapno: ['স্বপ্ন'],
  night: ['রাত', 'রাত্রি', 'নিশি'],
  rat: ['রাত', 'রাত্রি'],
  ratry: ['রাত্রি'],
  moon: ['চাঁদ', 'জোছনা'],
  chand: ['চাঁদ'],
  sky: ['আকাশ'],
  akash: ['আকাশ'],
  flower: ['ফুল'],
  ful: ['ফুল'],
  phul: ['ফুল'],
  rain: ['বৃষ্টি'],
  brishti: ['বৃষ্টি'],
  bristi: ['বৃষ্টি'],
  heart: ['হৃদয়', 'মন'],
  mon: ['মন'],
  life: ['জীবন'],
  jibon: ['জীবন'],
  friend: ['বন্ধু'],
  bondhu: ['বন্ধু'],
  cup: ['পেপার কাপ', 'কাপ'],
  craft: ['নৈপুণ্য', 'কলা']
};

const BENGALI_CHAR_MAP: Record<string, string> = {
  'অ': 'o',
  'আ': 'a',
  'ই': 'i',
  'ঈ': 'i',
  'উ': 'u',
  'ঊ': 'u',
  'ঋ': 'ri',
  'এ': 'e',
  'ঐ': 'oi',
  'ও': 'o',
  'ঔ': 'ou',
  'া': 'a',
  'ি': 'i',
  'ী': 'i',
  'ু': 'u',
  'ূ': 'u',
  'ৃ': 'ri',
  'ে': 'e',
  'ৈ': 'oi',
  'ো': 'o',
  'ৌ': 'ou',
  'ক': 'k',
  'খ': 'kh',
  'গ': 'g',
  'ঘ': 'gh',
  'ঙ': 'ng',
  'চ': 'ch',
  'ছ': 'chh',
  'জ': 'j',
  'ঝ': 'jh',
  'ঞ': 'n',
  'ট': 't',
  'ঠ': 'th',
  'ড': 'd',
  'ঢ': 'dh',
  'ণ': 'n',
  'ত': 't',
  'থ': 'th',
  'দ': 'd',
  'ধ': 'dh',
  'ন': 'n',
  'প': 'p',
  'ফ': 'f',
  'ব': 'b',
  'ভ': 'bh',
  'ম': 'm',
  'য': 'j',
  'র': 'r',
  'ল': 'l',
  'শ': 'sh',
  'ষ': 'sh',
  'স': 's',
  'হ': 'h',
  'ড়': 'r',
  'ঢ়': 'rh',
  'য়': 'y',
  'ৎ': 't',
  'ং': 'ng',
  'ঃ': 'h',
  'ঁ': 'n',
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9'
};

const BENGALI_CONSONANTS = new Set([
  'ক', 'খ', 'গ', 'ঘ', 'ঙ',
  'চ', 'ছ', 'জ', 'ঝ', 'ঞ',
  'ট', 'ঠ', 'ড', 'ঢ', 'ণ',
  'ত', 'থ', 'দ', 'ধ', 'ন',
  'প', 'ফ', 'ব', 'ভ', 'ম',
  'য', 'র', 'ল', 'শ', 'ষ',
  'স', 'হ', 'ড়', 'ঢ়', 'য়'
]);

const BENGALI_VOWEL_SIGNS = new Set([
  'া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ', '্'
]);

const BENGALI_VOWELS = new Set([
  'অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ'
]);

export function bengaliToLatinPhonetic(text: string): string {
  if (!text) return '';
  let primary = '';
  const chars = Array.from(text);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1] || '';
    const next2 = chars[i + 2] || '';

    // Handle য-ফলা (্য + optional া)
    if (ch === '্' && next === 'য') {
      if (next2 === 'া') {
        primary += 'ya';
        i += 2;
      } else {
        primary += 'y';
        i += 1;
      }
      continue;
    }

    if (ch === '্') {
      continue;
    }

    if (ch === 'য়') {
      const prev = chars[i - 1] || '';
      if (BENGALI_VOWELS.has(prev) || BENGALI_VOWEL_SIGNS.has(prev)) {
        primary += BENGALI_VOWELS.has(next) || BENGALI_VOWEL_SIGNS.has(next) ? 'y' : '';
      } else {
        primary += 'y';
      }
      continue;
    }

    const mapped = BENGALI_CHAR_MAP[ch];
    if (mapped !== undefined) {
      primary += mapped;
      // Add inherent vowel 'o' for Bengali consonants when followed by another consonant/vowel (e.g. কবিতা -> kobita, বই -> boi)
      if (
        BENGALI_CONSONANTS.has(ch) &&
        !BENGALI_VOWEL_SIGNS.has(next) &&
        next !== '' &&
        !/[\s.,!?;:\-_/|()'"৳]/.test(next)
      ) {
        primary += 'o';
      }
    } else {
      primary += ch.toLowerCase();
    }
  }

  // Generate common Banglish / English loanword spelling variants for seamless matching
  const collapsed = primary
    .replace(/ya/g, 'a')
    .replace(/ks/g, 'x')
    .replace(/chh/g, 'ch')
    .replace(/bh/g, 'v')
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's');

  const loanwordNormalized = primary
    .replace(/myach/g, 'match')
    .replace(/mach/g, 'match')
    .replace(/boks/g, 'box')
    .replace(/ks/g, 'x')
    .replace(/eks/g, 'ex')
    .replace(/myajik/g, 'magic')
    .replace(/majik/g, 'magic')
    .replace(/kiub/g, 'cube')
    .replace(/rubiks/g, 'rubiks')
    .replace(/sel/g, 'cel');

  return `${primary} ${collapsed} ${loanwordNormalized}`.trim();
}

export function expandSearchTerms(rawQuery: string): {
  bengaliTerms: string[];
  latinTerms: string[];
} {
  const cleaned = rawQuery.trim().toLowerCase();
  if (!cleaned) return { bengaliTerms: [], latinTerms: [] };

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const bengaliSet = new Set<string>();
  const latinSet = new Set<string>([cleaned]);

  const addForToken = (tok: string) => {
    latinSet.add(tok);
    // Normalize common Banglish variants in user's query too
    const normalizedBanglish = tok
      .replace(/ph/g, 'f')
      .replace(/bh/g, 'v')
      .replace(/sh/g, 's')
      .replace(/oo/g, 'u')
      .replace(/ee/g, 'i');
    if (normalizedBanglish !== tok) latinSet.add(normalizedBanglish);

    // Check if query has Bengali characters directly
    if (/[\u0980-\u09FF]/.test(tok)) {
      bengaliSet.add(tok);
    }

    // Lookup English / Banglish -> Bengali dictionary (supports prefix match for >= 3 chars, e.g., "matchbo", "kobit")
    for (const [engKey, bnList] of Object.entries(ENGLISH_BANG_DICTIONARY)) {
      const exactOrContained =
        engKey === tok ||
        (tok.length >= 3 && engKey.startsWith(tok)) ||
        (tok.length >= 4 && engKey.includes(tok)) ||
        (engKey.length >= 3 && tok.startsWith(engKey));
      if (exactOrContained) {
        bnList.forEach((bn) => bengaliSet.add(bn.toLowerCase()));
        latinSet.add(engKey);
      }
    }
  };

  addForToken(cleaned);
  tokens.forEach(addForToken);

  return {
    bengaliTerms: Array.from(bengaliSet),
    latinTerms: Array.from(latinSet).filter((t) => t.length >= 1)
  };
}

export function matchesBilingualSearch(
  rawText: string,
  phoneticLatinText: string,
  rawQuery: string
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const lowerRaw = rawText.toLowerCase();
  if (lowerRaw.includes(q)) return true;

  const { bengaliTerms, latinTerms } = expandSearchTerms(q);

  for (const bn of bengaliTerms) {
    if (lowerRaw.includes(bn)) return true;
  }

  for (const lat of latinTerms) {
    if (lat.length >= 2 && phoneticLatinText.includes(lat)) return true;
  }

  // Multi-word query: match if every token (>= 2 chars) matches either Bengali or Latin
  const queryWords = q.split(/\s+/).filter((w) => w.length >= 2);
  if (queryWords.length > 1) {
    const allMatch = queryWords.every((word) =>
      matchesBilingualSearch(rawText, phoneticLatinText, word)
    );
    if (allMatch) return true;
  }

  return false;
}
