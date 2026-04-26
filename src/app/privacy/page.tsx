import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Aestara",
  description: "Privacy policy for Aestara's AI image generation service.",
};

export default function PrivacyPolicy() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description="This policy explains what information Aestara collects, how it is used, and which third parties help operate the service."
      updatedAt="March 18, 2026"
    >
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              Overview
            </h2>
            <p className="leading-relaxed text-[15px] text-[#4a443c] dark:text-[#8a837a]">
              Aestara is an AI image generation service that lets users create accounts,
              purchase credits, submit prompts, and generate images. We are committed
              to protecting your privacy and being transparent about how we handle your
              data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              Information We Collect
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              <p>
                We collect minimal information to provide and improve our service:
              </p>
              <ul className="list-none space-y-3">
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                  <div>
                    <strong className="text-[#1a1814] dark:text-[#d5cfc4]">Google Account Information</strong>
                    <p className="mt-0.5">
                      When you sign in with Google, we receive your name, email address,
                      and profile picture from your Google account. This is used for
                      authentication, account access, and personalizing your experience.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                  <div>
                    <strong className="text-[#1a1814] dark:text-[#d5cfc4]">Prompts and Generated Images</strong>
                    <p className="mt-0.5">
                      We store prompts you submit, generation job data, and generated
                      image results so that the service can deliver outputs, maintain job
                      history, and support refunds or troubleshooting.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                  <div>
                    <strong className="text-[#1a1814] dark:text-[#d5cfc4]">Orders and Credit Balances</strong>
                    <p className="mt-0.5">
                      We store purchase history, credit balances, and order metadata so we
                      can fulfill purchases and maintain account balances.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                  <div>
                    <strong className="text-[#1a1814] dark:text-[#d5cfc4]">Theme Preference</strong>
                    <p className="mt-0.5">
                      We store your light/dark mode preference locally in your browser.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              How We Use Your Information
            </h2>
            <ul className="space-y-3 text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                Authenticate your account and provide personalized features
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                Save and sync your favorites across devices
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                Process credit purchases, support refunds, and maintain your account balance
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                Maintain and improve the service
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              Third-Party Services
            </h2>
            <p className="text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              We use the following third-party services:
            </p>
            <div className="mt-4 space-y-3">
              {[
                { name: "Google", desc: "For user authentication via Google OAuth." },
                { name: "Supabase", desc: "For database, authentication, and data storage." },
                { name: "Checkout Provider", desc: "For payment processing, billing, and related transaction handling." },
                { name: "Vercel", desc: "For website hosting and content delivery." },
                { name: "Umami", desc: "For privacy-focused website analytics." },
              ].map((s) => (
                <div
                  key={s.name}
                  className="rounded-xl border border-[#e0d9ce] dark:border-[#1a1814] bg-[#ebe7e0]/50 dark:bg-[#141210]/50 px-4 py-3"
                >
                  <p className="text-sm font-medium text-[#1a1814] dark:text-[#d5cfc4]">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#5c564e] dark:text-[#8a837a]">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              Data Storage & Security
            </h2>
            <p className="text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              Your data is stored securely in Supabase with row-level security (RLS)
              policies helping ensure that personal account data is only accessible to
              the appropriate user and service roles. We do not sell your personal data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              Your Rights
            </h2>
            <ul className="space-y-3 text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                <span><strong className="text-[#1a1814] dark:text-[#d5cfc4]">Access &amp; Delete</strong> — You can view or delete your account and all associated data at any time by signing in and using the sign-out feature, then contacting us to permanently delete your data.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a39b90] dark:bg-[#4a443c]" />
                <span><strong className="text-[#1a1814] dark:text-[#d5cfc4]">Data Portability</strong> — You own your data. Contact us if you need an export of your information.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              Cookies
            </h2>
            <p className="text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              We use cookies and local storage for essential functionality such as
              maintaining your authentication session and theme preference. We may also
              use privacy-focused analytics tools to understand site performance and
              product usage at an aggregate level.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              Changes to This Policy
            </h2>
            <p className="text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              We may update this privacy policy from time to time. Any changes will be
              reflected on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
              Contact
            </h2>
            <p className="text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              If you have any questions about this privacy policy, feel free to reach out
              at{" "}
              <a
                href="mailto:chengshengdeng@gmail.com"
                className="text-[#141210] dark:text-[#e0d9ce] underline decoration-[#a39b90] underline-offset-2 hover:decoration-[#5c564e] dark:decoration-[#4a443c]"
              >
                chengshengdeng@gmail.com
              </a>
              .
            </p>
          </section>
    </LegalPageShell>
  );
}
