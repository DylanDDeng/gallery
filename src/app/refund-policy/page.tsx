import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing-feature";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Refund Policy — Aestara",
  description: "Refund policy for Aestara credit purchases.",
};

export default function RefundPolicyPage() {
  if (!isBillingEnabled()) {
    notFound();
  }

  return (
    <LegalPageShell
      title="Refund Policy"
      description="This page explains when Aestara credit purchases may be refunded and how to request support."
      updatedAt="March 18, 2026"
    >
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
          Eligibility
        </h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
          <p>
            Refund requests may be submitted within 7 days of the original purchase date.
          </p>
          <p>
            We generally support refunds for accidental purchases, duplicate charges, or
            credit packages that remain materially unused.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
          Limits
        </h2>
        <ul className="space-y-3 text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
          <li>Credits that have already been substantially consumed may not be refundable.</li>
          <li>Refunds may be denied where fraud, abuse, or payment disputes are suspected.</li>
          <li>
            Payment processor requirements, card network rules, and tax obligations may
            affect whether a refund can be issued.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
          How to Request a Refund
        </h2>
        <p className="text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
          Email{" "}
          <a
            href="mailto:chengshengdeng@gmail.com"
            className="underline decoration-[#a39b90] underline-offset-2 hover:decoration-[#5c564e] dark:decoration-[#4a443c]"
          >
            chengshengdeng@gmail.com
          </a>{" "}
          with your account email, purchase date, and the reason for the request. We will
          review the request and respond as quickly as practical.
        </p>
      </section>
    </LegalPageShell>
  );
}
