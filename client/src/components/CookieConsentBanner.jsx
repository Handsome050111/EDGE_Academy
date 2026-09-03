import { Link } from 'react-router-dom';
import { useCookieConsent } from '../context/CookieConsentContext';

const CookieConsentBanner = () => {
  const { showBanner, accept, decline } = useCookieConsent();

  if (!showBanner) return null;

  return (
    <aside
      id="cookie-banner"
      role="region"
      aria-label="Cookie consent banner"
      className="fixed inset-x-0 bottom-0 z-50 w-full border-t border-slate-200 bg-white py-4 px-6 sm:px-10 lg:px-16 text-slate-900 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] transition-all duration-300 animate-slideUp"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-center text-sm leading-normal text-slate-700 sm:text-left">
          We use cookies to improve your experience.{' '}
          <Link
            to="/cookies"
            className="font-semibold text-[#E62E52] underline underline-offset-4 transition hover:text-[#d42b4b]"
          >
            Cookie Policy
          </Link>
        </p>

        <div className="flex w-full shrink-0 items-center justify-center gap-3 sm:w-auto sm:justify-end">
          <button
            type="button"
            id="cookie-banner-decline"
            onClick={decline}
            className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 sm:flex-initial"
          >
            Decline
          </button>
          <button
            type="button"
            id="cookie-banner-accept"
            onClick={accept}
            className="flex-1 cursor-pointer rounded-xl bg-[#E62E52] px-5 py-2 text-sm font-bold text-white shadow-sm shadow-[#E62E52]/20 transition hover:bg-[#d42b4b] active:scale-95 sm:flex-initial"
          >
            Accept
          </button>
        </div>
      </div>
    </aside>
  );
};

export default CookieConsentBanner;
