import { Link } from 'react-router-dom';
import SitePageLayout from '../components/SitePageLayout';
import { useCookieConsent } from '../context/CookieConsentContext';
import { cookiePolicyContent } from '../data/cookiePolicyContent';

const CookiesPage = () => {
  const { openPreferences } = useCookieConsent();

  return (
    <SitePageLayout>
      <div className="mx-auto max-w-4xl px-6 py-16 md:px-10">
        {/* Page Header matching Privacy Policy */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Cookie Policy</h1>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80 md:p-10">
          {/* Action Bar */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <button
              type="button"
              id="manage-cookie-preferences-btn"
              onClick={openPreferences}
              className="rounded-2xl bg-[#E62E52] px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#E62E52]/20 hover:bg-[#d42b4b] transition active:scale-95 cursor-pointer"
            >
              Manage Cookie Preferences
            </button>

            <Link
              to="/privacy-policy"
              className="text-sm font-semibold text-[#E62E52] underline underline-offset-4 hover:text-[#d42b4b] transition"
            >
              See also: Privacy Policy
            </Link>
          </div>


          {/* Structured Policy Content matching Privacy Policy styling */}
          <div className="space-y-8 text-base leading-7 text-slate-700">
            {cookiePolicyContent.map((section) => {
              if (section.type === 'paragraph') {
                if (section.customLink) {
                  return (
                    <p key={section.id} className="text-base leading-7 text-slate-700">
                      <Link
                        to={section.customLink.href}
                        className="font-medium text-[#E62E52] underline underline-offset-4 hover:text-[#d42b4b]"
                      >
                        {section.customLink.text}
                      </Link>
                    </p>
                  );
                }
                return (
                  <p key={section.id} className="text-base leading-7 text-slate-700">
                    {section.text}
                  </p>
                );
              }

              return (
                <section key={section.id} className="space-y-3 pt-2">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{section.heading}</h2>

                  {section.paragraphs?.map((paragraph, index) => (
                    <p key={`${section.id}-p-${index}`} className="text-slate-700 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}

                  {section.browserText && (
                    <p className="text-slate-700 leading-relaxed">{section.browserText}</p>
                  )}

                  {section.blocks && (
                    <div className="space-y-1 text-base leading-7 text-slate-700">
                      {section.blocks.map((line, index) => (
                        <p key={`${section.id}-block-${index}`}>{line}</p>
                      ))}
                    </div>
                  )}

                  {section.items && (
                    <div className="my-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <dl className="space-y-2 text-sm text-slate-700">
                        {section.items.map((item) => (
                          <div key={`${section.id}-${item.label}`} className="flex flex-col sm:flex-row sm:gap-4">
                            <dt className="min-w-[130px] font-semibold text-slate-900">{item.label}:</dt>
                            <dd className="text-slate-700">
                              {item.href ? (
                                item.href.startsWith('/') ? (
                                  <Link
                                    to={item.href}
                                    className="font-medium text-[#E62E52] underline underline-offset-4 hover:text-[#d42b4b]"
                                  >
                                    {item.value}
                                  </Link>
                                ) : (
                                  <a
                                    href={item.href}
                                    className="font-medium text-[#E62E52] underline underline-offset-4 hover:text-[#d42b4b]"
                                    target={item.href.startsWith('http') ? '_blank' : undefined}
                                    rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                                  >
                                    {item.value}
                                  </a>
                                )
                              ) : (
                                item.value
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </SitePageLayout>
  );
};

export default CookiesPage;
