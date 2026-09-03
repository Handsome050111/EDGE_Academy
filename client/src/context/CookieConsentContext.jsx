import { createContext, useContext, useMemo, useState } from 'react';

export const COOKIE_CONSENT_STORAGE_KEY = 'nexacademy-cookie-consent';

const readStoredConsent = () => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (stored === 'accepted' || stored === 'declined') {
      return stored;
    }

    // Clean up & migrate legacy per-category JSON key if present
    const legacy = window.localStorage.getItem('nexacademy-cookie-preferences');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        const migrated =
          parsed?.functionality || parsed?.userExperience || parsed?.measurement
            ? 'accepted'
            : 'declined';
        window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, migrated);
        window.localStorage.removeItem('nexacademy-cookie-preferences');
        return migrated;
      } catch {
        window.localStorage.removeItem('nexacademy-cookie-preferences');
      }
    }

    return null;
  } catch {
    return null;
  }
};

const CookieConsentContext = createContext(null);

export const CookieConsentProvider = ({ children }) => {
  const [consent, setConsent] = useState(() => readStoredConsent());
  const [showBanner, setShowBanner] = useState(() => !readStoredConsent());

  const accept = () => {
    setConsent('accepted');
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'accepted');
      window.localStorage.removeItem('nexacademy-cookie-preferences');
    }
  };

  const decline = () => {
    setConsent('declined');
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'declined');
      window.localStorage.removeItem('nexacademy-cookie-preferences');
    }
  };

  const reopenBanner = () => {
    setShowBanner(true);
  };

  const value = useMemo(
    () => ({
      consent,
      hasStoredConsent: consent !== null,
      isAccepted: consent === 'accepted',
      isDeclined: consent === 'declined',
      showBanner,
      setShowBanner,
      accept,
      decline,
      reopenBanner,
      // Backward-compatibility alias
      openPreferences: reopenBanner,
    }),
    [consent, showBanner]
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
};

export const useCookieConsent = () => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used inside a CookieConsentProvider');
  }
  return context;
};
