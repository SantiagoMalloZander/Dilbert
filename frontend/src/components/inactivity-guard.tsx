"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import {
  clearSessionTrackingCookies,
  getLastActivity,
  writeLastActivity,
} from "@/lib/workspace-activity";

const MAX_IDLE_MS = 30 * 60 * 1000;
const SYNC_INTERVAL_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
const SIGN_OUT_CALLBACK_URL = "/app/";

export function InactivityGuard() {
  useEffect(() => {
    let lastSync = 0;

    const syncActivity = () => {
      const now = Date.now();
      if (now - lastSync < SYNC_INTERVAL_MS) {
        return;
      }

      lastSync = now;
      writeLastActivity(now);
    };

    const handleIdleSession = async () => {
      const lastActivity = getLastActivity();
      if (!lastActivity) {
        syncActivity();
        return;
      }

      if (Date.now() - lastActivity > MAX_IDLE_MS) {
        clearSessionTrackingCookies();
        await signOut({ callbackUrl: SIGN_OUT_CALLBACK_URL });
      }
    };

    const events = ["click", "keydown", "scroll", "pointerdown", "touchstart"];
    events.forEach((eventName) => {
      window.addEventListener(eventName, syncActivity, { passive: true });
    });

    syncActivity();

    const interval = window.setInterval(handleIdleSession, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, syncActivity);
      });
    };
  }, []);

  return null;
}
