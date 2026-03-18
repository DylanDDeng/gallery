export type PaymentProvider = "stripe" | "paddle";

export function getPaymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === "paddle" ? "paddle" : "stripe";
}

export function isStripeProvider(provider = getPaymentProvider()) {
  return provider === "stripe";
}

export function isPaddleProvider(provider = getPaymentProvider()) {
  return provider === "paddle";
}
