import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// German Flag SVG Component
const GermanFlag = () => (
  <svg className="w-5 h-3.5 rounded-xs border border-slate-300 shrink-0 shadow-2xs" viewBox="0 0 5 3">
    <rect width="5" height="1" y="0" fill="#000000" />
    <rect width="5" height="1" y="1" fill="#DD0000" />
    <rect width="5" height="1" y="2" fill="#FFCE00" />
  </svg>
);

// UK (English) Union Jack Flag SVG Component
const UKFlag = () => (
  <svg className="w-5 h-3.5 rounded-xs border border-slate-300 shrink-0 shadow-2xs" viewBox="0 0 60 30">
    <rect width="60" height="30" fill="#012169" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
    <path d="M30,0 V30 M0,15 H60" stroke="#ffffff" strokeWidth="10" />
    <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
  </svg>
);

const languages = [
  { code: 'de', name: 'German', FlagComponent: GermanFlag },
  { code: 'en', name: 'English', FlagComponent: UKFlag },
];

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLangCode = (i18n.language || 'en').slice(0, 2);
  const currentLang = languages.find((l) => l.code === currentLangCode) || languages[1];

  const changeLanguage = (lngCode) => {
    i18n.changeLanguage(lngCode);
    localStorage.setItem('language', lngCode);
    localStorage.setItem('locale', lngCode);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const SelectedFlag = currentLang.FlagComponent;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button Matching Reference Box */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 bg-[#EEEEEE] hover:bg-[#E2E2E2] border border-slate-300 rounded-xs text-xs font-medium text-slate-800 shadow-2xs transition cursor-pointer"
      >
        <SelectedFlag />
        <span className="font-sans text-xs font-semibold text-slate-800">{currentLang.name}</span>
        <svg
          className={`w-3 h-3 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu Matching Reference Image */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-36 bg-[#F5F5F5] border border-slate-300 rounded-xs shadow-md py-0 z-50 overflow-hidden divide-y divide-slate-200">
          {languages.map((lng) => {
            const Flag = lng.FlagComponent;
            const isSelected = currentLang.code === lng.code;
            return (
              <button
                key={lng.code}
                onClick={() => changeLanguage(lng.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition text-left cursor-pointer ${
                  isSelected ? 'bg-[#E5E5E5] text-slate-900 font-bold' : 'bg-[#F5F5F5] text-slate-800 hover:bg-[#EAEAEA]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Flag />
                  <span>{lng.name}</span>
                </div>
                {isSelected && (
                  <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
