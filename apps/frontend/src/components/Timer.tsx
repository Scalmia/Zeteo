import { useEffect, useState } from 'react';

/**
 * 남은 시간 표시 전용. 마감 판정은 서버가 한다.
 *
 * ⚠️ 반드시 deadlineAt - Date.now() 를 매 틱 "새로" 계산한다.
 *    remaining-- 누적 방식으로 짜면 탭이 백그라운드로 갔을 때 setInterval이
 *    throttle 되어 시간이 밀리고, Day 4 검증(4탭 1초 이내 일치)에서 확정적으로 실패한다.
 */
export function Timer({ deadlineAt }: { deadlineAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadlineAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadlineAt]);

  if (deadlineAt === null) return null; // 타이머 없는 페이즈는 영역 자체를 숨긴다

  const sec = Math.max(0, Math.ceil((deadlineAt - now) / 1000));
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');

  return (
    <span className="zt-timer" aria-label="남은 시간">
      {mm}:{ss}
    </span>
  );
}
