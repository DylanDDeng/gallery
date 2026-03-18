export type CreditPackageCatalogItem = {
  id: "small" | "medium" | "large" | "pro";
  credits: number;
  priceLabel: string;
  priceCents: number;
};

export const CREDIT_PACKAGE_CATALOG: readonly CreditPackageCatalogItem[] = [
  {
    id: "small",
    credits: 100,
    priceLabel: "$0.99",
    priceCents: 99,
  },
  {
    id: "medium",
    credits: 500,
    priceLabel: "$3.99",
    priceCents: 399,
  },
  {
    id: "large",
    credits: 1000,
    priceLabel: "$6.99",
    priceCents: 699,
  },
  {
    id: "pro",
    credits: 2500,
    priceLabel: "$14.99",
    priceCents: 1499,
  },
] as const;

const PRICE_ID_BY_PACKAGE = {
  small: process.env.PADDLE_PRICE_SMALL || "",
  medium: process.env.PADDLE_PRICE_MEDIUM || "",
  large: process.env.PADDLE_PRICE_LARGE || "",
  pro: process.env.PADDLE_PRICE_PRO || "",
} as const;

export type CreditPackage = CreditPackageCatalogItem & {
  priceId: string;
};

export const CREDIT_PACKAGES: readonly CreditPackage[] = CREDIT_PACKAGE_CATALOG.map(
  (pkg) => ({
    ...pkg,
    priceId: PRICE_ID_BY_PACKAGE[pkg.id],
  })
);

export type CreditPackageId = CreditPackage["id"];

export function getPackageById(id: string) {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === id);
}

export function getPackageByPriceId(priceId: string) {
  return CREDIT_PACKAGES.find((pkg) => pkg.priceId === priceId);
}
