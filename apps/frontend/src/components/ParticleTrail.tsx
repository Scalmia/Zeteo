import { useEffect } from 'react';

/** 파트 D 소유 — 박진. 마우스를 따라가는 붉은 파티클 트레일. 50ms 쓰로틀, reduced-motion 사용자는 끈다. */
export function ParticleTrail() {
  useEffect(() => {

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
      // 800 은 ambience.css의 @keyframes zt-particle-fade 0.8s 와 짝이 맞아야 하는
      // 값이다 — 애니메이션이 끝나기 전에 지우면 파티클이 눈에 띄게 뚝 끊겨 사라진다.
      setTimeout(() => particle.remove(), 800);
    };

    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  return null;
}
