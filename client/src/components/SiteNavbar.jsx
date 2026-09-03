import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';

const primaryActionButtonClass =
  'bg-[#E62E52] hover:bg-[#d42b4b] text-white rounded-2xl shadow-sm shadow-[#E62E52]/20 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E62E52]/60';

/**
 * Shared top navigation bar used by both LandingPage and all legal pages
 * (via SitePageLayout). Includes the desktop nav links and a mobile hamburger
 * menu with backdrop overlay — identical behaviour in both contexts.
 *
 * @param {object}   props
 * @param {string}   [props.basePath='#'] - Prefix for anchor links.
 *   Pass '' (empty string) when the navbar is rendered on the landing page
 *   itself so that '#modules' resolves correctly.
 *   Pass '/' when rendered on any other page so that '/#modules' jumps to
 *   the landing page section.
 */
const SiteNavbar = ({ basePath = '/' }) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const close = () => setMobileMenuOpen(false);

  const navLinks = [
    { label: 'Modules',          href: `${basePath}#modules` },
    { label: 'Certifications',   href: `${basePath}#certifications` },
    { label: 'About Us',         href: `${basePath}#about` },
    { label: 'Verify Credential', href: `${basePath}#verification` },
  ];

  return (
    <header className="bg-[#062452] text-white sticky top-0 z-40 border-b border-blue-900/40 shadow-md">
      <div className="px-6 sm:px-12 lg:px-16 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center cursor-pointer group" onClick={() => navigate('/')}>
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-none group-hover:text-blue-100 transition">
              <Logo size="full" variant="light" className="h-10" />
            </span>
          </div>
        </div>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-blue-100/90">
          {navLinks.map(({ label, href }) => (
            <a key={label} href={href} className="hover:text-white transition">
              {label}
            </a>
          ))}
        </nav>

        {/* Right: Login + Hamburger */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/login')}
            className={`${primaryActionButtonClass} text-xs sm:text-sm font-bold px-5 sm:px-6 py-2 sm:py-2.5 active:scale-95`}
          >
            Login
          </button>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-blue-100 hover:text-white hover:bg-blue-900/50 rounded-xl transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-slate-950/40"
            aria-hidden="true"
            onClick={close}
          />
          {/* Panel */}
          <div className="md:hidden fixed left-0 right-0 top-[52px] z-50 border-t border-blue-900/60 bg-[#062452]/95 backdrop-blur-md px-6 py-4 space-y-1">
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={close}
                className="block text-sm font-semibold text-blue-100 hover:text-white hover:bg-blue-900/40 px-3 py-2.5 rounded-xl transition"
              >
                {label}
              </a>
            ))}
          </div>
        </>
      )}
    </header>
  );
};

export default SiteNavbar;
