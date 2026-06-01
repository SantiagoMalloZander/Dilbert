"use client";

import { useEffect, useState } from "react";
import { getBlueDollarRate } from "@/lib/fx";

let cached: { value: number | null; at: number } | null = null;
const CLIENT_TTL_MS = 30 * 60_000;

/**
 * Returns the current dólar blue rate (or null while loading / unavailable).
 * Shared in-memory cache across mounts so we don't fetch on every render.
 */
export function useBlueRate(): number | null {
  const fresh = cached && Date.now() - cached.at < CLIENT_TTL_MS;
  const [rate, setRate] = useState<number | null>(fresh ? cached!.value : null);

  useEffect(() => {
    if (cached && Date.now() - cached.at < CLIENT_TTL_MS) {
      setRate(cached.value);
      return;
    }
    let cancelled = false;
    getBlueDollarRate().then((v) => {
      cached = { value: v, at: Date.now() };
      if (!cancelled) setRate(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return rate;
}
