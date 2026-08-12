import { useEffect } from 'react';

/** 파트 D 소유 — 박진. 마우스를 따라가는 붉은 파티클 트레일. 50ms 쓰로틀, reduced-motion 사용자는 끈다. */
export function ParticleTrail() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let lastTime = 0;
    const onMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastTime < 50) return;
      lastTime = now;

      const particle = document.createElement('div');
      particle.className = 'zt-particle';
      particle.style.left = `${e.clientX}px`;
      particle.style.top = `${e.clientY}px`;
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 800);
    };

    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  return null;
}
