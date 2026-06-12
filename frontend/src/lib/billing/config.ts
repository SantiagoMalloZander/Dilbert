/**
 * Billing config. One simple plan: USD 15 per active vendor / month (Stripe),
 * or the ARS equivalent for Mercado Pago. Seats = vendor_limit of the company.
 */

export const PRICE_PER_SEAT_USD_CENTS = 1500; // USD 15.00
export const MIN_SEATS = 1;
export const MAX_SEATS = 50;

/** ARS price per seat for Mercado Pago (USD can't be charged locally in AR). */
export function mpPricePerSeatArs(): number {
  const v = Number(process.env.MP_PRICE_PER_SEAT_ARS);
  return Number.isFinite(v) && v > 0 ? v : 18000;
}

/** Subscription states that grant access to the app. */
export const ACTIVE_STATUSES = ["active", "trialing"];

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://dilvert.netlify.app").replace(/\/$/, "");
}

export function clampSeats(seats: number): number {
  if (!Number.isFinite(seats)) return MIN_SEATS;
  return Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.floor(seats)));
}
