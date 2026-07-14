"use client";

import { useEffect } from "react";

/** Registreert de service worker (push + installeerbaarheid). */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
