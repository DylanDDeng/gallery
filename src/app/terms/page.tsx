import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service — Aestara",
  description: "Terms of service for Aestara's AI image generation platform.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description="These terms govern your use of Aestara, including account access, credit purchases, acceptable use, and refunds."
      updatedAt="March 18, 2026"
    >
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          1. Service Overview
        </h2>
        <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Aestara provides an online AI image generation service. Users can create an
          account, purchase credits, submit prompts, and generate images through the
          platform. By accessing or using Aestara, you agree to these terms.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          2. Accounts and Eligibility
        </h2>
        <ul className="space-y-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          <li>You must provide accurate account information and keep it up to date.</li>
          <li>You are responsible for activity that occurs under your account.</li>
          <li>
            We may suspend or terminate access where use of the service creates legal,
            security, payment, or abuse risk.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          3. Credits, Pricing, and Billing
        </h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>
            Aestara sells one-time credit packages. Credits are consumed when you submit
            generation requests. Unless otherwise stated on the pricing page, one image
            generation consumes one credit.
          </p>
          <p>
            Prices are shown before purchase. Payments are processed by our
            third-party checkout provider. Depending on the active integration, this may
            include checkout, payment processing, invoicing, and related billing
            operations.
          </p>
          <p>
            Purchased credits do not expire under the current product model. We may change
            package sizes or prices prospectively at any time.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          4. Refund Policy
        </h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>
            You may request a refund within 7 days of purchase by contacting{" "}
            <a
              href="mailto:chengshengdeng@gmail.com"
              className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:decoration-zinc-600"
            >
              chengshengdeng@gmail.com
            </a>
            .
          </p>
          <p>
            We generally approve refunds for accidental purchases, duplicate purchases, or
            materially unused credits. Refund decisions may be limited where credits have
            already been substantially consumed, fraud is suspected, or the request would
            violate payment processor rules.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          5. Acceptable Use
        </h2>
        <ul className="space-y-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          <li>
            You may not use Aestara for unlawful, deceptive, abusive, infringing, or
            harmful activity.
          </li>
          <li>
            You may not use the service to generate or distribute non-consensual intimate
            content, deepfakes, face swaps, or content that impersonates a real person
            without permission.
          </li>
          <li>
            You may not submit prompts or create outputs that infringe another party&apos;s
            intellectual property or privacy rights.
          </li>
          <li>
            We may block prompts, remove content, or suspend accounts to comply with law,
            payment provider requirements, or platform safety policies.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          6. Generated Content
        </h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>
            AI systems can produce inaccurate, unexpected, or similar outputs. You are
            responsible for reviewing generated images before using, publishing, or selling
            them.
          </p>
          <p>
            We do not guarantee that outputs will be unique, error-free, suitable for a
            specific purpose, or free from third-party claims.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          7. Availability and Changes
        </h2>
        <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          We may update, improve, suspend, or discontinue parts of the service at any
          time. We are not liable for downtime, model changes, or third-party outages that
          affect availability.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          8. Contact
        </h2>
        <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Questions about these terms can be sent to{" "}
          <a
            href="mailto:chengshengdeng@gmail.com"
            className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:decoration-zinc-600"
          >
            chengshengdeng@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
