/**
 * Tipo de cambio "dólar tarjeta" para cobrar en ARS por Mercado Pago.
 * El precio está en USD (US$15/vendedor); cuando se cobra por Mercado Pago se
 * convierte a pesos al valor del dólar tarjeta del día.
 */

const DOLAR_TARJETA_API = "https://dolarapi.com/v1/dolares/tarjeta";

/** ARS por 1 USD al dólar tarjeta. Cachea 1h; si la API falla, usa un fallback. */
export async function getDolarTarjeta(): Promise<number> {
  try {
    const res = await fetch(DOLAR_TARJETA_API, {
      signal: AbortSignal.timeout(6000),
      // Cache de Next: no pegamos a la API en cada request.
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { venta?: number; compra?: number };
      const value = Number(data?.venta ?? data?.compra);
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch {
    // sin red / timeout → fallback
  }
  const fallback = Number(process.env.DOLAR_TARJETA_ARS);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 1600;
}

/** Monto en ARS (entero) para una cantidad de USD, al dólar tarjeta. */
export function usdToArs(usd: number, rate: number): number {
  return Math.round(usd * rate);
}
