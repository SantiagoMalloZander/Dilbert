/**
 * Money formatting helpers — kept in one place so all CRM screens agree on
 * the AR-formatted display and how the USD equivalent (via the blue rate) is
 * appended.
 */

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "—";
  const cur = (currency || "ARS").toUpperCase();
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-AR")} ${cur}`;
  }
}

/**
 * When `amount` is in ARS, returns the USD equivalent at the blue rate.
 * Returns null for USD amounts (no conversion needed) or when rate is missing.
 */
export function usdEquivalent(
  amount: number | null | undefined,
  currency: string | null | undefined,
  rate: number | null
): string | null {
  if (amount == null || !rate) return null;
  if ((currency || "ARS").toUpperCase() !== "ARS") return null;
  const usd = amount / rate;
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(usd);
}
