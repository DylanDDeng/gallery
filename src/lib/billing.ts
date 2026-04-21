import { getPaymentProvider, type PaymentProvider } from "@/lib/payment-provider";

export type CreditPackageCatalogItem = {
  id: "small" | "medium" | "large";
  credits: number;
  priceLabel: string;
  priceCents: number;
};

export const CREDIT_PACKAGE_CATALOG: readonly CreditPackageCatalogItem[] = [
  {
    id: "small",
    credits: 1200,
    priceLabel: "$10",
    priceCents: 1000,
  },
  {
    id: "medium",
    credits: 4800,
    priceLabel: "$30",
    priceCents: 3000,
  },
  {
    id: "large",
    credits: 8400,
    priceLabel: "$50",
    priceCents: 5000,
  },
] as const;

const PRICE_ID_BY_PROVIDER = {
  paddle: {
    small: process.env.PADDLE_PRICE_SMALL || "",
    medium: process.env.PADDLE_PRICE_MEDIUM || "",
    large: process.env.PADDLE_PRICE_LARGE || "",
  },
  stripe: {
    small: process.env.STRIPE_PRICE_SMALL || "",
    medium: process.env.STRIPE_PRICE_MEDIUM || "",
    large: process.env.STRIPE_PRICE_LARGE || "",
  },
} as const;

export type CreditPackage = CreditPackageCatalogItem & {
  priceId: string;
};

export type CreditPackageId = CreditPackage["id"];

export function getCreditPackages(
  provider: PaymentProvider = getPaymentProvider()
): readonly CreditPackage[] {
  return CREDIT_PACKAGE_CATALOG.map((pkg) => ({
    ...pkg,
    priceId: PRICE_ID_BY_PROVIDER[provider][pkg.id],
  }));
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = getCreditPackages();

export function getPackageById(
  id: string,
  provider: PaymentProvider = getPaymentProvider()
) {
  return getCreditPackages(provider).find((pkg) => pkg.id === id);
}

export function getPackageByPriceId(
  priceId: string,
  provider: PaymentProvider = getPaymentProvider()
) {
  return getCreditPackages(provider).find((pkg) => pkg.priceId === priceId);
}
