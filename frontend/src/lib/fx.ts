"use server";

/**
 * Argentine "dólar blue" rate, cached in-memory 30 minutes.
 *
 * Source: https://dolarapi.com/v1/dolares/blue (no auth, returns
 * { compra, venta, fechaActualizacion, nombre }). We use `venta`, the rate the
 * agency would use to convert ARS prices into the buyer's USD reference.
 *
 * Callable directly from client components — Next treats this as a server
 * action thanks to the `"use server"` directive at the top of the file.
 */

let cache: { value: number; expiresAt: number } | null = null;
const TTL_MS = 30 * 60_000;

async function fetchBlueRate(): Promise<number | null> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { compra?: number; venta?: number };
    const value = Number(data.venta) || Number(data.compra);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function getBlueDollarRate(): Promise<number | null> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  const v = await fetchBlueRate();
  if (v) cache = { value: v, expiresAt: now + TTL_MS };
  return v ?? cache?.value ?? null;
}
