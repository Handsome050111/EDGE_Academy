import SitePageLayout from '../components/SitePageLayout';
import { privacyPolicyContent } from '../data/privacyPolicyContent';

const PrivacyPolicyPage = () => {
  return (
    <SitePageLayout>
      <div className="mx-auto max-w-4xl px-6 py-16 md:px-10">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Privacy Policy</h1>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80 md:p-10">
          {privacyPolicyContent.map((section) => {
            if (section.type === 'paragraph') {
              return (
                <p key={section.id} className="mb-6 text-base leading-7 text-slate-700">
                  {section.text}
                </p>
              );
            }

            return (
              <section key={section.id} className="mb-8 last:mb-0">
                <h2 className="mb-4 text-xl font-semibold text-slate-900 md:text-2xl">{section.heading}</h2>

                {section.blocks && (
                  <div className="space-y-1 text-base leading-7 text-slate-700">
                    {section.blocks.map((line, index) => (
                      <p key={`${section.id}-block-${index}`}>{line}</p>
                    ))}
                  </div>
                )}

                {section.items && (
                  <dl className="space-y-3 text-base leading-7 text-slate-700">
                    {section.items.map((item) => (
                      <div key={`${section.id}-${item.label}`} className="flex flex-col gap-1 md:flex-row md:gap-3">
                        <dt className="min-w-[120px] font-medium text-slate-900">{item.label}:</dt>
                        <dd>
                          {item.href ? (
                            <a href={item.href} className="text-[#E62E52] underline underline-offset-4 hover:text-[#d42b4b]" target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noreferrer' : undefined}>
                              {item.value}
                            </a>
                          ) : (
                            item.value
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {section.paragraphs && (
                  <div className="space-y-4 text-base leading-7 text-slate-700">
                    {section.paragraphs.map((paragraph, index) => (
                      <div key={`${section.id}-paragraph-${index}`}>
                        {typeof paragraph === 'string' ? (
                          <p>{paragraph}</p>
                        ) : (
                          paragraph
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {section.customLink && (
                  <p className="mt-2 text-base leading-7 text-slate-700">
                    <a href={section.customLink.href} className="text-[#E62E52] underline underline-offset-4 hover:text-[#d42b4b]">
                      {section.customLink.text}
                    </a>
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </SitePageLayout>
  );
};

export default PrivacyPolicyPage;
