'use client';

import { useEffect } from 'react';

/**
 * Page-load motion for /landing, all driven by CSS + a tiny IntersectionObserver:
 * - reveal sections as they enter the viewport (once)
 * - count the hero stats up on load
 * - respect prefers-reduced-motion by skipping everything
 * No animation library: plain CSS transitions keep the page dependency-free.
 */
export function LandingAnimations() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reveals = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const counters = document.querySelectorAll<HTMLElement>('[data-count]');
    const bars = document.querySelectorAll<HTMLElement>('[data-animate]');

    if (reduced) {
      reveals.forEach((el) => el.classList.add('is-revealed'));
      counters.forEach((el) => {
        el.textContent = el.dataset.count ?? '';
      });
      bars.forEach((el) => el.classList.add('is-set'));
      return;
    }

    // Reveal once, when 12% of the section is visible.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    reveals.forEach((el) => io.observe(el));

    // Hero numbers count up from zero on mount.
    counters.forEach((el) => {
      const target = Number(el.dataset.count ?? '0');
      const start = performance.now();
      const duration = 1400;
      const latin = (n: number) => n.toLocaleString('en-US');
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = latin(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    return () => io.disconnect();
  }, []);

  return null;
}
