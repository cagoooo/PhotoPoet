"use client";

import {useEffect} from 'react';

/**
 * Register the static SW (public/sw.js).
 *
 * Both Firebase Hosting (root /) and GitHub Pages (/PhotoPoet) work because
 * we resolve the URL relative to the page itself, not to a hard-coded path.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const swUrl = `${basePath}/sw.js`;
    const scope = `${basePath}/`;

    navigator.serviceWorker
      .register(swUrl, {scope})
      .catch((err) => console.warn('[sw] register failed:', err));
  }, []);

  return null;
}
