import { useEffect, useState } from "react";

/** 우상단 고정 전체화면 버튼 — 헤더가 없는 화면(랜딩·대기실·결과·설문)에서 쓴다.
 *  로직은 screens/MainScreen.tsx의 전체화면 버튼과 동일 — document.fullscreenEnabled로
 *  지원 여부를 확인해, iOS Safari처럼 non-video Fullscreen API를 지원하지 않는
 *  브라우저에서는 버튼 자체를 렌더링하지 않는다(2026-08-20 확인: 별도 우회 라이브러리는
 *  있으나 iOS Safari가 실제로 지원하게 된 건 아님). position:fixed라 부모 레이아웃과
 *  무관하게 항상 뷰포트 우상단에 고정된다. */
export default function FullscreenButton() {
  const fullscreenSupported = typeof document !== "undefined" && document.fullscreenEnabled;
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement
  );
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!fullscreenSupported) return;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [fullscreenSupported]);

  if (!fullscreenSupported) return null;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
      title={isFullscreen ? "전체화면 종료" : "전체화면"}
      style={{
        position: "fixed",
        top: "var(--space-4)",
        right: "var(--space-4)",
        zIndex: 10,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        padding: 0,
        color: "var(--color-text)",
        background: "transparent",
        border: `1px solid ${hovered ? "var(--color-accent)" : "var(--color-line)"}`,
        borderRadius: "var(--radius)",
        cursor: "pointer"
      }}
    >
      {isFullscreen ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}
    </button>
  );
}
