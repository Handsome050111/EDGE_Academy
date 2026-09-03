import SitePageLayout from '../components/SitePageLayout';
import { termsContent } from '../data/termsContent';

const TermsPage = () => {
  return (
    <SitePageLayout>
      <div className="mx-auto max-w-4xl px-6 py-16 md:px-10">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            General Terms and Conditions of Business
          </h1>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80 md:p-10">
          {termsContent.map((section) => {
            if (section.type === 'paragraph') {
              return (
                <p key={section.id} className="mb-6 text-base leading-7 text-slate-700">
                  {section.text}
                </p>
              );
            }

            return (
              <section key={section.id} className="mb-8 last:mb-0">
                <h2 className="mb-4 text-xl font-semibold text-slate-900 md:text-2xl">
                  {section.heading}
                </h2>

                {section.paragraphs && (
                  <div className="space-y-4 text-base leading-7 text-slate-700">
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={`${section.id}-paragraph-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </SitePageLayout>
  );
};

export default TermsPage;
