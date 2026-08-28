'use client';

import { useEffect } from 'react';

/** Registreert de service worker zodat de app te installeren is. */
export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Geen service worker is geen ramp: de app werkt gewoon online.
    });
  }, []);
  return null;
}
