import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Aestara",
  description: "Privacy policy for Aestara AI Image Gallery.",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center px-6 py-3">
          <a href="/" className="flex items-center gap-2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Aestara
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-12">
          <h1
            className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-zinc-400">Last updated: March 15, 2026</p>
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Overview
            </h2>
            <p className="leading-relaxed text-[15px] text-zinc-600 dark:text-zinc-400">
              Aestara is an AI-generated image gallery that showcases curated artwork
              along with their prompts, tags, and generation details. We are committed
              to protecting your privacy and being transparent about how we handle your
              data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Information We Collect
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              <p>
                We collect minimal information to provide and improve our service:
              </p>
              <ul className="list-none space-y-3">
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <div>
                    <strong className="text-zinc-800 dark:text-zinc-200">Google Account Information</strong>
                    <p className="mt-0.5">
                      When you sign in with Google, we receive your name, email address,
                      and profile picture from your Google account. This is used solely for
                      authentication and personalizing your experience.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <div>
                    <strong className="text-zinc-800 dark:text-zinc-200">Favorites</strong>
                    <p className="mt-0.5">
                      We store which images you have favorited. This data is linked to your
                      account and is only visible to you.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <div>
                    <strong className="text-zinc-800 dark:text-zinc-200">Theme Preference</strong>
                    <p className="mt-0.5">
                      We store your light/dark mode preference locally in your browser.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              How We Use Your Information
            </h2>
            <ul className="space-y-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                Authenticate your account and provide personalized features
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                Save and sync your favorites across devices
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                Maintain and improve the service
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Third-Party Services
            </h2>
            <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              We use the following third-party services:
            </p>
            <div className="mt-4 space-y-3">
              {[
                { name: "Google", desc: "For user authentication via Google OAuth." },
                { name: "Supabase", desc: "For database, authentication, and data storage." },
                { name: "Vercel", desc: "For website hosting and content delivery." },
              ].map((s) => (
                <div
                  key={s.name}
                  className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-4 py-3"
                >
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Data Storage & Security
            </h2>
            <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Your data is stored securely in Supabase with row-level security (RLS)
              policies ensuring that your personal information and favorites are only
              accessible to you. We do not share, sell, or transfer your personal data
              to any third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Your Rights
            </h2>
            <ul className="space-y-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                <span><strong className="text-zinc-800 dark:text-zinc-200">Access &amp; Delete</strong> — You can view or delete your account and all associated data at any time by signing in and using the sign-out feature, then contacting us to permanently delete your data.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                <span><strong className="text-zinc-800 dark:text-zinc-200">Data Portability</strong> — You own your data. Contact us if you need an export of your information.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Cookies
            </h2>
            <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              We use cookies only for essential functionality — maintaining your
              authentication session and theme preference. We do not use tracking cookies
              or third-party analytics.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Changes to This Policy
            </h2>
            <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              We may update this privacy policy from time to time. Any changes will be
              reflected on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Contact
            </h2>
            <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              If you have any questions about this privacy policy, feel free to reach out
              at{" "}
              <a
                href="mailto:chengshengdeng@gmail.com"
                className="text-zinc-900 dark:text-zinc-100 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:decoration-zinc-600"
              >
                chengshengdeng@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-zinc-200 dark:border-zinc-800 pt-8 text-center text-xs text-zinc-400">
          Aestara
        </div>
      </main>
    </div>
  );
}
