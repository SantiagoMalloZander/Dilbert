"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Wraps an async handler so it can't run twice concurrently — fixes
 * double-click / double-submit (e.g. "Crear lead" creating two leads).
 *
 * The `useRef` flag blocks a second invocation synchronously, before React has
 * a chance to re-render the disabled state, so even a very fast double-click is
 * ignored. The returned `pending` boolean drives the visual disabled/spinner.
 */
export function useSubmitGuard<A extends unknown[]>(
  fn: (...args: A) => unknown | Promise<unknown>
): [(...args: A) => Promise<void>, boolean] {
  const running = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (...args: A) => {
      if (running.current) return; // ignore reentrant calls
      running.current = true;
      setPending(true);
      try {
        await fn(...args);
      } finally {
        running.current = false;
        setPending(false);
      }
    },
    [fn]
  );

  return [run, pending];
}
