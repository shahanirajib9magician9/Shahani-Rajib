import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Search, Copy, Check, X } from 'lucide-react';
import { BOOKS_SHEET_DATA, BookEntry } from '../data/booksSheetData';

const toBanglaDigits = (num: number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[Number(d)]);
};

export default function BooksSheetReader() {
  const [selectedBookId, setSelectedBookId] = useState<string>(BOOKS_SHEET_DATA[0]?.id || '');
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeBook = BOOKS_SHEET_DATA.find((b) => b.id === selectedBookId) || BOOKS_SHEET_DATA[0];
  const activeItems: BookEntry[] = activeBook?.items || [];

  const filteredItems = filterText.trim()
    ? activeItems.filter((item) =>
        item.title.toLowerCase().includes(filterText.trim().toLowerCase())
      )
    : activeItems;

  const selectedEntry = selectedRow !== null
    ? activeItems.find((item) => item.row === selectedRow) || null
    : null;

  const selectedArrayIdx = selectedEntry
    ? activeItems.findIndex((item) => item.row === selectedEntry.row)
    : -1;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBookChange = (newBookId: string) => {
    setSelectedBookId(newBookId);
    setSelectedRow(null);
    setFilterText('');
    setIsDropdownOpen(false);
  };

  const handleSelectEntry = (entry: BookEntry) => {
    setSelectedRow(entry.row);
    setFilterText('');
    setIsDropdownOpen(false);
  };

  const handleCopyContent = () => {
    if (!selectedEntry) return;
    navigator.clipboard.writeText(selectedEntry.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="space-y-4 font-['Aikya','Hind_Siliguri',sans-serif]">
      <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-4 sm:p-5 shadow-[0_0_25px_rgba(120,50,255,0.2)] space-y-4">
        {/* BOX 1: BOOK SELECTOR DROPDOWN */}
        <div className="space-y-1.5">
          <label
            htmlFor="book-collection-select"
            className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5"
          >
            <BookOpen size={15} /> বই নির্বাচন করুন
          </label>
          <div className="relative">
            <select
              id="book-collection-select"
              value={selectedBookId}
              onChange={(e) => handleBookChange(e.target.value)}
              className="w-full appearance-none bg-[#1b1b38] hover:bg-[#212144] border border-purple-500/50 focus:border-amber-400 rounded-xl px-4 py-3 pr-10 text-sm sm:text-base font-semibold text-white focus:outline-none transition-all cursor-pointer font-['Aikya','Hind_Siliguri',sans-serif]"
            >
              {BOOKS_SHEET_DATA.map((book) => (
                <option key={book.id} value={book.id} className="bg-[#13132b] text-white">
                  {book.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-300 pointer-events-none"
            />
          </div>
        </div>

        {/* BOX 2: DEPENDENT SEARCHABLE DROPDOWN (Shows all titles automatically without needing to type) */}
        <div className="space-y-1.5" ref={dropdownRef}>
          <label className="text-xs sm:text-sm font-bold text-amber-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Search size={15} /> কবিতা নির্বাচন করুন ({toBanglaDigits(activeItems.length)}টি)
            </span>
            {selectedEntry && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRow(null);
                  setFilterText('');
                }}
                className="text-[11px] text-purple-300 hover:text-amber-300 inline-flex items-center gap-1"
              >
                <X size={12} /> মুছুন
              </button>
            )}
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }
                  return next;
                });
              }}
              aria-expanded={isDropdownOpen}
              className="w-full bg-[#1b1b38] hover:bg-[#212144] border border-purple-500/50 focus:border-amber-400 rounded-xl px-4 py-3 text-left flex items-center justify-between gap-2 transition-all cursor-pointer"
            >
              <span
                className={`text-sm sm:text-base truncate font-['Aikya','Hind_Siliguri',sans-serif] ${
                  selectedEntry ? 'text-white font-semibold' : 'text-purple-200/70'
                }`}
              >
                {selectedEntry
                  ? `${toBanglaDigits(selectedEntry.row)}. ${selectedEntry.title}`
                  : 'ড্রপডাউন থেকে কবিতা সিলেক্ট করুন...'}
              </span>
              <ChevronDown
                size={18}
                className={`text-amber-300 shrink-0 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 z-40 bg-[#101026] border border-purple-500/60 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden">
                <div className="p-2.5 border-b border-purple-500/30 bg-[#161633] flex items-center gap-2">
                  <Search size={14} className="text-amber-300 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="শিরোনাম লিখে খুঁজুন (ঐচ্ছিক)..."
                    className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-purple-300/50 focus:outline-none font-['Aikya','Hind_Siliguri',sans-serif]"
                  />
                  {filterText && (
                    <button
                      type="button"
                      onClick={() => setFilterText('')}
                      className="text-purple-300 hover:text-white"
                      aria-label="খোঁজা মুছুন"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-purple-500/15">
                  {filteredItems.length === 0 ? (
                    <div className="p-4 text-center text-xs sm:text-sm text-purple-300/70">
                      কোনো লেখা পাওয়া যায়নি।
                    </div>
                  ) : (
                    filteredItems.map((entry) => {
                      const isSelected = selectedEntry?.row === entry.row;
                      return (
                        <button
                          key={entry.row}
                          type="button"
                          onClick={() => handleSelectEntry(entry)}
                          className={`w-full text-left px-4 py-2.5 text-sm sm:text-base transition-colors flex items-center gap-2.5 font-['Aikya','Hind_Siliguri',sans-serif] ${
                            isSelected
                              ? 'bg-gradient-to-r from-purple-700/70 to-amber-500/20 text-amber-300 font-bold'
                              : 'text-purple-100 hover:bg-purple-800/40'
                          }`}
                        >
                          <span className="text-[11px] bg-purple-900/60 border border-purple-500/40 text-amber-300 px-2 py-0.5 rounded-md shrink-0 min-w-[28px] text-center">
                            {toBanglaDigits(entry.row)}
                          </span>
                          <span className="flex-1 leading-snug">{entry.title}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OUTPUT DISPLAY PANEL */}
      {selectedEntry && (
        <div className="bg-[#13132b] border border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_30px_rgba(120,50,255,0.2)] space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-purple-500/30 pb-3">
            <div className="space-y-1">
              <span className="inline-block text-[11px] bg-purple-900/50 text-amber-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full font-medium">
                {activeBook.title}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">
                {selectedEntry.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleCopyContent}
              className="bg-[#1b1b38] hover:bg-purple-900/50 border border-purple-500/40 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shrink-0"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'কপি হয়েছে' : 'কপি'}</span>
            </button>
          </div>

          <div className="text-[15px] sm:text-base text-purple-100/95 leading-[1.9] whitespace-pre-wrap font-['Aikya','Hind_Siliguri',sans-serif]">
            {selectedEntry.content}
          </div>

          {activeItems.length > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-purple-500/25 gap-2">
              <button
                type="button"
                disabled={selectedArrayIdx <= 0}
                onClick={() => {
                  if (selectedArrayIdx > 0) {
                    setSelectedRow(activeItems[selectedArrayIdx - 1].row);
                  }
                }}
                className="bg-[#1b1b38] hover:bg-purple-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 border border-purple-500/40 px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-all"
              >
                <ChevronLeft size={15} /> আগের লেখা
              </button>
              <span className="text-xs text-purple-300 font-semibold">
                {toBanglaDigits(selectedArrayIdx + 1)} / {toBanglaDigits(activeItems.length)}
              </span>
              <button
                type="button"
                disabled={selectedArrayIdx < 0 || selectedArrayIdx >= activeItems.length - 1}
                onClick={() => {
                  if (selectedArrayIdx >= 0 && selectedArrayIdx < activeItems.length - 1) {
                    setSelectedRow(activeItems[selectedArrayIdx + 1].row);
                  }
                }}
                className="bg-[#1b1b38] hover:bg-purple-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 border border-purple-500/40 px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-all"
              >
                পরের লেখা <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
