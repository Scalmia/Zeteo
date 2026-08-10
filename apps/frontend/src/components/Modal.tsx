import type { ReactNode } from 'react';
import { Timer } from './Timer';

/** 페이즈 팝업의 공통 껍데기 — 메인화면 위에 얹힌다.
 *
 *  스크림이 뒤를 덮어 투표 패널 클릭까지 막는다. 채팅 입력 잠금은 MainScreen 이
 *  blocked prop 으로 따로 처리한다 — 서버 index.ts 의 chat 핸들러에는 phase 검사가
 *  없어서(describe·vote·lifeVote·guessWord 와 달리) 화면이 막지 않으면 그대로
 *  전송된다. 그래서 두 겹으로 막는다.
 *
 *  ⚠️ 이 컴포넌트에 phase 로 key 를 주지 말 것. reveal → guessWord 는 한 흐름이라
 *  (설계 결정 5 "쪼개면 전환이 끊겨 보인다") 껍데기는 마운트된 채로 안쪽 내용만
 *  바뀌어야 한다. */
export function Modal({
  title,
  deadlineAt,
  children,
}: {
  title: string;
  /** 타이머 없는 페이즈는 null — Timer 가 알아서 영역을 숨긴다 */
  deadlineAt: number | null;
  children: ReactNode;
}) {
  return (
    <div className="zt-modal-scrim">
      <div className="zt-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="zt-modal-head">
          <span className="zt-sub">{title}</span>
          <Timer deadlineAt={deadlineAt} />
        </div>
        {children}
      </div>
    </div>
  );
}
